import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { useTranslation } from '../utils/i18n';
import { useFlatRows } from '../hooks/useFlatRows';

interface PrintPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    lang?: 'en' | 'zh';
}

// Paper sizes in mm (width x height in portrait mode)
const PAPER_SIZES: Record<string, { width: number; height: number; label: string }> = {
    a4: { width: 210, height: 297, label: 'A4' },
    a3: { width: 297, height: 420, label: 'A3' },
    a2: { width: 420, height: 594, label: 'A2' },
    a1: { width: 594, height: 841, label: 'A1' },
};

const MM_TO_PX = 96 / 25.4; // 96 DPI

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({ isOpen, onClose, lang = 'en' }) => {
    const { t } = useTranslation(lang as 'en' | 'zh');
    const { data, schedule, userSettings, showRelations, showCritical } = useAppStore();
    const { flatRows } = useFlatRows();
    const previewContainerRef = useRef<HTMLDivElement>(null);
    
    // Safe access to schedule activities
    const scheduleActivities = schedule?.activities || [];
    
    const [settings, setSettings] = useState({
        paperSize: 'a3' as keyof typeof PAPER_SIZES,
        orientation: 'landscape' as 'landscape' | 'portrait',
        headerText: '',
        footerText: '',
        showPageNumber: true,
        showDate: true,
        showLegend: true,
        showBorder: true
    });

    const [previewScale, setPreviewScale] = useState(0.4);

    useEffect(() => {
        if (isOpen && data?.meta?.title) {
            setSettings(s => ({ ...s, headerText: data.meta.title }));
        }
    }, [isOpen, data?.meta?.title]);

    if (!isOpen || !data) return null;

    // Check if we have data to display
    const hasData = flatRows.length > 0 || data.wbs?.length > 0 || data.activities?.length > 0;

    const currentDate = new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US');
    
    // Paper dimensions in pixels
    const paper = PAPER_SIZES[settings.paperSize];
    const paperWidthMm = settings.orientation === 'landscape' ? paper.height : paper.width;
    const paperHeightMm = settings.orientation === 'landscape' ? paper.width : paper.height;
    const paperWidthPx = paperWidthMm * MM_TO_PX;
    const paperHeightPx = paperHeightMm * MM_TO_PX;
    
    // Content area (minus margins and header/footer)
    const marginPx = 10 * MM_TO_PX; // 10mm margins
    const headerFooterHeight = 32; // px
    const legendHeight = settings.showLegend ? 28 : 0;
    const contentWidthPx = paperWidthPx - marginPx * 2;
    const contentHeightPx = paperHeightPx - marginPx * 2 - headerFooterHeight * 2 - legendHeight;

    // Row and column calculations
    const fontSizePx = userSettings.uiFontPx || 13;
    const ROW_HEIGHT = Math.max(28, fontSizePx + 12);
    const TABLE_HEADER_HEIGHT = 36;
    
    // Calculate visible columns width
    const visibleCols = userSettings.visibleColumns || ['id', 'name', 'duration', 'start', 'finish'];
    const defaultWidths: Record<string, number> = { id: 100, name: 160, duration: 50, start: 80, finish: 80, float: 40, preds: 100 };
    const colWidths = { ...defaultWidths, ...userSettings.columnWidths };
    const tableWidth = visibleCols.reduce((sum, col) => sum + (colWidths[col] || 80), 0) + 30;
    
    // Gantt width = remaining space
    const ganttWidth = Math.max(contentWidthPx - tableWidth, 200);

    // Calculate pages based on row count
    const rowsPerPage = Math.max(1, Math.floor((contentHeightPx - TABLE_HEADER_HEIGHT) / ROW_HEIGHT));
    const totalPages = flatRows.length > 0 ? Math.max(1, Math.ceil(flatRows.length / rowsPerPage)) : 0;

    // Date calculations for Gantt
    const { minDate, maxDate, totalDays } = useMemo(() => {
        if (scheduleActivities.length === 0) {
            return { minDate: new Date(), maxDate: new Date(), totalDays: 30 };
        }
        let min = new Date();
        let max = new Date();
        scheduleActivities.forEach((a, i) => {
            const start = new Date(a.startDate);
            const end = new Date(a.endDate);
            if (i === 0 || start < min) min = start;
            if (i === 0 || end > max) max = end;
        });
        const days = Math.ceil((max.getTime() - min.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        return { minDate: min, maxDate: max, totalDays: days };
    }, [scheduleActivities]);

    const pixelPerDay = ganttWidth / Math.max(totalDays, 1);

    const getBarX = (date: Date | string) => {
        const d = new Date(date);
        return (d.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24) * pixelPerDay;
    };

    const formatDate = (date: Date | string): string => {
        const d = new Date(date);
        if (isNaN(d.getTime())) return '-';
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    // Update preview scale based on container
    useEffect(() => {
        if (!previewContainerRef.current) return;
        const container = previewContainerRef.current;
        const containerWidth = container.clientWidth - 48;
        const scale = Math.min(containerWidth / paperWidthPx, 0.5);
        setPreviewScale(scale);
    }, [paperWidthPx, isOpen]);

    // Generate month headers
    const generateMonthHeaders = () => {
        const headers: JSX.Element[] = [];
        const current = new Date(minDate);
        current.setDate(1);
        
        while (current <= maxDate) {
            const x = getBarX(current);
            const nextMonth = new Date(current);
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            const width = Math.min(
                (nextMonth.getTime() - current.getTime()) / (1000 * 60 * 60 * 24) * pixelPerDay,
                ganttWidth - x
            );
            
            if (x < ganttWidth && width > 20) {
                headers.push(
                    <g key={`month-${current.getTime()}`}>
                        <line x1={x} y1={0} x2={x} y2={TABLE_HEADER_HEIGHT} stroke="#cbd5e1" strokeWidth="1" />
                        <text x={x + Math.min(width, 60) / 2} y={TABLE_HEADER_HEIGHT / 2 + 4} fontSize="9" fill="#475569" textAnchor="middle">
                            {current.toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', year: '2-digit' })}
                        </text>
                    </g>
                );
            }
            current.setMonth(current.getMonth() + 1);
        }
        return headers;
    };
