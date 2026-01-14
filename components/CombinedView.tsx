import React, { useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import GanttChart from './GanttChart';
import { ActivityTable } from './ActivityTable';

export interface CombinedViewProps {
    printMode?: boolean;
    printPageIndex?: number;
    printRowStart?: number;
    printRowEnd?: number;
    printShowRelations?: boolean;
    printShowCritical?: boolean;
    printRowHeight?: number;
}

const CombinedView: React.FC<CombinedViewProps> = ({ 
    printMode = false, 
    printPageIndex = 0,
    printRowStart,
    printRowEnd,
    printShowRelations,
    printShowCritical,
    printRowHeight
}) => {
    const { 
        data: projectData, 
        userSettings,
        showRelations: storeShowRelations,
        showCritical: storeShowCritical
    } = useAppStore();

    // 打印模式使用传入的状态，否则使用 store 状态
    const showRelations = printMode ? (printShowRelations ?? storeShowRelations) : storeShowRelations;
    const showCritical = printMode ? (printShowCritical ?? storeShowCritical) : storeShowCritical;

    // Scroll Sync
    const tableRef = useRef<HTMLDivElement>(null);
    const ganttRef = useRef<HTMLDivElement>(null);
    const isScrolling = useRef<'table' | 'gantt' | null>(null);

    // Scroll Handlers
    const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (printMode) return;
        if (isScrolling.current === 'gantt') return;
        isScrolling.current = 'table';
        if (ganttRef.current) ganttRef.current.scrollTop = e.currentTarget.scrollTop;
        setTimeout(() => { if(isScrolling.current === 'table') isScrolling.current = null; }, 50);
    };

    const handleGanttScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (printMode) return;
        if (isScrolling.current === 'table') return;
        isScrolling.current = 'gantt';
        if (tableRef.current) tableRef.current.scrollTop = e.currentTarget.scrollTop;
        setTimeout(() => { if(isScrolling.current === 'gantt') isScrolling.current = null; }, 50);
    };

    const fontSizePx = printMode ? 10 : (userSettings.uiFontPx || 13);
    const ROW_HEIGHT = printMode ? (printRowHeight || 28) : Math.max(32, fontSizePx + 16);
    const headerHeight = printMode ? 48 : Math.max(45, fontSizePx * 2.5);  // 打印模式增加表头高度以容纳三行时间标尺

    if (!projectData) return null;

    return (
        <div className="flex-grow flex overflow-hidden bg-white select-none relative h-full">
            <ActivityTable 
                ref={tableRef}
                onScroll={handleTableScroll}
                headerHeight={headerHeight}
                rowHeight={ROW_HEIGHT}
                printMode={printMode}
                printRowStart={printRowStart}
                printRowEnd={printRowEnd}
            />
            <div className="flex-grow overflow-hidden relative">
                <GanttChart 
                    ref={ganttRef}
                    onScroll={handleGanttScroll}
                    headerHeight={headerHeight}
                    rowHeight={ROW_HEIGHT}
                    printMode={printMode}
                    printRowStart={printRowStart}
                    printRowEnd={printRowEnd}
                    printShowRelations={showRelations}
                    printShowCritical={showCritical}
                />
            </div>
        </div>
    );
};

export default CombinedView;
