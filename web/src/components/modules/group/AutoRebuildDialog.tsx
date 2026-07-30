'use client';

import { useState } from 'react';
import { Boxes, Sparkles, RefreshCw, Layers, CheckCircle2, Tag, Zap, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAutoRebuildAllGroups, useDeleteAllGroups, type GroupAutoRebuildOptions } from '@/api/endpoints/group';
import { toast } from '@/components/common/Toast';

interface AutoRebuildDialogContentProps {
    onClose?: () => void;
}

export function AutoRebuildDialogContent({ onClose }: AutoRebuildDialogContentProps) {
    const rebuildMutation = useAutoRebuildAllGroups();
    const deleteMutation = useDeleteAllGroups();

    const [opts, setOpts] = useState<GroupAutoRebuildOptions>({
        strip_provider_prefix: true,
        free_model_weight: 5,
    });

    const [result, setResult] = useState<{
        created_groups: number;
        updated_groups: number;
        added_items: number;
        total_groups: number;
    } | null>(null);

    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [deletedCount, setDeletedCount] = useState<number | null>(null);

    const handleRun = () => {
        rebuildMutation.mutate(opts, {
            onSuccess: (res) => {
                setResult(res);
                setDeletedCount(null);
                toast.success('一键全量按模型建组完成', {
                    description: `新增 ${res.created_groups} 个分组，更新 ${res.updated_groups} 个分组，共关联 ${res.added_items} 个渠道模型。`,
                });
            },
            onError: (err) => {
                toast.error('建组失败', { description: err.message });
            },
        });
    };

    const handleDeleteClick = () => {
        if (!deleteConfirm) {
            setDeleteConfirm(true);
            return;
        }
        // 二次确认：执行删除
        deleteMutation.mutate(undefined, {
            onSuccess: (res) => {
                setDeletedCount(res?.deleted ?? 0);
                setDeleteConfirm(false);
                setResult(null);
                toast.success(`已清空所有分组`, {
                    description: `共删除 ${res?.deleted ?? 0} 个分组，现在可以重新一键建组。`,
                });
            },
            onError: (err) => {
                setDeleteConfirm(false);
                toast.error('删除失败', { description: err.message });
            },
        });
    };

    const isPending = rebuildMutation.isPending || deleteMutation.isPending;

    return (
        <div className="w-[500px] max-w-full p-2 space-y-5">
            {/* Header */}
            <div className="flex items-center gap-3 pb-4 border-b border-border/40">
                <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                    <Boxes className="size-6" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold tracking-tight text-foreground">一键全量按模型建组</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">自动扫描已启用渠道，按唯一模型名构建路由分组</p>
                </div>
            </div>

            {/* 删除完成提示 */}
            {deletedCount !== null && !result && (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-sm">
                    <AlertTriangle className="size-4 text-amber-500 shrink-0" />
                    <span className="text-amber-600 dark:text-amber-400">
                        已清空 <strong>{deletedCount}</strong> 个分组，请选择选项后重新建组。
                    </span>
                </div>
            )}

            {/* Content */}
            {!result ? (
                <div className="space-y-4">
                    {/* 说明 */}
                    <div className="p-4 rounded-2xl bg-muted/40 border border-border/50 text-sm space-y-2.5 text-muted-foreground">
                        <div className="flex items-start gap-2 text-foreground font-medium">
                            <Sparkles className="size-4 text-primary shrink-0 mt-0.5" />
                            <span>这是什么功能？</span>
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground/90 pl-6">
                            就像 MetAPI 中的"自动重建路由"一样，此操作会扫描您所有已启用渠道所支持的模型。系统将自动以每个模型名称建立对应的分组，并将关联渠道一键填入。
                        </p>
                        <div className="pl-6 pt-1 space-y-1 text-xs">
                            <div className="flex items-center gap-2">
                                <Layers className="size-3.5 text-primary/80" />
                                <span>未创建的分组：自动以模型名新建组（默认轮询）</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Layers className="size-3.5 text-primary/80" />
                                <span>已存在的分组：自动补全未挂载的可用渠道</span>
                            </div>
                        </div>
                    </div>

                    {/* 选项区域 */}
                    <div className="space-y-3">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">构建选项</p>

                        {/* 去除 Provider 前缀 */}
                        <label className="flex items-start gap-3 p-3 rounded-xl border border-border/60 bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors">
                            <div className="mt-0.5">
                                <input
                                    type="checkbox"
                                    checked={opts.strip_provider_prefix}
                                    onChange={(e) => setOpts(o => ({ ...o, strip_provider_prefix: e.target.checked }))}
                                    className="accent-primary size-4 cursor-pointer"
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                    <Tag className="size-3.5 text-primary/80" />
                                    <span className="text-sm font-medium text-foreground">规范化分组名</span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">推荐</span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                    去除 Provider 前缀，<code className="text-primary text-[11px]">z-ai/glm-5.2</code> → 组名 <code className="text-primary text-[11px]">glm-5.2</code>，自动设置 MatchRegex 兼容带前缀的请求，解决 /v1/models 模型过少的问题。
                                </p>
                            </div>
                        </label>

                        {/* Free 模型权重提升 */}
                        <div className="p-3 rounded-xl border border-border/60 bg-muted/20">
                            <label className="flex items-start gap-3 cursor-pointer">
                                <div className="mt-0.5">
                                    <input
                                        type="checkbox"
                                        checked={opts.free_model_weight > 0}
                                        onChange={(e) => setOpts(o => ({ ...o, free_model_weight: e.target.checked ? 5 : 0 }))}
                                        className="accent-primary size-4 cursor-pointer"
                                    />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <Zap className="size-3.5 text-amber-500/80" />
                                        <span className="text-sm font-medium text-foreground">free 模型优先</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                        名称包含 <code className="text-amber-500 text-[11px]">free</code> 的渠道模型赋予更高权重，在加权模式下优先被选择。
                                    </p>
                                </div>
                            </label>
                            {opts.free_model_weight > 0 && (
                                <div className="mt-3 ml-7 flex items-center gap-3">
                                    <span className="text-xs text-muted-foreground">free 模型权重</span>
                                    <input
                                        type="number"
                                        min={1}
                                        max={100}
                                        value={opts.free_model_weight}
                                        onChange={(e) => setOpts(o => ({ ...o, free_model_weight: Math.max(1, parseInt(e.target.value) || 1) }))}
                                        className="w-20 px-2 py-1 text-sm rounded-lg border border-border/60 bg-background text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary/50"
                                    />
                                    <span className="text-xs text-muted-foreground">（普通模型权重为 1）</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-3">
                    <div className="flex items-center gap-2 text-primary font-medium text-sm">
                        <CheckCircle2 className="size-5 text-primary" />
                        <span>自动建组全量执行完成</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="p-3 rounded-xl bg-background/80 border border-border/40 text-center">
                            <div className="text-xs text-muted-foreground">新增分组</div>
                            <div className="text-xl font-bold text-primary mt-1">{result.created_groups}</div>
                        </div>
                        <div className="p-3 rounded-xl bg-background/80 border border-border/40 text-center">
                            <div className="text-xs text-muted-foreground">补充更新分组</div>
                            <div className="text-xl font-bold text-foreground mt-1">{result.updated_groups}</div>
                        </div>
                        <div className="p-3 rounded-xl bg-background/80 border border-border/40 text-center">
                            <div className="text-xs text-muted-foreground">关联渠道模型数</div>
                            <div className="text-xl font-bold text-foreground mt-1">{result.added_items}</div>
                        </div>
                        <div className="p-3 rounded-xl bg-background/80 border border-border/40 text-center">
                            <div className="text-xs text-muted-foreground">全站总分组数</div>
                            <div className="text-xl font-bold text-foreground mt-1">{result.total_groups}</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2">
                {/* 危险操作区：清空所有分组 */}
                {!result && (
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={isPending}
                        onClick={handleDeleteClick}
                        onBlur={() => setDeleteConfirm(false)}
                        className={`gap-1.5 transition-all ${
                            deleteConfirm
                                ? 'border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground'
                                : 'text-muted-foreground hover:text-destructive hover:border-destructive/60'
                        }`}
                    >
                        {deleteMutation.isPending ? (
                            <RefreshCw className="size-3.5 animate-spin" />
                        ) : (
                            <Trash2 className="size-3.5" />
                        )}
                        <span>{deleteConfirm ? '确认清空？' : '清空所有分组'}</span>
                    </Button>
                )}

                <div className="flex-1" />

                <Button variant="outline" size="sm" onClick={onClose} disabled={isPending}>
                    {result ? '关闭' : '取消'}
                </Button>

                {!result && (
                    <Button
                        size="sm"
                        onClick={handleRun}
                        disabled={isPending}
                        className="gap-2 bg-primary text-primary-foreground shadow-md hover:shadow-lg transition-all"
                    >
                        {rebuildMutation.isPending ? (
                            <>
                                <RefreshCw className="size-4 animate-spin" />
                                <span>建组中...</span>
                            </>
                        ) : (
                            <>
                                <Boxes className="size-4" />
                                <span>立即按模型建组</span>
                            </>
                        )}
                    </Button>
                )}
            </div>
        </div>
    );
}
