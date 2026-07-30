'use client';

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Filter, CheckCircle, AlertCircle, Power, PowerOff } from 'lucide-react';
import { detectBrand } from '@/lib/brand-utils';
import type { Group } from '@/api/endpoints/group';

interface BrandFilterPanelProps {
    groups: Group[];
    selectedBrand: string;
    onSelectBrand: (brandId: string) => void;
    selectedChannelStatus: string; // '__all__' | 'enabled' | 'disabled' | 'has_channels' | 'no_channels'
    onSelectChannelStatus: (status: string) => void;
}

export function BrandFilterPanel({
    groups,
    selectedBrand,
    onSelectBrand,
    selectedChannelStatus,
    onSelectChannelStatus,
}: BrandFilterPanelProps) {
    const [isExpanded, setIsExpanded] = useState(true);

    // 统计品牌和各类状态
    const { brandStats, totalCount, enabledCount, disabledCount, hasChannelsCount, noChannelsCount } = useMemo(() => {
        const brandMap = new Map<string, { id: string; name: string; count: number }>();
        let enCount = 0;
        let disCount = 0;
        let hasCh = 0;
        let noCh = 0;

        for (const g of groups) {
            // 启用/禁用状态
            if (g.disabled) {
                disCount++;
            } else {
                enCount++;
            }

            // 渠道状态统计
            const itemCount = g.items?.length ?? 0;
            if (itemCount > 0) {
                hasCh++;
            } else {
                noCh++;
            }

            // 品牌统计
            const brand = detectBrand(g.name);
            const existing = brandMap.get(brand.id);
            if (existing) {
                existing.count++;
            } else {
                brandMap.set(brand.id, { ...brand, count: 1 });
            }
        }

        const stats = Array.from(brandMap.values()).sort((a, b) => b.count - a.count);

        return {
            brandStats: stats,
            totalCount: groups.length,
            enabledCount: enCount,
            disabledCount: disCount,
            hasChannelsCount: hasCh,
            noChannelsCount: noCh,
        };
    }, [groups]);

    const activeBrandName = useMemo(() => {
        if (selectedBrand === '__all__') return '全部';
        const found = brandStats.find(b => b.id === selectedBrand);
        return found ? found.name : selectedBrand;
    }, [selectedBrand, brandStats]);

    const statusLabel = useMemo(() => {
        switch (selectedChannelStatus) {
            case 'enabled': return '仅启用';
            case 'disabled': return '仅禁用';
            case 'has_channels': return '有可用渠道';
            case 'no_channels': return '暂无渠道';
            default: return '';
        }
    }, [selectedChannelStatus]);

    if (totalCount === 0) return null;

    return (
        <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-md overflow-hidden transition-all duration-200">
            {/* Header / Collapse Bar */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between px-4 py-2.5 cursor-pointer hover:bg-muted/30 select-none border-b border-border/30"
            >
                <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Filter className="size-3.5 text-primary" />
                    <span>筛选面板</span>
                    <span className="text-foreground font-semibold">· {activeBrandName}</span>
                    {statusLabel && (
                        <span className="text-primary font-medium">（{statusLabel}）</span>
                    )}
                </div>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <span>{isExpanded ? '收起筛选面板' : '展开筛选面板'}</span>
                    {isExpanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                </div>
            </div>

            {/* Collapsible Content */}
            {isExpanded && (
                <div className="p-4 space-y-3.5 text-xs">
                    {/* Row 1: 状态 */}
                    <div className="flex items-center gap-2">
                        <span className="w-12 text-muted-foreground font-medium shrink-0">状态</span>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                                onClick={() => onSelectChannelStatus('__all__')}
                                className={`px-2.5 py-1 rounded-full border transition-all ${
                                    selectedChannelStatus === '__all__'
                                        ? 'bg-primary text-primary-foreground border-primary font-medium shadow-sm'
                                        : 'bg-muted/30 border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                                }`}
                            >
                                全部 {totalCount}
                            </button>
                            <button
                                onClick={() => onSelectChannelStatus('enabled')}
                                className={`px-2.5 py-1 rounded-full border flex items-center gap-1 transition-all ${
                                    selectedChannelStatus === 'enabled'
                                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-medium'
                                        : 'bg-muted/30 border-border/40 text-muted-foreground hover:border-emerald-500/40 hover:text-foreground'
                                }`}
                            >
                                <Power className="size-3 text-emerald-500" />
                                仅启用 {enabledCount}
                            </button>
                            <button
                                onClick={() => onSelectChannelStatus('disabled')}
                                className={`px-2.5 py-1 rounded-full border flex items-center gap-1 transition-all ${
                                    selectedChannelStatus === 'disabled'
                                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 font-medium'
                                        : 'bg-muted/30 border-border/40 text-muted-foreground hover:border-amber-500/40 hover:text-foreground'
                                }`}
                            >
                                <PowerOff className="size-3 text-amber-500" />
                                仅禁用 {disabledCount}
                            </button>
                            <button
                                onClick={() => onSelectChannelStatus('has_channels')}
                                className={`px-2.5 py-1 rounded-full border flex items-center gap-1 transition-all ${
                                    selectedChannelStatus === 'has_channels'
                                        ? 'bg-blue-500/15 border-blue-500/40 text-blue-600 dark:text-blue-400 font-medium'
                                        : 'bg-muted/30 border-border/40 text-muted-foreground hover:border-blue-500/40 hover:text-foreground'
                                }`}
                            >
                                <CheckCircle className="size-3 text-blue-500" />
                                仅有渠道 {hasChannelsCount}
                            </button>
                            <button
                                onClick={() => onSelectChannelStatus('no_channels')}
                                className={`px-2.5 py-1 rounded-full border flex items-center gap-1 transition-all ${
                                    selectedChannelStatus === 'no_channels'
                                        ? 'bg-purple-500/15 border-purple-500/40 text-purple-600 dark:text-purple-400 font-medium'
                                        : 'bg-muted/30 border-border/40 text-muted-foreground hover:border-purple-500/40 hover:text-foreground'
                                }`}
                            >
                                <AlertCircle className="size-3 text-purple-500" />
                                暂无渠道 {noChannelsCount}
                            </button>
                        </div>
                    </div>

                    {/* Row 2: 品牌 */}
                    <div className="flex items-start gap-2 pt-1 border-t border-border/20">
                        <span className="w-12 text-muted-foreground font-medium shrink-0 mt-1">品牌</span>
                        <div className="flex items-center gap-1.5 flex-wrap flex-1">
                            <button
                                onClick={() => onSelectBrand('__all__')}
                                className={`px-2.5 py-1 rounded-full border transition-all ${
                                    selectedBrand === '__all__'
                                        ? 'bg-primary text-primary-foreground border-primary font-medium shadow-sm'
                                        : 'bg-muted/30 border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                                }`}
                            >
                                全部 {totalCount}
                            </button>

                            {brandStats.map((b) => (
                                <button
                                    key={b.id}
                                    onClick={() => onSelectBrand(selectedBrand === b.id ? '__all__' : b.id)}
                                    className={`px-2.5 py-1 rounded-full border transition-all ${
                                        selectedBrand === b.id
                                            ? 'bg-primary text-primary-foreground border-primary font-medium shadow-sm'
                                            : 'bg-muted/30 border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground'
                                    }`}
                                >
                                    {b.name}
                                    <span className={`ml-1 text-[11px] ${selectedBrand === b.id ? 'opacity-90' : 'opacity-60'}`}>
                                        {b.count}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
