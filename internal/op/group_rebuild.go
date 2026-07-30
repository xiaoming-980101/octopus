package op

import (
	"context"
	"regexp"
	"strings"

	"github.com/bestruirui/octopus/internal/db"
	"github.com/bestruirui/octopus/internal/model"
	"gorm.io/gorm"
)

// normalizeModelName 根据 Options 规范化模型名，返回 (groupName, matchRegex)
//
// 当 StripProviderPrefix=true 时：
//
//	"z-ai/glm-5.2"  → groupName="glm-5.2", matchRegex="^(z-ai/)?glm-5\.2$"
//	"glm-5.2"       → groupName="glm-5.2", matchRegex=""  (无前缀，无需 regex)
func normalizeModelName(raw string, opts model.GroupAutoRebuildOptions) (groupName, matchRegex string) {
	groupName = raw
	matchRegex = ""

	if !opts.StripProviderPrefix {
		return
	}

	idx := strings.LastIndexByte(raw, '/')
	if idx <= 0 {
		return
	}

	prefix := raw[:idx]
	base := raw[idx+1:]
	if base == "" {
		return
	}

	groupName = base

	// 处理带 ~ 的前缀，如 ~anthropic/claude-3
	cleanPrefix := strings.TrimPrefix(prefix, "~")
	escapedCleanPrefix := regexp.QuoteMeta(cleanPrefix)
	escapedBase := regexp.QuoteMeta(base)

	// 匹配：可选 ~ + 原始前缀/ + 模型名，或者直接请求模型名
	matchRegex = "^(~?" + escapedCleanPrefix + "/)?" + escapedBase + "$"
	return
}

// itemWeight 根据模型名和 Options 计算 GroupItem 权重
func itemWeight(modelName string, opts model.GroupAutoRebuildOptions) int {
	if opts.FreeModelWeight > 0 && strings.Contains(strings.ToLower(modelName), "free") {
		return opts.FreeModelWeight
	}
	return 1
}


