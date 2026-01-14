import React, { useMemo, useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Activity } from '../types';
import { useAppStore } from '../stores/useAppStore';
import { useFlatRows } from '../hooks/useFlatRows';
import { useVirtualScroll } from '../hooks/useVirtualScroll';
import { useProjectOperations } from '../hooks/useProjectOperations';
import { usePermissions } from '../hooks/usePermissions'; // Assuming this exists or we use checkPermission directly? 

interface LinkDragState {
    sourceId: string;
    sourceType: 'start' | 'end';
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
}

interface GanttChartProps {
    onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
    headerHeight: number;
    rowHeight: number;
    printMode?: boolean;
    printRowStart?: number;
    printRowEnd?: number;
    printShowRelations?: boolean;
    printShowCritical?: boolean;
}

const ZOOM_CONFIG: Record<string, { pixelPerDay: number; leftPadding: number }> = {
    day: { pixelPerDay: 40, leftPadding: 20 },
    week: { pixelPerDay: 15, leftPadding: 20 },
    month: { pixelPerDay: 5, leftPadding: 20 },
    quarter: { pixelPerDay: 2, leftPadding: 20 },
    year: { pixelPerDay: 0.5, leftPadding: 20 },
};

const GanttChart = forwardRef<HTMLDivElement, GanttChartProps>(({
    onScroll, headerHeight, rowHeight, printMode = false, printRowStart, printRowEnd, printShowRelations, printShowCritical
}, ref) => {
    const { flatRows: rows } = useFlatRows();
    const {
        data: projectData,
        schedule,
        ganttZoom: zoomLevel,
        ganttPixelPerDay,
        setGanttPixelPerDay,
        ganttTimeScale,
        setGanttTimeScale,
        userSettings,
        showRelations: storeShowRelations,
        showCritical: storeShowCritical,
        selIds: selectedIds,
        setSelIds: onSelect,
        theme
    } = useAppStore();

    // 打印模式使用传入的状态
    const showRelations = printMode ? (printShowRelations ?? storeShowRelations) : storeShowRelations;
    const showCritical = printMode ? (printShowCritical ?? storeShowCritical) : storeShowCritical;

    // const { t } = useTranslation(userSettings.language);

    // const [zoomDrag, setZoomDrag] = useState<{start: number, val: number} | null>(null);
    const { handleUpdate } = useProjectOperations();
    const { user } = useAppStore(); // Need user for permissions if checking manually, or usePermissions hook
    // Actually usePermissions needs lang etc.
    // Let's assume write access for now if licensed/trial. 

    const [linkDrag, setLinkDrag] = useState<LinkDragState | null>(null);
    
    // 时间标尺右键菜单状态
    const [timeScaleMenu, setTimeScaleMenu] = useState<{ x: number; y: number } | null>(null);

    // Internal refs for split view
    const headerContainerRef = useRef<HTMLDivElement>(null);
    const bodyContainerRef = useRef<HTMLDivElement>(null);

    const [viewportWidth, setViewportWidth] = useState(0);
    const [scrollLeft, setScrollLeft] = useState(0);

    // Update viewport width and sync scroll
    useEffect(() => {
        const el = bodyContainerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(entries => {
            for (const entry of entries) setViewportWidth(entry.contentRect.width);
        });
        ro.observe(el);
        setViewportWidth(el.clientWidth);

        const onScroll = () => setScrollLeft(el.scrollLeft);
        el.addEventListener('scroll', onScroll);

        return () => {
            ro.disconnect();
            el.removeEventListener('scroll', onScroll);
        };
    }, []);

    const { virtualItems, totalHeight, startIndex, endIndex } = useVirtualScroll({
        totalCount: rows.length,
        itemHeight: rowHeight,
        containerRef: bodyContainerRef,
        overscan: 10
    });

    // 打印模式下的行数据
    const printRows = printMode && printRowStart !== undefined && printRowEnd !== undefined
        ? rows.slice(printRowStart, printRowEnd)
        : rows;

    // Row Index Map for O(1) lookup
    const rowIndexMap = useMemo(() => {
        const map = new Map<string, number>();
        rows.forEach((r, i) => map.set(r.id, i));
        return map;
    }, [rows]);


    // Forward the body ref to the parent for vertical scroll sync
    useImperativeHandle(ref, () => bodyContainerRef.current as HTMLDivElement);

    // 使用 store 中的 ganttPixelPerDay（用户手动拖拽设置的缩放比例）
    const pixelPerDay = ganttPixelPerDay || ZOOM_CONFIG[zoomLevel].pixelPerDay;
    const leftPadding = ZOOM_CONFIG[zoomLevel].leftPadding;

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

    // Position Calculation: Returns X at START of day with left padding for easier link dragging
    const getPosition = (date: Date | string | undefined): number => {
        if (!date) return leftPadding;
        const d = new Date(date);
        const diffTime = d.getTime() - projectStartDate.getTime();
        return leftPadding + (diffTime / (1000 * 60 * 60 * 24)) * pixelPerDay;
    };

    const chartWidth = Math.max((totalDuration + 120) * pixelPerDay + leftPadding, 800);

    const timeHeaders = useMemo(() => {
        const visibleStart = Math.max(0, scrollLeft - 500);
        const visibleEnd = scrollLeft + viewportWidth + 500;

        // Calculate start date based on scroll, but align to start of year to ensure we catch year headers
        const startDays = (visibleStart / pixelPerDay);
        const startDate = new Date(projectStartDate);
        startDate.setDate(startDate.getDate() + Math.floor(startDays));
        startDate.setMonth(0, 1); // Align to Jan 1st of the current year scope
        if (startDate < projectStartDate) startDate.setTime(projectStartDate.getTime());

        // Let's use a safe start date
        let iterDate = new Date(startDate);
        // Ensure we are at least at projectStart - 10 days if the calculated start is earlier
        const minStart = new Date(projectStartDate);
        minStart.setDate(minStart.getDate() - 10);

        if (iterDate < minStart) iterDate = new Date(minStart);

        const endDays = (visibleEnd / pixelPerDay);
        const endDate = new Date(projectStartDate);
        endDate.setDate(endDate.getDate() + Math.ceil(endDays) + 10);

        const tier1: JSX.Element[] = [];
        const tier2: JSX.Element[] = [];
        const tier3: JSX.Element[] = [];

        const endTs = endDate.getTime();

        const getDaysInYear = (y: number) => (y % 4 === 0 && y % 100 > 0) || y % 400 === 0 ? 366 : 365;
        const getDaysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
        const getDaysInQuarter = (y: number, q: number) => {
            const startMonth = q * 3;
            return getDaysInMonth(y, startMonth) + getDaysInMonth(y, startMonth + 1) + getDaysInMonth(y, startMonth + 2);
        };
        const getDaysInWeek = () => 7;

        // 确定时间标尺显示模式
        const effectiveTimeScale = ganttTimeScale === 'auto' 
            ? (printMode || zoomLevel === 'month' || zoomLevel === 'quarter' || zoomLevel === 'year' 
                ? 'year-quarter-month' 
                : (zoomLevel === 'week' ? 'year-month' : 'year-month'))
            : ganttTimeScale;

        // 夜间模式颜色
        const isDark = theme === 'dark' && !printMode;
        const textPrimary = isDark ? '#f1f5f9' : '#334155';
        const textSecondary = isDark ? '#cbd5e1' : '#475569';
        const textMuted = isDark ? '#94a3b8' : '#64748b';
        const lineStrong = isDark ? '#64748b' : '#94a3b8';
        const lineMedium = isDark ? '#475569' : '#cbd5e1';
        const lineLight = isDark ? '#334155' : '#e2e8f0';

        // 根据模式确定每层显示什么
        // year-month: 年 / 月
        // year-quarter: 年 / 季度
        // quarter-month: 季度 / 月
        // month-week: 月 / 周
        // year-quarter-month: 年 / 季度 / 月
        const getMonthLabel = (date: Date, short: boolean = true) => {
            if (printMode) return String(date.getMonth() + 1);
            return date.toLocaleDateString(userSettings.language === 'zh' ? 'zh-CN' : 'en-US', { month: short ? 'short' : 'long' });
        };

        while (iterDate.getTime() <= endTs) {
            const pos = getPosition(iterDate);
            const ts = iterDate.getTime();
            const year = iterDate.getFullYear();
            const month = iterDate.getMonth();
            const day = iterDate.getDate();
            const weekDay = iterDate.getDay();

            if (pos > visibleStart - 100 && pos < visibleEnd + 100) {
                
                if (effectiveTimeScale === 'year-quarter-month') {
                    // 三行：年 / 季度 / 月
                    if (day === 1 && month === 0) {
                        const yearWidth = getDaysInYear(year) * pixelPerDay;
                        tier1.push(<text key={`y-${ts}`} x={pos + yearWidth / 2} y="12" fill={textPrimary} fontSize="11" fontWeight="bold" textAnchor="middle">{year}</text>);
                        tier1.push(<line key={`yl-${ts}`} x1={pos} y1="0" x2={pos} y2={headerHeight} stroke={lineStrong} strokeWidth="1" />);
                    }
                    if (day === 1 && month % 3 === 0) {
                        const qWidth = getDaysInQuarter(year, Math.floor(month / 3)) * pixelPerDay;
                        tier2.push(<text key={`q-${ts}`} x={pos + qWidth / 2} y="26" fill={textSecondary} fontSize="10" textAnchor="middle">Q{Math.floor(month / 3) + 1}</text>);
                        tier2.push(<line key={`ql-${ts}`} x1={pos} y1="15" x2={pos} y2={headerHeight} stroke={lineMedium} strokeWidth="1" />);
                    }
                    if (day === 1) {
                        const monthWidth = getDaysInMonth(year, month) * pixelPerDay;
                        tier3.push(<text key={`m-${ts}`} x={pos + monthWidth / 2} y="40" fill={textMuted} fontSize="9" textAnchor="middle">{getMonthLabel(iterDate)}</text>);
                        tier3.push(<line key={`ml-${ts}`} x1={pos} y1="30" x2={pos} y2={headerHeight} stroke={lineLight} strokeWidth="1" />);
                    }
                } else if (effectiveTimeScale === 'year-month') {
                    // 两行：年 / 月
                    if (day === 1 && month === 0) {
                        const yearWidth = getDaysInYear(year) * pixelPerDay;
                        tier1.push(<text key={`y-${ts}`} x={pos + yearWidth / 2} y="14" fill={textPrimary} fontSize="11" fontWeight="bold" textAnchor="middle">{year}</text>);
                        tier1.push(<line key={`yl-${ts}`} x1={pos} y1="0" x2={pos} y2={headerHeight} stroke={lineStrong} strokeWidth="1" />);
                    }
                    if (day === 1) {
                        const monthWidth = getDaysInMonth(year, month) * pixelPerDay;
                        tier2.push(<text key={`m-${ts}`} x={pos + monthWidth / 2} y="32" fill={textSecondary} fontSize="10" textAnchor="middle">{getMonthLabel(iterDate, false)}</text>);
                        tier2.push(<line key={`ml-${ts}`} x1={pos} y1="20" x2={pos} y2={headerHeight} stroke={lineMedium} strokeWidth="1" />);
                    }
                } else if (effectiveTimeScale === 'year-quarter') {
                    // 两行：年 / 季度
                    if (day === 1 && month === 0) {
                        const yearWidth = getDaysInYear(year) * pixelPerDay;
                        tier1.push(<text key={`y-${ts}`} x={pos + yearWidth / 2} y="14" fill={textPrimary} fontSize="11" fontWeight="bold" textAnchor="middle">{year}</text>);
                        tier1.push(<line key={`yl-${ts}`} x1={pos} y1="0" x2={pos} y2={headerHeight} stroke={lineStrong} strokeWidth="1" />);
                    }
                    if (day === 1 && month % 3 === 0) {
                        const qWidth = getDaysInQuarter(year, Math.floor(month / 3)) * pixelPerDay;
                        tier2.push(<text key={`q-${ts}`} x={pos + qWidth / 2} y="32" fill={textSecondary} fontSize="10" textAnchor="middle">Q{Math.floor(month / 3) + 1}</text>);
                        tier2.push(<line key={`ql-${ts}`} x1={pos} y1="20" x2={pos} y2={headerHeight} stroke={lineMedium} strokeWidth="1" />);
                    }
                } else if (effectiveTimeScale === 'quarter-month') {
                    // 两行：季度 / 月
                    if (day === 1 && month % 3 === 0) {
                        const qWidth = getDaysInQuarter(year, Math.floor(month / 3)) * pixelPerDay;
                        tier1.push(<text key={`q-${ts}`} x={pos + qWidth / 2} y="14" fill={textPrimary} fontSize="11" fontWeight="bold" textAnchor="middle">{year} Q{Math.floor(month / 3) + 1}</text>);
                        tier1.push(<line key={`ql-${ts}`} x1={pos} y1="0" x2={pos} y2={headerHeight} stroke={lineStrong} strokeWidth="1" />);
                    }
                    if (day === 1) {
                        const monthWidth = getDaysInMonth(year, month) * pixelPerDay;
                        tier2.push(<text key={`m-${ts}`} x={pos + monthWidth / 2} y="32" fill={textSecondary} fontSize="10" textAnchor="middle">{getMonthLabel(iterDate)}</text>);
                        tier2.push(<line key={`ml-${ts}`} x1={pos} y1="20" x2={pos} y2={headerHeight} stroke={lineMedium} strokeWidth="1" />);
                    }
                } else if (effectiveTimeScale === 'month-week') {
                    // 两行：月 / 周
                    if (day === 1) {
                        const monthWidth = getDaysInMonth(year, month) * pixelPerDay;
                        tier1.push(<text key={`m-${ts}`} x={pos + monthWidth / 2} y="14" fill={textPrimary} fontSize="11" fontWeight="bold" textAnchor="middle">{year}/{month + 1}</text>);
                        tier1.push(<line key={`ml-${ts}`} x1={pos} y1="0" x2={pos} y2={headerHeight} stroke={lineStrong} strokeWidth="1" />);
                    }
                    if (weekDay === 1) { // 周一
                        const weekWidth = getDaysInWeek() * pixelPerDay;
                        tier2.push(<text key={`w-${ts}`} x={pos + weekWidth / 2} y="32" fill={textSecondary} fontSize="9" textAnchor="middle">{day}</text>);
                        tier2.push(<line key={`wl-${ts}`} x1={pos} y1="20" x2={pos} y2={headerHeight} stroke={lineMedium} strokeWidth="1" />);
                    }
                }
            }

            iterDate.setDate(iterDate.getDate() + 1);
        }
        return [...tier1, ...tier2, ...tier3];
    }, [zoomLevel, ganttTimeScale, projectStartDate, totalDuration, pixelPerDay, showVertLines, headerHeight, userSettings.language, scrollLeft, viewportWidth, printMode, theme]);

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

        // 夜间模式网格线颜色
        const isDark = theme === 'dark' && !printMode;
        const gridLineColor = isDark ? '#334155' : '#e2e8f0';

        if (showVertLines) {
            while (iterDate.getTime() <= endTs) {
                const pos = getPosition(iterDate) + 0;
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
                    lines.push(<line key={`bg-grid-${iterDate.getTime()}`} x1={pos} y1="0" x2={pos} y2={bodyH} stroke={gridLineColor} strokeWidth="0.5" />);
                }
                iterDate.setDate(iterDate.getDate() + 1);
            }
        }
        return lines;
    }, [zoomLevel, projectStartDate, totalDuration, pixelPerDay, showVertLines, rows.length, rowHeight, userSettings.gridSettings.verticalInterval, scrollLeft, viewportWidth, theme, printMode]);

    const relationships = useMemo(() => {
        if (!showRelations) return null;

        const rels: JSX.Element[] = [];

        // 打印模式下使用页面内的相对索引
        const rowsToRender = printMode ? printRows : rows;
        const pageOffset = printMode ? (printRowStart || 0) : 0;
        const printEnd = printMode ? (printRowEnd || rows.length) : rows.length;

        const viewportTop = startIndex * rowHeight - 500;
        const viewportBottom = endIndex * rowHeight + 500;

        const isVerticallyVisible = (y1: number, y2: number) => {
            if (printMode) return true; // 打印模式下总是渲染
            return Math.max(y1, y2) >= viewportTop && Math.min(y1, y2) <= viewportBottom;
        };

        // 用于跟踪已绘制的关系，避免重复
        const drawnRelations = new Set<string>();

        // 第一遍：遍历当前页面的任务，绘制它们的前置关系线
        rowsToRender.forEach((row, localIdx) => {
            if (row.type !== 'Activity') return;
            const act = row.data as Activity;
            if (!act.predecessors || act.predecessors.length === 0) return;

            act.predecessors.forEach((pred: any) => {
                const relationKey = `${pred.activityId}->${act.id}`;
                if (drawnRelations.has(relationKey)) return;
                drawnRelations.add(relationKey);

                // 在打印模式下，需要检查前置任务是否在当前页面内
                const globalPredIdx = rowIndexMap.get(pred.activityId);
                if (globalPredIdx === undefined) return;

                // 计算前置任务在当前页面的本地索引
                let predLocalIdx: number;
                let predRow: typeof row;
                let predOutOfPage = false; // 标记前置任务是否在页面外
                let predAbovePage = false; // 标记前置任务是否在页面上方
                
                if (printMode) {
                    // 打印模式：检查前置任务是否在当前页面范围内
                    if (globalPredIdx < pageOffset) {
                        // 前置任务在当前页面上方
                        predOutOfPage = true;
                        predAbovePage = true;
                        predLocalIdx = -1; // 使用 -1 表示在页面上方
                        predRow = rows[globalPredIdx]; // 仍然需要获取前置任务的数据
                    } else if (globalPredIdx >= printEnd) {
                        // 前置任务在当前页面下方
                        predOutOfPage = true;
                        predAbovePage = false;
                        predLocalIdx = printRows.length; // 使用页面长度表示在页面下方
                        predRow = rows[globalPredIdx];
                    } else {
                        predLocalIdx = globalPredIdx - pageOffset;
                        predRow = printRows[predLocalIdx];
                    }
                } else {
                    predLocalIdx = globalPredIdx;
                    predRow = rows[predLocalIdx];
                }

                if (!predRow) return;

                // 使用本地索引计算Y坐标
                let startY: number;
                if (predOutOfPage) {
                    // 如果前置任务在页面外，从页面边缘开始绘制
                    if (predAbovePage) {
                        startY = -rowHeight / 2; // 从页面顶部上方开始
                    } else {
                        startY = (printRows.length * rowHeight) + rowHeight / 2; // 从页面底部下方开始
                    }
                } else {
                    startY = (predLocalIdx * rowHeight) + rowHeight / 2;
                }
                const endY = (localIdx * rowHeight) + rowHeight / 2;

                if (!isVerticallyVisible(startY, endY)) return;

                const globalOffset = 0;

                // Determine start and end points based on relationship type
                let startX: number;
                let endX: number;

                const type = pred.type || 'FS';
                const predStart = getPosition(predRow.startDate ? new Date(predRow.startDate) : undefined) + globalOffset;
                const predEnd = getPosition(predRow.endDate ? new Date(predRow.endDate) : undefined) + pixelPerDay + globalOffset;
                const currStart = getPosition(row.startDate ? new Date(row.startDate) : undefined) + globalOffset;
                const currEnd = getPosition(row.endDate ? new Date(row.endDate) : undefined) + pixelPerDay + globalOffset;

                if (type === 'FF') {
                    startX = predEnd;
                    endX = currEnd;
                } else if (type === 'SS') {
                    startX = predStart;
                    endX = currStart;
                } else if (type === 'SF') {
                    startX = predStart;
                    endX = currEnd;
                } else { // FS
                    startX = predEnd;
                    endX = currStart;
                }

                const minX = Math.min(startX, endX);
                const maxX = Math.max(startX, endX);
                const viewportLeft = scrollLeft - 500;
                const viewportRight = scrollLeft + viewportWidth + 500;

                if (maxX < viewportLeft || minX > viewportRight) return;

                let path = '';
                const gap = 8; // Minimum gap from bar edge
                const r = 4; // Corner radius
                const dy = endY - startY;
                const signY = dy >= 0 ? 1 : -1;
                // Vertical bend offset: 0.3 times row height from the source bar
                const verticalBendOffset = rowHeight * 0.5;

                // 对于跨页的逻辑线，需要计算正确的折弯位置，使用与正常逻辑线相同的圆角风格
                if (predOutOfPage) {
                    if (type === 'SS') {
                        // SS: 从左侧进入
                        const leftX = Math.min(startX, endX) - gap;
                        const bendX = leftX - r;
                        
                        if (predAbovePage) {
                            // 从上方进入
                            path = `M ${bendX} ${-rowHeight * 0.5}
                                    L ${bendX} ${endY - r}
                                    Q ${bendX} ${endY} ${bendX + r} ${endY}
                                    L ${endX} ${endY}`;
                        } else {
                            // 从下方进入
                            const pageBottom = printRows.length * rowHeight;
                            path = `M ${bendX} ${pageBottom + rowHeight * 0.5}
                                    L ${bendX} ${endY + r}
                                    Q ${bendX} ${endY} ${bendX + r} ${endY}
                                    L ${endX} ${endY}`;
                        }
                    } else if (type === 'FF' || type === 'SF') {
                        // FF/SF: 从右侧进入
                        const rightOuter = Math.max(startX, endX) + gap;
                        
                        if (predAbovePage) {
                            path = `M ${rightOuter} ${-rowHeight * 0.5}
                                    L ${rightOuter} ${endY - r}
                                    Q ${rightOuter} ${endY} ${rightOuter - r} ${endY}
                                    L ${endX} ${endY}`;
                        } else {
                            const pageBottom = printRows.length * rowHeight;
                            path = `M ${rightOuter} ${pageBottom + rowHeight * 0.5}
                                    L ${rightOuter} ${endY + r}
                                    Q ${rightOuter} ${endY} ${rightOuter - r} ${endY}
                                    L ${endX} ${endY}`;
                        }
                    } else {
                        // FS
                        if (endX >= startX + gap * 2) {
                            // 正向 FS
                            const bendX = startX + gap;
                            
                            if (predAbovePage) {
                                path = `M ${bendX} ${-rowHeight * 0.5}
                                        L ${bendX} ${endY - r}
                                        Q ${bendX} ${endY} ${bendX + r} ${endY}
                                        L ${endX} ${endY}`;
                            } else {
                                const pageBottom = printRows.length * rowHeight;
                                path = `M ${bendX} ${pageBottom + rowHeight * 0.5}
                                        L ${bendX} ${endY + r}
                                        Q ${bendX} ${endY} ${bendX + r} ${endY}
                                        L ${endX} ${endY}`;
                            }
                        } else {
                            // 反向 FS - 从 endX - gap 位置进入
                            const bendX = endX - gap;
                            
                            if (predAbovePage) {
                                path = `M ${bendX} ${-rowHeight * 0.5}
                                        L ${bendX} ${endY - r}
                                        Q ${bendX} ${endY} ${bendX + r} ${endY}
                                        L ${endX} ${endY}`;
                            } else {
                                const pageBottom = printRows.length * rowHeight;
                                path = `M ${bendX} ${pageBottom + rowHeight * 0.5}
                                        L ${bendX} ${endY + r}
                                        Q ${bendX} ${endY} ${bendX + r} ${endY}
                                        L ${endX} ${endY}`;
                            }
                        }
                    }
                } else {
                    // 原有的路径逻辑
                    // Logic for Orthogonal Routing with Rounded Corners
                    if (type === 'SS') {
                        // SS: Start to Start - only one bend allowed
                        // Simple L-shape: go left from source, then straight to target
                        const leftX = Math.min(startX, endX) - gap;
                        
                        if (Math.abs(dy) < 2 * r) {
                            // Nearly same row - direct horizontal line
                            path = `M ${startX} ${startY} L ${endX} ${endY}`;
                        } else {
                            // L-shape with one bend
                            path = `M ${startX} ${startY} L ${leftX} ${startY}
                                    Q ${leftX - r} ${startY} ${leftX - r} ${startY + signY * r}
                                    L ${leftX - r} ${endY - signY * r}
                                    Q ${leftX - r} ${endY} ${leftX} ${endY}
                                    L ${endX} ${endY}`;
                        }
                    } else if (type === 'FF' || type === 'SF') {
                        // Target is Finish - Approach from the right
                        const targetX = currEnd;
                        const rightOuter = Math.max(startX, targetX) + gap;

                        if (Math.abs(dy) < 2 * r) {
                            path = `M ${startX} ${startY} L ${rightOuter} ${startY} L ${rightOuter} ${endY} L ${targetX} ${endY}`;
                        } else {
                            path = `M ${startX} ${startY} L ${rightOuter - r} ${startY}
                                    Q ${rightOuter} ${startY} ${rightOuter} ${startY + signY * r}
                                    L ${rightOuter} ${endY - signY * r}
                                    Q ${rightOuter} ${endY} ${rightOuter - r} ${endY}
                                    L ${targetX} ${endY}`;
                        }
                    } else if (endX >= startX + gap * 2) {
                        // Standard Forward FS - Bend at 1.2x row height vertically
                        const bendX = startX + gap;
                        // Calculate the Y position for the horizontal segment
                        const bendY = startY + signY * verticalBendOffset;
                        // Clamp bendY to not overshoot endY
                        const actualBendY = signY > 0 ? Math.min(bendY, endY) : Math.max(bendY, endY);
                        
                        if (Math.abs(actualBendY - startY) < 2 * r || Math.abs(endY - actualBendY) < 2 * r) {
                            // Too close, use simple path
                            path = `M ${startX} ${startY} L ${bendX} ${startY} L ${bendX} ${endY} L ${endX} ${endY}`;
                        } else {
                            path = `M ${startX} ${startY} L ${bendX - r} ${startY} 
                                    Q ${bendX} ${startY} ${bendX} ${startY + signY * r} 
                                    L ${bendX} ${endY - signY * r} 
                                    Q ${bendX} ${endY} ${bendX + r} ${endY} 
                                    L ${endX} ${endY}`;
                        }
                    } else {
                        // Backward / Overlap (FS) - Need to go around
                        const p1x = startX + gap; // First vertical segment (right of start)
                        const p2x = endX - gap;   // Second vertical segment (left of end)
                        
                        // Bend at 1.2x row height from source
                        const midY = startY + signY * verticalBendOffset;

                        const dy1 = midY - startY;
                        const signY1 = dy1 >= 0 ? 1 : -1;
                        const dy2 = endY - midY;
                        const signY2 = dy2 >= 0 ? 1 : -1;

                        if (Math.abs(dy1) < 2 * r || Math.abs(dy2) < 2 * r || Math.abs(p1x - p2x) < 2 * r) {
                            path = `M ${startX} ${startY} L ${p1x} ${startY} L ${p1x} ${midY} L ${p2x} ${midY} L ${p2x} ${endY} L ${endX} ${endY}`;
                        } else {
                            path = `M ${startX} ${startY} L ${p1x - r} ${startY}
                                    Q ${p1x} ${startY} ${p1x} ${startY + signY1 * r}
                                    L ${p1x} ${midY - signY1 * r}
                                    Q ${p1x} ${midY} ${p1x - r} ${midY}
                                    L ${p2x + r} ${midY}
                                    Q ${p2x} ${midY} ${p2x} ${midY + signY2 * r}
                                    L ${p2x} ${endY - signY2 * r}
                                    Q ${p2x} ${endY} ${p2x + r} ${endY}
                                    L ${endX} ${endY}`;
                        }
                    }
                } // 关闭 else (非跨页) 块

                rels.push(
                    <path
                        key={`${row.id}-${pred.activityId}`}
                        d={path}
                        fill="none"
                        stroke="#94a3b8"
                        strokeWidth="1"
                        strokeLinejoin="round"
                        markerEnd="url(#arrow)"
                        className="hover:stroke-blue-500 hover:stroke-2 transition-all"
                        style={{ isolation: 'isolate' }}
                    />
                );
            });
        });

        // 第二遍：在打印模式下，遍历当前页面的任务，查找它们作为前置任务时，后继在其他页面的情况
        if (printMode) {
            rowsToRender.forEach((row, localIdx) => {
                if (row.type !== 'Activity') return;
                const act = row.data as Activity;
                
                // 查找所有以当前任务为前置的后继任务
                rows.forEach((succRow, globalSuccIdx) => {
                    if (succRow.type !== 'Activity') return;
                    const succAct = succRow.data as Activity;
                    if (!succAct.predecessors) return;
                    
                    // 检查后继任务是否以当前任务为前置
                    const predRelation = succAct.predecessors.find((p: any) => p.activityId === act.id);
                    if (!predRelation) return;
                    
                    // 检查后继任务是否在当前页面外
                    if (globalSuccIdx >= pageOffset && globalSuccIdx < printEnd) {
                        return; // 后继在当前页面内，已经在第一遍处理过了
                    }
                    
                    const relationKey = `${act.id}->${succAct.id}`;
                    if (drawnRelations.has(relationKey)) return;
                    drawnRelations.add(relationKey);
                    
                    // 后继在页面外，需要画从当前任务到页面边缘的线
                    const succAbovePage = globalSuccIdx < pageOffset;
                    const startY = (localIdx * rowHeight) + rowHeight / 2;
                    let endY: number;
                    
                    if (succAbovePage) {
                        endY = -rowHeight / 2; // 到页面顶部
                    } else {
                        endY = (printRows.length * rowHeight) + rowHeight / 2; // 到页面底部
                    }
                    
                    const type = predRelation.type || 'FS';
                    const predStart = getPosition(row.startDate ? new Date(row.startDate) : undefined);
                    const predEnd = getPosition(row.endDate ? new Date(row.endDate) : undefined) + pixelPerDay;
                    const succStart = getPosition(succRow.startDate ? new Date(succRow.startDate) : undefined);
                    const succEnd = getPosition(succRow.endDate ? new Date(succRow.endDate) : undefined) + pixelPerDay;
                    
                    let startX: number;
                    let endX: number;
                    
                    if (type === 'FF') {
                        startX = predEnd;
                        endX = succEnd;
                    } else if (type === 'SS') {
                        startX = predStart;
                        endX = succStart;
                    } else if (type === 'SF') {
                        startX = predStart;
                        endX = succEnd;
                    } else { // FS
                        startX = predEnd;
                        endX = succStart;
                    }
                    
                    const gap = 8;
                    const r = 4;
                    let path = '';
                    
                    // 根据关系类型计算折弯位置，使用与正常逻辑线相同的圆角风格
                    if (type === 'SS') {
                        // SS: 从左侧出去
                        const leftX = Math.min(startX, endX) - gap;
                        const bendX = leftX - r;
                        
                        if (succAbovePage) {
                            path = `M ${startX} ${startY} L ${leftX} ${startY}
                                    Q ${bendX} ${startY} ${bendX} ${startY - r}
                                    L ${bendX} ${-rowHeight * 0.5}`;
                        } else {
                            const pageBottom = printRows.length * rowHeight;
                            path = `M ${startX} ${startY} L ${leftX} ${startY}
                                    Q ${bendX} ${startY} ${bendX} ${startY + r}
                                    L ${bendX} ${pageBottom + rowHeight * 0.5}`;
                        }
                    } else if (type === 'FF' || type === 'SF') {
                        // FF/SF: 从右侧出去
                        const rightOuter = Math.max(startX, endX) + gap;
                        
                        if (succAbovePage) {
                            path = `M ${startX} ${startY} L ${rightOuter - r} ${startY}
                                    Q ${rightOuter} ${startY} ${rightOuter} ${startY - r}
                                    L ${rightOuter} ${-rowHeight * 0.5}`;
                        } else {
                            const pageBottom = printRows.length * rowHeight;
                            path = `M ${startX} ${startY} L ${rightOuter - r} ${startY}
                                    Q ${rightOuter} ${startY} ${rightOuter} ${startY + r}
                                    L ${rightOuter} ${pageBottom + rowHeight * 0.5}`;
                        }
                    } else {
                        // FS
                        if (endX >= startX + gap * 2) {
                            // 正向 FS
                            const bendX = startX + gap;
                            
                            if (succAbovePage) {
                                path = `M ${startX} ${startY} L ${bendX - r} ${startY}
                                        Q ${bendX} ${startY} ${bendX} ${startY - r}
                                        L ${bendX} ${-rowHeight * 0.5}`;
                            } else {
                                const pageBottom = printRows.length * rowHeight;
                                path = `M ${startX} ${startY} L ${bendX - r} ${startY}
                                        Q ${bendX} ${startY} ${bendX} ${startY + r}
                                        L ${bendX} ${pageBottom + rowHeight * 0.5}`;
                            }
                        } else {
                            // 反向 FS - 先向右再折弯
                            const p1x = startX + gap;
                            
                            if (succAbovePage) {
                                path = `M ${startX} ${startY} L ${p1x - r} ${startY}
                                        Q ${p1x} ${startY} ${p1x} ${startY - r}
                                        L ${p1x} ${-rowHeight * 0.5}`;
                            } else {
                                const pageBottom = printRows.length * rowHeight;
                                path = `M ${startX} ${startY} L ${p1x - r} ${startY}
                                        Q ${p1x} ${startY} ${p1x} ${startY + r}
                                        L ${p1x} ${pageBottom + rowHeight * 0.5}`;
                            }
                        }
                    }
                    
                    rels.push(
                        <path
                            key={`outgoing-${act.id}-${succAct.id}`}
                            d={path}
                            fill="none"
                            stroke="#94a3b8"
                            strokeWidth="1"
                            strokeLinejoin="round"
                            markerEnd="url(#arrow)"
                            style={{ isolation: 'isolate' }}
                        />
                    );
                });
            });
        }

        // Temp Link Line
        if (linkDrag) {
            rels.push(
                <line
                    key="temp-link"
                    x1={linkDrag.startX} y1={linkDrag.startY}
                    x2={linkDrag.currentX} y2={linkDrag.currentY}
                    stroke="#2563eb" strokeWidth="2" strokeDasharray="5,5"
                />
            );
        }

        return <g style={{ pointerEvents: 'none' }}>{rels}</g>;
    }, [showRelations, rows, printRows, printMode, printRowStart, printRowEnd, rowIndexMap, startIndex, endIndex, rowHeight, pixelPerDay, projectStartDate, scrollLeft, viewportWidth, linkDrag, leftPadding]);


    useEffect(() => {
        if (!linkDrag) return;

        const onMove = (e: MouseEvent) => {
            if (!bodyContainerRef.current) return;
            const rect = bodyContainerRef.current.getBoundingClientRect();
            setLinkDrag(prev => prev ? {
                ...prev,
                currentX: e.clientX - rect.left + bodyContainerRef.current!.scrollLeft,
                currentY: e.clientY - rect.top + bodyContainerRef.current!.scrollTop
            } : null);
        };

        const onUp = () => {
            setLinkDrag(null);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => {
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
    }, [linkDrag]);

    const handleLinkStart = (e: React.MouseEvent, activity: Activity, type: 'start' | 'end', y: number, x: number) => {
        e.stopPropagation();
        e.preventDefault();
        // Calculate exact start pos
        setLinkDrag({
            sourceId: activity.id,
            sourceType: type,
            startX: x,
            startY: y,
            currentX: x,
            currentY: y
        });
    };

    const handleLinkDrop = (e: React.MouseEvent, targetActivity: Activity, targetType: 'start' | 'end') => {
        e.stopPropagation();
        if (!linkDrag) return;
        if (linkDrag.sourceId === targetActivity.id) {
            setLinkDrag(null);
            return;
        }

        // Determine Type
        // Src End -> Tgt Start = FS
        // Src Start -> Tgt Start = SS
        // Src End -> Tgt End = FF
        // Src Start -> Tgt End = SF
        let relType = 'FS';
        if (linkDrag.sourceType === 'end' && targetType === 'start') relType = 'FS';
        else if (linkDrag.sourceType === 'start' && targetType === 'start') relType = 'SS';
        else if (linkDrag.sourceType === 'end' && targetType === 'end') relType = 'FF';
        else if (linkDrag.sourceType === 'start' && targetType === 'end') relType = 'SF';

        // Add Predecessor
        // Check if exists
        const exists = targetActivity.predecessors?.some((p: any) => p.activityId === linkDrag.sourceId && p.type === relType);
        if (!exists) {
            const newPreds = [...(targetActivity.predecessors || []), { activityId: linkDrag.sourceId, type: relType, lag: 0 }];
            handleUpdate(targetActivity.id, 'predecessors', newPreds);
        }

        setLinkDrag(null);
    };

    // 时间标尺右键菜单处理
    const handleTimeScaleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setTimeScaleMenu({ x: e.clientX, y: e.clientY });
    };

    // 关闭时间标尺菜单
    useEffect(() => {
        const handleClickOutside = () => setTimeScaleMenu(null);
        if (timeScaleMenu) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [timeScaleMenu]);

    const handleMouseDown = (e: React.MouseEvent) => {
        const startX = e.clientX;
        const currentPPD = pixelPerDay;

        const onMove = (evt: MouseEvent) => {
            const diff = evt.clientX - startX;
            const newZoom = Math.max(0.1, currentPPD + (diff * 0.1));
            setGanttPixelPerDay(newZoom);  // 使用 store 的 setter
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    const handleBodyScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (headerContainerRef.current) {
            headerContainerRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
        setScrollLeft(e.currentTarget.scrollLeft);
        if (onScroll) onScroll(e);
    };

    // Handle bar click to select activity
    const handleBarClick = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (e.ctrlKey || e.metaKey) {
            if (selectedIds.includes(id)) {
                onSelect(selectedIds.filter(x => x !== id));
            } else {
                onSelect([...selectedIds, id]);
            }
        } else {
            onSelect([id]);
        }
    };

    // 夜间模式颜色变量
    const isDarkMode = theme === 'dark' && !printMode;
    const headerBgColor = printMode ? '#f8fafc' : (isDarkMode ? '#334155' : '#f8fafc');
    const headerLineColor = printMode ? '#e2e8f0' : (isDarkMode ? '#475569' : '#e2e8f0');
    const bodyBgColor = printMode ? '#ffffff' : (isDarkMode ? '#1e293b' : '#ffffff');

    return (
        <div className={`flex-grow flex flex-col h-full overflow-hidden select-none gantt-component ${printMode ? 'bg-white' : 'bg-white dark:bg-slate-800'}`}>
            {/* 1. Header Container */}
            <div
                ref={headerContainerRef}
                className={`border-b overflow-hidden shrink-0 relative gantt-header-wrapper ${printMode ? 'bg-slate-50 border-slate-200' : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600'}`}
                style={{ height: headerHeight, width: '100%' }}
            >
                <div style={{ width: chartWidth, height: headerHeight }} className="relative">
                    <svg width={chartWidth} height={headerHeight} xmlns="http://www.w3.org/2000/svg" onContextMenu={handleTimeScaleContextMenu}>
                        <rect x="0" y="0" width={chartWidth} height={headerHeight} fill={headerBgColor} className="cursor-ew-resize" onMouseDown={handleMouseDown} />
                        <line x1="0" y1={headerHeight} x2={chartWidth} y2={headerHeight} stroke={headerLineColor} strokeWidth="1" />
                        <g style={{ pointerEvents: 'none' }}>{timeHeaders}</g>
                    </svg>
                </div>
            </div>

            {/* 时间标尺右键菜单 */}
            {timeScaleMenu && (
                <div 
                    className={`fixed z-50 rounded-lg shadow-lg py-1 min-w-[160px] ${isDarkMode ? 'bg-slate-800 border border-slate-600' : 'bg-white border border-slate-200'}`}
                    style={{ left: timeScaleMenu.x, top: timeScaleMenu.y }}
                    onClick={e => e.stopPropagation()}
                >
                    <div className={`px-3 py-1.5 text-xs border-b ${isDarkMode ? 'text-slate-400 border-slate-600' : 'text-slate-500 border-slate-100'}`}>
                        {userSettings.language === 'zh' ? '时间标尺' : 'Time Scale'}
                    </div>
                    {[
                        { value: 'auto', label: userSettings.language === 'zh' ? '自动' : 'Auto' },
                        { value: 'year-month', label: userSettings.language === 'zh' ? '年 / 月' : 'Year / Month' },
                        { value: 'year-quarter', label: userSettings.language === 'zh' ? '年 / 季度' : 'Year / Quarter' },
                        { value: 'quarter-month', label: userSettings.language === 'zh' ? '季度 / 月' : 'Quarter / Month' },
                        { value: 'month-week', label: userSettings.language === 'zh' ? '月 / 周' : 'Month / Week' },
                        { value: 'year-quarter-month', label: userSettings.language === 'zh' ? '年 / 季度 / 月' : 'Year / Quarter / Month' },
                    ].map(item => (
                        <button
                            key={item.value}
                            className={`w-full px-3 py-1.5 text-left text-sm flex items-center justify-between ${
                                ganttTimeScale === item.value 
                                    ? 'text-blue-500 bg-blue-500/10' 
                                    : isDarkMode ? 'text-slate-300 hover:bg-slate-700' : 'text-slate-700 hover:bg-slate-100'
                            }`}
                            onClick={() => {
                                setGanttTimeScale(item.value as any);
                                setTimeScaleMenu(null);
                            }}
                        >
                            <span>{item.label}</span>
                            {ganttTimeScale === item.value && <span className="text-blue-500">✓</span>}
                        </button>
                    ))}
                </div>
            )}

            {/* 2. Body Container */}
            <div
                ref={bodyContainerRef}
                className={`flex-grow relative custom-scrollbar gantt-body-wrapper ${printMode ? 'bg-white overflow-hidden' : 'bg-white dark:bg-slate-800 overflow-scroll'}`}
                onScroll={printMode ? undefined : handleBodyScroll}
                style={{ backgroundColor: bodyBgColor }}
            >
                <div style={{ width: chartWidth, height: printMode ? 'auto' : Math.max(totalHeight + 300, 100) }} className="relative">
                    <svg width={chartWidth} height={printMode ? (printRows.length * rowHeight) : Math.max(totalHeight, 100)} xmlns="http://www.w3.org/2000/svg" className="print-content">
                        <defs>
                            <marker id="arrow" markerWidth="5" markerHeight="5" refX="5" refY="2.5" orient="auto">
                                <path d="M0,0 L0,5 L5,2.5 z" fill={isDarkMode ? '#64748b' : '#94a3b8'} />
                            </marker>
                        </defs>

                        {/* 1. Background Grid (Bottom layer) */}
                        {gridLines}

                        {/* 1.1 Horizontal Row Lines (Also bottom layer, but above background grid) */}
                        <g>
                            {(printMode ? printRows.map((row, i) => ({ index: (printRowStart || 0) + i, row })) : virtualItems.map(({ index }) => ({ index, row: rows[index] }))).map(({ index, row }) => {
                                const y = (printMode ? (index - (printRowStart || 0)) : index) * rowHeight;
                                const isWBS = row.type === 'WBS';
                                const hLineColor = isDarkMode ? '#334155' : '#e2e8f0';
                                return (
                                    <React.Fragment key={`grid-h-${row.id}`}>
                                        {showHorizontalLines && (
                                            <line x1="0" y1={y + rowHeight} x2={chartWidth} y2={y + rowHeight} stroke={hLineColor} strokeWidth="0.5" />
                                        )}
                                        {isWBS && showWBSLines && (
                                            <line x1="0" y1={y + rowHeight} x2={chartWidth} y2={y + rowHeight} stroke={hLineColor} strokeWidth="1" />
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </g>

                        {/* 2. Relationship Lines (Middle layer, below bars) */}
                        {showRelations && relationships}

                        {/* 3. Bars and Text (Top layer) */}
                        <g>
                            {/* Activity/WBS Rendering */}
                            {(printMode ? printRows.map((row, i) => ({ index: (printRowStart || 0) + i, row })) : virtualItems.map(({ index }) => ({ index, row: rows[index] }))).map(({ index, row }) => {
                                const y = (printMode ? (index - (printRowStart || 0)) : index) * rowHeight;
                                const globalOffset = 0;
                                const left = getPosition(row.startDate) + globalOffset;
                                const right = getPosition(row.endDate) + pixelPerDay + globalOffset;
                                const width = Math.max(right - left, 2);
                                const barH = Math.max(6, rowHeight * 0.35);
                                const barY = y + (rowHeight - barH) / 2;

                                const displayLeft = left;
                                const displayRight = right;

                                if (row.type === 'WBS') {
                                    if (!row.startDate) return null;
                                    const wbsBarH = 4;
                                    const wbsY = y + (rowHeight - wbsBarH) / 2;
                                    const isSelected = !printMode && selectedIds.includes(row.id);
                                    return (
                                        <g key={row.id} onClick={(e) => handleBarClick(e, row.id)} className="cursor-pointer">
                                            {isSelected && (
                                                <rect x={left - 4} y={wbsY - 4} width={width + 8} height={12} fill="#bfdbfe" rx="2" />
                                            )}
                                            <rect x={left} y={wbsY + 1} width={width} height={3} fill={isSelected ? '#3b82f6' : '#cccccc'} />
                                            <path d={`M ${left} ${wbsY} L ${left + 5} ${wbsY} L ${left} ${wbsY + 5} Z`} fill={isSelected ? '#2563eb' : '#999999'} />
                                            <path d={`M ${right} ${wbsY} L ${right - 5} ${wbsY} L ${right} ${wbsY + 5} Z`} fill={isSelected ? '#2563eb' : '#999999'} />
                                        </g>
                                    );
                                } else {
                                    const activity = row.data as Activity;
                                    const isMilestone = activity.duration === 0;
                                    const isSelected = !printMode && selectedIds.includes(activity.id);
                                    const barColor = isSelected ? '#3b82f6' : (showCritical && activity.isCritical ? '#ef4444' : '#10b981');
                                    const strokeColor = isSelected ? '#1d4ed8' : (showCritical && activity.isCritical ? '#b91c1c' : '#047857');

                                    const isTarget = linkDrag && linkDrag.sourceId !== activity.id;
                                    const barCenterY = y + rowHeight / 2;

                                    return (
                                        <g key={activity.id} className="group cursor-pointer" onClick={(e) => handleBarClick(e, activity.id)}>
                                            {/* Selection highlight background */}
                                            {isSelected && !isMilestone && (
                                                <rect x={displayLeft - 3} y={barY - 3} width={width + 6} height={barH + 6} fill="#bfdbfe" rx="3" />
                                            )}
                                            {isSelected && isMilestone && (
                                                <rect x={displayLeft - 4} y={barCenterY - 10} width={20} height={20} fill="#bfdbfe" rx="3" />
                                            )}
                                            {isMilestone ? (
                                                <path d={`M ${displayLeft} ${barCenterY} l 6 -6 l 6 6 l -6 6 z`} fill={isSelected ? '#3b82f6' : '#1e293b'} stroke={strokeColor} strokeWidth="1" />
                                            ) : (
                                                <rect
                                                    x={displayLeft} y={barY} width={width} height={barH} rx="1"
                                                    fill={barColor} stroke={strokeColor} strokeWidth="1"
                                                    className="transition-opacity"
                                                />
                                            )}

                                            {/* Link Handles */}
                                            <circle
                                                cx={displayLeft - 5} cy={barCenterY} r={4}
                                                fill="white" stroke="#2563eb" strokeWidth="2"
                                                className={`opacity-0 group-hover:opacity-100 cursor-cell transition-opacity z-10 ${isTarget ? 'opacity-100' : ''}`}
                                                onMouseDown={(e) => handleLinkStart(e, activity, 'start', barCenterY, displayLeft - 5)}
                                                onMouseUp={(e) => handleLinkDrop(e, activity, 'start')}
                                            />
                                            <circle
                                                cx={isMilestone ? displayLeft + 12 + 5 : displayRight + 5} cy={barCenterY} r={4}
                                                fill="white" stroke="#2563eb" strokeWidth="2"
                                                className={`opacity-0 group-hover:opacity-100 cursor-cell transition-opacity z-10 ${isTarget ? 'opacity-100' : ''}`}
                                                onMouseDown={(e) => handleLinkStart(e, activity, 'end', barCenterY, isMilestone ? displayLeft + 17 : displayRight + 5)}
                                                onMouseUp={(e) => handleLinkDrop(e, activity, 'end')}
                                            />

                                            <text x={Math.max(displayRight, displayLeft + 12) + 12} y={y + rowHeight / 2 + 4} fontSize={fontSize - 1} fill={isDarkMode ? '#cbd5e1' : '#475569'} fontWeight="500">
                                                {activity.name}
                                            </text>
                                        </g>
                                    );
                                }
                            })}
                        </g>
                    </svg>
                </div>
            </div>
        </div>
    );
});

export default GanttChart;
