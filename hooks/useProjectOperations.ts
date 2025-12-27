import * as React from 'react';
const { useCallback } = React;
import { useAppStore } from '../stores/useAppStore';
import { usePermissions } from './usePermissions';
import { useTranslation } from '../utils/i18n';
import { authService } from '../services/authService';

interface UseProjectOperationsProps {
    fileInputRef?: React.RefObject<HTMLInputElement>;
}

export const useProjectOperations = ({ fileInputRef }: UseProjectOperationsProps = {}) => {
    const { 
        data, setData, user, setUser, view, setView, selIds, setSelIds, 
        clipboard, setClipboard, setActiveModal, setModalData, 
        setSettingsTab, userSettings, isDirty, setIsDirty, setIsLoginOpen,
        ctx, setCtx, modalData
    } = useAppStore();
    
    const { t } = useTranslation(userSettings.language);
    const { checkPermission } = usePermissions(user, userSettings.language, setModalData, setActiveModal);

    const handleUpdate = useCallback((id: string, field: string, val: any) => {
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
                    let m = s.trim().match(/^(.+?)(FS|SS|FF|SF)([+-]?\d+)?$/i);
                    if (m) {
                        return { activityId: m[1].trim(), type: (m[2].toUpperCase() as any), lag: parseInt(m[3] || '0') };
                    }
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
    }, [data, setData]);

    const handleAssignmentUpdate = useCallback((newAssignments: any[]) => {
        setData(prev => prev ? { ...prev, assignments: newAssignments } : null);
    }, [setData]);

    const handleResourceUpdate = useCallback((newResources: any[]) => {
        setData(prev => prev ? { ...prev, resources: newResources } : null);
    }, [setData]);

    const handleProjectUpdate = useCallback((meta: any, calendars: any) => {
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
    }, [setData]);

    const createNew = useCallback(() => {
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
    }, [setData, setIsDirty, setActiveModal]);

    const handleNew = useCallback(() => {
        if(data && isDirty) {
            setModalData({ msg: "Unsaved changes. Continue?", action: createNew });
            setActiveModal('confirm');
        } else {
            createNew();
        }
    }, [data, isDirty, createNew, setModalData, setActiveModal]);

    const handleSave = useCallback(() => {
        if (!data) return;
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `${data.meta.title.replace(/\s+/g, '_')}.json`;
        link.click();
        setIsDirty(false);
    }, [data, setIsDirty]);

    const handleLogout = useCallback(() => {
        authService.logout();
        setUser(null);
        setData(null);
        setIsLoginOpen(true);
    }, [setUser, setData, setIsLoginOpen]);

    const handleDeleteItems = useCallback((ids: string[]) => {
        setData(p => {
            if (!p) return null;
            if (view === 'resources') return { ...p, resources: p.resources.filter(r => !ids.includes(r.id)) };
            const wbsToDelete = p.wbs.filter(w => ids.includes(w.id));
            if (wbsToDelete.length > 0) return { ...p, wbs: p.wbs.filter(w => !ids.includes(w.id)) };
            else return { ...p, activities: p.activities.filter(a => !ids.includes(a.id)), assignments: p.assignments.filter(a => !ids.includes(a.activityId)) };
        });
        setSelIds([]);
    }, [view, setData, setSelIds]);

    const handleBatchAssign = useCallback((resourceIds: string[], units: number) => {
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
    }, [data, modalData, setData, setActiveModal]);

    const handleCtxAction = useCallback((act: string) => {
        if (!data || !ctx) return;
        const { id, selIds: contextSelIds } = ctx; 
        const targets = (contextSelIds && contextSelIds.length > 0) ? contextSelIds : [id];
        setCtx(null);

        if (act === 'renumber') {
            const renumberAction = () => {
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
            setModalData({ msg: t('RenumberAllActivities'), action: renumberAction });
            setActiveModal('confirm');
        }
        if (act === 'addAct' || act === 'addActSame') {
            const role = user?.plannerRole || 'trial';
            const limitMap: Record<string, number> = { 'trial': 20, 'licensed': 100, 'premium': 500, 'admin': 9999 };
            const limit = limitMap[role] || 20;
            
            if (data.activities.length >= limit) {
                setModalData({ msg: `Activity limit reached for ${role} user. Limit: ${limit}`, title: "Limit Reached" });
                setActiveModal('alert');
                return;
            }

            const wbsId = act === 'addActSame' ? data.activities.find(a => a.id === id)?.wbsId : id;
            if (!wbsId) return;
            const max = data.activities.reduce((m, a) => { const match = a.id.match(/(\d+)/); return match ? Math.max(m, parseInt(match[1])) : m; }, 1000);
            const newId = (data.meta.activityIdPrefix || 'A') + (max + (data.meta.activityIdIncrement || 10));
            setData(p => p ? { ...p, activities: [...p.activities, { id: newId, name: t('NewTask'), wbsId, duration: 5, predecessors: [], budgetedCost: 0, calendarId: p.meta.defaultCalendarId, activityType: 'Task', startDate: new Date(), endDate: new Date(), earlyStart: new Date(), earlyFinish: new Date(), lateStart: new Date(), lateFinish: new Date(), totalFloat: 0 }] } : null);
        }
        if (act === 'addWBS') {
            const newId = id + '.' + (data.wbs.filter(w => w.parentId === id).length + 1);
            setData(p => p ? { ...p, wbs: [...p.wbs, { id: newId, name: t('NewWBS'), parentId: id }] } : null);
        }
        if (act === 'delAct') handleDeleteItems(targets);
        if (act === 'delWBS') {
            setModalData({ msg: t('DeleteWBSPrompt'), action: () => setData(p => p ? { ...p, wbs: p.wbs.filter(w => w.id !== id) } : null) });
            setActiveModal('confirm');
        }
        if (act === 'assignRes') {
            setModalData({ ids: targets });
            setActiveModal('batchRes');
        }
    }, [data, ctx, user, t, setData, setCtx, setModalData, setActiveModal, handleDeleteItems]);

    const handleMenuAction = useCallback((action: string) => {
        if (!checkPermission(action)) return;

        switch (action) {
            case 'import': fileInputRef?.current?.click(); break;
            case 'export': handleSave(); break;
            case 'print': setActiveModal('print'); break;
            case 'new_project': handleNew(); break;
            case 'open_project': fileInputRef?.current?.click(); break;
            case 'cloud_save': setActiveModal('cloud_save'); break;
            case 'cloud_projects': setActiveModal('cloud_load'); break;
            case 'logout': handleLogout(); break;
            case 'copy':
                if (selIds.length > 0 && data) {
                    if (view === 'resources') setClipboard({ ids: selIds, type: 'Resources' });
                    else if (data.wbs.some(w => selIds.includes(w.id))) setClipboard({ ids: selIds, type: 'WBS' });
                    else setClipboard({ ids: selIds, type: 'Activities' });
                }
                break;
            case 'cut':
                if (selIds.length) {
                    if (data) {
                        if (view === 'resources') setClipboard({ ids: selIds, type: 'Resources' });
                        else if (data.wbs.some(w => selIds.includes(w.id))) setClipboard({ ids: selIds, type: 'WBS' });
                        else setClipboard({ ids: selIds, type: 'Activities' });
                        handleDeleteItems(selIds);
                    }
                }
                break;
            case 'paste':
                if (clipboard && data) {
                    if (clipboard.type === 'Activities') {
                        const role = user?.plannerRole || 'trial';
                        const limitMap: Record<string, number> = { 'trial': 20, 'licensed': 100, 'premium': 500, 'admin': 9999 };
                        const limit = limitMap[role] || 20;

                        if (data.activities.length + clipboard.ids.length > limit) {
                            setModalData({ msg: `Activity limit exceeded for ${role} user. Limit: ${limit}, Paste Size: ${clipboard.ids.length}`, title: "Limit Reached" });
                            setActiveModal('alert');
                            return;
                        }
                    }

                    if (clipboard.type === 'Activities') {
                        const newActs = clipboard.ids.map(id => data.activities.find(a => a.id === id)).filter(x => x).map(a => ({ ...a!, id: a!.id + t('CopySuffix'), name: a!.name + t('CopySuffix') }));
                        setData(p => p ? { ...p, activities: [...p.activities, ...newActs] } : null);
                    }
                }
                break;
            case 'delete':
                if (selIds.length > 0) {
                    setModalData({ msg: "Delete selected items?", action: () => handleDeleteItems(selIds) });
                    setActiveModal('confirm');
                }
                break;
            case 'account_settings': setActiveModal('account_settings'); break;
            case 'user_preferences': setActiveModal('user_preferences'); break;
            case 'columns_setup': setActiveModal('columns_setup'); break;
            case 'project_info': setActiveModal('project_settings'); break;
            case 'view_activities': setView('activities'); break;
            case 'view_resources': setView('resources'); break;
            case 'settings': setSettingsTab('preferences'); setActiveModal('user_settings'); break;
            case 'settings_profile': setSettingsTab('profile'); setActiveModal('user_settings'); break;
            case 'settings_security': setSettingsTab('security'); setActiveModal('user_settings'); break;
            case 'settings_subscription': setSettingsTab('subscription'); setActiveModal('user_settings'); break;
            case 'settings_usage': setSettingsTab('usage'); setActiveModal('user_settings'); break;
            case 'help': setActiveModal('help'); break;
            case 'about': setActiveModal('about'); break;
            case 'admin': setActiveModal('admin'); break;
            case 'ai_settings': setActiveModal('ai_settings'); break;
            case 'cloud_load': setActiveModal('cloud_load'); break;
            case 'cloud_save': setActiveModal('cloud_save'); break;
            case 'license': setModalData({ msg: "License: Standard Edition\nExpires: 2025-12-31" }); setActiveModal('alert'); break;
            case 'usage': setModalData({ msg: "Usage: 5/10 Projects Used\nStorage: 120MB / 1GB" }); setActiveModal('alert'); break;
        }
    }, [checkPermission, data, selIds, clipboard, fileInputRef, handleSave, handleNew, handleLogout, setActiveModal, setClipboard, handleDeleteItems, setModalData, user, t, view, setData, setView, setSettingsTab]);

    return { 
        handleMenuAction, 
        handleDeleteItems, 
        handleUpdate,
        handleAssignmentUpdate,
        handleResourceUpdate,
        handleProjectUpdate,
        handleSave,
        handleNew,
        handleLogout,
        createNew,
        handleCtxAction,
        handleBatchAssign
    };
};