// GroupAutoRebuildAll 遍历所有已启用渠道，按 Options 策略自动创建/补全 Group
func GroupAutoRebuildAll(ctx context.Context, opts model.GroupAutoRebuildOptions) (*model.GroupAutoRebuildResult, error) {
	channels, err := ChannelList(ctx)
	if err != nil {
		return nil, err
	}

	// 1. 收集所有启用渠道的模型：groupName -> []{ channelID, originalModelName }
	type channelModel struct {
		channelID     int
		originalModel string // 发给上游时使用的原始名
	}
	type groupSpec struct {
		matchRegex string
		items      []channelModel
		seen       map[int]bool // channelID 去重
	}

	groupMap := make(map[string]*groupSpec) // groupName -> spec

	for _, ch := range channels {
		if !ch.Enabled {
			continue
		}
		modelNames := splitChannelModelNames(ch.Model, ch.CustomModel)
		for _, raw := range modelNames {
			raw = strings.TrimSpace(raw)
			if raw == "" {
				continue
			}

			groupName, matchRegex := normalizeModelName(raw, opts)

			spec, exists := groupMap[groupName]
			if !exists {
				spec = &groupSpec{
					matchRegex: matchRegex,
					seen:       make(map[int]bool),
				}
				groupMap[groupName] = spec
			}

			// 以 (channelID, originalModel) 为唯一键去重
			key := ch.ID
			if !spec.seen[key] {
				spec.seen[key] = true
				spec.items = append(spec.items, channelModel{
					channelID:     ch.ID,
					originalModel: raw, // GroupItem.ModelName 保留原始名
				})
			}
		}
	}

	// 2. 获取当前已存在分组
	existingGroups, err := GroupList(ctx)
	if err != nil {
		return nil, err
	}
	existingGroupMap := make(map[string]model.Group, len(existingGroups))
	for _, g := range existingGroups {
		existingGroupMap[g.Name] = g
	}

	result := &model.GroupAutoRebuildResult{}

	// 3. 事务中批量创建/补全
	err = db.GetDB().WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		for groupName, spec := range groupMap {
			group, exists := existingGroupMap[groupName]
			if !exists {
				// 创建新 Group
				newGroup := model.Group{
					Name:       groupName,
					Mode:       model.GroupModeRoundRobin,
					MatchRegex: spec.matchRegex,
				}
				if err := tx.Create(&newGroup).Error; err != nil {
					return err
				}

				items := make([]model.GroupItem, 0, len(spec.items))
				for _, cm := range spec.items {
					items = append(items, model.GroupItem{
						GroupID:   newGroup.ID,
						ChannelID: cm.channelID,
						ModelName: cm.originalModel,
						Priority:  0,
						Weight:    itemWeight(cm.originalModel, opts),
					})
				}
				if len(items) > 0 {
					if err := tx.Create(&items).Error; err != nil {
						return err
					}
				}
				result.CreatedGroups++
				result.AddedItems += len(items)
			} else {
				// 已存在 Group，仅补全缺失的 ChannelItem
				// 以 (channelID, modelName) 为唯一键
				type itemKey struct{ chID int; model string }
				existingKeys := make(map[itemKey]bool, len(group.Items))
				for _, item := range group.Items {
					existingKeys[itemKey{item.ChannelID, item.ModelName}] = true
				}

				var newItems []model.GroupItem
				for _, cm := range spec.items {
					k := itemKey{cm.channelID, cm.originalModel}
					if !existingKeys[k] {
						newItems = append(newItems, model.GroupItem{
							GroupID:   group.ID,
							ChannelID: cm.channelID,
							ModelName: cm.originalModel,
							Priority:  0,
							Weight:    itemWeight(cm.originalModel, opts),
						})
					}
				}
				if len(newItems) > 0 {
					if err := tx.Create(&newItems).Error; err != nil {
						return err
					}
					result.UpdatedGroups++
					result.AddedItems += len(newItems)
				}

				// 若 MatchRegex 有变化，同步更新
				if spec.matchRegex != "" && group.MatchRegex != spec.matchRegex {
					if err := tx.Model(&model.Group{}).Where("id = ?", group.ID).
						Update("match_regex", spec.matchRegex).Error; err != nil {
						return err
					}
				}
			}
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	// 4. 全量刷新分组缓存
	if err := groupRefreshCache(ctx); err != nil {
		return nil, err
	}

	// 5. 返回最新统计
	allGroups, err := GroupList(ctx)
	if err == nil {
		result.TotalGroups = len(allGroups)
	}

	return result, nil
}

// GroupDelAll 一键删除所有分组（含关联的 GroupItem 和 GroupPreset），并清空缓存。
// 适合在重新一键建组前使用。
func GroupDelAll(ctx context.Context) (int, error) {
	database := db.GetDB().WithContext(ctx)

	// 先统计数量，用于返回
	var count int64
	if err := database.Model(&model.Group{}).Count(&count).Error; err != nil {
		return 0, err
	}

	if count == 0 {
		return 0, nil
	}

	// 事务中按外键依赖顺序删除
	err := database.Transaction(func(tx *gorm.DB) error {
		// 1. 删除所有 GroupItem
		if err := tx.Where("1 = 1").Delete(&model.GroupItem{}).Error; err != nil {
			return err
		}
		// 2. 删除所有 GroupPreset
		if err := tx.Where("1 = 1").Delete(&model.GroupPreset{}).Error; err != nil {
			return err
		}
		// 3. 删除所有 Group
		if err := tx.Where("1 = 1").Delete(&model.Group{}).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return 0, err
	}

	// 清空内存缓存
	groupCache.Clear()
	groupMap.Clear()

	return int(count), nil
}

// GroupBatchDelete 批量删除指定 ID 列表的分组及关联数据
func GroupBatchDelete(ctx context.Context, ids []int) (int, error) {
	if len(ids) == 0 {
		return 0, nil
	}

	database := db.GetDB().WithContext(ctx)

	var groupsToDelete []model.Group
	if err := database.Where("id IN ?", ids).Find(&groupsToDelete).Error; err != nil {
		return 0, err
	}

	if len(groupsToDelete) == 0 {
		return 0, nil
	}

	targetIDs := make([]int, 0, len(groupsToDelete))
	for _, g := range groupsToDelete {
		targetIDs = append(targetIDs, g.ID)
	}

	err := database.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("group_id IN ?", targetIDs).Delete(&model.GroupItem{}).Error; err != nil {
			return err
		}
		if err := tx.Where("group_id IN ?", targetIDs).Delete(&model.GroupPreset{}).Error; err != nil {
			return err
		}
		if err := tx.Where("id IN ?", targetIDs).Delete(&model.Group{}).Error; err != nil {
			return err
		}
		return nil
	})
	if err != nil {
		return 0, err
	}

	for _, g := range groupsToDelete {
		groupCache.Del(g.ID)
		groupMap.Del(g.Name)
	}

	return len(targetIDs), nil
}

// GroupBatchSetDisabled 批量设置分组的禁用/启用状态
func GroupBatchSetDisabled(ctx context.Context, ids []int, disabled bool) (int, error) {
	if len(ids) == 0 {
		return 0, nil
	}

	database := db.GetDB().WithContext(ctx)
	if err := database.Model(&model.Group{}).Where("id IN ?", ids).Update("disabled", disabled).Error; err != nil {
		return 0, err
	}

	if err := groupRefreshCacheByIDs(ids, ctx); err != nil {
		_ = groupRefreshCache(ctx)
	}

	return len(ids), nil
}



