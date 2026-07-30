'use client';

import { useMemo, useState, useCallback } from 'react';
import { GroupCard } from './Card';
import { useGroupList, useBatchDeleteGroups, useBatchDisableGroups, useBatchEnableGroups } from '@/api/endpoints/group';
import { useSearchStore, useToolbarViewOptionsStore } from '@/components/modules/toolbar';
import { VirtualizedGrid } from '@/components/common/VirtualizedGrid';
import { BrandFilterPanel } from './BrandFilterPanel';
import { detectBrand } from '@/lib/brand-utils';
import { Button } from '@/components/ui/button';
import { CheckSquare, Square, Trash2, RefreshCw, AlertTriangle, Power, PowerOff } from 'lucide-react';
import { toast } from '@/components/common/Toast';

export function Group() {
    const { data: groups } = useGroupList();
    const batchDeleteMutation = useBatchDeleteGroups();
    const batchDisableMutation = useBatchDisableGroups();
    const batchEnableMutation = useBatchEnableGroups();

    const pageKey = 'group' as const;
    const searchTerm = useSearchStore((s) => s.getSearchTerm(pageKey));
    const sortField = useToolbarViewOptionsStore((s) => s.getSortField(pageKey));
    const sortOrder = useToolbarViewOptionsStore((s) => s.getSortOrder(pageKey));

    const [brandFilter, setBrandFilter] = useState<string>('__all__');
    const [channelStatusFilter, setChannelStatusFilter] = useState<string>('__all__');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

    const sortedGroups = useMemo(() => {
        if (!groups) return [];
        return [...groups].sort((a, b) => {
            // 置顶优先：pinned 组排在前面，组内按 pinned_at desc
            if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
            if (a.pinned && b.pinned) {
                const ta = a.pinned_at ? new Date(a.pinned_at).getTime() : 0;
                const tb = b.pinned_at ? new Date(b.pinned_at).getTime() : 0;
                if (ta !== tb) return tb - ta;
            }
            const diff = sortField === 'name'
                ? a.name.localeCompare(b.name)
                : (a.id || 0) - (b.id || 0);
            return sortOrder === 'asc' ? diff : -diff;
        });
    }, [groups, sortField, sortOrder]);

    const visibleGroups = useMemo(() => {
        const term = searchTerm.toLowerCase().trim();

        return sortedGroups.filter((g) => {
            // 1. 搜索关键词
            if (term && !g.name.toLowerCase().includes(term)) {
                return false;
            }

            // 2. 品牌筛选
            if (brandFilter !== '__all__') {
                const brand = detectBrand(g.name);
                if (brand.id !== brandFilter) {
                    return false;
                }
            }

            // 3. 启用/禁用/渠道挂载状态筛选
            if (channelStatusFilter === 'enabled') {
                if (g.disabled) return false;
            } else if (channelStatusFilter === 'disabled') {
                if (!g.disabled) return false;
            } else if (channelStatusFilter === 'has_channels') {
                if (!g.items || g.items.length === 0) return false;
            } else if (channelStatusFilter === 'no_channels') {
                if (g.items && g.items.length > 0) return false;
            }

            return true;
        });
    }, [sortedGroups, searchTerm, brandFilter, channelStatusFilter]);

    // 是否全选了当前筛选出的所有分组
    const isAllVisibleSelected = useMemo(() => {
        if (visibleGroups.length === 0) return false;
        return visibleGroups.every((g) => g.id !== undefined && selectedIds.has(g.id));
    }, [visibleGroups, selectedIds]);

    // 点击全选/反选当前筛选出的分组
    const handleToggleSelectAllVisible = useCallback(() => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (isAllVisibleSelected) {
                for (const g of visibleGroups) {
                    if (g.id !== undefined) next.delete(g.id);
                }
            } else {
                for (const g of visibleGroups) {
                    if (g.id !== undefined) next.add(g.id);
                }
            }
            return next;
        });
    }, [visibleGroups, isAllVisibleSelected]);

    // 单个 Card 切换选择状态
    const handleToggleSelectOne = useCallback((id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    }, []);

    // 批量禁用
    const handleBatchDisable = useCallback(() => {
        const idsToDisable = Array.from(selectedIds);
        if (idsToDisable.length === 0) return;

        batchDisableMutation.mutate(idsToDisable, {
            onSuccess: (res) => {
                toast.success('批量禁用分组成功', {
                    description: `已成功禁用 ${res.updated} 个分组。`,
                });
                setSelectedIds(new Set());
            },
            onError: (err) => {
                toast.error('批量禁用失败', { description: err.message });
            },
        });
    }, [selectedIds, batchDisableMutation]);

    // 批量启用
    const handleBatchEnable = useCallback(() => {
        const idsToEnable = Array.from(selectedIds);
        if (idsToEnable.length === 0) return;

        batchEnableMutation.mutate(idsToEnable, {
            onSuccess: (res) => {
                toast.success('批量启用分组成功', {
                    description: `已成功启用 ${res.updated} 个分组。`,
                });
                setSelectedIds(new Set());
            },
            onError: (err) => {
                toast.error('批量启用失败', { description: err.message });
            },
        });
    }, [selectedIds, batchEnableMutation]);

    // 执行批量删除
    const handleConfirmBatchDelete = useCallback(() => {
        const idsToDel = Array.from(selectedIds);
        if (idsToDel.length === 0) return;

        batchDeleteMutation.mutate(idsToDel, {
            onSuccess: (res) => {
                toast.success('批量删除分组成功', {
                    description: `已彻底删除 ${res.deleted} 个分组。`,
                });
                setSelectedIds(new Set());
                setConfirmDeleteOpen(false);
            },
            onError: (err) => {
                toast.error('批量删除失败', { description: err.message });
                setConfirmDeleteOpen(false);
            },
        });
    }, [selectedIds, batchDeleteMutation]);

    const isPending = batchDeleteMutation.isPending || batchDisableMutation.isPending || batchEnableMutation.isPending;

    return (
        <div className="h-full min-h-0 flex flex-col gap-3 relative">
            {/* 可折叠的品牌 & 状态筛选面板 */}
            <div className="flex-none space-y-2">
                <BrandFilterPanel
                    groups={sortedGroups}
                    selectedBrand={brandFilter}
                    onSelectBrand={setBrandFilter}
                    selectedChannelStatus={channelStatusFilter}
                    onSelectChannelStatus={setChannelStatusFilter}
                />

                {/* 全选 & 批量操作栏 */}
                <div className="flex items-center justify-between px-3 py-1.5 bg-card/60 border border-border/40 rounded-xl backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleToggleSelectAllVisible}
                            disabled={visibleGroups.length === 0}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors disabled:opacity-50"
                        >
                            {isAllVisibleSelected ? (
                                <CheckSquare className="size-4 text-primary" />
                            ) : (
                                <Square className="size-4" />
                            )}
                            <span>
                                {isAllVisibleSelected ? '取消全选当前' : '全选当前'} ({visibleGroups.length})
                            </span>
                        </button>

                        {selectedIds.size > 0 && (
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium border border-primary/20">
                                已选中 {selectedIds.size} 个分组
                            </span>
                        )}
                    </div>

                    {selectedIds.size > 0 && (
                        <div className="flex items-center gap-2">
                            {/* 批量启用 */}
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={isPending}
                                onClick={handleBatchEnable}
                                className="h-7 text-xs gap-1.5 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10"
                            >
                                <Power className="size-3.5" />
                                <span>批量启用 ({selectedIds.size})</span>
                            </Button>

                            {/* 批量禁用 */}
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={isPending}
                                onClick={handleBatchDisable}
                                className="h-7 text-xs gap-1.5 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                            >
                                <PowerOff className="size-3.5" />
                                <span>批量禁用 ({selectedIds.size})</span>
                            </Button>

                            {/* 批量删除 */}
                            <Button
                                size="sm"
                                variant="destructive"
                                disabled={isPending}
                                onClick={() => setConfirmDeleteOpen(true)}
                                className="h-7 text-xs gap-1.5 shadow-sm"
                            >
                                <Trash2 className="size-3.5" />
                                <span>批量删除 ({selectedIds.size})</span>
                            </Button>

                            <Button
                                size="sm"
                                variant="ghost"
                                disabled={isPending}
                                onClick={() => setSelectedIds(new Set())}
                                className="h-7 text-xs text-muted-foreground"
                            >
                                取消选择
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            {/* 批量删除确认 Modal */}
            {confirmDeleteOpen && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="w-[420px] max-w-full bg-card border border-border rounded-2xl p-5 space-y-4 shadow-2xl">
                        <div className="flex items-center gap-3 text-destructive">
                            <div className="p-2 rounded-xl bg-destructive/10 border border-destructive/20">
                                <AlertTriangle className="size-6" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-foreground">确认批量删除分组？</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">此操作不可撤销</p>
                            </div>
                        </div>

                        <p className="text-xs leading-relaxed text-muted-foreground bg-muted/30 p-3 rounded-xl border border-border/40">
                            您即将彻底删除已选中的 <strong className="text-destructive font-semibold">{selectedIds.size}</strong> 个路由分组。如果只需临时停用，请使用“批量禁用”功能。
                        </p>

                        <div className="flex justify-end gap-2 pt-2 border-t border-border/40">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setConfirmDeleteOpen(false)}
                                disabled={isPending}
                            >
                                取消
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleConfirmBatchDelete}
                                disabled={isPending}
                                className="gap-1.5"
                            >
                                {batchDeleteMutation.isPending ? (
                                    <>
                                        <RefreshCw className="size-3.5 animate-spin" />
                                        <span>删除中...</span>
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="size-3.5" />
                                        <span>确认删除 ({selectedIds.size})</span>
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* 卡片网格 */}
            <div className="flex-1 min-h-0">
                <VirtualizedGrid
                    items={visibleGroups}
                    columns={{ default: 1, md: 2, lg: 3 }}
                    estimateItemHeight={520}
                    getItemKey={(group, index) => group.id ?? `group-${index}`}
                    renderItem={(group) => (
                        <GroupCard
                            group={group}
                            isSelected={group.id !== undefined && selectedIds.has(group.id)}
                            onToggleSelect={handleToggleSelectOne}
                        />
                    )}
                />
            </div>
        </div>
    );
}
