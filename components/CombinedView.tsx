
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { ProjectData, Activity, UserSettings, Predecessor } from '../types';
import GanttChart from './GanttChart';
import { useTranslation } from '../utils/i18n';

interface CombinedViewProps {
    projectData: ProjectData;
    schedule: Activity[];
    wbsMap: Record<string, { startDate: Date; endDate: Date; duration: number }>;
    onUpdate: (id: string, field: string, val: any) => void;
    selectedIds: string[];
    onSelect: (ids: string[], multi: boolean) => void;
    onCtx: (data: any) => void;
    userSettings: UserSettings;
    zoomLevel: 'day' | 'week' | 'month' | 'quarter' | 'year';
    onZoomChange: (z: any) => void;
    onDeleteItems: (ids: string[]) => void;
    showRelations: boolean;
    showCritical: boolean;
}

const formatDate = (date: Date): string => {
    if (!date || isNaN(date.getTime())) return '-';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const SCROLLBAR_WIDTH = 14;

// Helper for Resizable Headers
const ResizableHeader: React.FC<{ 
    width: number, 
    onResize: (w: number) => void, 
    children: React.ReactNode, 
    align?: 'left'|'center'|'right',
    dataCol?: string
}> = ({ width, onResize, children, align='left', dataCol }) => {
    const handleMouseDown = (e: React.MouseEvent) => {
        const startX = e.pageX;
        const startW = width;
        const onMove = (mv: MouseEvent) => onResize(Math.max(40, startW + (mv.pageX - startX)));
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        e.stopPropagation();
    };
    return (
        <div 
            className="border-r border-slate-300 px-2 h-full flex items-center relative overflow-visible select-none flex-shrink-0" 
            style={{ width, justifyContent: align==='right'?'flex-end':align==='center'?'center':'flex-start' }}
            data-col={dataCol}
        >
            {children}
            <div 
                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-10 hover:w-1.5 transition-all" 
                onMouseDown={handleMouseDown}
            ></div>
        </div>
    );
};

const CombinedView: React.FC<CombinedViewProps> = ({ 
    projectData, schedule, wbsMap, onUpdate, selectedIds, onSelect, onCtx, userSettings, zoomLevel, onZoomChange,
    showRelations, showCritical
}) => {
    const { t } = useTranslation(userSettings.language);
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [colWidths, setColWidths] = useState({ id: 180, name: 250, duration: 60, start: 90, finish: 90, float: 50, preds: 150 });
    
    // Editing State
    const [editing, setEditing] = useState<{id: string, field: string} | null>(null);
    const [editVal, setEditVal] = useState('');

    // Refs for Scroll Sync
    const tableBodyRef = useRef<HTMLDivElement>(null);
    const ganttRef = useRef<HTMLDivElement>(null);
    const isScrolling = useRef<'table' | 'gantt' | null>(null);

    // Initialize Expanded State (Expand All by default)
    useEffect(() => {
        if(projectData.wbs.length > 0 && Object.keys(expanded).length === 0) {
            const all: Record<string, boolean> = {};
            projectData.wbs.forEach(w => all[w.id] = true);
            setExpanded(all);
        }
    }, [projectData.wbs.length]);

    const toggleExpand = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpanded(p => ({...p, [id]: !p[id]}));
    };

    // Flatten Data Logic
    const flatRows = useMemo(() => {
        const rows: any[] = [];
        if(!projectData) return rows;

        const recurse = (parentId: string | null, depth: number) => {
            const childrenWbs = projectData.wbs.filter(w => (parentId === null ? (!w.parentId || w.parentId === 'null') : w.parentId === parentId));
            
            childrenWbs.forEach(node => {
                const isExp = expanded[node.id] !== false; // Default true
                const wbsInfo = wbsMap[node.id];
                
                rows.push({
                    type: 'WBS',
                    id: node.id,
                    data: node,
                    depth,
                    expanded: isExp,
                    startDate: wbsInfo?.startDate,
                    endDate: wbsInfo?.endDate,
                    duration: wbsInfo?.duration
                });

                if (isExp) {
                    // Activities
                    const nodeActs = schedule.filter(a => a.wbsId === node.id);
                    nodeActs.forEach(act => {
                        rows.push({
                            type: 'Activity',
                            id: act.id,
                            data: act,
                            depth: depth + 1,
                            startDate: act.startDate,
                            endDate: act.endDate
                        });
                    });
                    // Child WBS
                    recurse(node.id, depth + 1);
                }
            });
        };
        recurse(null, 0);
        return rows;
    }, [projectData, schedule, wbsMap, expanded]);

    // Scroll Sync Handlers
    const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (isScrolling.current === 'gantt') return;
        isScrolling.current = 'table';
        if (ganttRef.current) ganttRef.current.scrollTop = e.currentTarget.scrollTop;
        setTimeout(() => { if(isScrolling.current === 'table') isScrolling.current = null; }, 50);
    };

    const handleGanttScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (isScrolling.current === 'table') return;
        isScrolling.current = 'gantt';
        if (tableBodyRef.current) tableBodyRef.current.scrollTop = e.currentTarget.scrollTop;
        setTimeout(() => { if(isScrolling.current === 'gantt') isScrolling.current = null; }, 50);
    };

    // Style Helpers
    const fontSizePx = userSettings.uiFontPx || 13;
    const ROW_HEIGHT = Math.max(32, fontSizePx + 16); // Buffer for padding
    const headerHeight = Math.max(45, fontSizePx * 2.5); // Scaled header

    // Editing Logic
    const startEdit = (id: string, field: string, val: any) => {
        setEditing({id, field});
        if(field === 'predecessors') {
            const act = schedule.find(a => a.id === id);
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
            const idx1 = flatRows.findIndex(r => r.id === lastId);
            const idx2 = flatRows.findIndex(r => r.id === id);
            if (idx1 !== -1 && idx2 !== -1) {
                const start = Math.min(idx1, idx2);
                const end = Math.max(idx1, idx2);
                const range = flatRows.slice(start, end + 1).map(r => r.id);
                onSelect(e.ctrlKey ? [...new Set([...selectedIds, ...range])] : range, true);
                return;
            }
        }
        onSelect(e.ctrlKey || e.metaKey ? (selectedIds.includes(id) ? selectedIds.filter(x => x !== id) : [...selectedIds, id]) : [id], true);
    };

    // Render Logic
    const isColVisible = (id: string) => userSettings.visibleColumns.includes(id);

    // Calculate total table width for layout
    const tableWidth = (
        (isColVisible('id') ? colWidths.id : 0) +
        (isColVisible('name') ? colWidths.name : 0) +
        (isColVisible('duration') ? colWidths.duration : 0) +
        (isColVisible('start') ? colWidths.start : 0) +
        (isColVisible('finish') ? colWidths.finish : 0) +
        (isColVisible('float') ? colWidths.float : 0) +
        (isColVisible('preds') ? colWidths.preds : 0)
    );

    return (
        <div className="flex flex-grow overflow-hidden border-t border-slate-300 combined-view-container select-none text-slate-800" style={{ fontSize: `${fontSizePx}px` }}>
            {/* LEFT: TABLE */}
            <div className="flex flex-col border-r border-slate-300 bg-white flex-shrink-0" style={{ width: tableWidth + 2 }}>
                {/* Header */}
            <div className="p6-header bg-slate-100 border-b border-slate-300 font-bold text-slate-600 flex" style={{ height: headerHeight, paddingRight: SCROLLBAR_WIDTH }}>
                {isColVisible('id') && 
                        <ResizableHeader width={colWidths.id} onResize={w => setColWidths(p => ({...p, id: w}))} dataCol="id">
                            {t('ActivityID')}
                        </ResizableHeader>
                    }
                    {isColVisible('name') && 
                        <ResizableHeader width={colWidths.name} onResize={w => setColWidths(p => ({...p, name: w}))} dataCol="name">
                            {t('ActivityName')}
                        </ResizableHeader>
                    }
                    {isColVisible('duration') && 
                        <ResizableHeader width={colWidths.duration} onResize={w => setColWidths(p => ({...p, duration: w}))} align="center" dataCol="duration">
                            {t('Dur')}
                        </ResizableHeader>
                    }
                    {isColVisible('start') && 
                        <ResizableHeader width={colWidths.start} onResize={w => setColWidths(p => ({...p, start: w}))} align="center" dataCol="start">
                            {t('Start')}
                        </ResizableHeader>
                    }
                    {isColVisible('finish') && 
                        <ResizableHeader width={colWidths.finish} onResize={w => setColWidths(p => ({...p, finish: w}))} align="center" dataCol="finish">
                            {t('Finish')}
                        </ResizableHeader>
                    }
                    {isColVisible('float') && 
                        <ResizableHeader width={colWidths.float} onResize={w => setColWidths(p => ({...p, float: w}))} align="center" dataCol="float">
                            {t('TF')}
                        </ResizableHeader>
                    }
                    {isColVisible('preds') && 
                        <ResizableHeader width={colWidths.preds} onResize={w => setColWidths(p => ({...p, preds: w}))} dataCol="preds">
                            {t('Predecessors')}
                        </ResizableHeader>
                    }
                </div>

                {/* Body */}
                <div ref={tableBodyRef} className="flex-grow overflow-y-scroll overflow-x-hidden custom-scrollbar bg-white p6-table-body" onScroll={handleTableScroll}>
                    {flatRows.map(row => {
                        const isSel = selectedIds.includes(row.id);
                        const isWBS = row.type === 'WBS';
                        const bgColor = isSel ? 'bg-blue-100' : (isWBS ? 'bg-slate-50' : 'bg-white');
                        const textColor = isSel ? 'text-blue-900' : (isWBS ? 'text-blue-800 font-bold' : (row.data.isCritical ? 'text-red-600' : 'text-slate-700'));

                        return (
                            <div 
                                key={row.id} 
                                className={`p6-row ${bgColor} ${textColor} hover:bg-blue-50 transition-colors cursor-pointer`}
                                style={{ height: ROW_HEIGHT }}
                                onClick={(e) => handleRowClick(row.id, e)}
                                onContextMenu={(e) => { e.preventDefault(); handleRowClick(row.id, e); onCtx({x:e.clientX, y:e.clientY, id:row.id, type:row.type}); }}
                            >
                                {/* ID Column */}
                                {isColVisible('id') && (
                                    <div className="p6-cell flex items-center" style={{ width: colWidths.id, paddingLeft: `${row.depth * 16 + 4}px` }} data-col="id">
                                        {isWBS ? (
                                            <span onClick={(e) => toggleExpand(row.id, e)} className="mr-1 cursor-pointer font-mono text-[10px] w-4 text-center leading-none select-none text-slate-500">
                                                {row.expanded ? '[-]' : '[+]'}
                                            </span>
                                        ) : (
                                            <span className="mr-1 w-4 text-center font-mono text-[10px] leading-none select-none">
                                                {row.data.duration === 0 ? <span className="text-purple-600">♦</span> : ''}
                                            </span>
                                        )}
                                        {editing?.id === row.id && editing.field === 'id' ? (
                                            <input autoFocus className="w-full border px-1" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} />
                                        ) : (
                                            <span onDoubleClick={() => startEdit(row.id, 'id', row.id)} className="truncate w-full">{row.id}</span>
                                        )}
                                    </div>
                                )}

                                {/* Name Column */}
                                {isColVisible('name') && (
                                    <div className="p6-cell flex items-center" style={{ width: colWidths.name }} data-col="name">
                                        {editing?.id === row.id && editing.field === 'name' ? (
                                            <input autoFocus className="w-full border px-1" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} />
                                        ) : (
                                            <span onDoubleClick={() => startEdit(row.id, 'name', row.data.name)} className="truncate w-full">{row.data.name}</span>
                                        )}
                                    </div>
                                )}

                                {/* Duration */}
                                {isColVisible('duration') && (
                                    <div className="p6-cell justify-center" style={{ width: colWidths.duration }} data-col="duration">
                                        {editing?.id === row.id && editing.field === 'duration' && !isWBS ? (
                                            <input autoFocus className="w-full text-center border px-1" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} />
                                        ) : (
                                            <span onDoubleClick={() => !isWBS && startEdit(row.id, 'duration', row.data.duration)}>{isWBS ? (row.duration||0) : row.data.duration}</span>
                                        )}
                                    </div>
                                )}

                                {/* Start */}
                                {isColVisible('start') && (
                                    <div className="p6-cell justify-center text-[0.9em]" style={{ width: colWidths.start }} data-col="start">
                                        {formatDate(row.startDate)}
                                    </div>
                                )}

                                {/* Finish */}
                                {isColVisible('finish') && (
                                    <div className="p6-cell justify-center text-[0.9em]" style={{ width: colWidths.finish }} data-col="finish">
                                        {formatDate(row.endDate)}
                                    </div>
                                )}

                                {/* Float */}
                                {isColVisible('float') && (
                                    <div className="p6-cell justify-center text-[0.9em]" style={{ width: colWidths.float }} data-col="float">
                                        {!isWBS && row.data.totalFloat}
                                    </div>
                                )}

                                {/* Predecessors */}
                                {isColVisible('preds') && (
                                    <div className="p6-cell text-[0.85em]" style={{ width: colWidths.preds }} data-col="preds" onDoubleClick={() => !isWBS && startEdit(row.id, 'predecessors', null)}>
                                        {editing?.id === row.id && editing.field === 'predecessors' ? (
                                            <input autoFocus className="w-full border px-1" value={editVal} onChange={e => setEditVal(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} />
                                        ) : (
                                            <span className="truncate w-full block">
                                                {!isWBS && row.data.predecessors?.map((p: Predecessor) => `${p.activityId}${p.type!=='FS'?p.type:''}${p.lag!==0?(p.lag>0?'+'+p.lag:p.lag):''}`).join(', ')}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                    <div className="h-40"></div> {/* Spacer */}
                </div>
            </div>

            {/* RIGHT: GANTT */}
            <GanttChart 
                ref={ganttRef}
                rows={flatRows} 
                activities={schedule}
                projectStartDate={projectData.meta ? new Date(projectData.meta.projectStartDate) : new Date()} 
                totalDuration={flatRows.length > 0 ? (flatRows[0].duration || 100) : 100} // Rough est
                showRelations={showRelations}
                showCritical={showCritical}
                showGrid={true}
                zoomLevel={zoomLevel}
                userSettings={userSettings}
                rowHeight={ROW_HEIGHT}
                fontSize={fontSizePx}
                headerHeight={headerHeight}
                onScroll={handleGanttScroll}
            />

        </div>
    );
};

export default CombinedView;
