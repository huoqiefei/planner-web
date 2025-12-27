import React, { useMemo, useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Activity } from '../types';
import { useAppStore } from '../stores/useAppStore';
import { useFlatRows } from '../hooks/useFlatRows';
import { useVirtualScroll } from '../hooks/useVirtualScroll';
import { useTranslation } from '../utils/i18n';

interface GanttChartProps {
    onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
    headerHeight: number;
    rowHeight: number;
}

const ZOOM_CONFIG: Record<string, { pixelPerDay: number }> = {
    day: { pixelPerDay: 40 },
    week: { pixelPerDay: 15 },
    month: { pixelPerDay: 5 },
    quarter: { pixelPerDay: 2 },
    year: { pixelPerDay: 0.5 },
};

const GanttChart = forwardRef<HTMLDivElement, GanttChartProps>(({ 
    onScroll, headerHeight, rowHeight
}, ref) => {
    const { flatRows: rows } = useFlatRows();
    const { 
        data: projectData,
        schedule,
        ganttZoom: zoomLevel,
        setGanttZoom: setZoomLevel,
        showRelations,
        showCritical,
        userSettings
    } = useAppStore();

    const { t } = useTranslation(userSettings.language);

    const [zoomDrag, setZoomDrag] = useState<{start: number, val: number} | null>(null);
    const [manualPixelPerDay, setManualPixelPerDay] = useState<number | null>(null);
    
    // Internal refs for split view
    const headerContainerRef = useRef<HTMLDivElement>(null);
    const bodyContainerRef = useRef<HTMLDivElement>(null);

    const [viewportWidth, setViewportWidth] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    // Update viewport width
    useEffect(() => {
        const el = bodyContainerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(entries => {
            for (const entry of entries) setViewportWidth(entry.contentRect.width);
        });
        ro.observe(el);
        setViewportWidth(el.clientWidth);
        return () => ro.disconnect();
    }, []);

    const { virtualItems, totalHeight, startIndex, endIndex } = useVirtualScroll({
        totalCount: rows.length,
        itemHeight: rowHeight,
        containerRef: bodyContainerRef,
        overscan: 10
    });

    // Row Index Map for O(1) lookup
    const rowIndexMap = useMemo(() => {
        const map = new Map<string, number>();
        rows.forEach((r, i) => map.set(r.id, i));
        return map;
    }, [rows]);


    // Forward the body ref to the parent for vertical scroll sync
    useImperativeHandle(ref, () => bodyContainerRef.current as HTMLDivElement);

    // Reset manual zoom when zoom level button is clicked
    useEffect(() => {
        setManualPixelPerDay(null);
    }, [zoomLevel]);

    const pixelPerDay = manualPixelPerDay || ZOOM_CONFIG[zoomLevel].pixelPerDay;

    const showVertLines = userSettings.gridSettings.showVertical;
    const showHorizontalLines = userSettings.gridSettings.showHorizontal;
    const showWBSLines = userSettings.gridSettings.showWBSLines;
    const fontSize = userSettings.uiFontPx || 13;

    const projectStartDate = projectData?.meta.projectStartDate ? new Date(projectData.meta.projectStartDate) : new Date();
    
    // Calculate total duration from schedule if not available directly
    const totalDuration = useMemo(() => {
        if (!schedule?.activities?.length) return 100;
        let minStart = new Date(projectStartDate).getTime();
        let maxEnd = minStart + (100 * 24 * 3600 * 1000);

        schedule.activities.forEach(a => {
            const s = new Date(a.startDate).getTime();
            const e = new Date(a.endDate).getTime();
            if (s < minStart) minStart = s;
            if (e > maxEnd) maxEnd = e;
        });
        
        return Math.ceil((maxEnd - minStart) / (24 * 3600 * 1000));
    }, [schedule, projectStartDate]);
    
    // Position Calculation: Returns X at START of day
    const getPosition = (date: Date | string): number => {
        if(!date) return 0;
        const d = new Date(date);
        const diffTime = d.getTime() - projectStartDate.getTime();
        return (diffTime / (1000 * 60 * 60 * 24)) * pixelPerDay;
    };

    const chartWidth = Math.max((totalDuration + 120) * pixelPerDay, 800); 

    const timeHeaders = useMemo(() => {
        const visibleStart = Math.max(0, scrollLeft - 500);
        const visibleEnd = scrollLeft + viewportWidth + 500;
        
        // Calculate start date based on scroll, but align to start of year to ensure we catch year headers
        const startDays = (visibleStart / pixelPerDay);
        const startDate = new Date(projectStartDate);
        startDate.setDate(startDate.getDate() + Math.floor(startDays));
        startDate.setMonth(0, 1); // Align to Jan 1st of the current year scope
        if (startDate < projectStartDate) startDate.setTime(projectStartDate.getTime());
        // Actually, we might need to go back to project start if we are close to it, or handle "project start" logic
        // But simply, if we align to Jan 1st, we might be before projectStartDate. 
        // Let's just ensure we don't start way before projectStartDate if not needed.
        // But headers might be needed before projectStartDate if we show some buffer.
        // The original code: startDate = projectStartDate - 10 days.
        
        // Let's use a safe start date
        let iterDate = new Date(startDate);
        // Ensure we are at least at projectStart - 10 days if the calculated start is earlier
        const minStart = new Date(projectStartDate);
        minStart.setDate(minStart.getDate() - 10);
        
        if (iterDate < minStart) iterDate = new Date(minStart);
        // If we aligned to Jan 1st and it's way before visible range (e.g. huge year), it's fine (max 365 iterations extra).
        
        const endDays = (visibleEnd / pixelPerDay);
        const endDate = new Date(projectStartDate);
        endDate.setDate(endDate.getDate() + Math.ceil(endDays) + 10);
        
        const tier1 = []; // Years
        const tier2 = []; // Months/Quarters
        const tier3 = []; // Days/Weeks

        const endTs = endDate.getTime();
        
        const getDaysInYear = (y: number) => (y % 4 === 0 && y % 100 > 0) || y % 400 === 0 ? 366 : 365;
        const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

        while (iterDate.getTime() <= endTs) {
            const pos = getPosition(iterDate) + (5 * pixelPerDay);
            // Optimization: If pos is way beyond visibleEnd, break? 
            // The loop condition handles it.
            
            const ts = iterDate.getTime();
            const year = iterDate.getFullYear();
            const month = iterDate.getMonth();
            const day = iterDate.getDate();
            const weekDay = iterDate.getDay();

            // Tier 1: Year
            if (day === 1 && month === 0) {
                 const yearWidth = getDaysInYear(year) * pixelPerDay;
                 // Only render if it overlaps visible range
                 if (pos + yearWidth > visibleStart && pos < visibleEnd) {
                     tier1.push(<text key={`y-${ts}`} x={pos + yearWidth/2} y="12" fill="#334155" fontSize="11" fontWeight="bold" textAnchor="middle">{year}</text>);
                     tier1.push(<line key={`yl-${ts}`} x1={pos} y1="0" x2={pos} y2={headerHeight} stroke="#94a3b8" strokeWidth="1" />);
                 }
            }

            // For other tiers, check visibility
            if (pos > visibleStart - 100 && pos < visibleEnd + 100) {
                // Lower Tiers based on Zoom
                if (zoomLevel === 'day') {
                    if (day === 1) {
                        const monthWidth = getDaysInMonth(year, month) * pixelPerDay;
                        tier2.push(<text key={`m-${ts}`} x={pos + monthWidth/2} y="26" fill="#475569" fontSize="10" textAnchor="middle">{iterDate.toLocaleDateString(userSettings.language==='zh'?'zh-CN':'en-US', {month:'long'})}</text>);
                        tier2.push(<line key={`ml-${ts}`} x1={pos} y1="15" x2={pos} y2={headerHeight} stroke="#cbd5e1" strokeWidth="1" />);
                    }
                    tier3.push(<text key={`d-${ts}`} x={pos + pixelPerDay/2} y="42" fill="#64748b" fontSize="9" textAnchor="middle">{day}</text>);
                    if (weekDay === 0 || weekDay === 6) {
                        tier3.push(<rect key={`we-${ts}`} x={pos} y="30" width={pixelPerDay} height={headerHeight-30} fill="#f1f5f9" opacity="0.5" />);
                    }
                    tier3.push(<line key={`dl-${ts}`} x1={pos} y1="30" x2={pos} y2={headerHeight} stroke="#e2e8f0" strokeWidth="1" />);
                } 
                else if (zoomLevel === 'week') {
                     if (day === 1) {
                        const monthWidth = getDaysInMonth(year, month) * pixelPerDay;
                        tier2.push(<text key={`m-${ts}`} x={pos + monthWidth/2} y="26" fill="#475569" fontSize="10" textAnchor="middle">{iterDate.toLocaleDateString(userSettings.language==='zh'?'zh-CN':'en-US', {month:'short'})}</text>);
                        tier2.push(<line key={`ml-${ts}`} x1={pos} y1="15" x2={pos} y2={headerHeight} stroke="#cbd5e1" strokeWidth="1" />);
                    }
                    if (weekDay === 1) {
                        tier3.push(<text key={`w-${ts}`} x={pos + 2} y="42" fill="#64748b" fontSize="9">{day}</text>);
                        tier3.push(<line key={`wl-${ts}`} x1={pos} y1="30" x2={pos} y2={headerHeight} stroke="#e2e8f0" strokeWidth="1" />);
                    }
                }
                else if (zoomLevel === 'month') {
                    if (day === 1) {
                        const monthWidth = getDaysInMonth(year, month) * pixelPerDay;
                        tier2.push(<text key={`m-${ts}`} x={pos + monthWidth/2} y="32" fill="#475569" fontSize="11" textAnchor="middle">{iterDate.toLocaleDateString(userSettings.language==='zh'?'zh-CN':'en-US', {month:'short'})}</text>);
                        tier2.push(<line key={`ml-${ts}`} x1={pos} y1="15" x2={pos} y2={headerHeight} stroke="#cbd5e1" strokeWidth="1" />);
                    }
                }
                else if (zoomLevel === 'quarter') {
                     if (day === 1 && month % 3 === 0) {
                         const qWidth = 91 * pixelPerDay;
                         tier2.push(<text key={`q-${ts}`} x={pos + qWidth/2} y="32" fill="#475569" fontSize="11" textAnchor="middle">Q{Math.floor(month/3)+1}</text>);
                         tier2.push(<line key={`ql-${ts}`} x1={pos} y1="15" x2={pos} y2={headerHeight} stroke="#cbd5e1" strokeWidth="1" />);
                     }
                } 
                else if (zoomLevel === 'year') {
                    // Year logic already handled in Tier 1
                }
            }

            iterDate.setDate(iterDate.getDate() + 1);
        }
        return [...tier1, ...tier2, ...tier3];
    }, [zoomLevel, projectStartDate, totalDuration, pixelPerDay, showVertLines, headerHeight, userSettings.language, scrollLeft, viewportWidth]);

    const gridLines = useMemo(() => {
        const lines = [];
        
        const visibleStart = Math.max(0, scrollLeft - 500);
        const visibleEnd = scrollLeft + viewportWidth + 500;
        
        const startDays = (visibleStart / pixelPerDay);
        const startDate = new Date(projectStartDate);
        startDate.setDate(startDate.getDate() + Math.floor(startDays));
        // For grid lines, we don't need to align to year start, just day start is fine
        
        let iterDate = new Date(startDate);
        const minStart = new Date(projectStartDate);
        minStart.setDate(minStart.getDate() - 10);
        if (iterDate < minStart) iterDate = new Date(minStart);

        const endDays = (visibleEnd / pixelPerDay);
        const endDate = new Date(projectStartDate);
        endDate.setDate(endDate.getDate() + Math.ceil(endDays) + 10);

        const endTs = endDate.getTime();
        const bodyH = Math.max(rows.length * rowHeight, 100);
        const interval = userSettings.gridSettings.verticalInterval || 'auto';

        if(showVertLines) {
            while (iterDate.getTime() <= endTs) {
                const pos = getPosition(iterDate) + (5 * pixelPerDay);
                const day = iterDate.getDate();
                const weekDay = iterDate.getDay();
                const month = iterDate.getMonth();
                
                let draw = false;
                
                if (interval === 'auto') {
                    if (zoomLevel === 'day') draw = true;
                    if (zoomLevel === 'week' && weekDay === 1) draw = true;
                    if (zoomLevel === 'month' && day === 1) draw = true;
                    if (zoomLevel === 'quarter' && day === 1 && month % 3 === 0) draw = true;
                    if (zoomLevel === 'year' && day === 1 && month === 0) draw = true;
                } else if (interval === 'month') {
                    if (day === 1) draw = true;
                } else if (interval === 'quarter') {
                    if (day === 1 && month % 3 === 0) draw = true;
                } else if (interval === 'year') {
                    if (day === 1 && month === 0) draw = true;
                }

                if (draw) {
                    lines.push(<line key={`bg-grid-${iterDate.getTime()}`} x1={pos} y1="0" x2={pos} y2={bodyH} stroke="#e2e8f0" strokeWidth="0.5" />);
                }
                iterDate.setDate(iterDate.getDate() + 1);
            }
        }
        return lines;
    }, [zoomLevel, projectStartDate, totalDuration, pixelPerDay, showVertLines, rows.length, rowHeight, userSettings.gridSettings.verticalInterval, scrollLeft, viewportWidth]);

    const relationships = useMemo(() => {
        if (!showRelations) return null;
        
        const rels: JSX.Element[] = [];
        
        const viewportTop = startIndex * rowHeight - 500;
        const viewportBottom = endIndex * rowHeight + 500;
        
        const isVerticallyVisible = (y1: number, y2: number) => {
                return Math.max(y1, y2) >= viewportTop && Math.min(y1, y2) <= viewportBottom;
        };

        rows.forEach((row, idx) => {
            if (row.type !== 'Activity') return;
            const act = row.data as Activity;
            if (!act.predecessors || act.predecessors.length === 0) return;

            act.predecessors.forEach((pred: any) => {
                const predIdx = rowIndexMap.get(pred.activityId);
                if (predIdx === undefined) return;
                
                const predRow = rows[predIdx];
                
                const startY = (predIdx * rowHeight) + rowHeight/2;
                const endY = (idx * rowHeight) + rowHeight/2;

                if (!isVerticallyVisible(startY, endY)) return;

                const globalOffset = 5 * pixelPerDay;
                const startX = getPosition(new Date(predRow.endDate)) + pixelPerDay + globalOffset;
                const endX = getPosition(new Date(row.startDate)) + globalOffset;

                const minX = Math.min(startX, endX);
                const maxX = Math.max(startX, endX);
                const viewportLeft = scrollLeft - 500;
                const viewportRight = scrollLeft + viewportWidth + 500;
                
                if (maxX < viewportLeft || minX > viewportRight) return;

                const midX = startX + (endX - startX)/2;
                
                rels.push(
                    <path 
                        key={`${row.id}-${pred.activityId}`}
                        d={`M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth="1"
                        markerEnd="url(#arrow)"
                    />
                );
            });
        });
        
        return <g style={{ pointerEvents: 'none' }}>{rels}</g>;
    }, [showRelations, rows, rowIndexMap, startIndex, endIndex, rowHeight, pixelPerDay, projectStartDate, scrollLeft, viewportWidth]);


    const handleMouseDown = (e: React.MouseEvent) => {
        setZoomDrag({ start: e.clientX, val: pixelPerDay });
        const onMove = (evt: MouseEvent) => {
            const diff = evt.clientX - e.clientX;
            const newZoom = Math.max(0.1, pixelPerDay + (diff * 0.1));
            setManualPixelPerDay(newZoom);
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            setZoomDrag(null);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    const handleBodyScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (headerContainerRef.current) {
            headerContainerRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
        if (onScroll) onScroll(e);
    };

    return (
        <div className="flex-grow bg-white flex flex-col h-full overflow-hidden border-l border-slate-300 select-none gantt-component">
            {/* 1. Header Container */}
            <div 
                ref={headerContainerRef}
                className="bg-slate-50 border-b border-slate-300 overflow-hidden shrink-0 relative gantt-header-wrapper" 
                style={{ height: headerHeight, width: '100%' }}
            >
                <div style={{ width: chartWidth, height: headerHeight }} className="relative">
                    <svg width={chartWidth} height={headerHeight} xmlns="http://www.w3.org/2000/svg">
                         <rect x="0" y="0" width={chartWidth} height={headerHeight} fill="#f8fafc" className="cursor-ew-resize" onMouseDown={handleMouseDown} />
                         <line x1="0" y1={headerHeight} x2={chartWidth} y2={headerHeight} stroke="#cbd5e1" strokeWidth="1" />
                         <g style={{ pointerEvents: 'none' }}>{timeHeaders}</g>
                    </svg>
                     {/* Zoom Controls Overlay */}
                     <div className="absolute right-4 top-2 flex bg-white border border-slate-300 rounded shadow-sm z-30">
                        {['day','week','month','quarter','year'].map(z => (
                            <button key={z} onClick={()=>setZoomLevel(z as any)} className={`px-2 py-0.5 text-xs uppercase ${zoomLevel===z?'bg-blue-100 text-blue-700 font-bold':'text-slate-600 hover:bg-slate-50'}`}>{t(z as any)}</button>
                        ))}
                     </div>
                </div>
            </div>

            {/* 2. Body Container */}
            <div 
                ref={bodyContainerRef}
                className="flex-grow overflow-auto relative custom-scrollbar bg-white gantt-body-wrapper" 
                onScroll={handleBodyScroll}
            >
                <div style={{ width: chartWidth, height: Math.max(totalHeight, 100) }} className="relative">
                    <svg width={chartWidth} height={Math.max(totalHeight, 100)} xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <marker id="arrow" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#64748b" /></marker>
                        </defs>
                        
                        {/* Background Grid */}
                        {gridLines}

                        <g>
                            {/* Horizontal Row Lines */}
                            {virtualItems.map(({ index }) => {
                                const row = rows[index];
                                const y = index * rowHeight;
                                const isWBS = row.type === 'WBS';
                                return (
                                    <React.Fragment key={`grid-${row.id}`}>
                                        {showHorizontalLines && (
                                             <line x1="0" y1={y + rowHeight} x2={chartWidth} y2={y + rowHeight} stroke="#f1f5f9" strokeWidth="1" />
                                        )}
                                        {isWBS && showWBSLines && (
                                            <line x1="0" y1={y + rowHeight} x2={chartWidth} y2={y + rowHeight} stroke="#cbd5e1" strokeWidth="2" />
                                        )}
                                    </React.Fragment>
                                );
                            })}

                            {/* Bars */}
                            {virtualItems.map(({ index }) => {
                                const row = rows[index];
                                const y = index * rowHeight;
                                const globalOffset = 5 * pixelPerDay;
                                const left = getPosition(new Date(row.startDate)) + globalOffset;
                                const right = getPosition(new Date(row.endDate)) + pixelPerDay + globalOffset;
                                const width = Math.max(right - left, 2);
                                const barH = Math.max(6, rowHeight * 0.35); 
                                const barY = y + (rowHeight - barH) / 2;

                                if (row.type === 'WBS') {
                                    if(!row.startDate) return null;
                                    const wbsBarH = 5;
                                    const wbsY = y + (rowHeight - wbsBarH)/2;
                                    return (
                                        <g key={row.id}>
                                            <rect x="0" y={y} width={chartWidth} height={rowHeight} fill="#f1f5f9" opacity="0.4" />
                                            <rect x={left} y={wbsY + 1} width={width} height={2} fill="#64748b" />
                                            <path d={`M ${left} ${wbsY} L ${left+5} ${wbsY} L ${left} ${wbsY+5} Z`} fill="#334155" />
                                            <path d={`M ${right} ${wbsY} L ${right-5} ${wbsY} L ${right} ${wbsY+5} Z`} fill="#334155" />
                                        </g>
                                    );
                                } else {
                                    const activity = row.data as Activity;
                                    const isMilestone = activity.duration === 0;
                                    const barColor = showCritical && activity.isCritical ? '#ef4444' : '#10b981';
                                    const strokeColor = showCritical && activity.isCritical ? '#b91c1c' : '#047857';

                                    return (
                                        <g key={activity.id}>
                                            {isMilestone ? (
                                                 <path d={`M ${left} ${y + rowHeight/2} l 6 -6 l 6 6 l -6 6 z`} fill="#1e293b" stroke={strokeColor} strokeWidth="1" />
                                            ) : (
                                                <rect x={left} y={barY} width={width} height={barH} rx="1" fill={barColor} stroke={strokeColor} strokeWidth="1" className="cursor-pointer hover:brightness-110 transition-all" />
                                            )}
                                            <text x={Math.max(right, left + 12) + 5} y={y + rowHeight/2 + 4} fontSize={fontSize - 1} fill="#475569" fontWeight="500">{activity.name}</text>
                                        </g>
                                    );
                                }
                            })}
                        </g>

                        {/* Relationship Lines (Orthogonal) */}
                        {relationships}
                    </svg>
                </div>
            </div>
        </div>
    );
});

export default GanttChart;
