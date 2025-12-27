import React, { useState, useRef, useImperativeHandle } from 'react';
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
        schedule 
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

    const [colWidths, setColWidths] = useState({ id: 180, name: 250, duration: 60, start: 90, finish: 90, float: 50, preds: 150 });
    const [editing, setEditing] = useState<{id: string, field: string} | null>(null);
    const [editVal, setEditVal] = useState('');

    const fontSizePx = userSettings.uiFontPx || 13;
    const visibleCols = userSettings.visibleColumns || ['id', 'name', 'duration', 'start', 'finish', 'float', 'preds'];

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
        if(editing) onUpdate(editing.id, editing.field, editVal);
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
        <div className="flex flex-col h-full border-r border-slate-300" style={{ width: '40%', minWidth: 400, maxWidth: '50%' }}>
            {/* Header */}
            <div 
                ref={headerRef}
                className="flex overflow-hidden bg-slate-100 border-b border-slate-300 font-bold text-slate-700 shadow-sm z-20" 
                style={{ height: headerHeight }}
            >
                {userSettings.gridSettings.showVertical && (
                    <div className="w-8 border-r border-slate-300 flex items-center justify-center bg-slate-200 text-slate-500">#</div>
                )}
                {visibleCols.includes('id') && <ResizableHeader width={colWidths.id} onResize={w=>setColWidths({...colWidths, id:w})}>{t('ActivityID')}</ResizableHeader>}
                {visibleCols.includes('name') && <ResizableHeader width={colWidths.name} onResize={w=>setColWidths({...colWidths, name:w})}>{t('ActivityName')}</ResizableHeader>}
                {visibleCols.includes('duration') && <ResizableHeader width={colWidths.duration} onResize={w=>setColWidths({...colWidths, duration:w})} align="right">{t('Duration')}</ResizableHeader>}
                {visibleCols.includes('start') && <ResizableHeader width={colWidths.start} onResize={w=>setColWidths({...colWidths, start:w})} align="center">{t('Start')}</ResizableHeader>}
                {visibleCols.includes('finish') && <ResizableHeader width={colWidths.finish} onResize={w=>setColWidths({...colWidths, finish:w})} align="center">{t('Finish')}</ResizableHeader>}
                {visibleCols.includes('float') && <ResizableHeader width={colWidths.float} onResize={w=>setColWidths({...colWidths, float:w})} align="right">{t('TotalFloat')}</ResizableHeader>}
                {visibleCols.includes('preds') && <ResizableHeader width={colWidths.preds} onResize={w=>setColWidths({...colWidths, preds:w})}>{t('Predecessors')}</ResizableHeader>}
            </div>

            {/* Body */}
            <div 
                className="overflow-y-auto overflow-x-auto bg-white flex-grow" 
                ref={containerRef}
                onScroll={handleBodyScroll}
            >
                <div style={{ minWidth: Object.values(colWidths).reduce((a,b)=>a+b, 40), height: totalHeight, position: 'relative' }}>
                    {virtualItems.map(({ index, offsetTop }) => {
                        const row = rows[index];
                        const isSel = selectedIds.includes(row.id);
                        return (
                            <div 
                                key={row.id} 
                                className={`flex border-b border-slate-100 hover:bg-blue-50 transition-colors cursor-pointer group absolute left-0 w-full ${isSel ? 'bg-blue-100' : (index%2===0?'bg-white':'bg-slate-50')}`}
                                style={{ height: rowHeight, top: offsetTop, fontSize: `${fontSizePx}px` }}
                                onClick={(e) => handleRowClick(row.id, e)}
                                onContextMenu={(e) => handleContextMenu(e, row.id, row.type)}
                            >
                                {userSettings.gridSettings.showVertical && (
                                    <div className="w-8 flex-shrink-0 border-r border-slate-200 flex items-center justify-center text-xs text-slate-400 select-none bg-slate-50">
                                        {index + 1}
                                    </div>
                                )}

                                {/* ID Column */}
                                {visibleCols.includes('id') && (
                                    <div className="flex-shrink-0 border-r border-slate-200 px-2 flex items-center" style={{ width: colWidths.id }}>
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
                                    <div className="flex-shrink-0 border-r border-slate-200 px-2 flex items-center" style={{ width: colWidths.name }}>
                                            {editing?.id===row.id && editing?.field==='name' ? (
                                            <input autoFocus className="w-full h-full border-2 border-blue-400 px-1 rounded" value={editVal} onChange={e=>setEditVal(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} />
                                        ) : (
                                            <span onDoubleClick={() => startEdit(row.id, 'name', row.data.name)} className={`truncate w-full ${row.type==='WBS'?'font-bold':''}`}>{row.data.name}</span>
                                        )}
                                    </div>
                                )}

                                {/* Duration */}
                                {visibleCols.includes('duration') && (
                                    <div className="flex-shrink-0 border-r border-slate-200 px-2 flex items-center justify-end" style={{ width: colWidths.duration }}>
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
                                    <div className="flex-shrink-0 border-r border-slate-200 px-2 flex items-center justify-center text-sm text-slate-600" style={{ width: colWidths.start }}>
                                        {formatDate(row.type==='Activity'?row.data.startDate:row.startDate)}
                                    </div>
                                )}

                                {/* Finish Date */}
                                {visibleCols.includes('finish') && (
                                    <div className="flex-shrink-0 border-r border-slate-200 px-2 flex items-center justify-center text-sm text-slate-600" style={{ width: colWidths.finish }}>
                                        {formatDate(row.type==='Activity'?row.data.endDate:row.endDate)}
                                    </div>
                                )}

                                {/* Float */}
                                {visibleCols.includes('float') && (
                                    <div className="flex-shrink-0 border-r border-slate-200 px-2 flex items-center justify-end" style={{ width: colWidths.float }}>
                                        {row.type === 'Activity' && (
                                            <span className={`${(row.data.totalFloat||0)<=0?'text-red-600 font-bold':''}`}>{row.data.totalFloat}</span>
                                        )}
                                    </div>
                                )}

                                {/* Predecessors */}
                                {visibleCols.includes('preds') && (
                                    <div 
                                        className="flex-shrink-0 border-r border-slate-200 px-2 flex items-center" 
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
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
});
