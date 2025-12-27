import React, { useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';
import GanttChart from './GanttChart';
import { ActivityTable } from './ActivityTable';

const CombinedView: React.FC = () => {
    const { 
        data: projectData, 
        userSettings
    } = useAppStore();

    // Scroll Sync
    const tableRef = useRef<HTMLDivElement>(null);
    const ganttRef = useRef<HTMLDivElement>(null);
    const isScrolling = useRef<'table' | 'gantt' | null>(null);

    // Scroll Handlers
    const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (isScrolling.current === 'gantt') return;
        isScrolling.current = 'table';
        if (ganttRef.current) ganttRef.current.scrollTop = e.currentTarget.scrollTop;
        setTimeout(() => { if(isScrolling.current === 'table') isScrolling.current = null; }, 50);
    };

    const handleGanttScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (isScrolling.current === 'table') return;
        isScrolling.current = 'gantt';
        if (tableRef.current) tableRef.current.scrollTop = e.currentTarget.scrollTop;
        setTimeout(() => { if(isScrolling.current === 'gantt') isScrolling.current = null; }, 50);
    };

    const fontSizePx = userSettings.uiFontPx || 13;
    const ROW_HEIGHT = Math.max(32, fontSizePx + 16);
    const headerHeight = Math.max(45, fontSizePx * 2.5);

    if (!projectData) return null;

    return (
        <div className="flex-grow flex overflow-hidden bg-white select-none relative h-full">
            <ActivityTable 
                ref={tableRef}
                onScroll={handleTableScroll}
                headerHeight={headerHeight}
                rowHeight={ROW_HEIGHT}
            />
            <div className="flex-grow overflow-hidden relative">
                <GanttChart 
                    ref={ganttRef}
                    onScroll={handleGanttScroll}
                    headerHeight={headerHeight}
                    rowHeight={ROW_HEIGHT}
                />
            </div>
        </div>
    );
};

export default CombinedView;
