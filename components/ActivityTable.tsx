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
}

const formatDate = (date: Date): string => {
    if (!date || isNaN(date.getTime())) return '-';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

export const ActivityTable = React.forwardRef<HTMLDivElement, ActivityTableProps>(({ 
    onScroll, headerHeight, rowHeight 
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
        data
    } = useAppStore();

    const customFields = data?.meta?.customFieldDefinitions?.filter(f => f.scope === 'activity') || [];

    const { handleUpdate: onUpdate } = useProjectOperations();
    const { flatRows: rows, toggleExpand: onToggleExpand } = useFlatRows();
    const { t } = useTranslation(userSettings.language);

    const { virtualItems, totalHeight } = useVirtualScroll({
        totalCount: rows.length,
        itemHeight: rowHeight,
        containerRef,
        overscan: 10
    });

    const [colWidths, setColWidths] = useState(userSettings.columnWidths || { id: 180, name: 250, duration: 60, start: 90, finish: 90, float: 50, preds: 150 });
    const [editing, setEditing] = useState<{id: string, field: string} | null>(null);
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

    // Calculate total required width for columns 
    const showVertical = userSettings.gridSettings.showVertical;
    const standardWidth = Object.entries(colWidths)
        .filter(([key]) => visibleCols.includes(key))
        .reduce((sum, [_, width]) => sum + width, 0);
    const customWidth = customFields.reduce((sum, cf) => sum + (colWidths[cf.id] || 100), 0);
    const totalContentWidth = standardWidth + customWidth + (showVertical ? 32 : 0) + 20; // +20 for buffer/padding

    const startEdit = (id: string, field: string, val: any) => {
        setEditing({id, field});
        if(field === 'predecessors') {
            const act = schedule.activities.find(a => a.id === id);
            const s = act?.predecessors.map(p => {
                if(p.type === 'FS' && p.lag === 0) return p.activityId;
                const lagStr = p.lag > 0 ? `+${p.lag}` : p.lag < 0 ? `${p.lag}` : '';
                return `${p.activityId}${p.type!=='FS'?p.type:''}${lagStr}`;
            }).join(',') || '';
            setEditVal(s);
        } else {
            setEditVal(String(val));
        }
    };

    const saveEdit = () => {
        if(editing) {
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
        if(e.key === 'Enter') saveEdit();
        if(e.key === 'Escape') setEditing(null);
    };

    const handleRowClick = (id: string, e: React.MouseEvent) => {
        if (e.shiftKey && selectedIds.length > 0) {
            const lastId = selectedIds[selectedIds.length - 1];
            const idx1 = rows.findIndex(r => r.id === lastId);
            const idx2 = rows.findIndex(r => r.id === id);
            if (idx1 !== -1 && idx2 !== -1) {
                const start = Math.min(idx1, idx2);
                const end = Math.max(idx1, idx2);
                const range = rows.slice(start, end + 1).map(r => r.id);
                onSelect(e.ctrlKey ? [...new Set([...selectedIds, ...range])] : range);
                return;
            }
        }
        
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

    const handleContextMenu = (e: React.MouseEvent, id: string, type: 'WBS' | 'Activity') => {
        e.preventDefault();
        e.stopPropagation();
        if (!selectedIds.includes(id)) {
            onSelect([id]);
        }
        setCtx({ x: e.pageX, y: e.pageY, type, id });
    };

    return (
        <div className="flex flex-col h-full border-r border-slate-300 flex-shrink-0" style={{ width: totalContentWidth, minWidth: totalContentWidth }}>
            {/* Header */}
            <div 
                ref={headerRef}
                className="overflow-hidden bg-slate-100 border-b border-slate-300 font-bold text-slate-700 shadow-sm z-20" 
                style={{ height: headerHeight }}
            >
                <div className="flex h-full p6-header" style={{ minWidth: totalContentWidth }}>
                    {userSettings.gridSettings.showVertical && (
                        <div className="w-8 border-r border-slate-300 flex items-center justify-center bg-slate-200 text-slate-500 flex-shrink-0" data-col="index" style={{ width: 32 }}>#</div>
                    )}
                    {visibleCols.includes('id') && <ResizableHeader width={colWidths.id} onResize={w=>setColWidths({...colWidths, id:w})} dataCol="id">{t('ActivityID')}</ResizableHeader>}
                    {visibleCols.includes('name') && <ResizableHeader width={colWidths.name} onResize={w=>setColWidths({...colWidths, name:w})} dataCol="name">{t('ActivityName')}</ResizableHeader>}
                    {visibleCols.includes('duration') && <ResizableHeader width={colWidths.duration} onResize={w=>setColWidths({...colWidths, duration:w})} align="right" dataCol="duration">{t('Duration')}</ResizableHeader>}
                    {visibleCols.includes('start') && <ResizableHeader width={colWidths.start} onResize={w=>setColWidths({...colWidths, start:w})} align="center" dataCol="start">{t('Start')}</ResizableHeader>}
                    {visibleCols.includes('finish') && <ResizableHeader width={colWidths.finish} onResize={w=>setColWidths({...colWidths, finish:w})} align="center" dataCol="finish">{t('Finish')}</ResizableHeader>}
                    {visibleCols.includes('float') && <ResizableHeader width={colWidths.float} onResize={w=>setColWidths({...colWidths, float:w})} align="right" dataCol="float">{t('TotalFloat')}</ResizableHeader>}
                    {visibleCols.includes('preds') && <ResizableHeader width={colWidths.preds} onResize={w=>setColWidths({...colWidths, preds:w})} dataCol="preds">{t('Predecessors')}</ResizableHeader>}
                </div>
            </div>

            {/* Body */}
            <div 
                className="overflow-scroll bg-white flex-grow relative p6-table-body" 
                ref={containerRef}
                onScroll={handleBodyScroll}
            >
                <div style={{ minWidth: totalContentWidth, height: totalHeight, position: 'relative' }}>
                    {virtualItems.map(({ index, offsetTop }) => {
                        const row = rows[index];
                        const isSel = selectedIds.includes(row.id);
                        return (
                            <div 
                                key={row.id} 
                                className={`flex border-b border-slate-100 hover:bg-blue-50 transition-colors cursor-pointer group absolute left-0 w-full p6-row ${isSel ? 'bg-blue-100' : (index%2===0?'bg-white':'bg-slate-50')}`}
                                style={{ height: rowHeight, top: offsetTop, fontSize: `${fontSizePx}px` }}
                                onClick={(e) => handleRowClick(row.id, e)}
                                onContextMenu={(e) => handleContextMenu(e, row.id, row.type)}
                            >
                                {userSettings.gridSettings.showVertical && (
                                    <div className="w-8 flex-shrink-0 border-r border-slate-200 flex items-center justify-center text-xs text-slate-400 select-none bg-slate-50 p6-cell" data-col="index" style={{ width: 32 }}>
                                        {index + 1}
                                    </div>
                                )}

                                {/* ID Column */}
                                {visibleCols.includes('id') && (
                                    <div className="flex-shrink-0 border-r border-slate-200 px-2 flex items-center p6-cell" data-col="id" style={{ width: colWidths.id }}>
                                        <div style={{ paddingLeft: row.depth * 16 }} className="flex items-center w-full overflow-hidden">
                                            {row.type === 'WBS' && (
                                                <button onClick={(e) => { e.stopPropagation(); onToggleExpand(row.id); }} className="mr-1 text-slate-500 hover:text-black focus:outline-none">
                                                    {row.expanded ? '▼' : '▶'}
                                                </button>
                                            )}
                                            {row.type === 'Activity' && <div className="w-4 mr-1"></div>}
                                            {editing?.id===row.id && editing?.field==='id' && row.type==='WBS' ? (
                                                <input autoFocus className="w-full h-full border-2 border-blue-400 px-1 rounded" value={editVal} onChange={e=>setEditVal(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} />
                                            ) : (
                                                <span onDoubleClick={() => row.type==='WBS' && startEdit(row.id, 'id', row.id)} className={`truncate ${row.type==='WBS'?'font-bold text-slate-700':''}`}>{row.id}</span>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Name Column */}
                                {visibleCols.includes('name') && (
                                    <div className="flex-shrink-0 border-r border-slate-200 px-2 flex items-center p6-cell" data-col="name" style={{ width: colWidths.name }}>
                                            {editing?.id===row.id && editing?.field==='name' ? (
                                            <input autoFocus className="w-full h-full border-2 border-blue-400 px-1 rounded" value={editVal} onChange={e=>setEditVal(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} />
                                        ) : (
                                            <span onDoubleClick={() => startEdit(row.id, 'name', row.data.name)} className={`truncate w-full ${row.type==='WBS'?'font-bold':''}`}>{row.data.name}</span>
                                        )}
                                    </div>
                                )}

                                {/* Duration */}
                                {visibleCols.includes('duration') && (
                                    <div className="flex-shrink-0 border-r border-slate-200 px-2 flex items-center justify-end p6-cell" data-col="duration" style={{ width: colWidths.duration }}>
                                        {row.type === 'Activity' && (editing?.id===row.id && editing?.field==='duration' ? (
                                            <input autoFocus type="number" className="w-full h-full border-2 border-blue-400 px-1 rounded text-right" value={editVal} onChange={e=>setEditVal(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} />
                                        ) : (
                                            <span onDoubleClick={() => startEdit(row.id, 'duration', row.data.duration)}>{row.data.duration}</span>
                                        ))}
                                        {row.type === 'WBS' && <span className="font-semibold text-slate-500">{row.duration}</span>}
                                    </div>
                                )}

                                {/* Start Date */}
                                {visibleCols.includes('start') && (
                                    <div className="flex-shrink-0 border-r border-slate-200 px-2 flex items-center justify-center text-sm text-slate-600 p6-cell" data-col="start" style={{ width: colWidths.start }}>
                                        {formatDate(row.type==='Activity'?row.data.startDate:row.startDate)}
                                    </div>
                                )}

                                {/* Finish Date */}
                                {visibleCols.includes('finish') && (
                                    <div className="flex-shrink-0 border-r border-slate-200 px-2 flex items-center justify-center text-sm text-slate-600 p6-cell" data-col="finish" style={{ width: colWidths.finish }}>
                                        {formatDate(row.type==='Activity'?row.data.endDate:row.endDate)}
                                    </div>
                                )}

                                {/* Float */}
                                {visibleCols.includes('float') && (
                                    <div className="flex-shrink-0 border-r border-slate-200 px-2 flex items-center justify-end p6-cell" data-col="float" style={{ width: colWidths.float }}>
                                        {row.type === 'Activity' && (
                                            <span className={`${(row.data.totalFloat||0)<=0?'text-red-600 font-bold':''}`}>{row.data.totalFloat}</span>
                                        )}
                                    </div>
                                )}

                                {/* Predecessors */}
                                {visibleCols.includes('preds') && (
                                    <div 
                                        className="flex-shrink-0 border-r border-slate-200 px-2 flex items-center p6-cell" data-col="preds" 
                                        style={{ width: colWidths.preds }}
                                        onDoubleClick={() => {
                                            if (row.type === 'Activity' && (!editing || editing.id !== row.id || editing.field !== 'predecessors')) {
                                                startEdit(row.id, 'predecessors', null);
                                            }
                                        }}
                                    >
                                        {row.type === 'Activity' && (editing?.id===row.id && editing?.field==='predecessors' ? (
                                            <input 
                                                autoFocus 
                                                className="w-full h-full border-2 border-blue-400 px-1 rounded text-xs" 
                                                value={editVal} 
                                                onChange={e=>setEditVal(e.target.value)} 
                                                onBlur={saveEdit} 
                                                onKeyDown={handleKeyDown} 
                                                onDoubleClick={(e) => e.stopPropagation()}
                                            />
                                        ) : (
                                            <span className="truncate text-xs w-full block" title={row.data.predecessors?.map((p:any)=>p.activityId).join(',')}>
                                                {row.data.predecessors?.map((p:any) => {
                                                    if(p.type === 'FS' && p.lag === 0) return p.activityId;
                                                    const lagStr = p.lag > 0 ? `+${p.lag}` : p.lag < 0 ? `${p.lag}` : '';
                                                    return `${p.activityId}${p.type!=='FS'?p.type:''}${lagStr}`;
                                                }).join(', ')}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Custom Fields */}
                                {customFields.map(cf => (
                                    <div key={cf.id} className="flex-shrink-0 border-r border-slate-200 px-2 flex items-center p6-cell" style={{ width: colWidths[cf.id] || 100 }}>
                                        {row.type === 'Activity' && (editing?.id===row.id && editing?.field===cf.id ? (
                                            cf.type === 'list' && cf.options ? (
                                                <select 
                                                    autoFocus
                                                    className="w-full h-full border-2 border-blue-400 px-1 rounded bg-white"
                                                    value={editVal}
                                                    onChange={e=>setEditVal(e.target.value)}
                                                    onBlur={saveEdit}
                                                    onKeyDown={handleKeyDown}
                                                >
                                                    <option value="">-</option>
                                                    {cf.options.map(opt => (
                                                        <option key={opt} value={opt}>{opt}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <input 
                                                    autoFocus 
                                                    type={cf.type === 'number' ? 'number' : cf.type === 'date' ? 'date' : 'text'}
                                                    className="w-full h-full border-2 border-blue-400 px-1 rounded" 
                                                    value={editVal} 
                                                    onChange={e=>setEditVal(e.target.value)} 
                                                    onBlur={saveEdit} 
                                                    onKeyDown={handleKeyDown} 
                                                />
                                            )
                                        ) : (
                                            <span 
                                                onDoubleClick={() => startEdit(row.id, cf.id, row.data.customFields?.[cf.id] || '')} 
                                                className="truncate w-full block"
                                            >
                                                {row.data.customFields?.[cf.id]}
                                            </span>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});
