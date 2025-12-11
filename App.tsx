
import React, { useState, useEffect, useRef } from 'react';
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

    // Global Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check if user is typing in an input
            const tag = (e.target as HTMLElement).tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

            // Copy (Ctrl+C)
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                handleMenuAction('copy');
            }
            // Cut (Ctrl+X)
            if ((e.ctrlKey || e.metaKey) && e.key === 'x') {
                e.preventDefault();
                handleMenuAction('cut');
            }
            // Paste (Ctrl+V)
            if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault();
                handleMenuAction('paste');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selIds, data, view, clipboard]);

    // Load Admin Config on Mount
    useEffect(() => {
        const saved = localStorage.getItem('planner_admin_config');
        if(saved) {
            try { setAdminConfig(JSON.parse(saved)); } catch(e) {}
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
             // Check if deleting resources (from Resources view)
             if(view === 'resources') {
                 return { ...p, resources: p.resources.filter(r => !ids.includes(r.id)) };
             }
             // Activities/WBS
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

    const handleRenumberActivities = () => {
        if (!data) return;
        const prefix = data.meta.activityIdPrefix || 'A';
        const increment = data.meta.activityIdIncrement || 10;
        
        let counter = 0;
        const newActivities = data.activities.map((act) => {
             counter += increment;
             return { ...act, newId: `${prefix}${counter}` };
        });
        
        const idMap: Record<string, string> = {};
        newActivities.forEach(a => idMap[a.id] = a.newId);
        
        const finalActivities = newActivities.map(act => ({
            ...act,
            id: act.newId,
            predecessors: act.predecessors.map(p => ({
                ...p,
                activityId: idMap[p.activityId] || p.activityId
            }))
        }));
        
        const cleanActivities = finalActivities.map(({newId, ...rest}) => rest);
        
        const newAssignments = data.assignments.map(asg => ({
             ...asg,
             activityId: idMap[asg.activityId] || asg.activityId
        }));

        setData({ ...data, activities: cleanActivities, assignments: newAssignments });
        setCtx(null);
    };

    const handleCtxAction = (act: string) => {
        const { id, selIds: contextSelIds } = ctx; 
        const targets = (contextSelIds && contextSelIds.length > 0) ? contextSelIds : [id];
        setCtx(null);

        if (!data) return;

        if (act === 'renumber') {
            setModalData({ 
                msg: `Renumber all activities starting with "${data.meta.activityIdPrefix}${data.meta.activityIdIncrement}"? This cannot be undone.`, 
                action: handleRenumberActivities 
            });
            setActiveModal('confirm');
        }

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
        await new Promise(r => setTimeout(r, 200));

        const original = document.querySelector('.combined-view-container');
        if (!original) return;
        
        const firstRow = original.querySelector('.p6-row') as HTMLElement;
        const computedRowHeight = firstRow ? firstRow.offsetHeight : 0;
        
        const clone = original.cloneNode(true) as HTMLElement;
        clone.style.height = 'auto';
        clone.style.width = 'fit-content'; 
        clone.style.minWidth = '0px'; 
        clone.style.position = 'absolute';
        clone.style.top = '-10000px';
        clone.style.left = '-10000px';
        clone.style.overflow = 'visible';
        clone.style.background = 'white';
        clone.style.border = '1px solid #cbd5e1'; 
        clone.style.padding = '15px'; 
        clone.style.boxSizing = 'border-box';

        // 1. STRICT COLUMN HIDING based on VISIBLE COLUMNS
        const allowedCols = userSettings.visibleColumns;
        const cells = clone.querySelectorAll('[data-col]');
        
        cells.forEach((cell: any) => {
            const colId = cell.getAttribute('data-col');
            if (colId && !allowedCols.includes(colId)) {
                cell.style.display = 'none';
                cell.style.width = '0px';
                cell.style.minWidth = '0px';
                cell.style.padding = '0px';
                cell.style.border = 'none';
                cell.innerHTML = '';
            }
        });

        // Calculate visible table width strictly
        let tableWidth = 0;
        const headerCells = clone.querySelectorAll('.p6-header > div');
        headerCells.forEach((cell: any) => {
            const colId = cell.getAttribute('data-col');
            if(colId && allowedCols.includes(colId)) {
                const w = parseFloat(cell.style.width || '0');
                if(w > 0) tableWidth += w;
            } else {
                 cell.style.display = 'none';
            }
        });
        
        const tableContainer = clone.children[1]?.children[0] as HTMLElement; 
        if(tableContainer) {
            tableContainer.style.width = `${tableWidth}px`;
            tableContainer.style.minWidth = `${tableWidth}px`;
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
                // Important for centering watermark relative to this container
                ganttContainer.style.position = 'relative'; 
            }
        }

        // --- INJECT WATERMARK ---
        if (adminConfig.enableWatermark) {
            try {
                let wmText = adminConfig.watermarkText; 
                if (!wmText) {
                    const wmRes = await fetch('watermark.md');
                    if (wmRes.ok) wmText = await wmRes.text();
                    else wmText = adminConfig.appName;
                }
                
                const wmDiv = document.createElement('div');
                wmDiv.style.position = 'absolute';
                // CENTER POSITIONING
                wmDiv.style.top = '50%';
                wmDiv.style.left = '50%';
                wmDiv.style.transform = 'translate(-50%, -50%)';
                
                wmDiv.style.color = '#e2e8f0'; 
                wmDiv.style.fontSize = `${adminConfig.watermarkFontSize || 40}px`;
                wmDiv.style.fontWeight = 'bold';
                wmDiv.style.zIndex = '9999';
                wmDiv.style.pointerEvents = 'none';
                wmDiv.style.whiteSpace = 'nowrap';
                wmDiv.innerText = wmText || '';
                
                // Inject into the GANTT BODY container (second child of main flex)
                // clone -> children[1] (Main Flex) -> children[1] (Gantt Wrapper) -> children[1] (Gantt Body)
                const ganttBody = clone.querySelector('div[class*="custom-scrollbar"][style*="overflow: visible"]');
                if (ganttBody) {
                     ganttBody.appendChild(wmDiv);
                } else {
                     // Fallback
                     clone.style.position = 'relative';
                     clone.appendChild(wmDiv);
                }

            } catch(e) {}
        }

        clone.style.width = `${tableWidth + ganttWidth + 50}px`;

        const scrollers = clone.querySelectorAll('.custom-scrollbar');
        scrollers.forEach((e: any) => { 
            e.style.overflow = 'visible'; 
            e.style.height = 'auto'; 
            e.style.maxHeight = 'none'; 
            e.style.width = 'auto'; 
        });

        // --- 3. FORCE ROW HEIGHT & TEXT ALIGNMENT ---
        if (computedRowHeight > 0) {
            const cloneRows = clone.querySelectorAll('.p6-row');
            const originalRows = original.querySelectorAll('.p6-row');
            
            cloneRows.forEach((row: any, i: number) => {
                 const origRow = originalRows[i] as HTMLElement;
                 const h = origRow ? origRow.offsetHeight : computedRowHeight;

                 row.style.height = `${h}px`;
                 row.style.minHeight = `${h}px`;
                 row.style.maxHeight = `${h}px`;
                 row.style.flexShrink = '0';
                 row.style.overflow = 'hidden';
                 
                 const cells = row.querySelectorAll('.p6-cell');
                 cells.forEach((c: any) => {
                     if (c.style.display !== 'none') {
                        // FIX: Ensure centering works for print
                        c.style.display = 'flex';
                        c.style.alignItems = 'center';
                        c.style.lineHeight = 'normal';
                        
                        // FIX: Fix text clipping/ellipsis in print by allowing overflow
                        const spans = c.querySelectorAll('span');
                        spans.forEach((s: any) => {
                            s.style.textOverflow = 'clip';
                            s.style.overflow = 'visible';
                        });
                     }
                 });
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
                    if (view === 'resources' && data) {
                        setClipboard({ ids: selIds, type: 'Resources' });
                    } else if (data) {
                         if (data.wbs.some(w => selIds.includes(w.id))) {
                             setClipboard({ ids: selIds, type: 'WBS' });
                         } else {
                             setClipboard({ ids: selIds, type: 'Activities' });
                         }
                    }
                 }
                 break;
            case 'cut':
                 if(selIds.length) {
                     handleMenuAction('copy'); // Copy first
                     handleDeleteItems(selIds);
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
                        const targetWbsId = selIds.length > 0 ? 
                            (data.activities.find(a => a.id === selIds[0])?.wbsId || data.wbs.find(w=>w.id === selIds[0])?.id) :
                            (data.wbs.length > 0 ? data.wbs[0].id : null);
                            
                        if (targetWbsId) {
                            // NEW LOGIC: Use Prefix + Increment for new IDs
                            const prefix = data.meta.activityIdPrefix || 'A';
                            const increment = data.meta.activityIdIncrement || 10;
                            
                            // Find current max numeric part of ID
                            let maxVal = 0;
                            data.activities.forEach(a => {
                                const match = a.id.match(/(\d+)$/);
                                if (match) {
                                    const val = parseInt(match[1]);
                                    if (val > maxVal) maxVal = val;
                                }
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
            case 'columns': setActiveModal('columns'); break;
            case 'project_info': setActiveModal('project_settings'); break;
            case 'view_activities': setView('activities'); break;
            case 'view_resources': setView('resources'); break;
            case 'settings': setActiveModal('user_settings'); break;
            case 'help': setActiveModal('help'); break;
            case 'about': setActiveModal('about'); break;
            case 'admin': setActiveModal('admin'); break;
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
             
             <div className="z-10 bg-white p-8 rounded-xl shadow-2xl flex flex-col items-center gap-6 max-w-md w-full border border-slate-700">
                <div className="text-center">
                    <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-900 to-slate-700 tracking-tighter" 
                        style={{ 
                            textShadow: '2px 2px 0px #e2e8f0', 
                            fontFamily: '"Segoe UI", Roboto, "Helvetica Neue", sans-serif',
                            transform: 'rotate(-2deg)'
                        }}>
                        {adminConfig.appName.split(' ')[0]}
                    </h1>
                    <p className="text-slate-400 text-sm mt-3 font-semibold tracking-widest uppercase">{adminConfig.appName}</p>
                    <div className="mt-4 text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full inline-block">
                        {adminConfig.copyrightText}
                    </div>
                </div>

                <div className="flex flex-col gap-3 w-full">
                    <button onClick={createNew} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold shadow-lg transition-all hover:scale-[1.02] flex items-center justify-center gap-3 text-lg">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>
                        Create New Project
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="w-full bg-white hover:bg-slate-50 text-slate-700 py-3 rounded-lg font-bold border-2 border-slate-200 transition-colors flex items-center justify-center gap-3 text-lg">
                         <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"/></svg>
                        Open Existing Project
                    </button>
                </div>

                <div className="pt-4 border-t w-full text-center text-xs text-slate-400">
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
            
            <ColumnSetupModal 
                isOpen={activeModal === 'columns'}
                onClose={() => setActiveModal(null)}
                visibleColumns={userSettings.visibleColumns}
                onSave={(cols) => setUserSettings({...userSettings, visibleColumns: cols})}
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
            
            <AdminModal isOpen={activeModal === 'admin'} onClose={() => setActiveModal(null)} onSave={setAdminConfig} />
        </div>
    );
};

export default App;
