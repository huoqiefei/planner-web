
import React, { useState, useEffect, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { ProjectData, ScheduleResult, UserSettings, PrintSettings, AdminConfig } from './types';
import { calculateSchedule } from './services/scheduler';
import Toolbar from './components/Toolbar';
import MenuBar from './components/MenuBar';
import CombinedView from './components/CombinedView';
import DetailsPanel from './components/DetailsPanel';
import ResourcesPanel from './components/ResourcesPanel';
import ProjectSettingsModal from './components/ProjectSettingsModal';
import { AlertModal, ConfirmModal, AboutModal, UserSettingsModal, PrintSettingsModal, BatchAssignModal, AdminModal, HelpModal, ColumnSetupModal } from './components/Modals';

// --- APP ---
const App: React.FC = () => {
    const [data, setData] = useState<ProjectData | null>(null);
    const [schedule, setSchedule] = useState<ScheduleResult>({ activities: [], wbsMap: {} });
    const [selIds, setSelIds] = useState<string[]>([]);
    const [view, setView] = useState<'activities' | 'resources'>('activities');
    const [ganttZoom, setGanttZoom] = useState<'day' | 'week' | 'month' | 'quarter' | 'year'>('day');
    
    // Gantt Visual State
    const [showRelations, setShowRelations] = useState(true);
    const [showCritical, setShowCritical] = useState(false);
    
    // View State
    const [showDetails, setShowDetails] = useState(true);

    // Modals State
    const [activeModal, setActiveModal] = useState<string | null>(null);
    const [modalData, setModalData] = useState<any>(null);

    const [ctx, setCtx] = useState<any>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [clipboard, setClipboard] = useState<{ids: string[], type: 'Activities'|'WBS'|'Resources'} | null>(null);
    
    // Admin Config
    const [adminConfig, setAdminConfig] = useState<AdminConfig>({
        appName: 'Planner Web',
        copyrightText: 'Copyright © Planner.cn. All rights reserved.',
        enableWatermark: true,
        watermarkText: '',
        watermarkFontSize: 40,
        watermarkOpacity: 0.2,
        ganttBarRatio: 0.35
    });

    const [userSettings, setUserSettings] = useState<UserSettings>({ 
        dateFormat: 'YYYY-MM-DD', 
        language: 'en',
        uiSize: 'small',
        uiFontPx: 13,
        gridSettings: { showVertical: true, verticalInterval: 'auto', showHorizontal: true, showWBSLines: true },
        visibleColumns: ['id', 'name', 'duration', 'start', 'finish', 'float', 'preds'] 
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load Admin Config
    useEffect(() => {
        const saved = localStorage.getItem('planner_admin_config');
        if(saved) {
            try { setAdminConfig({ ...adminConfig, ...JSON.parse(saved) }); } catch(e) {}
        }
    }, []);

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
                setData(p => p ? {
                        ...p, 
                        wbs: p.wbs.map(w => w.id === id ? { ...w, id: val } : (w.parentId === id ? { ...w, parentId: val } : w)), 
                        activities: p.activities.map(a => a.wbsId === id ? { ...a, wbsId: val } : a)
                    } : null);
            } else {
                setData(p => p ? { ...p, wbs: p.wbs.map(w => w.id === id ? { ...w, [field]: val } : w) } : null);
            }
        } else {
            if (field === 'predecessors') { 
                const preds = Array.isArray(val) ? val : String(val).split(',').filter(x => x).map(s => {
                    // Enhanced Parsing: Try to find ID, Type, and Lag
                    // 1. Check for explicit relation type (FS, SS, FF, SF)
                    // Regex: Start, Capture ID (lazy), Capture Type, Optional Capture Lag, End
                    let m = s.trim().match(/^(.+?)(FS|SS|FF|SF)([+-]?\d+)?$/i);
                    if (m) {
                        return { activityId: m[1].trim(), type: (m[2].toUpperCase() as any), lag: parseInt(m[3] || '0') };
                    }
                    // 2. Fallback: ID + Optional Lag (implies FS)
                    m = s.trim().match(/^(.+?)([+-]\d+)?$/);
                    if (m) {
                        return { activityId: m[1].trim(), type: 'FS', lag: parseInt(m[2] || '0') };
                    }
                    return null;
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

            if (meta.title !== prev.meta.title) newWbs = newWbs.map(w => (!w.parentId || w.parentId === 'null') ? { ...w, name: meta.title } : w);
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
             if(view === 'resources') return { ...p, resources: p.resources.filter(r => !ids.includes(r.id)) };
             const wbsToDelete = p.wbs.filter(w => ids.includes(w.id));
             if (wbsToDelete.length > 0) return { ...p, wbs: p.wbs.filter(w => !ids.includes(w.id)) };
             else return { ...p, activities: p.activities.filter(a => !ids.includes(a.id)), assignments: p.assignments.filter(a => !ids.includes(a.activityId)) };
        });
        setSelIds([]);
    };

    const handleRenumberActivities = () => {
        if (!data) return;
        const prefix = data.meta.activityIdPrefix || 'A';
        const increment = data.meta.activityIdIncrement || 10;
        let counter = 0;
        const newActivities = data.activities.map((act) => { counter += increment; return { ...act, newId: `${prefix}${counter}` }; });
        const idMap: Record<string, string> = {};
        newActivities.forEach(a => idMap[a.id] = a.newId);
        const finalActivities = newActivities.map(act => ({ ...act, id: act.newId, predecessors: act.predecessors.map(p => ({ ...p, activityId: idMap[p.activityId] || p.activityId })) }));
        const cleanActivities = finalActivities.map(({newId, ...rest}) => rest);
        const newAssignments = data.assignments.map(asg => ({ ...asg, activityId: idMap[asg.activityId] || asg.activityId }));
        setData({ ...data, activities: cleanActivities, assignments: newAssignments });
        setCtx(null);
    };

    const handleCtxAction = (act: string) => {
        const { id, selIds: contextSelIds } = ctx; 
        const targets = (contextSelIds && contextSelIds.length > 0) ? contextSelIds : [id];
        setCtx(null);
        if (!data) return;

        if (act === 'renumber') {
            setModalData({ msg: `Renumber all activities?`, action: handleRenumberActivities });
            setActiveModal('confirm');
        }
        if (act === 'addAct' || act === 'addActSame') {
            const wbsId = act === 'addActSame' ? data.activities.find(a => a.id === id)?.wbsId : id;
            if (!wbsId) return;
            const max = data.activities.reduce((m, a) => { const match = a.id.match(/(\d+)/); return match ? Math.max(m, parseInt(match[1])) : m; }, 1000);
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
        let newAssignments = [...data.assignments].filter(a => !(actIds.includes(a.activityId) && resourceIds.includes(a.resourceId)));
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

    // Use useCallback to keep reference stable for useEffect
    const handleMenuAction = useCallback((action: string) => {
        switch(action) {
            case 'import': fileInputRef.current?.click(); break;
            case 'export': handleSave(); break;
            case 'print': setActiveModal('print'); break;
            case 'copy': 
                 if (selIds.length > 0 && data) {
                    if (view === 'resources') setClipboard({ ids: selIds, type: 'Resources' });
                    else if (data.wbs.some(w => selIds.includes(w.id))) setClipboard({ ids: selIds, type: 'WBS' });
                    else setClipboard({ ids: selIds, type: 'Activities' });
                 }
                 break;
            case 'cut':
                 if(selIds.length) { 
                     if (data) {
                        if (view === 'resources') setClipboard({ ids: selIds, type: 'Resources' });
                        else if (data.wbs.some(w => selIds.includes(w.id))) setClipboard({ ids: selIds, type: 'WBS' });
                        else setClipboard({ ids: selIds, type: 'Activities' });
                        handleDeleteItems(selIds);
                     }
                 }
                 break;
            case 'paste':
                if(clipboard && data) {
                    if (clipboard.type === 'Resources') {
                        const newResources = clipboard.ids.map(id => {
                            const original = data.resources.find(r => r.id === id);
                            if(!original) return null;
                             const suffix = Math.floor(Math.random() * 1000);
                             return { ...original, id: original.id + '-CP' + suffix, name: original.name + ' (Copy)' };
                        }).filter(x => x) as any;
                        setData(p => p ? { ...p, resources: [...p.resources, ...newResources] } : null);
                    } else if (clipboard.type === 'Activities') {
                        const targetWbsId = selIds.length > 0 ? (data.activities.find(a => a.id === selIds[0])?.wbsId || data.wbs.find(w=>w.id === selIds[0])?.id) : (data.wbs.length > 0 ? data.wbs[0].id : null);
                        if (targetWbsId) {
                            const prefix = data.meta.activityIdPrefix || 'A';
                            const increment = data.meta.activityIdIncrement || 10;
                            let maxVal = 0;
                            data.activities.forEach(a => {
                                const match = a.id.match(/(\d+)$/);
                                if (match) { const val = parseInt(match[1]); if (val > maxVal) maxVal = val; }
                            });
                            const newActivities = clipboard.ids.map((oldId, index) => {
                                const original = data.activities.find(a => a.id === oldId); 
                                if(!original) return null; 
                                const nextVal = maxVal + (increment * (index + 1));
                                const newId = `${prefix}${nextVal}`;
                                return { ...original, id: newId, name: original.name, wbsId: targetWbsId, predecessors: [] };
                            }).filter(x => x !== null) as any[];
                            setData(p => p ? { ...p, activities: [...p.activities, ...newActivities] } : null);
                        }
                    }
                }
                break;
            case 'columns': setActiveModal('columns'); break;
            case 'project_info': setActiveModal('project_settings'); break;
            case 'view_activities': setView('activities'); break;
            case 'view_resources': setView('resources'); break;
            case 'settings': setActiveModal('user_settings'); break;
            case 'help': setActiveModal('help'); break;
            case 'about': setActiveModal('about'); break;
            case 'admin': setActiveModal('admin'); break;
        }
    }, [data, selIds, view, clipboard, isDirty]);

    // Global Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            // Allow copy/paste in inputs, but block for the app level if not in input
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
            
            if (!isInput && (e.ctrlKey || e.metaKey)) {
                if (e.key === 'c') { e.preventDefault(); handleMenuAction('copy'); }
                if (e.key === 'x') { e.preventDefault(); handleMenuAction('cut'); }
                if (e.key === 'v') { e.preventDefault(); handleMenuAction('paste'); }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleMenuAction]);

    // --- ENHANCED PRINT LOGIC ---
    const executePrint = async (settings: PrintSettings) => {
        if (view !== 'activities') setView('activities');
        await new Promise(r => setTimeout(r, 200));

        const original = document.querySelector('.combined-view-container');
        if (!original) {
            alert("Could not find view to print.");
            return;
        }

        // 1. Setup Staging Area (Clone)
        const clone = original.cloneNode(true) as HTMLElement;
        document.body.appendChild(clone);
        
        // Style Clone for Capture
        clone.style.position = 'absolute';
        clone.style.top = '-10000px';
        clone.style.left = '-10000px';
        clone.style.height = 'auto'; 
        clone.style.width = 'fit-content';
        clone.style.overflow = 'visible';
        clone.style.backgroundColor = 'white';
        clone.style.border = 'none'; 
        clone.style.padding = '0';

        // 2. Strict Column Hiding & Width Calc
        const allowedCols = userSettings.visibleColumns;
        const headerCells = clone.querySelectorAll('.p6-header > div');
        let tableWidth = 0;
        
        const isColVisible = (el: Element) => {
            const colId = el.getAttribute('data-col');
            return colId && allowedCols.includes(colId);
        };

        headerCells.forEach((cell: any) => {
            if(isColVisible(cell)) {
                const w = parseFloat(cell.style.width || '0');
                if(w>0) tableWidth += w;
            } else {
                cell.style.display = 'none';
            }
        });

        const cells = clone.querySelectorAll('.p6-cell');
        cells.forEach((cell: any) => {
            if(!isColVisible(cell)) cell.style.display = 'none';
            else {
                // Formatting for print - FORCE VISIBILITY AND ALIGNMENT
                cell.style.display = 'flex'; 
                cell.style.alignItems = 'center'; 
                cell.style.overflow = 'visible'; 
                cell.style.paddingTop = '0px'; // Reset padding to allow flex centering
                cell.style.paddingBottom = '0px'; // Reset padding to allow flex centering
                
                // CRITICAL FIX: Target ALL spans to fix ID text clipping
                // (ID cell has multiple spans: one for icon, one for text)
                const spans = cell.querySelectorAll('span');
                spans.forEach((span: any) => {
                    span.style.textOverflow = 'clip'; 
                    span.style.overflow = 'visible'; 
                    span.style.whiteSpace = 'nowrap';
                    span.style.lineHeight = 'normal'; 
                    span.style.height = 'auto'; 
                    span.style.maxHeight = 'none'; // Ensure no max-height constraints
                });
            }
        });

        // Resize Table Container
        const tableWrapper = clone.querySelector('.border-r.flex-col') as HTMLElement; 
        if(tableWrapper) {
            tableWrapper.style.width = `${tableWidth}px`;
            tableWrapper.style.minWidth = `${tableWidth}px`;
            tableWrapper.style.flexShrink = '0';
        }

        // --- FIX START: DYNAMIC GANTT WIDTH & CLIP ---
        const zoomMap: Record<string, number> = {
            day: 40, week: 15, month: 5, quarter: 2, year: 0.5
        };
        const px = zoomMap[ganttZoom] || 40;

        // Calculate Project Date Range from Schedule for Exact Width
        let maxEnd = new Date(data!.meta.projectStartDate).getTime();
        let minStart = new Date(data!.meta.projectStartDate).getTime();

        if (schedule.activities.length > 0) {
            schedule.activities.forEach(a => {
                const startT = a.startDate.getTime();
                const endT = a.endDate.getTime();
                if (endT > maxEnd) maxEnd = endT;
                if (startT < minStart) minStart = startT;
            });
        }
        
        // Calculate strict duration from Project Start to Max Activity End
        const start = new Date(data!.meta.projectStartDate).getTime();
        const diffDays = Math.max(1, (maxEnd - start) / (1000 * 60 * 60 * 24));
        // Add minimal buffer for last label
        const ganttContentWidth = (diffDays + 5) * px; 

        // Force Gantt Width - Strict Clipping
        const ganttSvg = clone.querySelector('svg');
        let ganttWidth = ganttContentWidth;
        
        if(ganttSvg) {
            // Apply widths to all SVGs and Containers in the Gantt section
            const allSvgs = clone.querySelectorAll('svg');
            allSvgs.forEach((svg: any) => {
                svg.setAttribute('width', `${ganttWidth}`);
            });

            const ganttWrappers = clone.querySelectorAll('.gantt-component, .gantt-header-wrapper, .gantt-body-wrapper');
            ganttWrappers.forEach((el: any) => {
                el.style.width = `${ganttWidth}px`;
                el.style.minWidth = `${ganttWidth}px`;
                el.style.overflow = 'hidden'; // Force clip for print
            });
        }
        // --- FIX END ---

        // 3. SEPARATE HEADERS FROM BODY
        const tableHeader = clone.querySelector('.p6-header') as HTMLElement;
        const tableBody = clone.querySelector('.p6-table-body') as HTMLElement;
        
        const ganttHeader = clone.querySelector('.gantt-header-wrapper') as HTMLElement;
        const ganttBody = clone.querySelector('.gantt-body-wrapper') as HTMLElement;

        if (!tableHeader || !tableBody || !ganttHeader || !ganttBody) {
            document.body.removeChild(clone);
            alert("Print Error: Could not parse view structure. Please try again.");
            return;
        }

        // Create Header Assembly
        const headerAssembly = document.createElement('div');
        headerAssembly.style.display = 'flex';
        headerAssembly.style.width = `${tableWidth + ganttWidth}px`;
        headerAssembly.style.backgroundColor = 'white';
        headerAssembly.style.borderBottom = '1px solid #cbd5e1';
        
        tableHeader.style.width = `${tableWidth}px`;
        tableHeader.style.flexShrink = '0';
        headerAssembly.appendChild(tableHeader);
        
        ganttHeader.style.width = `${ganttWidth}px`;
        ganttHeader.style.border = 'none'; 
        headerAssembly.appendChild(ganttHeader);

        // Create Body Assembly
        const bodyAssembly = document.createElement('div');
        bodyAssembly.style.display = 'flex';
        bodyAssembly.style.width = `${tableWidth + ganttWidth}px`;
        bodyAssembly.style.backgroundColor = 'white';
        
        tableBody.style.width = `${tableWidth}px`;
        tableBody.style.height = 'auto';
        tableBody.style.overflow = 'visible';
        tableBody.style.flexShrink = '0';
        bodyAssembly.appendChild(tableBody);

        ganttBody.style.width = `${ganttWidth}px`;
        ganttBody.style.height = 'auto';
        ganttBody.style.overflow = 'visible';
        bodyAssembly.appendChild(ganttBody);

        // 4. Row Alignment (Remove max-height limits)
        const tableRows = tableBody.querySelectorAll('.p6-row');
        tableRows.forEach((row: any) => {
            const h = row.style.height; 
            if(h) {
                row.style.minHeight = h;
                row.style.height = 'auto'; // FIX: Remove strict height match to allow font flex
                row.style.overflow = 'visible'; // ALLOW content to show if slightly larger
                row.style.maxHeight = 'none'; // Ensure no max height constraint
            }
        });

        // 5. Append Assemblies
        const staging = document.createElement('div');
        staging.style.position = 'absolute';
        staging.style.top = '-10000px';
        staging.style.left = '-10000px';
        staging.style.backgroundColor = 'white';
        staging.appendChild(headerAssembly);
        staging.appendChild(bodyAssembly);
        document.body.appendChild(staging);

        // 6. Capture
        try {
            // Increase scale to 3 for higher clarity on large prints
            const headerCanvas = await html2canvas(headerAssembly, { scale: 3, logging: false });
            const bodyCanvas = await html2canvas(bodyAssembly, { scale: 3, logging: false });
            
            document.body.removeChild(clone);
            document.body.removeChild(staging);

            // 7. Generate PDF
            const dims: Record<string, {w: number, h: number}> = { 'a4': {w: 595, h: 842}, 'a3': {w: 842, h: 1190}, 'a2': {w: 1190, h: 1684}, 'a1': {w: 1684, h: 2384} };
            const isLandscape = settings.orientation === 'landscape';
            const pageW = isLandscape ? dims[settings.paperSize].h : dims[settings.paperSize].w;
            const pageH = isLandscape ? dims[settings.paperSize].w : dims[settings.paperSize].h;
            
            const margin = 20;
            const contentW = pageW - (margin * 2);
            const contentH = pageH - (margin * 2);

            const pdf = new jsPDF(isLandscape ? 'l' : 'p', 'pt', [pageW, pageH]);

            const totalImgW = headerCanvas.width;
            
            // --- SCALING LOGIC ---
            // Base Ratio: Fits width to page content
            const fitRatio = contentW / totalImgW;
            
            let scaleFactor = fitRatio;
            
            if (settings.scalingMode === 'custom') {
                 // Convert user percent (e.g., 100) to ratio (1.0).
                 // However, we captured at scale 3. So 100% "actual size" roughly means 1px = 1pt.
                 // But html2canvas scale=3 means image is 3x bigger. 
                 // If we want "actual size", we should use (1 / 3).
                 // Let's interpret "100%" as "Fit Width" is 100% relative to page? No, standard practice is scale ratio.
                 
                 // Simpler approach: 
                 // "Fit Width" means everything fits.
                 // "100%" means we assume the HTML px maps to PDF pt (72 DPI approx).
                 // Since we captured at 3x, we divide by 3 to get back to 1:1, then multiply by user scale.
                 const baseOneToOne = 1 / 3; 
                 scaleFactor = baseOneToOne * (settings.scalePercent / 100);
            }

            const headerH = headerCanvas.height * scaleFactor;
            const bodyTotalH = bodyCanvas.height * scaleFactor;
            
            let yOffset = 0; 
            let heightLeft = bodyTotalH;

            // PREPARE WATERMARK
            let wmDataUrl = '';
            if (adminConfig.enableWatermark) {
                const wmCanvas = document.createElement('canvas');
                wmCanvas.width = pageW;
                wmCanvas.height = pageH;
                const ctx = wmCanvas.getContext('2d');
                if (ctx) {
                    ctx.save();
                    ctx.translate(pageW/2, pageH/2);
                    ctx.rotate(-30 * Math.PI / 180);
                    ctx.translate(-pageW/2, -pageH/2);
                    
                    ctx.globalAlpha = adminConfig.watermarkOpacity || 0.2;
                    
                    const imgSource = adminConfig.watermarkImage || adminConfig.appLogo;

                    if (imgSource) {
                        const img = new Image();
                        img.src = imgSource;
                        await new Promise(r => img.onload = r);
                        const aspect = img.width / img.height;
                        const drawW = Math.min(400, img.width);
                        const drawH = drawW / aspect;
                        ctx.drawImage(img, (pageW - drawW)/2, (pageH - drawH)/2, drawW, drawH);
                    }
                    
                    if (adminConfig.watermarkText || (!imgSource && adminConfig.copyrightText)) {
                        const text = adminConfig.watermarkText || adminConfig.appName;
                        ctx.font = `bold ${adminConfig.watermarkFontSize || 40}px Arial`;
                        ctx.fillStyle = '#94a3b8';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        const textY = imgSource ? (pageH/2 + 150) : pageH/2;
                        ctx.fillText(text, pageW/2, textY);
                    }
                    ctx.restore();
                    wmDataUrl = wmCanvas.toDataURL('image/png');
                }
            }

            // PAGINATION LOOP
            while (heightLeft > 0) {
                // Header
                // Note: If scaleFactor is huge (custom zoom), the header might be wider than contentW.
                // We clip it or let it flow off page. jsPDF images flow off page by default.
                pdf.addImage(headerCanvas.toDataURL('image/jpeg', 0.9), 'JPEG', margin, margin, headerCanvas.width * scaleFactor, headerH);
                
                // Draw a box around header region (clamped to page)
                const headerBoxW = Math.min(contentW, headerCanvas.width * scaleFactor);
                pdf.setDrawColor(203, 213, 225); 
                pdf.rect(margin, margin, headerBoxW, headerH);

                // Body Slice
                const availableH = contentH - headerH - 10;
                const sliceH = Math.min(heightLeft, availableH);
                
                const sourceY = yOffset / scaleFactor;
                const sourceH = sliceH / scaleFactor;

                const sliceCanvas = document.createElement('canvas');
                sliceCanvas.width = bodyCanvas.width;
                // Safety check for tiny sourceH
                if (sourceH > 0) {
                    sliceCanvas.height = sourceH;
                    const sCtx = sliceCanvas.getContext('2d');
                    if (sCtx) {
                        sCtx.drawImage(
                            bodyCanvas, 
                            0, sourceY, bodyCanvas.width, sourceH, 
                            0, 0, sliceCanvas.width, sliceCanvas.height 
                        );
                        
                        pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 0.9), 'JPEG', margin, margin + headerH, sliceCanvas.width * scaleFactor, sliceH);
                        
                        const bodyBoxW = Math.min(contentW, sliceCanvas.width * scaleFactor);
                        pdf.rect(margin, margin + headerH, bodyBoxW, sliceH);
                    }
                }

                // Watermark (Draw AFTER content to be on top)
                if (wmDataUrl) {
                    pdf.addImage(wmDataUrl, 'PNG', 0, 0, pageW, pageH, undefined, 'FAST');
                }

                heightLeft -= sliceH;
                yOffset += sliceH;

                const pageNum = pdf.getNumberOfPages();
                pdf.setFontSize(10);
                pdf.setTextColor(100);
                pdf.text(`- ${pageNum} -`, pageW / 2, pageH - 10, { align: 'center' });

                if (heightLeft > 0) pdf.addPage();
            }

            window.open(pdf.output('bloburl'), '_blank');

        } catch (e) {
            console.error("Print Error", e);
            alert("Print generation failed. Please try again.");
            if(document.body.contains(clone)) document.body.removeChild(clone);
            if(document.body.contains(staging)) document.body.removeChild(staging);
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
            Delete: <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>,
            Number: <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
        };
        
        return (
            <div className="ctx-menu" style={{ ...style, fontSize: `${userSettings.uiFontPx || 13}px` }} onClick={e => e.stopPropagation()}>
                <div className="bg-slate-100 px-3 py-1 font-bold border-b text-slate-500">{type} Actions</div>
                {type === 'WBS' && (
                    <>
                        <div className="ctx-item" onClick={() => onAction('addAct')}>{Icons.Task} Add Activity</div>
                        <div className="ctx-item" onClick={() => onAction('addWBS')}>{Icons.WBS} Add Child WBS</div>
                        <div className="ctx-sep"></div>
                        <div className="ctx-item" onClick={() => onAction('renumber')}>{Icons.Number} Renumber Activities</div>
                        <div className="ctx-sep"></div>
                        <div className="ctx-item text-red-600" onClick={() => onAction('delWBS')}>{Icons.Delete} Delete WBS</div>
                    </>
                )}
                {type === 'Activity' && (
                    <>
                        <div className="ctx-item" onClick={() => onAction('addActSame')}>{Icons.Task} Add Activity</div>
                        <div className="ctx-item" onClick={() => onAction('assignRes')}>{Icons.User} Assign Resource</div>
                        <div className="ctx-sep"></div>
                        <div className="ctx-item" onClick={() => onAction('renumber')}>{Icons.Number} Renumber Activities</div>
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
             
             {/* Scaled down Landing Page (~80%) */}
             <div className="z-10 bg-white p-6 rounded-xl shadow-2xl flex flex-col items-center gap-5 max-w-sm w-full border border-slate-700">
                <div className="text-center flex flex-col items-center">
                    {adminConfig.appLogo ? (
                        <img src={adminConfig.appLogo} alt="Logo" className="h-16 mb-2 object-contain" />
                    ) : (
                        <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-700 tracking-tighter" 
                            style={{ 
                                textShadow: '2px 2px 0px #e2e8f0', 
                                fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                                transform: 'rotate(-2deg)'
                            }}>
                            {adminConfig.appName.split(' ')[0]}
                        </h1>
                    )}
                    <p className="text-slate-400 text-xs mt-2 font-semibold tracking-widest uppercase">{adminConfig.appName}</p>
                    <div className="mt-3 text-[10px] font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full inline-block">
                        {adminConfig.copyrightText}
                    </div>
                </div>

                <div className="flex flex-col gap-3 w-full">
                    <button onClick={createNew} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-bold shadow-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-2 text-base">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                        Create New Project
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="w-full bg-white hover:bg-slate-50 text-slate-700 py-2.5 rounded-lg font-bold border-2 border-slate-200 transition-colors flex items-center justify-center gap-2 text-base">
                         <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"/></svg>
                        Open Existing Project
                    </button>
                </div>

                <div className="pt-3 border-t w-full text-center text-[10px] text-slate-400">
                    <span>Version 1.0.0 &copy; {new Date().getFullYear()}</span>
                </div>
             </div>
             <input type="file" ref={fileInputRef} onChange={handleOpen} className="hidden" accept=".json" />
             <AdminModal isOpen={activeModal === 'admin'} onClose={() => setActiveModal(null)} onSave={setAdminConfig} />
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
                showRelations={showRelations}
                onToggleRelations={() => setShowRelations(!showRelations)}
                showCritical={showCritical}
                onToggleCritical={() => setShowCritical(!showCritical)}
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
                                onSelect={(ids, multi) => setSelIds(ids)} 
                                onCtx={setCtx} 
                                userSettings={userSettings}
                                zoomLevel={ganttZoom}
                                onZoomChange={setGanttZoom}
                                onDeleteItems={handleDeleteItems}
                                showRelations={showRelations}
                                showCritical={showCritical}
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
                            isVisible={showDetails}
                            onToggle={() => setShowDetails(!showDetails)}
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
                        selectedIds={selIds}
                        onSelect={(ids) => setSelIds(ids)}
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
            <AboutModal isOpen={activeModal === 'about'} onClose={() => setActiveModal(null)} customCopyright={adminConfig.copyrightText} />
            <HelpModal isOpen={activeModal === 'help'} onClose={() => setActiveModal(null)} />
            <UserSettingsModal isOpen={activeModal === 'user_settings'} settings={userSettings} onSave={setUserSettings} onClose={() => setActiveModal(null)} />
            <PrintSettingsModal isOpen={activeModal === 'print'} onClose={() => setActiveModal(null)} onPrint={executePrint} lang={userSettings.language} />
            <ColumnSetupModal isOpen={activeModal === 'columns'} onClose={() => setActiveModal(null)} visibleColumns={userSettings.visibleColumns} onSave={(cols) => setUserSettings({...userSettings, visibleColumns: cols})} lang={userSettings.language} />
            <ProjectSettingsModal isOpen={activeModal === 'project_settings'} onClose={() => setActiveModal(null)} projectData={data} onUpdateProject={handleProjectUpdate} />
            <BatchAssignModal isOpen={activeModal === 'batchRes'} onClose={() => setActiveModal(null)} resources={data.resources} onAssign={handleBatchAssign} lang={userSettings.language} />
            <AdminModal isOpen={activeModal === 'admin'} onClose={() => setActiveModal(null)} onSave={setAdminConfig} />
        </div>
    );
};

export default App;
