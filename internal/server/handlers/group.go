package handlers

import (
	"net/http"
	"strconv"

	"github.com/bestruirui/octopus/internal/apperror"
	"github.com/bestruirui/octopus/internal/model"
	"github.com/bestruirui/octopus/internal/op"
	"github.com/bestruirui/octopus/internal/server/middleware"
	"github.com/bestruirui/octopus/internal/server/resp"
	"github.com/bestruirui/octopus/internal/server/router"
	"github.com/dlclark/regexp2"
	"github.com/gin-gonic/gin"
)

func init() {
	router.NewGroupRouter("/api/v1/group").
		Use(middleware.Auth()).
		Use(middleware.RequireJSON()).
		AddRoute(
			router.NewRoute("/list", http.MethodGet).
				Handle(getGroupList),
		).
		AddRoute(
			router.NewRoute("/create", http.MethodPost).
				Handle(createGroup),
		).
		AddRoute(
			router.NewRoute("/update", http.MethodPost).
				Handle(updateGroup),
		).
		AddRoute(
			router.NewRoute("/delete/:id", http.MethodDelete).
				Handle(deleteGroup),
		).
		AddRoute(
			router.NewRoute("/auto-rebuild-all", http.MethodPost).
				Handle(autoRebuildAllGroups),
		).
		AddRoute(
			router.NewRoute("/delete-all", http.MethodDelete).
				Handle(deleteAllGroups),
		).
		AddRoute(
			router.NewRoute("/batch-delete", http.MethodPost).
				Handle(batchDeleteGroups),
		).
		AddRoute(
			router.NewRoute("/batch-disable", http.MethodPost).
				Handle(batchDisableGroups),
		).
		AddRoute(
			router.NewRoute("/batch-enable", http.MethodPost).
				Handle(batchEnableGroups),
		)
}


func getGroupList(c *gin.Context) {
	groups, err := op.GroupList(c.Request.Context())
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, groups)
}

func createGroup(c *gin.Context) {
	var group model.Group
	if err := c.ShouldBindJSON(&group); err != nil {
		resp.InvalidJSON(c)
		return
	}
	if group.MatchRegex != "" {
		_, err := regexp2.Compile(group.MatchRegex, regexp2.ECMAScript)
		if err != nil {
			resp.ErrorWithAppError(c, http.StatusBadRequest, apperror.New(apperror.CodeCommonValidationFailed, err.Error()).WithStatus(http.StatusBadRequest))
			return
		}
	}
	if err := op.GroupCreate(&group, c.Request.Context()); err != nil {
		resp.ErrorWithAppError(c, http.StatusInternalServerError, groupError(codeGroupCreateFailed, "group create failed", err))
		return
	}
	resp.Success(c, group)
}

func updateGroup(c *gin.Context) {
	var req model.GroupUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		resp.InvalidJSON(c)
		return
	}
	if req.MatchRegex != nil {
		_, err := regexp2.Compile(*req.MatchRegex, regexp2.ECMAScript)
		if err != nil {
			resp.ErrorWithAppError(c, http.StatusBadRequest, apperror.New(apperror.CodeCommonValidationFailed, err.Error()).WithStatus(http.StatusBadRequest))
			return
		}
	}
	group, err := op.GroupUpdate(&req, c.Request.Context())
	if err != nil {
		resp.ErrorWithAppError(c, http.StatusInternalServerError, groupError(codeGroupUpdateFailed, "group update failed", err))
		return
	}
	resp.Success(c, group)
}

func deleteGroup(c *gin.Context) {
	id := c.Param("id")
	idNum, err := strconv.Atoi(id)
	if err != nil {
		resp.InvalidParam(c)
		return
	}
	if err := op.GroupDel(idNum, c.Request.Context()); err != nil {
		resp.ErrorWithAppError(c, http.StatusInternalServerError, groupError(codeGroupDeleteFailed, "group delete failed", err))
		return
	}
	resp.Success(c, "group deleted successfully")
}

func autoRebuildAllGroups(c *gin.Context) {
	var opts model.GroupAutoRebuildOptions
	// 忽略解析错误，用零值（精确模式）作为默认值
	_ = c.ShouldBindJSON(&opts)
	result, err := op.GroupAutoRebuildAll(c.Request.Context(), opts)
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, result)
}

func deleteAllGroups(c *gin.Context) {
	deleted, err := op.GroupDelAll(c.Request.Context())
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, gin.H{"deleted": deleted})
}

func batchDeleteGroups(c *gin.Context) {
	var req struct {
		IDs []int `json:"ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		resp.InvalidJSON(c)
		return
	}
	deleted, err := op.GroupBatchDelete(c.Request.Context(), req.IDs)
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, gin.H{"deleted": deleted})
}

func batchDisableGroups(c *gin.Context) {
	var req struct {
		IDs []int `json:"ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		resp.InvalidJSON(c)
		return
	}
	updated, err := op.GroupBatchSetDisabled(c.Request.Context(), req.IDs, true)
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, gin.H{"updated": updated})
}

func batchEnableGroups(c *gin.Context) {
	var req struct {
		IDs []int `json:"ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		resp.InvalidJSON(c)
		return
	}
	updated, err := op.GroupBatchSetDisabled(c.Request.Context(), req.IDs, false)
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, gin.H{"updated": updated})
}




