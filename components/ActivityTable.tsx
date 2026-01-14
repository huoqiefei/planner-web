import React, { useState, useRef, useImperativeHandle, useEffect } from 'react';
import { Activity, WBSNode, Predecessor, RelationType } from '../types';
import { useAppStore } from '../stores/useAppStore';
import { useProjectOperations } from '../hooks/useProjectOperations';
import { useFlatRows } from '../hooks/useFlatRows';
import { useVirtualScroll } from '../hooks/useVirtualScroll';
import { ResizableHeader } from './ResizableHeader';
import { useTranslation } from '../utils/i18n';

interface ActivityTableProps {
    onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
    headerHeight: number;
    rowHeight: number;
    printMode?: boolean;
    printRowStart?: number;
    printRowEnd?: number;
}

const formatDate = (date: Date): string => {
    if (!date || isNaN(date.getTime())) return '-';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export const ActivityTable = React.forwardRef<HTMLDivElement, ActivityTableProps>(({
    onScroll, headerHeight, rowHeight, printMode = false, printRowStart, printRowEnd
}, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const headerRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => containerRef.current as HTMLDivElement);

    const handleBodyScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (headerRef.current) {
            headerRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
        if (onScroll) onScroll(e);
    };

    const {
        selIds: selectedIds,
        setSelIds: onSelect,
        setCtx,
        userSettings,
        setUserSettings,
        schedule,
        data,
        theme
    } = useAppStore();

    const { handleUpdate: onUpdate } = useProjectOperations();
    const { flatRows: rows, toggleExpand: onToggleExpand } = useFlatRows();
    const { t } = useTranslation(userSettings.language);

    const { virtualItems, totalHeight } = useVirtualScroll({
        totalCount: rows.length,
        itemHeight: rowHeight,
        containerRef,
        overscan: 10
    });

    // 打印模式下的行数据
    const printRows = printMode && printRowStart !== undefined && printRowEnd !== undefined
        ? rows.slice(printRowStart, printRowEnd)
        : rows;

    const defaultWidths: Record<string, number> = {
        id: 180, name: 250, duration: 60, start: 90, finish: 90, float: 50, preds: 150, budget: 100
    };
    const [colWidths, setColWidths] = useState({ ...defaultWidths, ...userSettings.columnWidths });
    const [editing, setEditing] = useState<{ id: string, field: string } | null>(null);
    const [editVal, setEditVal] = useState('');

    // Sync TO store with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            if (JSON.stringify(colWidths) !== JSON.stringify(userSettings.columnWidths)) {
                setUserSettings((s) => ({ ...s, columnWidths: colWidths }));
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [colWidths, setUserSettings, userSettings.columnWidths]);

    const fontSizePx = userSettings.uiFontPx || 13;
    const visibleCols = userSettings.visibleColumns || ['id', 'name', 'duration', 'start', 'finish', 'float', 'preds'];

    const allCustomFields = data?.meta?.customFieldDefinitions?.filter(f => f.scope === 'activity') || [];
    const customFields = allCustomFields.filter(cf => visibleCols.includes(cf.id));

    // Calculate total required width for columns 
    const showVertical = userSettings.gridSettings.showRowNumbers ?? true;
    const indexColWidth = 32; // 行号列宽度，统一使用
    const standardWidth = Object.entries(colWidths)
        .filter(([key]) => visibleCols.includes(key))
        .reduce((sum, [_, width]) => sum + (width || 100), 0);
    const customWidth = customFields.reduce((sum, cf) => sum + (colWidths[cf.id] || 100), 0);
    const totalContentWidth = standardWidth + customWidth + (showVertical ? indexColWidth : 0);

    const startEdit = (id: string, field: string, val: any) => {
        setEditing({ id, field });
        if (field === 'predecessors') {
            const act = schedule.activities.find(a => a.id === id);
            const s = act?.predecessors.map(p => {
                if (p.type === 'FS' && p.lag === 0) return p.activityId;
                const lagStr = p.lag > 0 ? `+${p.lag}` : p.lag < 0 ? `${p.lag}` : '';
                return `${p.activityId}${p.type !== 'FS' ? p.type : ''}${lagStr}`;
            }).join(',') || '';
            setEditVal(s);
        } else {
            setEditVal(String(val));
        }
    };

    const saveEdit = () => {
        if (editing) {
            if (customFields.find(f => f.id === editing.field)) {
                const act = rows.find(r => r.id === editing.id)?.data as Activity;
                if (act) {
                    const newCustom = { ...act.customFields, [editing.field]: editVal };
                    onUpdate(editing.id, 'customFields', newCustom);
                }
            } else {
                onUpdate(editing.id, editing.field, editVal);
            }
        }
        setEditing(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') saveEdit();
        if (e.key === 'Escape') setEditing(null);
    };

    const handleRowClick = (id: string, e: React.MouseEvent) => {
        console.log('[ActivityTable] Click:', id, 'Meta:', e.metaKey, 'Ctrl:', e.ctrlKey, 'Shift:', e.shiftKey, 'CurrentSel:', selectedIds);

        // Range Selection (Shift)
        if (e.shiftKey && selectedIds.length > 0) {
            let anchorIndex = rows.findIndex(r => r.id === selectedIds[selectedIds.length - 1]);

            // Fallback: If anchor is hidden/collapsed, find the last visible selected item
            if (anchorIndex === -1) {
                for (let i = rows.length - 1; i >= 0; i--) {
                    if (selectedIds.includes(rows[i].id)) {
                        anchorIndex = i;
                        break;
                    }
                }
            }

            const currentIndex = rows.findIndex(r => r.id === id);

            if (anchorIndex !== -1 && currentIndex !== -1) {
                const start = Math.min(anchorIndex, currentIndex);
                const end = Math.max(anchorIndex, currentIndex);
                const range = rows.slice(start, end + 1).map(r => r.id);
                // Respect Ctrl/Meta key for Union
                const finalSel = e.ctrlKey || e.metaKey ? [...new Set([...selectedIds, ...range])] : range;
                console.log('[ActivityTable] Range Select:', finalSel);
                onSelect(finalSel);
                return;
            }
        }

        // Toggle / Single Selection
        if (e.ctrlKey || e.metaKey) {
            if (selectedIds.includes(id)) {
                console.log('[ActivityTable] Deselecting:', id);
                onSelect(selectedIds.filter(x => x !== id));
            } else {
                console.log('[ActivityTable] Adding:', id);
                onSelect([...selectedIds, id]);
            }
        } else {
            console.log('[ActivityTable] Single Select:', id);
            onSelect([id]);
        }
    };

    const handleContextMenu = (e: React.MouseEvent, id: string, type: 'WBS' | 'Activity') => {
        e.preventDefault();
        e.stopPropagation();
        let newSelIds = selectedIds;
        if (!selectedIds.includes(id)) {
            if (e.ctrlKey || e.metaKey) {
                newSelIds = [...selectedIds, id];
            } else {
                newSelIds = [id];
            }
            onSelect(newSelIds);
        }
        setCtx({ x: e.pageX, y: e.pageY, type, id, selIds: newSelIds });
    };

    return (
        <div className={`flex flex-col h-full border-r flex-shrink-0 ${printMode ? 'border-slate-300' : 'border-slate-300 dark:border-slate-600'}`} style={{ width: totalContentWidth, minWidth: totalContentWidth }}>
            {/* Header */}
            <div
                ref={headerRef}
                className={`overflow-hidden font-bold shadow-sm z-20 flex-shrink-0 ${printMode ? 'bg-slate-100 border-b border-slate-300 text-slate-700' : 'bg-slate-100 dark:bg-slate-700 border-b border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200'}`}
                style={{ height: headerHeight }}
            >
                <div className="flex h-full p6-header" style={{ minWidth: totalContentWidth }}>
                    {showVertical && (
                        <div className="border-r border-slate-300 dark:border-slate-600 px-2 h-full flex items-center justify-center flex-shrink-0" data-col="index" style={{ width: indexColWidth }}>#</div>
                    )}
                    {visibleCols.includes('id') && <ResizableHeader width={colWidths.id || defaultWidths.id} onResize={w => setColWidths({ ...colWidths, id: w })} dataCol="id">{t('ActivityID')}</ResizableHeader>}
                    {visibleCols.includes('name') && <ResizableHeader width={colWidths.name || defaultWidths.name} onResize={w => setColWidths({ ...colWidths, name: w })} dataCol="name">{t('ActivityName')}</ResizableHeader>}
                    {visibleCols.includes('duration') && <ResizableHeader width={colWidths.duration || defaultWidths.duration} onResize={w => setColWidths({ ...colWidths, duration: w })} align="right" dataCol="duration">{t('Duration')}</ResizableHeader>}
                    {visibleCols.includes('start') && <ResizableHeader width={colWidths.start || defaultWidths.start} onResize={w => setColWidths({ ...colWidths, start: w })} align="center" dataCol="start">{t('Start')}</ResizableHeader>}
                    {visibleCols.includes('finish') && <ResizableHeader width={colWidths.finish || defaultWidths.finish} onResize={w => setColWidths({ ...colWidths, finish: w })} align="center" dataCol="finish">{t('Finish')}</ResizableHeader>}
                    {visibleCols.includes('float') && <ResizableHeader width={colWidths.float || defaultWidths.float} onResize={w => setColWidths({ ...colWidths, float: w })} align="right" dataCol="float">{t('TotalFloat')}</ResizableHeader>}
                    {visibleCols.includes('preds') && <ResizableHeader width={colWidths.preds || defaultWidths.preds} onResize={w => setColWidths({ ...colWidths, preds: w })} dataCol="preds">{t('Predecessors')}</ResizableHeader>}
                    {/* Custom Field Headers */}
                    {customFields.map(cf => (
                        <ResizableHeader
                            key={cf.id}
                            width={colWidths[cf.id] || 100}
                            onResize={w => setColWidths({ ...colWidths, [cf.id]: w })}
                            dataCol={cf.id}
                        >
                            {cf.name}
                        </ResizableHeader>
                    ))}
                </div>
            </div>

            {/* Body */}
            <div
                className={`flex-grow relative p6-table-body ${printMode ? 'bg-white overflow-hidden' : 'bg-white dark:bg-slate-800 overflow-scroll'}`}
                ref={containerRef}
                onScroll={printMode ? undefined : handleBodyScroll}
            >
                <div style={{ minWidth: totalContentWidth, height: printMode ? 'auto' : totalHeight + 300, position: 'relative' }}>
                    {printMode ? (
                        // 打印模式：使用 SVG 渲染，与甘特图保持一致的文字定位
                        <svg 
                            width={totalContentWidth} 
                            height={printRows.length * rowHeight}
                            style={{ display: 'block' }}
                        >
                            {printRows.map((row, index) => {
                                const globalIndex = (printRowStart || 0) + index;
                                const y = index * rowHeight;
                                const isWBS = row.type === 'WBS';
                                // P6 风格的 WBS 层级背景色
                                const wbsLevelBgColors = ['#dbeafe', '#d1fae5', '#fef3c7', '#ede9fe', '#ffe4e6', '#cffafe'];
                                const bgColor = isWBS 
                                    ? wbsLevelBgColors[Math.min(row.depth, wbsLevelBgColors.length - 1)]
                                    : (globalIndex % 2 === 0 ? '#ffffff' : '#f8fafc');
                                const textY = y + rowHeight / 2 + 4; // 与甘特图一致的文字垂直位置
                                const fontSize = 11;  // 增大字号
                                const smallFontSize = 10;
                                
                                let xOffset = 0;
                                const cells: JSX.Element[] = [];
                                
                                // 背景
                                cells.push(
                                    <rect key={`bg-${row.id}`} x={0} y={y} width={totalContentWidth} height={rowHeight} fill={bgColor} />
                                );
                                // 底部边框
                                cells.push(
                                    <line key={`border-${row.id}`} x1={0} y1={y + rowHeight} x2={totalContentWidth} y2={y + rowHeight} stroke="#cbd5e1" strokeWidth="1" />
                                );
                                
                                // 行号列
                                if (showVertical) {
                                    cells.push(
                                        <rect key={`idx-bg-${row.id}`} x={xOffset} y={y} width={indexColWidth} height={rowHeight} fill="#f1f5f9" />
                                    );
                                    cells.push(
                                        <line key={`idx-border-${row.id}`} x1={xOffset + indexColWidth} y1={y} x2={xOffset + indexColWidth} y2={y + rowHeight} stroke="#cbd5e1" strokeWidth="1" />
                                    );
                                    cells.push(
                                        <text key={`idx-${row.id}`} x={xOffset + indexColWidth / 2} y={textY} fontSize={smallFontSize} fill="#64748b" textAnchor="middle">{globalIndex + 1}</text>
                                    );
                                    xOffset += indexColWidth;
                                }
                                
                                // ID列
                                if (visibleCols.includes('id')) {
                                    const colWidth = colWidths.id || defaultWidths.id;
                                    const indent = row.depth * 6 + 4;
                                    cells.push(
                                        <line key={`id-border-${row.id}`} x1={xOffset + colWidth} y1={y} x2={xOffset + colWidth} y2={y + rowHeight} stroke="#cbd5e1" strokeWidth="1" />
                                    );
                                    cells.push(
                                        <text key={`id-${row.id}`} x={xOffset + indent} y={textY} fontSize={fontSize} fill="#334155" fontWeight={isWBS ? 600 : 400}>
                                            {isWBS ? '▶ ' : ''}{row.id}
                                        </text>
                                    );
                                    xOffset += colWidth;
                                }
                                
                                // 名称列
                                if (visibleCols.includes('name')) {
                                    const colWidth = colWidths.name || defaultWidths.name;
                                    cells.push(
                                        <line key={`name-border-${row.id}`} x1={xOffset + colWidth} y1={y} x2={xOffset + colWidth} y2={y + rowHeight} stroke="#cbd5e1" strokeWidth="1" />
                                    );
                                    cells.push(
                                        <clipPath key={`name-clip-${row.id}`} id={`name-clip-${row.id}`}>
                                            <rect x={xOffset + 4} y={y} width={colWidth - 8} height={rowHeight} />
                                        </clipPath>
                                    );
                                    cells.push(
                                        <text key={`name-${row.id}`} x={xOffset + 4} y={textY} fontSize={fontSize} fill="#334155" fontWeight={isWBS ? 600 : 400} clipPath={`url(#name-clip-${row.id})`}>
                                            {row.data.name}
                                        </text>
                                    );
                                    xOffset += colWidth;
                                }
                                
                                // 工期列
                                if (visibleCols.includes('duration')) {
                                    const colWidth = colWidths.duration || defaultWidths.duration;
                                    cells.push(
                                        <line key={`dur-border-${row.id}`} x1={xOffset + colWidth} y1={y} x2={xOffset + colWidth} y2={y + rowHeight} stroke="#cbd5e1" strokeWidth="1" />
                                    );
                                    cells.push(
                                        <text key={`dur-${row.id}`} x={xOffset + colWidth / 2} y={textY} fontSize={fontSize} fill="#334155" textAnchor="middle">
                                            {row.type === 'Activity' ? row.data.duration : row.duration}
                                        </text>
                                    );
                                    xOffset += colWidth;
                                }
                                
                                // 开始日期列
                                if (visibleCols.includes('start')) {
                                    const colWidth = colWidths.start || defaultWidths.start;
                                    cells.push(
                                        <line key={`start-border-${row.id}`} x1={xOffset + colWidth} y1={y} x2={xOffset + colWidth} y2={y + rowHeight} stroke="#cbd5e1" strokeWidth="1" />
                                    );
                                    cells.push(
                                        <text key={`start-${row.id}`} x={xOffset + colWidth / 2} y={textY} fontSize={fontSize} fill="#334155" textAnchor="middle">
                                            {formatDate(row.type === 'Activity' ? row.data.startDate : row.startDate)}
                                        </text>
                                    );
                                    xOffset += colWidth;
                                }
                                
                                // 结束日期列
                                if (visibleCols.includes('finish')) {
                                    const colWidth = colWidths.finish || defaultWidths.finish;
                                    cells.push(
                                        <line key={`finish-border-${row.id}`} x1={xOffset + colWidth} y1={y} x2={xOffset + colWidth} y2={y + rowHeight} stroke="#cbd5e1" strokeWidth="1" />
                                    );
                                    cells.push(
                                        <text key={`finish-${row.id}`} x={xOffset + colWidth / 2} y={textY} fontSize={fontSize} fill="#334155" textAnchor="middle">
                                            {formatDate(row.type === 'Activity' ? row.data.endDate : row.endDate)}
                                        </text>
                                    );
                                    xOffset += colWidth;
                                }
                                
                                // 总浮时列
                                if (visibleCols.includes('float')) {
                                    const colWidth = colWidths.float || defaultWidths.float;
                                    const floatVal = row.type === 'Activity' ? row.data.totalFloat : null;
                                    const isCritical = floatVal !== null && floatVal <= 0;
                                    cells.push(
                                        <line key={`float-border-${row.id}`} x1={xOffset + colWidth} y1={y} x2={xOffset + colWidth} y2={y + rowHeight} stroke="#cbd5e1" strokeWidth="1" />
                                    );
                                    if (floatVal !== null) {
                                        cells.push(
                                            <text key={`float-${row.id}`} x={xOffset + colWidth / 2} y={textY} fontSize={fontSize} fill={isCritical ? '#dc2626' : '#334155'} fontWeight={isCritical ? 700 : 400} textAnchor="middle">
                                                {floatVal}
                                            </text>
                                        );
                                    }
                                    xOffset += colWidth;
                                }
                                
                                // 前置任务列
                                if (visibleCols.includes('preds')) {
                                    const colWidth = colWidths.preds || defaultWidths.preds;
                                    cells.push(
                                        <line key={`preds-border-${row.id}`} x1={xOffset + colWidth} y1={y} x2={xOffset + colWidth} y2={y + rowHeight} stroke="#cbd5e1" strokeWidth="1" />
                                    );
                                    if (row.type === 'Activity' && row.data.predecessors) {
                                        const predsText = row.data.predecessors.map((p: any) => {
                                            if (p.type === 'FS' && p.lag === 0) return p.activityId;
                                            const lagStr = p.lag > 0 ? `+${p.lag}` : p.lag < 0 ? `${p.lag}` : '';
                                            return `${p.activityId}${p.type !== 'FS' ? p.type : ''}${lagStr}`;
                                        }).join(', ');
                                        cells.push(
                                            <text key={`preds-${row.id}`} x={xOffset + 4} y={textY} fontSize={smallFontSize} fill="#334155">
                                                {predsText}
                                            </text>
                                        );
                                    }
                                    xOffset += colWidth;
                                }
                                
                                // 自定义字段列
                                customFields.forEach(cf => {
                                    const colWidth = colWidths[cf.id] || 100;
                                    cells.push(
                                        <line key={`cf-${cf.id}-border-${row.id}`} x1={xOffset + colWidth} y1={y} x2={xOffset + colWidth} y2={y + rowHeight} stroke="#cbd5e1" strokeWidth="1" />
                                    );
                                    if (row.type === 'Activity') {
                                        cells.push(
                                            <text key={`cf-${cf.id}-${row.id}`} x={xOffset + 4} y={textY} fontSize={smallFontSize} fill="#334155">
                                                {row.data.customFields?.[cf.id] || '-'}
                                            </text>
                                        );
                                    }
                                    xOffset += colWidth;
                                });
                                
                                return <g key={row.id}>{cells}</g>;
                            })}
                        </svg>
                    ) : (
                        // 正常模式：虚拟滚动
                        virtualItems.map(({ index, offsetTop }) => {
                        const row = rows[index];
                        const isSel = selectedIds.includes(row.id);
                        // WBS 层级背景色 - 夜间模式使用深色版本
                        const wbsLevelBgColorsLight = [
                            '#dbeafe', // Level 0 - blue-100
                            '#d1fae5', // Level 1 - emerald-100
                            '#fef3c7', // Level 2 - amber-100
                            '#ede9fe', // Level 3 - purple-100
                            '#ffe4e6', // Level 4 - rose-100
                            '#cffafe', // Level 5+ - cyan-100
                        ];
                        const wbsLevelBgColorsDark = [
                            '#1e3a5f', // Level 0 - dark blue
                            '#1a3d3d', // Level 1 - dark emerald
                            '#3d3520', // Level 2 - dark amber
                            '#2d2640', // Level 3 - dark purple
                            '#3d2530', // Level 4 - dark rose
                            '#1a3d3d', // Level 5+ - dark cyan
                        ];
                        // 检测是否为夜间模式
                        const isDark = theme === 'dark' && !printMode;
                        const wbsLevelBgColors = isDark ? wbsLevelBgColorsDark : wbsLevelBgColorsLight;
                        const defaultBgEven = isDark ? '#1e293b' : '#ffffff';
                        const defaultBgOdd = isDark ? '#334155' : '#f8fafc';
                        const rowBgColor = row.type === 'WBS' 
                            ? wbsLevelBgColors[Math.min(row.depth, wbsLevelBgColors.length - 1)]
                            : (index % 2 === 0 ? defaultBgEven : defaultBgOdd);
                        return (
                            <div
                                key={row.id}
                                className={`flex border-b border-slate-100 dark:border-slate-700 transition-colors cursor-pointer group absolute left-0 w-full p6-row select-none ${isSel ? '!bg-blue-200 dark:!bg-blue-900' : 'hover:bg-blue-50 dark:hover:bg-slate-600'}`}
                                style={{ 
                                    height: rowHeight, 
                                    top: offsetTop, 
                                    fontSize: `${fontSizePx}px`,
                                    backgroundColor: isSel ? undefined : rowBgColor
                                }}
                                onClick={(e) => handleRowClick(row.id, e)}
                                onContextMenu={(e) => handleContextMenu(e, row.id, row.type)}
                            >
                                {showVertical && (
                                    <div className="w-8 flex-shrink-0 border-r border-slate-200 dark:border-slate-600 flex items-center justify-center text-xs text-slate-400 dark:text-slate-500 select-none bg-slate-50 dark:bg-slate-700 p6-cell print:bg-transparent" data-col="index" style={{ width: indexColWidth }}>
                                        {index + 1}
                                    </div>
                                )}

                                {/* ID Column */}
                                {visibleCols.includes('id') && (
                                    <div className="flex-shrink-0 border-r border-slate-200 dark:border-slate-600 px-1 flex items-center p6-cell" data-col="id" style={{ width: colWidths.id || defaultWidths.id }}>
                                        <div style={{ paddingLeft: row.depth * 6 }} className="flex items-center w-full overflow-hidden">
                                            {row.type === 'WBS' && (
                                                <button onClick={(e) => { e.stopPropagation(); onToggleExpand(row.id); }} className="mr-0.5 text-slate-500 hover:text-black dark:hover:text-white focus:outline-none text-xs">
                                                    {row.expanded ? '▼' : '▶'}
                                                </button>
                                            )}
                                            {row.type === 'Activity' && <div className="w-3 mr-0.5"></div>}
                                            {editing?.id === row.id && editing?.field === 'id' && row.type === 'WBS' ? (
                                                <input autoFocus className="w-full h-full border-2 border-blue-400 px-1 rounded" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} />
                                            ) : (
                                                <span onDoubleClick={() => row.type === 'WBS' && row.depth > 0 && startEdit(row.id, 'id', row.id)} className={`truncate ${row.type === 'WBS' ? 'font-bold text-slate-700 dark:text-slate-200' : ''}`}>{row.id}</span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Name Column */}
                                {visibleCols.includes('name') && (
                                    <div className="flex-shrink-0 border-r border-slate-200 dark:border-slate-600 px-2 flex items-center p6-cell" data-col="name" style={{ width: colWidths.name || defaultWidths.name }}>
                                        {editing?.id === row.id && editing?.field === 'name' ? (
                                            <input autoFocus className="w-full h-full border-2 border-blue-400 px-1 rounded" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} />
                                        ) : (
                                            <span onDoubleClick={() => {
                                                if (row.type === 'WBS' && row.depth === 0) return;
                                                startEdit(row.id, 'name', row.data.name);
                                            }} className={`truncate w-full ${row.type === 'WBS' ? 'font-bold' : ''}`}>{row.data.name}</span>
                                        )}
                                    </div>
                                )}

                                {/* Duration */}
                                {visibleCols.includes('duration') && (
                                    <div className="flex-shrink-0 border-r border-slate-200 dark:border-slate-600 px-2 flex items-center justify-end p6-cell" data-col="duration" style={{ width: colWidths.duration || defaultWidths.duration }}>
                                        {row.type === 'Activity' && (editing?.id === row.id && editing?.field === 'duration' ? (
                                            <input autoFocus type="text" inputMode="numeric" pattern="[0-9]*" className="w-full h-full border-2 border-blue-400 px-1 rounded text-right" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} />
                                        ) : (
                                            <span onDoubleClick={() => startEdit(row.id, 'duration', row.data.duration)}>{row.data.duration}</span>
                                        ))}
                                        {row.type === 'WBS' && <span className="font-semibold text-slate-500">{row.duration}</span>}
                                    </div>
                                )}

                                {/* Start Date */}
                                {visibleCols.includes('start') && (
                                    <div className="flex-shrink-0 border-r border-slate-200 dark:border-slate-600 px-2 flex items-center justify-center text-sm text-slate-600 dark:text-slate-300 p6-cell" data-col="start" style={{ width: colWidths.start || defaultWidths.start }}>
                                        {formatDate(row.type === 'Activity' ? row.data.startDate : row.startDate)}
                                    </div>
                                )}

                                {/* Finish Date */}
                                {visibleCols.includes('finish') && (
                                    <div className="flex-shrink-0 border-r border-slate-200 dark:border-slate-600 px-2 flex items-center justify-center text-sm text-slate-600 dark:text-slate-300 p6-cell" data-col="finish" style={{ width: colWidths.finish || defaultWidths.finish }}>
                                        {formatDate(row.type === 'Activity' ? row.data.endDate : row.endDate)}
                                    </div>
                                )}

                                {/* Float */}
                                {visibleCols.includes('float') && (
                                    <div className="flex-shrink-0 border-r border-slate-200 dark:border-slate-600 px-2 flex items-center justify-end p6-cell" data-col="float" style={{ width: colWidths.float || defaultWidths.float }}>
                                        {row.type === 'Activity' && (
                                            <span className={`${(row.data.totalFloat || 0) <= 0 ? 'text-red-600 font-bold' : ''}`}>{row.data.totalFloat}</span>
                                        )}
                                    </div>
                                )}

                                {/* Predecessors */}
                                {visibleCols.includes('preds') && (
                                    <div
                                        className="flex-shrink-0 border-r border-slate-200 dark:border-slate-600 px-2 flex items-center p6-cell" data-col="preds"
                                        style={{ width: colWidths.preds || defaultWidths.preds }}
                                        onDoubleClick={() => {
                                            if (row.type === 'Activity' && (!editing || editing.id !== row.id || editing.field !== 'predecessors')) {
                                                startEdit(row.id, 'predecessors', null);
                                            }
                                        }}
                                    >
                                        {row.type === 'Activity' && (editing?.id === row.id && editing?.field === 'predecessors' ? (
                                            <input
                                                autoFocus
                                                className="w-full h-full border-2 border-blue-400 px-1 rounded text-xs"
                                                value={editVal}
                                                onChange={e => setEditVal(e.target.value)}
                                                onBlur={saveEdit}
                                                onKeyDown={handleKeyDown}
                                                onDoubleClick={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <span className="truncate text-xs w-full block" title={row.data.predecessors?.map((p: any) => p.activityId).join(',')}>
                                                {row.data.predecessors?.map((p: any) => {
                                                    if (p.type === 'FS' && p.lag === 0) return p.activityId;
                                                    const lagStr = p.lag > 0 ? `+${p.lag}` : p.lag < 0 ? `${p.lag}` : '';
                                                    return `${p.activityId}${p.type !== 'FS' ? p.type : ''}${lagStr}`;
                                                }).join(', ')}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Custom Fields */}
                                {customFields.map(cf => (
                                    <div
                                        key={cf.id}
                                        className="flex-shrink-0 border-r border-slate-200 dark:border-slate-600 px-2 flex items-center p6-cell"
                                        style={{ width: colWidths[cf.id] || 100 }}
                                        onDoubleClick={() => {
                                            if (row.type === 'Activity' && (!editing || editing.id !== row.id || editing.field !== cf.id)) {
                                                startEdit(row.id, cf.id, row.data.customFields?.[cf.id] || '');
                                            }
                                        }}
                                    >
                                        {row.type === 'Activity' && (editing?.id === row.id && editing?.field === cf.id ? (
                                            cf.type === 'list' && cf.options ? (
                                                <select
                                                    autoFocus
                                                    className="w-full h-full border-2 border-blue-400 px-1 rounded bg-white"
                                                    value={editVal}
                                                    onChange={e => setEditVal(e.target.value)}
                                                    onBlur={saveEdit}
                                                    onKeyDown={handleKeyDown}
                                                    onDoubleClick={(e) => e.stopPropagation()}
                                                >
                                                    <option value="">-</option>
                                                    {cf.options.map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input
                                                    autoFocus
                                                    type={cf.type === 'number' ? 'text' : cf.type === 'date' ? 'date' : 'text'}
                                                    inputMode={cf.type === 'number' ? 'numeric' : undefined}
                                                    pattern={cf.type === 'number' ? '[0-9]*' : undefined}
                                                    className="w-full h-full border-2 border-blue-400 px-1 rounded"
                                                    value={editVal}
                                                    onChange={e => setEditVal(e.target.value)}
                                                    onBlur={saveEdit}
                                                    onKeyDown={handleKeyDown}
                                                    onDoubleClick={(e) => e.stopPropagation()}
                                                />
                                            )
                                        ) : (
                                            <span className="truncate w-full block text-xs">
                                                {row.data.customFields?.[cf.id] || '-'}
                                            </span>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        );
                    })
                    )}
                </div>
            </div>
        </div>
    );
});
