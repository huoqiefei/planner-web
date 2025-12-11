
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { ProjectData, Activity, UserSettings, RelationType } from '../types';
import GanttChart from './GanttChart';

interface CombinedViewProps {
    projectData: ProjectData;
    schedule: Activity[];
    wbsMap: Record<string, { startDate: Date; endDate: Date; duration: number }>;
    onUpdate: (id: string, field: string, val: any) => void;
    selectedIds: string[];
    onSelect: (id: string, multi: boolean) => void;
    onCtx: (data: any) => void;
    userSettings: UserSettings;
    zoomLevel: 'day' | 'week' | 'month' | 'quarter' | 'year';
    onZoomChange: (level: 'day' | 'week' | 'month' | 'quarter' | 'year') => void;
    onDeleteItems: (ids: string[]) => void;
}

const ResizableHeader: React.FC<{ width: number, minWidth?: number, onResize: (w: number) => void, children: React.ReactNode, align?: 'left'|'center'|'right', colId?: string }> = ({ width, minWidth=50, onResize, children, align='left', colId }) => {
    const handleMouseDown = (e: React.MouseEvent) => {
        const startX = e.pageX;
        const startW = width;
        const onMove = (mv: MouseEvent) => onResize(Math.max(minWidth, startW + (mv.pageX - startX)));
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };

    return (
        <div className="border-r border-slate-400 px-2 h-full flex items-center relative overflow-visible group" style={{ width, justifyContent: align === 'center' ? 'center' : (align === 'right' ? 'flex-end' : 'flex-start') }} data-col={colId}>
            {children}
            <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-10 opacity-0 group-hover:opacity-100" onMouseDown={handleMouseDown}></div>
        </div>
    );
};

