
import React, { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { ProjectData, ScheduleResult, UserSettings, PrintSettings } from './types';
import { calculateSchedule } from './services/scheduler';
import Toolbar from './components/Toolbar';
import MenuBar from './components/MenuBar';
import CombinedView from './components/CombinedView';
import DetailsPanel from './components/DetailsPanel';
import ResourcesPanel from './components/ResourcesPanel';
import ProjectSettingsModal from './components/ProjectSettingsModal';
import { AlertModal, ConfirmModal, AboutModal, UserSettingsModal, PrintSettingsModal, BatchAssignModal, AdminModal, HelpModal } from './components/Modals';

// --- APP ---
const App: React.FC = () => {
    const [data, setData] = useState<ProjectData | null>(null);
    const [schedule, setSchedule] = useState<ScheduleResult>({ activities: [], wbsMap: {} });
    const [selIds, setSelIds] = useState<string[]>([]);
    const [view, setView] = useState<'activities' | 'resources'>('activities');
    const [ganttZoom, setGanttZoom] = useState<'day' | 'week' | 'month' | 'quarter' | 'year'>('day');
    
    // Modals State
    const [activeModal, setActiveModal] = useState<string | null>(null);
    const [modalData, setModalData] = useState<any>(null);

    const [ctx, setCtx] = useState<any>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [clipboard, setClipboard] = useState<{ids: string[], type: 'Activities'|'WBS'} | null>(null);
    
    const [userSettings, setUserSettings] = useState<UserSettings>({ 
        dateFormat: 'YYYY-MM-DD', 
        language: 'en',
        uiSize: 'small',
        uiFontPx: 13,
        gridSettings: { showVertical: true, verticalInterval: 'auto', showHorizontal: true, showWBSLines: true } 
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { 
        if(data) { 
            const res = calculateSchedule(data);
            setSchedule(res); 
            setIsDirty(true); 
        } 
    }, [data]);

    const createNew = () => {
        const pCode = 'PROJ-01';
        const pName = 'New Project';
        const defCal = { id: 'cal-1', name: 'Standard 5-Day', isDefault:true, weekDays:[false,true,true,true,true,true,false], hoursPerDay:8, exceptions:[] };
        setData({
            wbs: [{id: pCode, name: pName, parentId:null}], activities: [], resources: [], assignments: [], calendars: [defCal],
            meta: { 
                title: pName, projectCode: pCode, defaultCalendarId: defCal.id, projectStartDate: new Date().toISOString().split('T')[0], 
                activityIdPrefix:'A', activityIdIncrement:10, resourceIdPrefix:'R', resourceIdIncrement:10 
            }
        });
        setIsDirty(false); setActiveModal(null);
    };

    const handleNew = () => {
        if(data && isDirty) {
            setModalData({ msg: "Unsaved changes. Continue?", action: createNew });
            setActiveModal('confirm');
        } else {
            createNew();
        }
    };

    const handleOpen = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                setData(json); setIsDirty(false);
            } catch (err) { alert("Failed to parse"); }
        };
        reader.readAsText(file);
    };

    const handleSave = () => {
        if (!data) return;
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${data.meta.title.replace(/\s+/g, '_')}.json`;
        link.click();
        setIsDirty(false);
    };

    const handleUpdate = (id: string, field: string, val: any) => {
        if (!data) return;
        const isWBS = data.wbs.some(w => w.id === id);
        if (isWBS) {
            if (field === 'id') {
                if (data.wbs.some(w => w.id === val)) return;
                setData(p => {
                    if (!p) return null;
                    return {
                        ...p, 
                        wbs: p.wbs.map(w => w.id === id ? { ...w, id: val } : (w.parentId === id ? { ...w, parentId: val } : w)), 
                        activities: p.activities.map(a => a.wbsId === id ? { ...a, wbsId: val } : a)
                    };
                });
            } else {
                setData(p => p ? { ...p, wbs: p.wbs.map(w => w.id === id ? { ...w, [field]: val } : w) } : null);
            }
        } else {
            if (field === 'predecessors') { 
                const preds = Array.isArray(val) ? val : String(val).split(',').filter(x => x).map(s => {
                    const m = s.trim().match(/^([a-zA-Z0-9.\-_]+)(FS|SS|FF|SF)?([+-]?\d+)?$/);
                    return m ? { activityId: m[1], type: (m[2] as any) || 'FS', lag: parseInt(m[3] || '0') } : null;
                }).filter(x => x !== null) as any[];
                setData(p => p ? { ...p, activities: p.activities.map(a => a.id === id ? { ...a, predecessors: preds } : a) } : null);
            } else {
                setData(p => p ? { ...p, activities: p.activities.map(a => a.id === id ? { ...a, [field]: (field === 'duration' || field === 'budgetedCost') ? Number(val) : val } : a) } : null);
            }
        }
    };
    
    const handleProjectUpdate = (meta: ProjectData['meta'], calendars: ProjectData['calendars']) => {
        setData(prev => {
            if(!prev) return null;
            let newWbs = [...prev.wbs];
            let newActs = [...prev.activities];

            if (meta.title !== prev.meta.title) {
                newWbs = newWbs.map(w => (!w.parentId || w.parentId === 'null') ? { ...w, name: meta.title } : w);
            }

            if (meta.projectCode !== prev.meta.projectCode) {
                const root = newWbs.find(w => !w.parentId || w.parentId === 'null');
                if (root) {
                    const oldId = root.id;
                    const newId = meta.projectCode;
                    if (!newWbs.some(w => w.id === newId)) {
                         newWbs = newWbs.map(w => {
                             if (w.id === oldId) return { ...w, id: newId };
                             if (w.parentId === oldId) return { ...w, parentId: newId };
                             return w;
                         });
                         newActs = newActs.map(a => a.wbsId === oldId ? { ...a, wbsId: newId } : a);
                    }
                }
            }
            return { ...prev, meta, calendars, wbs: newWbs, activities: newActs };
        });
    };

    const handleDeleteItems = (ids: string[]) => {
        setData(p => {
             if(!p) return null;
             const wbsToDelete = p.wbs.filter(w => ids.includes(w.id));
             if (wbsToDelete.length > 0) {
                 return { ...p, wbs: p.wbs.filter(w => !ids.includes(w.id)) };
             } else {
                 return {
                     ...p,
                     activities: p.activities.filter(a => !ids.includes(a.id)),
                     assignments: p.assignments.filter(a => !ids.includes(a.activityId))
                 };
             }
        });
        setSelIds([]);
    };

    const handleCtxAction = (act: string) => {
        const { id, selIds: contextSelIds } = ctx; 
        const targets = (contextSelIds && contextSelIds.length > 0) ? contextSelIds : [id];
        setCtx(null);

        if (!data) return;

        if (act === 'addAct' || act === 'addActSame') {
            const wbsId = act === 'addActSame' ? data.activities.find(a => a.id === id)?.wbsId : id;
            if (!wbsId) return;
            const max = data.activities.reduce((m, a) => { 
                const match = a.id.match(/(\d+)/); 
                return match ? Math.max(m, parseInt(match[1])) : m; 
            }, 1000);
            const newId = (data.meta.activityIdPrefix || 'A') + (max + (data.meta.activityIdIncrement || 10));
            setData(p => p ? { ...p, activities: [...p.activities, { id: newId, name: 'New Task', wbsId, duration: 5, predecessors: [], budgetedCost: 0, calendarId: p.meta.defaultCalendarId, activityType: 'Task', startDate: new Date(), endDate: new Date(), earlyStart: new Date(), earlyFinish: new Date(), lateStart: new Date(), lateFinish: new Date(), totalFloat: 0 }] } : null);
        }
        if (act === 'addWBS') {
            const newId = id + '.' + (data.wbs.filter(w => w.parentId === id).length + 1);
            setData(p => p ? { ...p, wbs: [...p.wbs, { id: newId, name: 'New WBS', parentId: id }] } : null);
        }
        if (act === 'delAct') handleDeleteItems(targets);
        if (act === 'delWBS') {
            setModalData({ msg: "Delete WBS and all its activities?", action: () => setData(p => p ? { ...p, wbs: p.wbs.filter(w => w.id !== id) } : null) });
            setActiveModal('confirm');
        }
        if (act === 'assignRes') {
            setModalData({ ids: targets });
            setActiveModal('batchRes');
        }
    };

    const handleBatchAssign = (resourceIds: string[], units: number) => {
        if (!data || !modalData) return;
        const actIds = modalData.ids as string[];
        
        let newAssignments = [...data.assignments];
        newAssignments = newAssignments.filter(a => !(actIds.includes(a.activityId) && resourceIds.includes(a.resourceId)));
        
        actIds.forEach(aid => {
            const act = data.activities.find(a => a.id === aid);
            if(!act) return;
            resourceIds.forEach(rid => {
                const res = data.resources.find(r => r.id === rid);
                let total = units;
                if(res?.type !== 'Material' && act.duration > 0) total = units * act.duration;
                newAssignments.push({ activityId: aid, resourceId: rid, units: total });
            });
        });
        
        setData(p => p ? { ...p, assignments: newAssignments } : null);
        setActiveModal(null);
    };

    const handleAssignUpdate = (newAssignments: any) => {
        setData(p => p ? { ...p, assignments: newAssignments } : null);
    };

    const executePrint = async (settings: PrintSettings) => {
        if (view !== 'activities') setView('activities');
        
        // Wait for view to settle
        await new Promise(r => setTimeout(r, 200));

        const original = document.querySelector('.combined-view-container');
        if (!original) return;
        
        // Get the computed height of a row from the live DOM
        const firstRow = original.querySelector('.p6-row') as HTMLElement;
        const computedRowHeight = firstRow ? firstRow.offsetHeight : 0;
        
        // Clone for printing
        const clone = original.cloneNode(true) as HTMLElement;
        clone.style.height = 'auto';
        clone.style.width = 'fit-content'; 
        clone.style.minWidth = '1000px';
        clone.style.position = 'absolute';
        clone.style.top = '-10000px';
        clone.style.left = '-10000px';
        clone.style.overflow = 'visible';
        clone.style.background = 'white';
        // Add Border and Padding
        clone.style.border = '1px solid #cbd5e1'; // Light thin line
        clone.style.padding = '15px'; // 15px margin around content
        clone.style.boxSizing = 'border-box';

        // 1. FILTER COLUMNS
        const allowedCols = settings.selectedColumns || ['id', 'name', 'duration', 'start', 'finish', 'float', 'preds'];
        const cells = clone.querySelectorAll('[data-col]');
        let tableWidth = 0;
        
        cells.forEach((cell: any) => {
            const colId = cell.getAttribute('data-col');
            if (colId && !allowedCols.includes(colId)) {
                cell.style.display = 'none';
            }
        });

        const headerCells = clone.querySelectorAll('.p6-header > div');
        headerCells.forEach((cell: any) => {
            if(cell.style.display !== 'none') {
                tableWidth += parseFloat(cell.style.width || '0');
            }
        });
        
        const tableContainer = clone.children[1]?.children[0] as HTMLElement; 
        if(tableContainer) {
            tableContainer.style.width = `${tableWidth + 20}px`;
        }

        // 2. FORCE GANTT WIDTH
        const ganttSvg = clone.querySelector('svg');
        let ganttWidth = 0;
        if(ganttSvg) {
            ganttSvg.style.overflow = 'visible';
            const requiredWidth = parseFloat(ganttSvg.getAttribute('width') || '1000');
            ganttWidth = requiredWidth;
            
            const ganttContainer = ganttSvg.parentElement?.parentElement;
            if(ganttContainer) {
                ganttContainer.style.width = `${requiredWidth}px`;
                ganttContainer.style.overflow = 'visible';
            }
        }

        // --- INJECT WATERMARK AT MAIN CONTAINER LEVEL ---
        try {
            const wmRes = await fetch('watermark.md');
            let wmText = 'Powered by Planner.cn';
            if (wmRes.ok) wmText = await wmRes.text();
            
            const wmDiv = document.createElement('div');
            wmDiv.style.position = 'absolute';
            // Position Top Right - Below header which is usually ~45-50px.
            wmDiv.style.top = '55px';
            wmDiv.style.right = '20px';
            // Light grey
            wmDiv.style.color = '#cbd5e1'; 
            wmDiv.style.fontSize = '12px';
            wmDiv.style.fontWeight = 'bold';
            wmDiv.style.zIndex = '9999';
            wmDiv.style.pointerEvents = 'none';
            wmDiv.innerText = wmText;
            
            clone.style.position = 'relative'; 
            clone.appendChild(wmDiv);
        } catch(e) { console.warn("Could not load watermark", e); }

        // Width logic: Table + Gantt + Padding (15*2) + Buffer
        clone.style.width = `${tableWidth + ganttWidth + 50}px`;

        const scrollers = clone.querySelectorAll('.custom-scrollbar');
        scrollers.forEach((e: any) => { 
            e.style.overflow = 'visible'; 
            e.style.height = 'auto'; 
            e.style.maxHeight = 'none'; 
            e.style.width = 'auto'; 
        });

        // --- 3. FORCE ROW HEIGHT ---
        if (computedRowHeight > 0) {
            // Re-query rows in the clone to apply styles
            const cloneRows = clone.querySelectorAll('.p6-row');
            
            // We need to iterate over the *original* rows to get individual height if variable,
            // or just use computedRowHeight if fixed. 
            // The user requested variable height support based on text.
            // However, HTML2Canvas renders what it sees.
            // If rows are flex, let's enforce min-height.
            
            const originalRows = original.querySelectorAll('.p6-row');
            
            cloneRows.forEach((row: any, i: number) => {
                 // Get height from original to handle text wrapping
                 const origRow = originalRows[i] as HTMLElement;
                 const h = origRow ? origRow.offsetHeight : computedRowHeight;

                 row.style.height = `${h}px`;
                 row.style.minHeight = `${h}px`;
                 row.style.maxHeight = `${h}px`;
                 row.style.flexShrink = '0';
                 row.style.overflow = 'hidden';
                 
                 // Sync Gantt row group Y position? 
                 // This is hard because Gantt is SVG with absolute Y coords based on fixed rowHeight.
                 // If table rows expand, Gantt SVG rows will misalign unless we rebuild SVG.
                 // Current Gantt implementation uses fixed rowHeight prop.
                 // To ensure alignment, we must enforce the fixed row height on the table rows during print,
                 // OR accepting that text might be cut off if it wraps too much.
                 // The "Correct" P6 way is strict row height.
                 // So we enforce the calculated schedule row height.
            });
        }

        document.body.appendChild(clone);
        await new Promise(r => setTimeout(r, 500));

        try {
            const canvas = await html2canvas(clone, { 
                scale: 2, 
                useCORS: true, 
                windowWidth: clone.scrollWidth + 100, 
                windowHeight: clone.scrollHeight + 100 
            });
            document.body.removeChild(clone);
            
            const dims: Record<string, {w: number, h: number}> = {
                'a4': {w: 595, h: 842},
                'a3': {w: 842, h: 1190},
                'a2': {w: 1190, h: 1684},
                'a1': {w: 1684, h: 2384}
            };
            
            const isLandscape = settings.orientation === 'landscape';
            const pageW = isLandscape ? dims[settings.paperSize].h : dims[settings.paperSize].w;
            const pageH = isLandscape ? dims[settings.paperSize].w : dims[settings.paperSize].h;

            const pdf = new jsPDF(isLandscape ? 'l' : 'p', 'pt', [pageW, pageH]);
            
            const imgWidth = canvas.width;
            const imgHeight = canvas.height;
            const ratio = pageW / imgWidth;
            const finalH = imgHeight * ratio;

            let heightLeft = finalH;
            let position = 0;
            const pageContentHeight = pageH; 

            pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, position, pageW, finalH);
            heightLeft -= pageContentHeight;

            while (heightLeft > 0) {
                position = heightLeft - finalH; 
                pdf.addPage();
                pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, position - (finalH - heightLeft) - pageContentHeight, pageW, finalH);
                heightLeft -= pageContentHeight;
            }

            const blob = pdf.output('bloburl');
            window.open(blob, '_blank');
        } catch (e) {
            console.error("Print failed", e);
            document.body.removeChild(clone);
            alert("Printing failed. Please try again.");
        }
    };

    const handleMenuAction = (action: string) => {
        switch(action) {
            case 'import': fileInputRef.current?.click(); break;
            case 'export': handleSave(); break;
            case 'print': setActiveModal('print'); break;
            case 'copy': 
                 if (selIds.length > 0) {
                     if (data?.wbs.some(w => selIds.includes(w.id))) {
                         setClipboard({ ids: selIds, type: 'WBS' });
                     } else {
                         setClipboard({ ids: selIds, type: 'Activities' });
                     }
                 }
                 break;
            case 'cut':
                 if(selIds.length) {
                     if (data?.wbs.some(w => selIds.includes(w.id))) setClipboard({ ids: selIds, type: 'WBS' });
                     else setClipboard({ ids: selIds, type: 'Activities' });
                     handleDeleteItems(selIds);
                 }
                 break;
            case 'paste':
                if(clipboard && data) {
                    if (clipboard.type === 'Activities') {
                        const targetWbsId = selIds.length > 0 ? 
                            (data.activities.find(a => a.id === selIds[0])?.wbsId || data.wbs.find(w=>w.id === selIds[0])?.id) :
                            (data.wbs.length > 0 ? data.wbs[0].id : null);
                            
                        if (targetWbsId) {
                            const newActivities = clipboard.ids.map(oldId => {
                                const original = data.activities.find(a => a.id === oldId); 
                                if(!original) return null; 
                                const suffix = Math.floor(Math.random() * 1000);
                                return { ...original, id: original.id + '-' + suffix, name: original.name + ' - Copy', wbsId: targetWbsId };
                            }).filter(x => x !== null) as any[];
                            setData(p => p ? { ...p, activities: [...p.activities, ...newActivities] } : null);
                        }
                    } else if (clipboard.type === 'WBS') {
                        const targetParentId = selIds.length > 0 ?
                             (data.wbs.find(w => w.id === selIds[0]) ? selIds[0] : null) : 
                             (data.wbs.find(w => !w.parentId)?.id); 
                        
                        if (targetParentId) {
                            const newWbsNodes: any[] = [];
                            const newActivities: any[] = [];
                            clipboard.ids.forEach(wbsId => {
                                const original = data.wbs.find(w => w.id === wbsId);
                                if(original) {
                                    const suffix = Math.floor(Math.random() * 1000);
                                    const newId = original.id + '-CP' + suffix;
                                    newWbsNodes.push({ ...original, id: newId, name: original.name + ' (Copy)', parentId: targetParentId });
                                    data.activities.filter(a => a.wbsId === wbsId).forEach(act => {
                                        newActivities.push({ ...act, id: act.id + '-' + suffix, wbsId: newId });
                                    });
                                }
                            });
                            setData(p => p ? { ...p, wbs: [...p.wbs, ...newWbsNodes], activities: [...p.activities, ...newActivities] } : null);
                        }
                    }
                }
                break;
            case 'project_info': setActiveModal('project_settings'); break;
            case 'view_activities': setView('activities'); break;
            case 'view_resources': setView('resources'); break;
            case 'settings': setActiveModal('user_settings'); break;
            case 'help': setActiveModal('help'); break;
            case 'about': setActiveModal('about'); break;
        }
    };

    const ContextMenu = ({ data, onClose, onAction }: any) => {
        if (!data) return null;
        const { x, y, type } = data;
        const style = { top: Math.min(y, window.innerHeight - 150), left: Math.min(x, window.innerWidth - 180) };
        const Icons = {
            Task: <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/></svg>,
            WBS: <svg className="w-3 h-3 text-yellow-600" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>,
            User: <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/></svg>,
            Delete: <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
        };
        
        return (
            <div className="ctx-menu" style={{ ...style, fontSize: `${userSettings.uiFontPx || 13}px` }} onClick={e => e.stopPropagation()}>
                <div className="bg-slate-100 px-3 py-1 font-bold border-b text-slate-500">{type} Actions</div>
                {type === 'WBS' && (
                    <>
                        <div className="ctx-item" onClick={() => onAction('addAct')}>{Icons.Task} Add Activity</div>
                        <div className="ctx-item" onClick={() => onAction('addWBS')}>{Icons.WBS} Add Child WBS</div>
                        <div className="ctx-sep"></div>
                        <div className="ctx-item text-red-600" onClick={() => onAction('delWBS')}>{Icons.Delete} Delete WBS</div>
                    </>
                )}
                {type === 'Activity' && (
                    <>
                        <div className="ctx-item" onClick={() => onAction('addActSame')}>{Icons.Task} Add Activity</div>
                        <div className="ctx-item" onClick={() => onAction('assignRes')}>{Icons.User} Assign Resource</div>
                        <div className="ctx-sep"></div>
                        <div className="ctx-item text-red-600" onClick={() => onAction('delAct')}>{Icons.Delete} Delete Activity</div>
                    </>
                )}
            </div>
        );
    };

    if (!data) return (
        <div className="flex h-full w-full items-center justify-center bg-slate-900 relative overflow-hidden font-sans">
             <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>
             
             <div className="z-10 bg-white p-12 rounded-xl shadow-2xl flex flex-col items-center gap-8 max-w-lg w-full border border-slate-700">
                <div className="text-center">
                    <h1 className="text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-700 tracking-tighter" 
                        style={{ 
                            textShadow: '3px 3px 0px #e2e8f0', 
                            fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                            transform: 'rotate(-2deg)'
                        }}>
                        Planner
                    </h1>
                    <p className="text-slate-400 text-sm mt-3 font-semibold tracking-widest uppercase">Web Scheduling Platform</p>
                    <div className="mt-4 text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full inline-block">
                        Powered by <span className="text-blue-600">planner.cn</span>
                    </div>
                </div>

                <div className="flex flex-col gap-4 w-full">
                    <button onClick={createNew} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-lg font-bold shadow-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-3 text-lg">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                        Create New Project
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="w-full bg-white hover:bg-slate-50 text-slate-700 py-4 rounded-lg font-bold border-2 border-slate-200 transition-colors flex items-center justify-center gap-3 text-lg">
                         <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"/></svg>
                        Open Existing Project
                    </button>
                </div>

                <div className="pt-6 border-t w-full text-center text-xs text-slate-400">
                    <span>Version 1.0.0 &copy; {new Date().getFullYear()} Planner.cn</span>
                </div>
             </div>
             <input type="file" ref={fileInputRef} onChange={handleOpen} className="hidden" accept=".json" />
             
             <AdminModal isOpen={activeModal === 'admin'} onClose={() => setActiveModal(null)} />
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-slate-100" onClick={() => setCtx(null)}>
            <div className="h-8 flex-shrink-0 relative z-50">
                <MenuBar onAction={handleMenuAction} lang={userSettings.language} uiSize={userSettings.uiSize} uiFontPx={userSettings.uiFontPx} />
            </div>
            
            <Toolbar 
                onNew={handleNew} 
                onOpen={(e) => handleOpen(e)}
                onSave={handleSave}
                onPrint={() => setActiveModal('print')} 
                onSettings={() => setActiveModal('project_settings')} 
                title={data.meta.title} 
                isDirty={isDirty}
                uiFontPx={userSettings.uiFontPx} 
            />
            <input type="file" ref={fileInputRef} onChange={handleOpen} className="hidden" accept=".json" />

            <div className="flex-grow flex flex-col overflow-hidden">
                <div className="bg-slate-300 border-b flex px-2 pt-1 gap-1 shrink-0" style={{ fontSize: `${userSettings.uiFontPx || 13}px` }}>
                    {['Activities', 'Resources'].map(v => (
                        <button key={v} onClick={() => setView(v.toLowerCase() as any)} className={`px-4 py-1 font-bold rounded-t ${view === v.toLowerCase() ? 'bg-white text-blue-900' : 'text-slate-600 hover:bg-slate-200'}`}>
                            {v}
                        </button>
                    ))}
                </div>

                {view === 'activities' && (
                    <>
                        <div className="flex-grow overflow-hidden bg-white relative flex flex-col combined-view-container">
                            <CombinedView 
                                projectData={data} 
                                schedule={schedule.activities} 
                                wbsMap={schedule.wbsMap} 
                                onUpdate={handleUpdate} 
                                selectedIds={selIds} 
                                onSelect={(id, m) => m ? setSelIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]) : setSelIds([id])} 
                                onCtx={setCtx} 
                                userSettings={userSettings}
                                zoomLevel={ganttZoom}
                                onZoomChange={setGanttZoom}
                                onDeleteItems={handleDeleteItems}
                            />
                        </div>
                        <DetailsPanel 
                            activity={schedule.activities.find(a => selIds[selIds.length - 1] === a.id)} 
                            resources={data.resources} 
                            assignments={data.assignments} 
                            calendars={data.calendars} 
                            onUpdate={handleUpdate} 
                            onAssignUpdate={handleAssignUpdate} 
                            userSettings={userSettings}
                            allActivities={schedule.activities}
                        />
                    </>
                )}
                {view === 'resources' && (
                    <ResourcesPanel 
                        resources={data.resources} 
                        assignments={data.assignments} 
                        activities={schedule.activities} 
                        onUpdateResources={(r) => setData(p => p ? { ...p, resources: r } : null)}
                        userSettings={userSettings}
                    />
                )}
            </div>

            <ContextMenu data={ctx} onClose={() => setCtx(null)} onAction={handleCtxAction} />
            
            <AlertModal isOpen={activeModal === 'alert'} msg={modalData?.msg} onClose={() => setActiveModal(null)} />
            
            <ConfirmModal 
                isOpen={activeModal === 'confirm'} 
                msg={modalData?.msg} 
                onConfirm={() => { modalData?.action?.(); setActiveModal(null); }} 
                onCancel={() => setActiveModal(null)}
                lang={userSettings.language} 
            />

            <AboutModal isOpen={activeModal === 'about'} onClose={() => setActiveModal(null)} />
            
            <HelpModal isOpen={activeModal === 'help'} onClose={() => setActiveModal(null)} />

            <UserSettingsModal 
                isOpen={activeModal === 'user_settings'} 
                settings={userSettings} 
                onSave={setUserSettings}
                onClose={() => setActiveModal(null)}
            />

            <PrintSettingsModal 
                isOpen={activeModal === 'print'} 
                onClose={() => setActiveModal(null)}
                onPrint={executePrint}
                lang={userSettings.language}
            />
            
            <ProjectSettingsModal 
                isOpen={activeModal === 'project_settings'} 
                onClose={() => setActiveModal(null)}
                projectData={data}
                onUpdateProject={handleProjectUpdate}
            />
            
            <BatchAssignModal 
                isOpen={activeModal === 'batchRes'} 
                onClose={() => setActiveModal(null)}
                resources={data.resources}
                onAssign={handleBatchAssign}
                lang={userSettings.language}
            />
        </div>
    );
};

export default App;
