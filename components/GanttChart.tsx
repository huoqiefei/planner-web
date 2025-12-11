
import React, { useMemo, forwardRef, useState, useEffect, useRef, useImperativeHandle } from 'react';
import { Activity, UserSettings } from '../types';

interface GanttChartProps {
    rows: any[];
    activities: Activity[];
    projectStartDate: Date;
    totalDuration: number;
    showRelations: boolean;
    showCritical: boolean;
    showGrid: boolean;
    zoomLevel: 'day' | 'week' | 'month' | 'quarter' | 'year';
    onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
    userSettings: UserSettings;
    rowHeight: number;
    fontSize: number;
    headerHeight: number;
}

const ZOOM_CONFIG: Record<string, { pixelPerDay: number }> = {
    day: { pixelPerDay: 40 },
    week: { pixelPerDay: 15 },
    month: { pixelPerDay: 5 },
    quarter: { pixelPerDay: 2 },
    year: { pixelPerDay: 0.5 },
};

const GanttChart = forwardRef<HTMLDivElement, GanttChartProps>(({ 
    rows, activities, projectStartDate, totalDuration, showRelations, showCritical, showGrid, zoomLevel, onScroll, userSettings, rowHeight, fontSize, headerHeight
}, ref) => {
    const [zoomDrag, setZoomDrag] = useState<{start: number, val: number} | null>(null);
    const [manualPixelPerDay, setManualPixelPerDay] = useState<number | null>(null);
    
    // Internal refs for split view
    const headerContainerRef = useRef<HTMLDivElement>(null);
    const bodyContainerRef = useRef<HTMLDivElement>(null);

    // Forward the body ref to the parent for vertical scroll sync
    useImperativeHandle(ref, () => bodyContainerRef.current as HTMLDivElement);

    // Reset manual zoom when zoom level button is clicked
    useEffect(() => {
        setManualPixelPerDay(null);
    }, [zoomLevel]);

    const pixelPerDay = manualPixelPerDay || ZOOM_CONFIG[zoomLevel].pixelPerDay;

    const showVertLines = showGrid && userSettings.gridSettings.showVertical;
    const showWBSLines = userSettings.gridSettings.showWBSLines;
    
    // Position Calculation: Returns X at START of day
    const getPosition = (date: Date): number => {
        if(!date) return 0;
        const diffTime = date.getTime() - projectStartDate.getTime();
        return (diffTime / (1000 * 60 * 60 * 24)) * pixelPerDay;
    };

    const chartWidth = Math.max((totalDuration + 120) * pixelPerDay, 800); 

    const timeHeaders = useMemo(() => {
        const startDate = new Date(projectStartDate);
        startDate.setDate(startDate.getDate() - 10);
        const endDate = new Date(projectStartDate);
        endDate.setDate(endDate.getDate() + totalDuration + 200);
        
        const tier1 = []; // Years
        const tier2 = []; // Months/Quarters
        const tier3 = []; // Days/Weeks

        let iterDate = new Date(startDate);
        const endTs = endDate.getTime();
        
        const getDaysInYear = (y: number) => (y % 4 === 0 && y % 100 > 0) || y % 400 === 0 ? 366 : 365;
        const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

        while (iterDate.getTime() <= endTs) {
            const pos = getPosition(iterDate) + (5 * pixelPerDay);
            const ts = iterDate.getTime();
            const year = iterDate.getFullYear();
            const month = iterDate.getMonth();
            const day = iterDate.getDate();
            const weekDay = iterDate.getDay();

            // Tier 1: Year
            if (day === 1 && month === 0) {
                 const yearWidth = getDaysInYear(year) * pixelPerDay;
                 tier1.push(<text key={`y-${ts}`} x={pos + yearWidth/2} y="12" fill="#334155" fontSize="11" fontWeight="bold" textAnchor="middle">{year}</text>);
                 tier1.push(<line key={`yl-${ts}`} x1={pos} y1="0" x2={pos} y2={headerHeight} stroke="#94a3b8" strokeWidth="1" />);
            }

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
            iterDate.setDate(iterDate.getDate() + 1);
        }
        return [...tier1, ...tier2, ...tier3];
    }, [zoomLevel, projectStartDate, totalDuration, pixelPerDay, showVertLines, headerHeight, userSettings.language]);

    const gridLines = useMemo(() => {
        const lines = [];
        const startDate = new Date(projectStartDate);
        startDate.setDate(startDate.getDate() - 10);
        const endDate = new Date(projectStartDate);
        endDate.setDate(endDate.getDate() + totalDuration + 200);
        
        let iterDate = new Date(startDate);
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
    }, [zoomLevel, projectStartDate, totalDuration, pixelPerDay, showVertLines, rows.length, rowHeight, userSettings.gridSettings.verticalInterval]);


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
        <div className="flex-grow bg-white flex flex-col h-full overflow-hidden border-l border-slate-300 select-none">
            {/* 1. Header Container */}
            <div 
                ref={headerContainerRef}
                className="bg-slate-50 border-b border-slate-300 overflow-hidden shrink-0 relative" 
                style={{ height: headerHeight, width: '100%' }}
            >
                <div style={{ width: chartWidth, height: headerHeight }} className="relative">
                    <svg width={chartWidth} height={headerHeight} xmlns="http://www.w3.org/2000/svg">
                         <rect x="0" y="0" width={chartWidth} height={headerHeight} fill="#f8fafc" className="cursor-ew-resize" onMouseDown={handleMouseDown} />
                         <line x1="0" y1={headerHeight} x2={chartWidth} y2={headerHeight} stroke="#cbd5e1" strokeWidth="1" />
                         <g style={{ pointerEvents: 'none' }}>{timeHeaders}</g>
                    </svg>
                </div>
            </div>

            {/* 2. Body Container */}
            <div 
                ref={bodyContainerRef}
                className="flex-grow overflow-auto relative custom-scrollbar bg-white" 
                onScroll={handleBodyScroll}
            >
                <div style={{ width: chartWidth, height: Math.max(rows.length * rowHeight, 100) }} className="relative">
                    <svg width={chartWidth} height={Math.max(rows.length * rowHeight, 100)} xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <marker id="arrow" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L6,3 z" fill="#64748b" /></marker>
                        </defs>
                        
                        {/* Background Grid */}
                        {gridLines}

                        <g>
                            {/* Horizontal Row Lines */}
                            {rows.map((row, index) => {
                                const y = index * rowHeight;
                                const isWBS = row.type === 'WBS';
                                return (
                                    <React.Fragment key={`grid-${row.id}`}>
                                        {showGrid && userSettings.gridSettings.showHorizontal && (
                                             <line x1="0" y1={y + rowHeight} x2={chartWidth} y2={y + rowHeight} stroke="#f1f5f9" strokeWidth="1" />
                                        )}
                                        {isWBS && showWBSLines && (
                                            <line x1="0" y1={y + rowHeight} x2={chartWidth} y2={y + rowHeight} stroke="#cbd5e1" strokeWidth="2" />
                                        )}
                                    </React.Fragment>
                                );
                            })}

                            {/* Bars */}
                            {rows.map((row, index) => {
                                const y = index * rowHeight;
                                const globalOffset = 5 * pixelPerDay;
                                const left = getPosition(row.startDate) + globalOffset;
                                const right = getPosition(row.endDate) + pixelPerDay + globalOffset;
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
                        {showRelations && (
                            <g style={{ pointerEvents: 'none' }}>
                                 {rows.map((row, idx) => {
                                     if (row.type !== 'Activity') return null;
                                     const act = row.data as Activity;
                                     
                                     return act.predecessors.map(pred => {
                                         const predId = typeof pred === 'string' ? pred : pred.activityId;
                                         const type = typeof pred === 'string' ? 'FS' : (pred.type || 'FS');
                                         
                                         const predRowIndex = rows.findIndex(r => r.id === predId);
                                         if (predRowIndex === -1) return null;
                                         
                                         const predAct = activities.find(a => a.id === predId);
                                         if (!predAct) return null;

                                         const globalOffset = 5 * pixelPerDay;
                                         const barYOffset = rowHeight / 2;
                                         
                                         // Coordinates
                                         const predRight = getPosition(predAct.endDate) + pixelPerDay + globalOffset + (predAct.duration === 0 ? -6 : 0);
                                         const predLeft = getPosition(predAct.startDate) + globalOffset;
                                         const predY = (predRowIndex * rowHeight) + barYOffset;
                                         
                                         const succLeft = getPosition(act.startDate) + globalOffset + (act.duration === 0 ? 6 : 0);
                                         const succRight = getPosition(act.endDate) + pixelPerDay + globalOffset;
                                         const succY = (idx * rowHeight) + barYOffset;

                                         // Line Points
                                         let x1 = 0, x2 = 0;
                                         if (type === 'FS') { x1 = predRight; x2 = succLeft; }
                                         else if (type === 'FF') { x1 = predRight; x2 = succRight; }
                                         else if (type === 'SS') { x1 = predLeft; x2 = succLeft; }
                                         else if (type === 'SF') { x1 = predLeft; x2 = succRight; }
                                         
                                         const y1 = predY;
                                         const y2 = succY;
                                         
                                         let path = '';
                                         const gap = 10;
                                         const isCriticalLink = showCritical && act.isCritical && predAct.isCritical && act.totalFloat === 0 && predAct.totalFloat === 0;
                                         const lineColor = isCriticalLink ? '#ef4444' : '#64748b';

                                         // Orthogonal Routing Logic
                                         if (type === 'FF') {
                                             // FF: Loop around the back
                                             // Go right from pred, go right from succ, vertical connect
                                             const midX = Math.max(x1, x2) + 15;
                                             path = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
                                         }
                                         else if (type === 'FS') {
                                             if (x2 > x1 + 20) {
                                                 const midX = x1 + (x2 - x1)/2;
                                                 path = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
                                             } else {
                                                 path = `M ${x1} ${y1} L ${x1 + gap} ${y1} L ${x1 + gap} ${y2 - (y2>y1 ? 10 : -10)} L ${x2 - gap} ${y2 - (y2>y1 ? 10 : -10)} L ${x2 - gap} ${y2} L ${x2} ${y2}`;
                                             }
                                         } else {
                                             // Standard orthogonal mid-point (SS, SF)
                                             const midX = Math.min(x1, x2) - 15;
                                             path = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
                                         }

                                         return <path key={`${predId}-${act.id}`} d={path} fill="none" stroke={lineColor} strokeWidth={isCriticalLink?1.5:1} markerEnd="url(#arrow)" opacity={showRelations ? 1 : 0} />;
                                     });
                                 })}
                            </g>
                        )}
                    </svg>
                </div>
            </div>
        </div>
    );
});

export default GanttChart;
