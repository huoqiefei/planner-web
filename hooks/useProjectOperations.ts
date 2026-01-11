import * as React from 'react';
const { useCallback } = React;
import { useAppStore } from '../stores/useAppStore';
import { usePermissions } from './usePermissions';
import { useTranslation } from '../utils/i18n';
import { authService } from '../services/authService';
import { getSubscriptionLimits } from '../utils/subscriptionLimits';


export interface UseProjectOperationsProps {
    fileInputRef?: React.RefObject<HTMLInputElement>;
}

export const useProjectOperations = ({ fileInputRef }: UseProjectOperationsProps = { fileInputRef: undefined }) => {
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
                const oldId = id;
                const newId = val;

                // Build map of oldId -> newId for recursion
                const idMap = new Map<string, string>();
                idMap.set(oldId, newId);

                const findDescendants = (pId: string, newPId: string) => {
                    const children = data.wbs.filter(w => w.parentId === pId);
                    children.forEach(c => {
                        let childNewId = c.id;
                        // Auto-update child ID if it follows the specific pattern parentId + '.'
                        if (c.id.startsWith(pId + '.')) {
                            childNewId = newPId + c.id.substring(pId.length);
                        }
                        idMap.set(c.id, childNewId);
                        findDescendants(c.id, childNewId);
                    });
                };
                findDescendants(oldId, newId);

                setData(p => p ? {
                    ...p,
                    wbs: p.wbs.map(w => {
                        const nId = idMap.has(w.id) ? idMap.get(w.id)! : w.id;
                        const pId = (w.parentId && idMap.has(w.parentId)) ? idMap.get(w.parentId)! : w.parentId;
                        return { ...w, id: nId, parentId: pId };
                    }),
                    activities: p.activities.map(a => idMap.has(a.wbsId) ? { ...a, wbsId: idMap.get(a.wbsId)! } : a)
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
            if (!prev) return null;
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
        const defCal = { id: 'cal-1', name: 'Standard 5-Day', isDefault: true, weekDays: [false, true, true, true, true, true, false], hoursPerDay: 8, exceptions: [] };
        setData({
            wbs: [{ id: pCode, name: pName, parentId: null }], activities: [], resources: [], assignments: [], calendars: [defCal],
            meta: {
                title: pName, projectCode: pCode, defaultCalendarId: defCal.id, projectStartDate: new Date().toISOString().split('T')[0],
                activityIdPrefix: 'A', activityIdIncrement: 10, resourceIdPrefix: 'R', resourceIdIncrement: 10
            }
        });
        setIsDirty(false); setActiveModal(null);
    }, [setData, setIsDirty, setActiveModal]);

    const handleNew = useCallback(() => {
        if (data && isDirty) {
            setModalData({ msg: "Unsaved changes. Continue?", action: createNew });
            setActiveModal('confirm');
        } else {
            createNew();
        }
    }, [data, isDirty, createNew, setModalData, setActiveModal]);

    const handleSave = useCallback(() => {
        if (!data) return;
        // Ask user if they want to include settings
        setModalData({
            msg: t('ExportWithSettings'),
            action: () => {
                // Export with settings
                const exportData = {
                    projectData: data,
                    userSettings: userSettings,
                    exportVersion: '1.0',
                    exportDate: new Date().toISOString()
                };
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `${data.meta.title.replace(/\s+/g, '_')}_with_settings.json`;
                link.click();
                setIsDirty(false);
                setActiveModal(null);
            },
            cancelAction: () => {
                // Export without settings (original behavior)
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `${data.meta.title.replace(/\s+/g, '_')}.json`;
                link.click();
                setIsDirty(false);
                setActiveModal(null);
            }
        });
        setActiveModal('export_options');
    }, [data, userSettings, t, setIsDirty, setModalData, setActiveModal]);

    const handleLogout = useCallback(() => {
        authService.logout();
        setUser(null);
        setData(null);
        setIsLoginOpen(true);
    }, [setUser, setData, setIsLoginOpen]);

    const handleDeleteItems = useCallback((ids: string[]) => {
        setData(p => {
            if (!p) return null;
            if (view === 'resources') {
                return {
                    ...p,
                    resources: p.resources.filter(r => !ids.includes(r.id)),
                    assignments: p.assignments.filter(a => !ids.includes(a.resourceId))
                };
            }
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
            if (!act) return;
            resourceIds.forEach(rid => {
                const res = data.resources.find(r => r.id === rid);
                let total = units;
                if (res?.type !== 'Material' && act.duration > 0) total = units * act.duration;
                newAssignments.push({ activityId: aid, resourceId: rid, units: total });
            });
        });
        setData(p => p ? { ...p, assignments: newAssignments } : null);
        setActiveModal(null);
    }, [data, modalData, setData, setActiveModal]);

    const addResource = useCallback(() => {
        if (!data) return;

        const role = user?.plannerRole || 'trial';
        const limitMap: Record<string, number> = {
            'trial': Number(import.meta.env.VITE_LIMIT_RES_TRIAL) || 10,
            'licensed': Number(import.meta.env.VITE_LIMIT_RES_LICENSED) || 50,
            'premium': Number(import.meta.env.VITE_LIMIT_RES_PREMIUM) || 200,
            'admin': Number(import.meta.env.VITE_LIMIT_RES_ADMIN) || 9999
        };
        const limit = limitMap[role] || 10;

        if (data.resources.length >= limit) {
            setModalData({ msg: `Resource limit reached for ${role} user. Limit: ${limit}`, title: "Limit Reached" });
            setActiveModal('alert');
            return;
        }
        const max = data.resources.reduce((m, r) => {
            const match = r.id.match(/(\d+)/);
            return match ? Math.max(m, parseInt(match[1])) : m;
        }, 1000);
        const newId = (data.meta.resourceIdPrefix || 'R') + (max + (data.meta.resourceIdIncrement || 10));
        const newRes = { id: newId, name: t('NewResource'), type: 'Labor' as const, unit: 'h', maxUnits: 8, unitPrice: 0 };
        setData(p => p ? { ...p, resources: [...p.resources, newRes] } : null);
        setSelIds([newId]);
    }, [data, t, setData, setSelIds]);

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
                const cleanActivities = finalActivities.map(({ newId, ...rest }) => rest);
                const newAssignments = data.assignments.map(asg => ({ ...asg, activityId: idMap[asg.activityId] || asg.activityId }));
                setData({ ...data, activities: cleanActivities, assignments: newAssignments });
                setCtx(null);
            };
            setModalData({ msg: t('RenumberAllActivities'), action: renumberAction });
            setActiveModal('confirm');
        }
        if (act === 'renumberRes') {
            const renumberAction = () => {
                if (!data) return;
                const prefix = data.meta.resourceIdPrefix || 'R';
                const increment = data.meta.resourceIdIncrement || 10;
                let counter = 0;
                const newResources = data.resources.map((res) => { counter += increment; return { ...res, newId: `${prefix}${counter}` }; });
                const idMap: Record<string, string> = {};
                newResources.forEach(r => idMap[r.id] = r.newId);
                const finalResources = newResources.map(({ newId, ...rest }) => ({ ...rest, id: newId }));
                const newAssignments = data.assignments.map(asg => ({ ...asg, resourceId: idMap[asg.resourceId] || asg.resourceId }));
                setData({ ...data, resources: finalResources as any[], assignments: newAssignments });
                setCtx(null);
            };
            setModalData({ msg: t('RenumberAllResources' as any) || "Renumber all resources?", action: renumberAction });
            setActiveModal('confirm');
        }
        if (act === 'addRes') {
            addResource();
        }
        if (act === 'addAct' || act === 'addActSame') {
            const role = user?.plannerRole || 'trial';
            const limitMap: Record<string, number> = {
                'trial': Number(import.meta.env.VITE_LIMIT_TRIAL) || 20,
                'licensed': Number(import.meta.env.VITE_LIMIT_LICENSED) || 100,
                'premium': Number(import.meta.env.VITE_LIMIT_PREMIUM) || 500,
                'admin': Number(import.meta.env.VITE_LIMIT_ADMIN) || 9999
            };
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
        if (act === 'delRes') {
            setModalData({ msg: t('DeleteResourcePrompt' as any) || "Delete selected resources?", action: () => handleDeleteItems(targets) });
            setActiveModal('confirm');
        }
        if (act === 'delWBS') {
            setModalData({ msg: t('DeleteWBSPrompt'), action: () => setData(p => p ? { ...p, wbs: p.wbs.filter(w => w.id !== id) } : null) });
            setActiveModal('confirm');
        }
        if (act === 'assignRes') {
            setModalData({ ids: targets });
            setActiveModal('batchRes');
        }
        if (act === 'delAssignment') {
            setModalData({
                msg: t('DeleteAssignmentPrompt' as any) || "Delete all assignments for selected activities?",
                action: () => {
                    setData(p => {
                        if (!p) return null;
                        return {
                            ...p,
                            assignments: p.assignments.filter(a => !targets.includes(a.activityId))
                        };
                    });
                    setSelIds([]);
                }
            });
            setActiveModal('confirm');
        }
    }, [data, ctx, user, t, setData, setCtx, setModalData, setActiveModal, handleDeleteItems, addResource, setSelIds]);

    const handleMenuAction = useCallback((action: string) => {
        if (!checkPermission(action)) return;

        switch (action) {
            case 'import': fileInputRef?.current?.click(); break;
            case 'export': handleSave(); break;
            case 'print': setActiveModal('print'); break;
            case 'new_project': handleNew(); break;
            case 'open_project': fileInputRef?.current?.click(); break;
            case 'logout': handleLogout(); break;
            case 'filter': setActiveModal('filter'); break; // Add filter action
            case 'copy':
                if (selIds.length > 0 && data) {
                    if (view === 'resources') {
                        const items = selIds.map(id => data.resources.find(r => r.id === id)).filter(x => x);
                        setClipboard({ type: 'Resources', data: items });
                    } else if (data.wbs.some(w => selIds.includes(w.id))) {
                        const wbsToCopy: any[] = [];
                        const actsToCopy: any[] = [];
                        const processNode = (wbsId: string) => {
                            const node = data.wbs.find(w => w.id === wbsId);
                            if (node && !wbsToCopy.some(w => w.id === wbsId)) {
                                wbsToCopy.push(node);
                                const acts = data.activities.filter(a => a.wbsId === wbsId);
                                actsToCopy.push(...acts);
                                const children = data.wbs.filter(w => w.parentId === wbsId);
                                children.forEach(c => processNode(c.id));
                            }
                        };
                        selIds.forEach(id => processNode(id));
                        setClipboard({ type: 'WBS', data: { wbs: wbsToCopy, activities: actsToCopy } });
                    } else {
                        const items = selIds.map(id => data.activities.find(a => a.id === id)).filter(x => x);
                        setClipboard({ type: 'Activities', data: items });
                    }
                }
                break;
            case 'cut':
                if (selIds.length > 0 && data) {
                    if (view === 'resources') {
                        const items = selIds.map(id => data.resources.find(r => r.id === id)).filter(x => x);
                        setClipboard({ type: 'Resources', data: items });
                    } else if (data.wbs.some(w => selIds.includes(w.id))) {
                        const wbsToCopy: any[] = [];
                        const actsToCopy: any[] = [];
                        const processNode = (wbsId: string) => {
                            const node = data.wbs.find(w => w.id === wbsId);
                            if (node && !wbsToCopy.some(w => w.id === wbsId)) {
                                wbsToCopy.push(node);
                                const acts = data.activities.filter(a => a.wbsId === wbsId);
                                actsToCopy.push(...acts);
                                const children = data.wbs.filter(w => w.parentId === wbsId);
                                children.forEach(c => processNode(c.id));
                            }
                        };
                        selIds.forEach(id => processNode(id));
                        setClipboard({ type: 'WBS', data: { wbs: wbsToCopy, activities: actsToCopy } });
                    } else {
                        const items = selIds.map(id => data.activities.find(a => a.id === id)).filter(x => x);
                        setClipboard({ type: 'Activities', data: items });
                    }
                    handleDeleteItems(selIds);
                }
                break;
            case 'paste':
                if (clipboard && data) {
                    const role = user?.plannerRole || 'trial';
                    const limits = getSubscriptionLimits(role);

                    // Determine Insert Context
                    let targetWbsId: string | undefined;
                    let targetActivityIndex = -1;
                    let targetWbsParentId: string | undefined;
                    let targetWbsIndex = -1;

                    if (selIds.length > 0) {
                        const targetId = selIds[selIds.length - 1];
                        const targetAct = data.activities.find(a => a.id === targetId);
                        if (targetAct) {
                            targetWbsId = targetAct.wbsId;
                            targetActivityIndex = data.activities.indexOf(targetAct);
                            const parentWbs = data.wbs.find(w => w.id === targetAct.wbsId);
                            targetWbsParentId = parentWbs ? parentWbs.parentId : 'root';
                            targetWbsIndex = data.wbs.indexOf(parentWbs!) + 1;
                        } else {
                            const targetWbs = data.wbs.find(w => w.id === targetId);
                            if (targetWbs) {
                                targetWbsId = targetWbs.id;
                                const wbsActs = data.activities.map((a, i) => ({ a, i })).filter(x => x.a.wbsId === targetWbs.id);
                                targetActivityIndex = wbsActs.length > 0 ? wbsActs[wbsActs.length - 1].i : data.activities.length - 1;
                                targetWbsParentId = targetWbs.id;
                                const wbsChildren = data.wbs.map((w, i) => ({ w, i })).filter(x => x.w.parentId === targetWbs.id);
                                targetWbsIndex = wbsChildren.length > 0 ? wbsChildren[wbsChildren.length - 1].i + 1 : data.wbs.length;
                            }
                        }
                    }

                    if (clipboard.type === 'Activities') {
                        const limit = limits.activities;
                        const actsData = clipboard.data as any[];

                        if (data.activities.length + actsData.length > limit) {
                            setModalData({ msg: `Activity limit exceeded for ${role} user. Limit: ${limit}, Paste Size: ${actsData.length}`, title: t('LimitReached') });
                            setActiveModal('alert');
                            return;
                        }

                        const prefix = data.meta.activityIdPrefix || 'A';
                        const increment = data.meta.activityIdIncrement || 10;
                        const maxIdNum = data.activities.reduce((max, act) => {
                            const match = act.id.match(new RegExp(`^${prefix}(\\d+)`));
                            return match ? Math.max(max, parseInt(match[1])) : max;
                        }, 0);

                        let currentIdNum = maxIdNum;

                        const newActs = actsData
                            .map(a => {
                                currentIdNum += increment;
                                const newId = `${prefix}${currentIdNum}`;
                                return {
                                    ...a!,
                                    id: newId,
                                    name: a!.name + (t('CopySuffix') || ' (Copy)'),
                                    wbsId: targetWbsId || a!.wbsId
                                };
                            });

                        const newActivitiesList = [...data.activities];
                        const insertPos = targetActivityIndex !== -1 ? targetActivityIndex + 1 : newActivitiesList.length;
                        newActivitiesList.splice(insertPos, 0, ...newActs);
                        setData(p => p ? { ...p, activities: newActivitiesList } : null);

                    } else if (clipboard.type === 'Resources') {
                        const limit = limits.resources;
                        const resData = clipboard.data as any[];

                        if (data.resources.length + resData.length > limit) {
                            setModalData({ msg: `Resource limit exceeded for ${role} user. Limit: ${limit}, Paste Size: ${resData.length}`, title: t('LimitReached') });
                            setActiveModal('alert');
                            return;
                        }

                        const newRes = resData
                            .map(r => {
                                // Generate a unique ID
                                const baseId = r!.id;
                                let newId = baseId + (t('CopySuffix') || ' (Copy)');
                                let counter = 1;
                                while (data.resources.some(existing => existing.id === newId)) {
                                    newId = `${baseId}_Copy_${counter++}`;
                                }
                                return {
                                    ...r!,
                                    id: newId,
                                    name: r!.name + (t('CopySuffix') || ' (Copy)')
                                };
                            });
                        setData(p => p ? { ...p, resources: [...p.resources, ...newRes] } : null);
                    } else if (clipboard.type === 'WBS') {
                        const { wbs: wbsToCopy, activities: actsToCopy } = clipboard.data as { wbs: any[], activities: any[] };

                        // Check limits
                        if (data.activities.length + actsToCopy.length > limits.activities) {
                            setModalData({ msg: `Activity limit exceeded.`, title: t('LimitReached') });
                            setActiveModal('alert');
                            return;
                        }



                        // Generate New IDs
                        const idMap = new Map<string, string>();
                        // WBS IDs
                        wbsToCopy.forEach(w => {
                            const newId = crypto.randomUUID();
                            idMap.set(w.id, newId);
                        });

                        // Activity IDs (need prefix logic)
                        const prefix = data.meta.activityIdPrefix || 'A';
                        const increment = data.meta.activityIdIncrement || 10;
                        const maxIdNum = data.activities.reduce((max, act) => {
                            const match = act.id.match(new RegExp(`^${prefix}(\\d+)`));
                            return match ? Math.max(max, parseInt(match[1])) : max;
                        }, 0);
                        let currentIdNum = maxIdNum;

                        const finalActs = actsToCopy.map(a => {
                            currentIdNum += increment;
                            const newId = `${prefix}${currentIdNum}`;
                            return { ...a, id: newId, wbsId: idMap.get(a.wbsId) || a.wbsId, name: a.name + (t('CopySuffix') || ' (Copy)') };
                        });

                        const finalWBS = wbsToCopy.map(w => {
                            let pId = w.parentId;
                            if (idMap.has(w.parentId || '')) {
                                pId = idMap.get(w.parentId!);
                            } else {
                                pId = targetWbsParentId !== undefined ? targetWbsParentId : w.parentId;
                            }
                            return { ...w, id: idMap.get(w.id), parentId: pId, name: w.name + (t('CopySuffix') || ' (Copy)') };
                        });

                        const newWbsList = [...data.wbs];
                        const wbsInsertPos = targetWbsIndex !== -1 ? targetWbsIndex : newWbsList.length;
                        newWbsList.splice(wbsInsertPos, 0, ...finalWBS);

                        setData(p => p ? {
                            ...p,
                            wbs: newWbsList,
                            activities: [...p.activities, ...finalActs]
                        } : null);
                    }
                }
                break;
            case 'delete':
                if (selIds.length > 0) {
                    setModalData({ msg: "Delete selected items?", action: () => handleDeleteItems(selIds) });
                    setActiveModal('confirm');
                }
                break;
            case 'undo': (useAppStore as any).temporal.getState().undo(); break;
            case 'redo': (useAppStore as any).temporal.getState().redo(); break;
            case 'account_settings': setActiveModal('account_settings'); break;
            case 'user_preferences': setActiveModal('user_preferences'); break;
            case 'columns': setActiveModal('columns'); break;
            case 'project_general':
                setModalData({ initialTab: 'general' });
                setActiveModal('project_settings');
                break;
            case 'project_calendars':
                setModalData({ initialTab: 'calendars' });
                setActiveModal('project_settings');
                break;
            case 'project_custom_fields':
                setModalData({ initialTab: 'custom_fields' });
                setActiveModal('project_settings');
                break;
            case 'project_defaults':
                setModalData({ initialTab: 'defaults' });
                setActiveModal('project_settings');
                break;
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
            case 'cloud_projects':
            case 'cloud_save':
                if (import.meta.env.VITE_ENABLE_CLOUD_FEATURES !== 'true') {
                    return; // Cloud features disabled
                }
                setActiveModal(action === 'cloud_projects' ? 'cloud_load' : 'cloud_save');
                break;
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
        addResource,
        handleCtxAction,
        handleBatchAssign
    };
};
