import React, { useState } from 'react';
import { Predecessor } from '../types';
import { useTranslation } from '../utils/i18n';
import { useAppStore } from '../stores/useAppStore';
import { useProjectOperations } from '../hooks/useProjectOperations';

const DetailsPanel: React.FC = () => {
    const { 
        data, 
        schedule, 
        selIds, 
        userSettings, 
        showDetails, 
        setShowDetails 
    } = useAppStore();

    const { handleUpdate, handleAssignmentUpdate } = useProjectOperations();
    const { t } = useTranslation(userSettings.language);

    const [tab, setTab] = useState('General');
    const [selRes, setSelRes] = useState('');
    const [inputUnits, setInputUnits] = useState(8);
    const [newSuccId, setNewSuccId] = useState('');

    const fontSizePx = userSettings.uiFontPx || 13;
    
    // Derived State
    const activity = selIds.length === 1 ? schedule.activities.find(a => a.id === selIds[0]) : undefined;
    const resources = data?.resources || [];
    const assignments = data?.assignments || [];
    const calendars = data?.calendars || [];
    const allActivities = schedule.activities || [];

    // Collapsed State View
    if (!showDetails) {
        return (
            <div className="details-panel h-8 border-t bg-slate-100 flex items-center justify-between px-2 flex-shrink-0 cursor-pointer hover:bg-slate-200 transition-colors border-slate-300" onClick={() => setShowDetails(true)}>
                <span className="font-bold text-slate-500 text-xs uppercase tracking-wider">{t('ActivityDetails')}</span>
                <button className="text-slate-500 hover:text-blue-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"/></svg>
                </button>
            </div>
        );
    }

    if (!activity) return (
        <div className="details-panel h-64 border-t bg-slate-50 flex flex-col" style={{ fontSize: `${fontSizePx}px` }}>
            <div className="bg-slate-200 border-b border-slate-300 px-1 pt-1 h-8 flex justify-between items-center">
                 <div className="flex gap-1 h-full items-end">
                    <button className="px-4 py-1 uppercase font-bold border-t border-l border-r rounded-t-sm bg-white text-black border-b-white -mb-px">{t('General')}</button>
                 </div>
                 <button onClick={() => setShowDetails(false)} className="mr-2 text-slate-500 hover:text-blue-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                 </button>
            </div>
            <div className="flex-grow flex items-center justify-center text-slate-400">
                {t('NoActivitySelected')}
            </div>
        </div>
    );

    const myAssigns = assignments.filter(a => a.activityId === activity.id);
    
    const addRes = () => {
        if (!selRes) return;
        const res = resources.find(r => r.id === selRes);
        if(!res) return;

        let totalToStore = inputUnits;
        if(res.type !== 'Material' && activity.duration > 0) {
            totalToStore = inputUnits * activity.duration;
        }

        handleAssignmentUpdate([...assignments.filter(a => !(a.activityId === activity.id && a.resourceId === selRes)), { activityId: activity.id, resourceId: selRes, units: totalToStore }]);
    };
    
    const delRes = (rid: string) => handleAssignmentUpdate(assignments.filter(a => !(a.activityId === activity.id && a.resourceId === rid)));

    const preds = activity.predecessors || [];
    const updatePred = (idx: number, field: keyof Predecessor, val: any) => {
        const newPreds = [...preds];
        newPreds[idx] = { ...newPreds[idx], [field]: val };
        handleUpdate(activity.id, 'predecessors', newPreds);
    };
    const delPred = (idx: number) => {
        const newPreds = preds.filter((_, i) => i !== idx);
        handleUpdate(activity.id, 'predecessors', newPreds);
    };
    const addPred = () => {
        const newP: Predecessor = { activityId: '', type: 'FS', lag: 0 };
        handleUpdate(activity.id, 'predecessors', [...preds, newP]);
    };

    const successors = allActivities.filter(a => a.predecessors && a.predecessors.some(p => p.activityId === activity.id));
    
    const addSucc = () => {
        if(!newSuccId) return;
        const targetAct = allActivities.find(a => a.id === newSuccId);
        if(targetAct) {
            const newP: Predecessor = { activityId: activity.id, type: 'FS', lag: 0 };
            handleUpdate(targetAct.id, 'predecessors', [...(targetAct.predecessors || []), newP]);
            setNewSuccId('');
        }
    };
    const delSucc = (succId: string) => {
        const targetAct = allActivities.find(a => a.id === succId);
        if(targetAct) {
            const newPreds = (targetAct.predecessors || []).filter(p => p.activityId !== activity.id);
            handleUpdate(targetAct.id, 'predecessors', newPreds);
        }
    };

    const handleTypeChange = (newType: string) => {
        handleUpdate(activity.id, 'activityType', newType);
        if (newType.includes('Milestone')) {
            handleUpdate(activity.id, 'duration', 0);
        }
    };

    const selResObj = resources.find(r => r.id === selRes);

    return (
        <div className="details-panel h-64 border-t-4 border-slate-300 bg-white flex flex-col flex-shrink-0 shadow-[0_-2px_5px_rgba(0,0,0,0.05)] transition-all" style={{ fontSize: `${fontSizePx}px` }}>
            <div className="flex bg-slate-100 border-b border-slate-300 px-1 pt-1 gap-1 select-none h-8 items-end justify-between">
                <div className="flex gap-1 h-full items-end">
                    {['General', 'Status', 'Resources', 'Relationships'].map(key => (
                        <button key={key} onClick={() => setTab(key)} className={`px-4 py-1 uppercase font-bold border-t border-l border-r rounded-t-sm outline-none focus:outline-none ${tab === key ? 'bg-white text-black border-b-white -mb-px' : 'text-slate-500 bg-slate-100 border-b-slate-300 hover:bg-slate-50'}`}>{t(key as any)}</button>
                    ))}
                </div>
                <button onClick={() => setShowDetails(false)} className="mr-2 mb-1 text-slate-500 hover:text-blue-600" title={t('Collapse')}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                </button>
            </div>
            <div className="p-2 overflow-y-auto flex-grow font-sans">
                <div className="font-bold text-slate-700 border-b pb-1 mb-2 uppercase">{t(tab as any)} - {activity.id} : {activity.name}</div>
                
                {tab === 'General' && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <div>
                                <label className="block text-slate-500 mb-0.5 font-semibold">{t('ActivityID')}</label>
                                <input disabled value={activity.id} className="w-full border border-slate-300 px-1 py-1 bg-slate-50 text-slate-500" style={{ fontSize: `${fontSizePx}px` }} />
                            </div>
                            <div>
                                <label className="block text-slate-500 mb-0.5 font-semibold">{t('ActivityName')}</label>
                                <input value={activity.name} onChange={e => handleUpdate(activity.id, 'name', e.target.value)} className="w-full border border-slate-300 px-1 py-1" style={{ fontSize: `${fontSizePx}px` }} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div>
                                <label className="block text-slate-500 mb-0.5 font-semibold">{t('ActivityType')}</label>
                                <select value={activity.activityType} onChange={e => handleTypeChange(e.target.value)} className="w-full border border-slate-300 px-1 py-1 bg-white" style={{ fontSize: `${fontSizePx}px` }}>
                                    <option value="Task">{t('Task')}</option>
                                    <option value="Start Milestone">{t('StartMilestone')}</option>
                                    <option value="Finish Milestone">{t('FinishMilestone')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-slate-500 mb-0.5 font-semibold">{t('Calendars')}</label>
                                <select value={activity.calendarId || ''} onChange={e => handleUpdate(activity.id, 'calendarId', e.target.value)} className="w-full border border-slate-300 px-1 py-1 bg-white" style={{ fontSize: `${fontSizePx}px` }}>
                                    <option value="">{t('ProjectDefault')}</option>
                                    {calendars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                             <div>
                                <label className="block text-slate-500 mb-0.5 font-semibold">{t('OriginalDuration')}</label>
                                <div className="flex items-center">
                                    <input type="number" value={activity.duration} disabled={activity.activityType.includes('Milestone')} onChange={e => handleUpdate(activity.id, 'duration', Number(e.target.value))} className={`w-20 border border-slate-300 px-1 py-1 text-right ${activity.activityType.includes('Milestone')?'bg-slate-100':''}`} style={{ fontSize: `${fontSizePx}px` }} />
                                    <span className="ml-2 text-slate-500">{t('Days')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'Status' && (
                    <div className="grid grid-cols-4 gap-4">
                         <div className="border p-2 bg-slate-50">
                            <label className="font-bold block border-b mb-2 pb-1 uppercase">{t('Duration')}</label>
                            <div className="grid grid-cols-2 gap-1">
                                <label className="text-right text-slate-500 font-semibold">{t('Original')}:</label> <span>{activity.duration}</span>
                                <label className="text-right text-slate-500 font-semibold">{t('Remaining')}:</label> <span>{activity.duration}</span>
                            </div>
                         </div>
                         <div className="border p-2 bg-slate-50">
                            <label className="font-bold block border-b mb-2 pb-1 uppercase">{t('Dates')}</label>
                            <div className="grid grid-cols-2 gap-1">
                                <label className="text-right text-slate-500 font-semibold">{t('Start')}:</label> <span>{new Date(activity.startDate).toLocaleDateString()}</span>
                                <label className="text-right text-slate-500 font-semibold">{t('Finish')}:</label> <span>{new Date(activity.endDate).toLocaleDateString()}</span>
                            </div>
                         </div>
                         <div className="border p-2 bg-slate-50">
                            <label className="font-bold block border-b mb-2 pb-1 uppercase">{t('Float')}</label>
                            <div className="grid grid-cols-2 gap-1">
                                <label className="text-right text-slate-500 font-semibold">{t('TotalFloat')}:</label> <span className={`${(activity.totalFloat || 0) <= 0 ? 'text-red-600 font-bold' : ''}`}>{activity.totalFloat}</span>
                            </div>
                         </div>
                    </div>
                )}

                {tab === 'Resources' && (
                    <div className="flex h-full gap-4">
                        <div className="w-64 flex flex-col gap-2 p-2 bg-slate-50 border border-slate-200">
                            <label className="font-bold text-slate-600">{t('AssignResource')}</label>
                            <select className="border px-1 py-1 w-full" value={selRes} onChange={e => setSelRes(e.target.value)} style={{ fontSize: `${fontSizePx}px` }}>
                                <option value="">{t('SelectResource')}</option>
                                {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                            
                            <label className="font-bold text-slate-600 mt-2">
                                {selResObj?.type === 'Material' ? t('TotalQuantity') : t('UnitsPerTime')}
                            </label>
                            <input type="number" className="border px-1 py-1 w-full" value={inputUnits} onChange={e => setInputUnits(Number(e.target.value))} style={{ fontSize: `${fontSizePx}px` }} />
                            
                            <button onClick={addRes} className="bg-slate-200 border border-slate-300 px-2 py-1 hover:bg-slate-300 mt-2">{t('Add')}</button>
                        </div>
                        <div className="flex-grow border border-slate-200 overflow-auto bg-white">
                            <table className="w-full text-left">
                                <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
                                    <tr>
                                        <th className="p-1 pl-2">{t('ResourceName')}</th>
                                        <th className="p-1">{t('Type')}</th>
                                        <th className="p-1 text-right pr-2">{t('BudgetedUnitsTotal')}</th>
                                        <th className="p-1 text-right pr-2">{t('UnitsPerTime')}</th>
                                        <th className="p-1 w-8"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {myAssigns.map(a => {
                                        const r = resources.find(res => res.id === a.resourceId);
                                        const unitsPerTime = (r?.type !== 'Material' && activity.duration > 0) ? (a.units / activity.duration) : '-';
                                        return (
                                            <tr key={a.resourceId} className="border-b hover:bg-slate-50">
                                                <td className="p-1 pl-2">{r?.name}</td>
                                                <td className="p-1">{r?.type}</td>
                                                <td className="p-1 text-right pr-2">{a.units.toFixed(1)}</td>
                                                <td className="p-1 text-right pr-2">{typeof unitsPerTime === 'number' ? unitsPerTime.toFixed(1) : unitsPerTime}</td>
                                                <td className="p-1 text-center text-red-500 cursor-pointer font-bold" onClick={() => delRes(a.resourceId)}>×</td>
                                            </tr>
                                        );
                                    })}
                                    {myAssigns.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">{t('NoResourcesAssigned')}</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {tab === 'Relationships' && (
                    <div className="flex h-full gap-4">
                        {/* Predecessors */}
                        <div className="flex-1 flex flex-col border border-slate-300">
                             <div className="bg-slate-100 p-1 border-b font-bold text-slate-600 flex justify-between items-center">
                                 <span>{t('Predecessors')}</span>
                                 <button onClick={addPred} className="px-2 py-0.5 bg-white border rounded text-[11px] hover:bg-slate-50">+ {t('Add')}</button>
                             </div>
                             <div className="flex-grow overflow-auto bg-white">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b">
                                        <tr>
                                            <th className="p-1 pl-2">{t('ActID')}</th>
                                            <th className="p-1 w-16">{t('Type')}</th>
                                            <th className="p-1 w-12">{t('Lag')}</th>
                                            <th className="p-1 w-6"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {preds.map((p, i) => (
                                            <tr key={i} className="border-b hover:bg-slate-50">
                                                <td className="p-1 pl-2"><input className="w-full border-none p-0" value={p.activityId} onChange={e => updatePred(i, 'activityId', e.target.value)} /></td>
                                                <td className="p-1"><select className="w-full border-none p-0 bg-transparent" value={p.type} onChange={e => updatePred(i, 'type', e.target.value)}><option>FS</option><option>SS</option><option>FF</option><option>SF</option></select></td>
                                                <td className="p-1"><input type="number" className="w-full border-none p-0" value={p.lag} onChange={e => updatePred(i, 'lag', Number(e.target.value))} /></td>
                                                <td className="p-1 text-center cursor-pointer text-red-500" onClick={()=>delPred(i)}>×</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                             </div>
                        </div>

                        {/* Successors */}
                         <div className="flex-1 flex flex-col border border-slate-300">
                             <div className="bg-slate-100 p-1 border-b font-bold text-slate-600 flex justify-between items-center">
                                 <span>{t('Successors')}</span>
                                 <div className="flex gap-1">
                                     <input className="border px-1 py-0.5 w-20 text-[11px]" placeholder={t('ActID')} value={newSuccId} onChange={e=>setNewSuccId(e.target.value)}/>
                                     <button onClick={addSucc} className="px-2 py-0.5 bg-white border rounded text-[11px] hover:bg-slate-50">+ {t('Add')}</button>
                                 </div>
                             </div>
                             <div className="flex-grow overflow-auto bg-white">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b">
                                        <tr>
                                            <th className="p-1 pl-2">{t('ActID')}</th>
                                            <th className="p-1">{t('Name')}</th>
                                            <th className="p-1 w-6"></th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {successors.map(s => (
                                            <tr key={s.id} className="border-b hover:bg-slate-50">
                                                <td className="p-1 pl-2">{s.id}</td>
                                                <td className="p-1 truncate max-w-[100px]">{s.name}</td>
                                                <td className="p-1 text-center cursor-pointer text-red-500" onClick={()=>delSucc(s.id)}>×</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                             </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DetailsPanel;