// Icons for Toggles
const ToggleIcons = {
    Logic: (active: boolean) => <svg className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
    Critical: (active: boolean) => <svg className={`w-4 h-4 ${active ? 'text-red-600' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" /></svg>,
    Grid: (active: boolean) => <svg className={`w-4 h-4 ${active ? 'text-slate-700' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
};

// Table Icons
const TableIcons = {
    Folder: <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-yellow-500"><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-2.06 11L15 10h9l-3.06 7H17.94z" /><path d="M20 6h-8l-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z" /></svg>,
    Task: <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-green-600"><rect x="3" y="8" width="18" height="8" rx="2" /></svg>,
    Milestone: <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-slate-800"><path d="M12 2L2 12l10 10 10-10z" /></svg>,
    Expand: <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-slate-500"><path d="M10 17l5-5-5-5v10z"/></svg>,
    Collapse: <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-slate-500"><path d="M7 10l5 5 5-5H7z"/></svg>
};

const CombinedView: React.FC<CombinedViewProps> = ({ projectData, schedule, wbsMap, onUpdate, selectedIds, onSelect, onCtx, userSettings, zoomLevel, onZoomChange, onDeleteItems }) => {
    const [editing, setEditing] = useState<{id: string, field: string} | null>(null);
    const [val, setVal] = useState('');
    const [collapsedWbs, setCollapsedWbs] = useState<string[]>([]);
    
    const [showRelations, setShowRelations] = useState(true);
    const [showCritical, setShowCritical] = useState(true);
    const [showGrid, setShowGrid] = useState(true);

    const [colWidths, setColWidths] = useState({
        id: 120, name: 300, duration: 60, start: 90, finish: 90, float: 60, preds: 150
    });

    const tableBodyRef = useRef<HTMLDivElement>(null);
    const ganttBodyRef = useRef<HTMLDivElement>(null);
    const isScrolling = useRef<'table'|'gantt'|null>(null);

    // Dynamic Sizes based on User Settings
    const fontSizePx = userSettings.uiFontPx || 13;
    // Row Height = Font Size + Top Padding (3) + Bottom Padding (6) + extra buffer to be safe
    const ROW_HEIGHT = Math.max(32, fontSizePx + 12); 
    const HEADER_HEIGHT = (zoomLevel === 'day' || zoomLevel === 'week') ? 50 : 45;

    const toggleWbs = (id: string) => {
        if (collapsedWbs.includes(id)) setCollapsedWbs(collapsedWbs.filter(x => x !== id));
        else setCollapsedWbs([...collapsedWbs, id]);
    };

    const formatDate = (d?: Date) => {
        if (!d) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const monStr = d.toLocaleDateString(userSettings.language === 'zh' ? 'zh-CN' : 'en-US', {month: 'short'});
        
        if (userSettings.dateFormat === 'DD-MMM-YYYY') return `${day}-${monStr}-${y}`;
        if (userSettings.dateFormat === 'MM/DD/YYYY') return `${m}/${day}/${y}`;
        return `${y}-${m}-${day}`;
    };

    const parsePredecessors = (input: string) => {
        if (!input.trim()) return [];
        return input.split(/[,;]/).map(part => {
            const clean = part.trim();
            let match = clean.match(/^(.*?)(FS|SS|FF|SF)([+\-]?\d+)?$/i);
            
            if (match) {
                return {
                    activityId: match[1],
                    type: (match[2]?.toUpperCase() as RelationType),
                    lag: match[3] ? parseInt(match[3]) : 0
                };
            }
            return { activityId: clean, type: 'FS', lag: 0 };
        }).filter(x => x && x.activityId); 
    };

    const flatRows = useMemo(() => {
        const rows: any[] = [];
        const isHidden = (nodeId: string, parentId: string | null) => {
            if (!parentId) return false;
            if (collapsedWbs.includes(parentId)) return true;
            let curr = projectData.wbs.find(w => w.id === parentId);
            while(curr) {
                if(collapsedWbs.includes(curr.id)) return true;
                curr = projectData.wbs.find(w => w.id === curr?.parentId);
            }
            return false;
        };

        const recurse = (pid: string | null, depth: number) => {
            const children = projectData.wbs.filter(w => w.parentId === pid);
            children.forEach(node => {
                if (isHidden(node.id, pid)) return;
                
                const wbsCalc = wbsMap[node.id];
                const nodeWithDuration = { 
                    ...node, 
                    duration: wbsCalc?.duration || 0 
                };

                rows.push({ 
                    type: 'WBS', 
                    data: nodeWithDuration, 
                    id: node.id, 
                    depth, 
                    startDate: wbsCalc?.startDate, 
                    endDate: wbsCalc?.endDate,
                    collapsed: collapsedWbs.includes(node.id)
                });
                
                if (!collapsedWbs.includes(node.id)) {
                    schedule.filter(a => a.wbsId === node.id).forEach(act => {
                        rows.push({ type: 'Activity', data: act, id: act.id, depth: depth + 1, startDate: act.startDate, endDate: act.endDate });
                    });
                    recurse(node.id, depth + 1);
                }
            });
        };
        
        projectData.wbs.filter(w => !w.parentId || w.parentId === 'null').forEach(r => recurse(null, 0));
        return rows;
    }, [projectData.wbs, schedule, wbsMap, collapsedWbs]);

    // Enhanced Robust Vertical Scroll Sync
    const handleTableScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (isScrolling.current === 'gantt') return;
        
        const scrollTop = e.currentTarget.scrollTop;
        if (ganttBodyRef.current && Math.abs(ganttBodyRef.current.scrollTop - scrollTop) > 1) {
            isScrolling.current = 'table';
            ganttBodyRef.current.scrollTop = scrollTop;
            if((window as any)._scrollTimeout) clearTimeout((window as any)._scrollTimeout);
            (window as any)._scrollTimeout = setTimeout(() => { isScrolling.current = null; }, 100);
        }
    };

    const handleGanttScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (isScrolling.current === 'table') return;

        const scrollTop = e.currentTarget.scrollTop;
        if (tableBodyRef.current && Math.abs(tableBodyRef.current.scrollTop - scrollTop) > 1) {
            isScrolling.current = 'gantt';
            tableBodyRef.current.scrollTop = scrollTop;
            if((window as any)._scrollTimeout) clearTimeout((window as any)._scrollTimeout);
            (window as any)._scrollTimeout = setTimeout(() => { isScrolling.current = null; }, 100);
        }
    };

    const startEdit = (id: string, field: string, v: any) => {
        setEditing({ id, field });
        if (field === 'predecessors') {
            const act = schedule.find(a => a.id === id);
            const s = act?.predecessors.map(p => {
                const typeStr = (p.type !== 'FS' || p.lag !== 0) ? p.type : '';
                let lagStr = '';
                if (p.lag > 0) lagStr = '+' + p.lag;
                else if (p.lag < 0) lagStr = String(p.lag);
                return `${p.activityId}${typeStr}${lagStr}`;
            }).join(', ') || '';
            setVal(s);
        } else {
            setVal(String(v));
        }
    };

    const saveEdit = () => {
        if (editing) {
            if (editing.field === 'predecessors') {
                const preds = parsePredecessors(val);
                onUpdate(editing.id, editing.field, preds);
            } else {
                onUpdate(editing.id, editing.field, val);
            }
        }
        setEditing(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Delete' && selectedIds.length > 0 && !editing) {
            onDeleteItems(selectedIds);
        }
    };

    const projectStartDate = projectData.meta.projectStartDate ? new Date(projectData.meta.projectStartDate) : new Date();
    let maxDate = projectStartDate;
    schedule.forEach(a => { if(a.endDate > maxDate) maxDate = a.endDate; });
    const totalDuration = Math.ceil((maxDate.getTime() - projectStartDate.getTime()) / (1000 * 3600 * 24)) + 30;

    return (
        <div 
            className="flex flex-col h-full overflow-hidden combined-view-container outline-none" 
            style={{ fontSize: `${fontSizePx}px` }} 
            tabIndex={0} 
            onKeyDown={handleKeyDown}
        >
             <div className="bg-slate-50 border-b border-slate-300 px-2 py-1 flex justify-between items-center h-10 shrink-0 select-none">
                <div className="flex gap-4 items-center">
                    <div className="flex gap-1 items-center">
                        <span className="font-bold text-slate-500 mr-1">Zoom:</span>
                        {(['day', 'week', 'month', 'quarter', 'year'] as const).map(z => (
                            <button key={z} onClick={() => onZoomChange(z)} className={`px-2 py-0.5 text-[11px] uppercase border rounded ${zoomLevel === z ? 'bg-blue-100 border-blue-400 text-blue-800 font-bold' : 'bg-white text-slate-600 hover:bg-slate-100'}`}>{z}</button>
                        ))}
                    </div>
                    <div className="w-px h-5 bg-slate-300"></div>
                    <div className="flex gap-4 items-center">
                        <button title="Toggle Logic Lines" onClick={() => setShowRelations(!showRelations)} className={`p-1 rounded hover:bg-slate-200 border border-transparent ${showRelations ? 'bg-slate-200 border-slate-300' : ''}`}>
                            {ToggleIcons.Logic(showRelations)}
                        </button>
                        <button title="Toggle Critical Path" onClick={() => setShowCritical(!showCritical)} className={`p-1 rounded hover:bg-slate-200 border border-transparent ${showCritical ? 'bg-slate-200 border-slate-300' : ''}`}>
                            {ToggleIcons.Critical(showCritical)}
                        </button>
                        <button title="Toggle Grid Lines" onClick={() => setShowGrid(!showGrid)} className={`p-1 rounded hover:bg-slate-200 border border-transparent ${showGrid ? 'bg-slate-200 border-slate-300' : ''}`}>
                            {ToggleIcons.Grid(showGrid)}
                        </button>
                    </div>
                </div>
             </div>

            <div className="flex flex-grow overflow-hidden h-full">
                {/* TABLE */}
                <div className="border-r border-slate-300 flex flex-col bg-white shrink-0 shadow-lg z-10" style={{ width: (Object.values(colWidths) as number[]).reduce((a, b) => a + b, 0) + 20 }}>
                    <div className="p6-header select-none shrink-0" style={{ height: HEADER_HEIGHT }}>
                        <ResizableHeader colId="id" width={colWidths.id} onResize={w => setColWidths({...colWidths, id: w})}>ID</ResizableHeader>
                        <ResizableHeader colId="name" width={colWidths.name} onResize={w => setColWidths({...colWidths, name: w})}>Name</ResizableHeader>
                        <ResizableHeader colId="duration" width={colWidths.duration} onResize={w => setColWidths({...colWidths, duration: w})} align="center">Dur</ResizableHeader>
                        <ResizableHeader colId="start" width={colWidths.start} onResize={w => setColWidths({...colWidths, start: w})} align="center">Start</ResizableHeader>
                        <ResizableHeader colId="finish" width={colWidths.finish} onResize={w => setColWidths({...colWidths, finish: w})} align="center">Finish</ResizableHeader>
                        <ResizableHeader colId="float" width={colWidths.float} onResize={w => setColWidths({...colWidths, float: w})} align="center">Float</ResizableHeader>
                        <ResizableHeader colId="preds" width={colWidths.preds} onResize={w => setColWidths({...colWidths, preds: w})}>Predecessors</ResizableHeader>
                    </div>
                    <div ref={tableBodyRef} className="flex-grow overflow-y-auto overflow-x-hidden custom-scrollbar bg-white" onScroll={handleTableScroll}>
                        {flatRows.map(row => {
                            const isSel = selectedIds.includes(row.id);
                            const isWBS = row.type === 'WBS';
                            const isMilestone = !isWBS && row.data.duration === 0;
                            const iconSize = fontSizePx; // Icon height matches text height
                            
                            return (
                                <div key={row.id}
                                    className={`p6-row ${isSel ? 'selected' : (isWBS ? 'wbs' : '')}`}
                                    style={{ height: ROW_HEIGHT }}
                                    onClick={(e) => onSelect(row.id, e.ctrlKey)}
                                    onContextMenu={(e) => { e.preventDefault(); onSelect(row.id, e.ctrlKey); onCtx({ x: e.clientX, y: e.clientY, id: row.id, type: row.type, selIds: selectedIds }); }}
                                >
                                    <div className="p6-cell font-sans" style={{ width: colWidths.id, paddingLeft: (row.depth * 15 + 4) + 'px' }} data-col="id">
                                        {isWBS ? (
                                            <div className="flex items-center cursor-pointer h-full" onClick={(e) => { e.stopPropagation(); toggleWbs(row.id); }}>
                                                <div style={{ width: iconSize, height: iconSize, marginRight: 4 }}>
                                                    {row.collapsed ? TableIcons.Expand : TableIcons.Collapse}
                                                </div>
                                                <div style={{ width: iconSize, height: iconSize, marginRight: 4 }}>
                                                    {TableIcons.Folder}
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ width: iconSize, height: iconSize, marginRight: 6 }}>
                                                {isMilestone ? TableIcons.Milestone : TableIcons.Task}
                                            </div>
                                        )}
                                        {editing?.id === row.id && editing.field === 'id' ? 
                                            <input autoFocus className="w-full h-full px-1" value={val} onChange={e => setVal(e.target.value)} onBlur={saveEdit} onKeyDown={e => e.key === 'Enter' && saveEdit()} /> : 
                                            <span onDoubleClick={() => startEdit(row.id, 'id', row.id)} className="truncate pt-[3px] pb-[3px]">{row.id}</span>
                                        }
                                    </div>
                                    <div className="p6-cell" style={{ width: colWidths.name }} data-col="name">
                                        {editing?.id === row.id && editing.field === 'name' ? 
                                            <input autoFocus className="w-full h-full px-1" value={val} onChange={e => setVal(e.target.value)} onBlur={saveEdit} onKeyDown={e => e.key === 'Enter' && saveEdit()} /> : 
                                            <span onDoubleClick={() => startEdit(row.id, 'name', row.data.name)} className="truncate pt-[3px] pb-[3px]">{row.data.name}</span>
                                        }
                                    </div>
                                    <div className="p6-cell justify-center" style={{ width: colWidths.duration }} data-col="duration">
                                        {!isWBS ? (
                                            editing?.id === row.id && editing.field === 'duration' ? 
                                            <input autoFocus className="w-full h-full text-center" value={val} onChange={e => setVal(e.target.value)} onBlur={saveEdit} onKeyDown={e => e.key === 'Enter' && saveEdit()} /> : 
                                            <span onDoubleClick={() => startEdit(row.id, 'duration', row.data.duration)} className="pt-[3px] pb-[3px]">{row.data.duration}</span>
                                        ) : (
                                            <span className="pt-[3px] pb-[3px]">{row.data.duration}</span>
                                        )}
                                    </div>
                                    <div className="p6-cell justify-center" style={{ width: colWidths.start }} data-col="start"><span className="pt-[3px] pb-[3px]">{formatDate(row.startDate)}</span></div>
                                    <div className="p6-cell justify-center" style={{ width: colWidths.finish }} data-col="finish"><span className="pt-[3px] pb-[3px]">{formatDate(row.endDate)}</span></div>
                                    <div className="p6-cell justify-center" style={{ width: colWidths.float }} data-col="float">
                                        {!isWBS && <span className={`pt-[3px] pb-[3px] ${row.data.totalFloat <= 0 ? 'text-red-600 font-bold' : ''}`}>{row.data.totalFloat}</span>}
                                    </div>
                                    <div className="p6-cell" style={{ width: colWidths.preds }} data-col="preds" onDoubleClick={() => !isWBS && startEdit(row.id, 'predecessors', null)}>
                                        {!isWBS && (editing?.id === row.id && editing.field === 'predecessors' ? 
                                            <input autoFocus className="w-full h-full" value={val} onChange={e => setVal(e.target.value)} onBlur={saveEdit} onKeyDown={e => e.key === 'Enter' && saveEdit()} /> : 
                                            <span className="truncate pt-[3px] pb-[3px]">{row.data.predecessors?.map((p: any) => {
                                                const t = p.type !== 'FS' ? p.type : '';
                                                const l = p.lag !== 0 ? (p.lag > 0 ? `+${p.lag}` : p.lag) : '';
                                                return `${p.activityId}${t}${l}`;
                                            }).join(', ')}</span>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                        <div style={{ height: 200 }}></div>
                    </div>
                </div>

                {/* GANTT */}
                <GanttChart 
                    ref={ganttBodyRef}
                    rows={flatRows}
                    activities={schedule}
                    projectStartDate={projectStartDate}
                    totalDuration={totalDuration}
                    showRelations={showRelations}
                    showCritical={showCritical}
                    showGrid={showGrid}
                    zoomLevel={zoomLevel}
                    onScroll={handleGanttScroll}
                    userSettings={userSettings}
                    rowHeight={ROW_HEIGHT}
                    fontSize={fontSizePx}
                    headerHeight={HEADER_HEIGHT}
                />
            </div>
        </div>
    );
};

export default CombinedView;
