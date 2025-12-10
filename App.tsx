
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
import { AlertModal, ConfirmModal, AboutModal, UserSettingsModal, PrintSettingsModal, BatchAssignModal } from './components/Modals';

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
    const [clipboard, setClipboard] = useState<string[]>([]);
    
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
    
    // Updates Project Meta and synchronizes Root WBS Node if needed
    const handleProjectUpdate = (meta: ProjectData['meta'], calendars: ProjectData['calendars']) => {
        setData(prev => {
            if(!prev) return null;
            let newWbs = [...prev.wbs];
            let newActs = [...prev.activities];

            // 1. Sync Root Node Name with Project Title
            if (meta.title !== prev.meta.title) {
                newWbs = newWbs.map(w => (!w.parentId || w.parentId === 'null') ? { ...w, name: meta.title } : w);
            }

            // 2. Sync Root Node ID with Project Code (Cascade update)
            if (meta.projectCode !== prev.meta.projectCode) {
                const root = newWbs.find(w => !w.parentId || w.parentId === 'null');
                if (root) {
                    const oldId = root.id;
                    const newId = meta.projectCode;
                    // Check if new ID already exists (collision)
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
        if (act === 'delAct') {
            setData(p => p ? { ...p, activities: p.activities.filter(a => !targets.includes(a.id)), assignments: p.assignments.filter(a => !targets.includes(a.activityId)) } : null);
            setSelIds([]);
        }
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
                if(res?.type !== 'Material' && act.duration > 0) {
                    total = units * act.duration;
                }
                newAssignments.push({ activityId: aid, resourceId: rid, units: total });
            });
        });
        
        setData(p => p ? { ...p, assignments: newAssignments } : null);
        setActiveModal(null);
    };

    // Callback for updating assignments from DetailsPanel - Fixes duplicate issue by replacing list
    const handleAssignUpdate = (newAssignments: any) => {
        setData(p => p ? { ...p, assignments: newAssignments } : null);
    };

    const executePrint = async (settings: PrintSettings) => {
        if (view !== 'activities') setView('activities');
        
        // Wait for render
        setTimeout(async () => {
            const original = document.querySelector('.combined-view-container');
            if (!original) return;
            
            const clone = original.cloneNode(true) as HTMLElement;
            clone.style.height = 'auto';
            clone.style.width = '2400px'; 
            clone.style.position = 'absolute';
            clone.style.top = '-10000px';
            clone.style.left = '-10000px';
            clone.style.overflow = 'visible';
            clone.style.background = 'white';

            // Filter Columns
            const allowedCols = ['id', 'name', 'duration', 'start', 'finish', 'float'];
            const cells = clone.querySelectorAll('[data-col]');
            cells.forEach((cell: any) => {
                const colId = cell.getAttribute('data-col');
                if (colId && !allowedCols.includes(colId)) {
                    cell.style.display = 'none';
                }
            });

            // Adjust width of Table container to fit only visible columns
            const tableContainer = clone.children[1]?.children[0] as HTMLElement; // CombinedView -> Split -> Table
            if(tableContainer) {
                 tableContainer.style.width = '700px'; // Approx width of allowed cols
            }

            // Force scroll containers to be visible
            const scrollers = clone.querySelectorAll('.custom-scrollbar');
            scrollers.forEach((e: any) => { 
                e.style.overflow = 'visible'; 
                e.style.height = 'auto'; 
                e.style.maxHeight = 'none'; 
                e.style.width = 'auto'; 
            });

            // Ensure the internal table containers also expand
            const flexGrowers = clone.querySelectorAll('.flex-grow');
            flexGrowers.forEach((e:any) => {
                e.style.flexGrow = '0';
                e.style.height = 'auto';
                e.style.overflow = 'visible';
            });

            const svg = clone.querySelector('svg');
            if(svg) {
                svg.style.overflow = 'visible';
            }

            document.body.appendChild(clone);
            
            const canvas = await html2canvas(clone, { scale: 1.5, useCORS: true, windowWidth: 3000, windowHeight: clone.scrollHeight + 100 });
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
            let pageHeight = pageH;

            pdf.addImage(canvas.toDataURL('image/jpeg'), 'JPEG', 0, position, pageW, finalH);
            heightLeft -= pageHeight;

            while (heightLeft > 0) {
                position = heightLeft - finalH; 
                pdf.addPage();
                pdf.addImage(canvas.toDataURL('image/jpeg'), 'JPEG', 0, position, pageW, finalH);
                heightLeft -= pageHeight;
            }

            pdf.save(`Project_${settings.paperSize}.pdf`);
        }, 500);
    };

    const handleMenuAction = (action: string) => {
        switch(action) {
            case 'import': fileInputRef.current?.click(); break;
            case 'export': handleSave(); break;
            case 'print': setActiveModal('print'); break;
            case 'copy': if(selIds.length) setClipboard(selIds); break;
            case 'cut':
                 if(selIds.length) {
                     setClipboard(selIds);
                     if(data) setData(p => p ? { ...p, activities: p.activities.filter(a => !selIds.includes(a.id)) } : null);
                     setSelIds([]);
                 }
                 break;
            case 'paste':
                if(clipboard.length && data) {
                    const newActivities = clipboard.map(oldId => {
                        const original = data.activities.find(a => a.id === oldId);
                        if(!original) return null;
                        const suffix = Math.floor(Math.random() * 1000);
                        return { ...original, id: original.id + '-' + suffix, name: original.name + ' - Copy' };
                    }).filter(x => x !== null) as any[];
                    setData(p => p ? { ...p, activities: [...p.activities, ...newActivities] } : null);
                }
                break;
            case 'project_info': setActiveModal('project_settings'); break;
            case 'view_activities': setView('activities'); break;
            case 'view_resources': setView('resources'); break;
            case 'settings': setActiveModal('user_settings'); break;
            case 'help': setActiveModal('about'); break;
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
        <div className="flex h-full items-center justify-center bg-slate-50 flex-col gap-4">
            <h1 className="text-3xl font-bold text-blue-900 tracking-tight">Planner Web</h1>
            <button onClick={createNew} className="bg-blue-600 text-white px-8 py-4 rounded shadow hover:bg-blue-700 flex items-center gap-2 text-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                Create New Project
            </button>
        </div>
    );

    return (
        <div className="flex flex-col h-full bg-slate-100" onClick={() => setCtx(null)}>
            <MenuBar onAction={handleMenuAction} lang={userSettings.language} uiSize={userSettings.uiSize} uiFontPx={userSettings.uiFontPx} />
            
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
