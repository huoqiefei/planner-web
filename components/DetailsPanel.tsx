
import React, { useState } from 'react';
import { Activity, Resource, Assignment, Calendar, Predecessor, UserSettings } from '../types';

interface DetailsPanelProps {
    activity?: Activity;
    resources: Resource[];
    assignments: Assignment[];
    calendars: Calendar[];
    onUpdate: (id: string, field: string, value: any) => void;
    onAssignUpdate: (assignments: Assignment[], activityId: string) => void;
    userSettings: UserSettings;
    allActivities?: Activity[];
    isVisible?: boolean;
    onToggle?: () => void;
}

const DetailsPanel: React.FC<DetailsPanelProps> = ({ activity, resources, assignments, calendars, onUpdate, onAssignUpdate, userSettings, allActivities = [], isVisible = true, onToggle }) => {
    const [tab, setTab] = useState('General');
    const [selRes, setSelRes] = useState('');
    const [inputUnits, setInputUnits] = useState(8);
    const [newSuccId, setNewSuccId] = useState('');

    const fontSizePx = userSettings.uiFontPx || 13;
    
    // Collapsed State View
    if (!isVisible) {
        return (
            <div className="h-8 border-t bg-slate-100 flex items-center justify-between px-2 flex-shrink-0 cursor-pointer hover:bg-slate-200 transition-colors border-slate-300" onClick={onToggle}>
                <span className="font-bold text-slate-500 text-xs uppercase tracking-wider">Activity Details</span>
                <button className="text-slate-500 hover:text-blue-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7"/></svg>
                </button>
            </div>
        );
    }

    if (!activity) return (
        <div className="h-64 border-t bg-slate-50 flex flex-col" style={{ fontSize: `${fontSizePx}px` }}>
            <div className="bg-slate-200 border-b border-slate-300 px-1 pt-1 h-8 flex justify-between items-center">
                 <div className="flex gap-1 h-full items-end">
                    <button className="px-4 py-1 uppercase font-bold border-t border-l border-r rounded-t-sm bg-white text-black border-b-white -mb-px">General</button>
                 </div>
                 <button onClick={onToggle} className="mr-2 text-slate-500 hover:text-blue-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                 </button>
            </div>
            <div className="flex-grow flex items-center justify-center text-slate-400">
                No activity selected
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

        onAssignUpdate([...assignments.filter(a => !(a.activityId === activity.id && a.resourceId === selRes)), { activityId: activity.id, resourceId: selRes, units: totalToStore }], activity.id);
    };
    
    const delRes = (rid: string) => onAssignUpdate(assignments.filter(a => !(a.activityId === activity.id && a.resourceId === rid)), activity.id);

    const preds = activity.predecessors || [];
    const updatePred = (idx: number, field: keyof Predecessor, val: any) => {
        const newPreds = [...preds];
        newPreds[idx] = { ...newPreds[idx], [field]: val };
        onUpdate(activity.id, 'predecessors', newPreds);
    };
    const delPred = (idx: number) => {
        const newPreds = preds.filter((_, i) => i !== idx);
        onUpdate(activity.id, 'predecessors', newPreds);
    };
    const addPred = () => {
        const newP: Predecessor = { activityId: '', type: 'FS', lag: 0 };
        onUpdate(activity.id, 'predecessors', [...preds, newP]);
    };

    const successors = allActivities.filter(a => a.predecessors && a.predecessors.some(p => p.activityId === activity.id));
    
    const addSucc = () => {
        if(!newSuccId) return;
        const targetAct = allActivities.find(a => a.id === newSuccId);
        if(targetAct) {
            const newP: Predecessor = { activityId: activity.id, type: 'FS', lag: 0 };
            onUpdate(targetAct.id, 'predecessors', [...(targetAct.predecessors || []), newP]);
            setNewSuccId('');
        }
    };
    const delSucc = (succId: string) => {
        const targetAct = allActivities.find(a => a.id === succId);
        if(targetAct) {
            const newPreds = targetAct.predecessors.filter(p => p.activityId !== activity.id);
            onUpdate(targetAct.id, 'predecessors', newPreds);
        }
    };

    const handleTypeChange = (newType: string) => {
        onUpdate(activity.id, 'activityType', newType);
        if (newType.includes('Milestone')) {
            onUpdate(activity.id, 'duration', 0);
        }
    };

    const selResObj = resources.find(r => r.id === selRes);

    return (
        <div className="h-64 border-t-4 border-slate-300 bg-white flex flex-col flex-shrink-0 shadow-[0_-2px_5px_rgba(0,0,0,0.05)] transition-all" style={{ fontSize: `${fontSizePx}px` }}>
            <div className="flex bg-slate-100 border-b border-slate-300 px-1 pt-1 gap-1 select-none h-8 items-end justify-between">
                <div className="flex gap-1 h-full items-end">
                    {['General', 'Status', 'Resources', 'Relationships'].map(t => (
                        <button key={t} onClick={() => setTab(t)} className={`px-4 py-1 uppercase font-bold border-t border-l border-r rounded-t-sm outline-none focus:outline-none ${tab === t ? 'bg-white text-black border-b-white -mb-px' : 'text-slate-500 bg-slate-100 border-b-slate-300 hover:bg-slate-50'}`}>{t}</button>
                    ))}
                </div>
                <button onClick={onToggle} className="mr-2 mb-1 text-slate-500 hover:text-blue-600" title="Collapse">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"/></svg>
                </button>
            </div>
            <div className="p-2 overflow-y-auto flex-grow font-sans">
                <div className="font-bold text-slate-700 border-b pb-1 mb-2 uppercase">{tab} - {activity.id} : {activity.name}</div>
                
                {tab === 'General' && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <div>
                                <label className="block text-slate-500 mb-0.5 font-semibold">Activity ID</label>
                                <input disabled value={activity.id} className="w-full border border-slate-300 px-1 py-1 bg-slate-50 text-slate-500" style={{ fontSize: `${fontSizePx}px` }} />
                            </div>
                            <div>
                                <label className="block text-slate-500 mb-0.5 font-semibold">Activity Name</label>
                                <input value={activity.name} onChange={e => onUpdate(activity.id, 'name', e.target.value)} className="w-full border border-slate-300 px-1 py-1" style={{ fontSize: `${fontSizePx}px` }} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div>
                                <label className="block text-slate-500 mb-0.5 font-semibold">Activity Type</label>
                                <select value={activity.activityType} onChange={e => handleTypeChange(e.target.value)} className="w-full border border-slate-300 px-1 py-1 bg-white" style={{ fontSize: `${fontSizePx}px` }}>
                                    <option>Task</option>
                                    <option>Start Milestone</option>
                                    <option>Finish Milestone</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-slate-500 mb-0.5 font-semibold">Calendar</label>
                                <select value={activity.calendarId || ''} onChange={e => onUpdate(activity.id, 'calendarId', e.target.value)} className="w-full border border-slate-300 px-1 py-1 bg-white" style={{ fontSize: `${fontSizePx}px` }}>
                                    <option value="">Project Default</option>
                                    {calendars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>
                        <div className="space-y-2">
                             <div>
                                <label className="block text-slate-500 mb-0.5 font-semibold">Original Duration</label>
                                <div className="flex items-center">
                                    <input type="number" value={activity.duration} disabled={activity.activityType.includes('Milestone')} onChange={e => onUpdate(activity.id, 'duration', Number(e.target.value))} className={`w-20 border border-slate-300 px-1 py-1 text-right ${activity.activityType.includes('Milestone')?'bg-slate-100':''}`} style={{ fontSize: `${fontSizePx}px` }} />
                                    <span className="ml-2 text-slate-500">Days</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'Status' && (
                    <div className="grid grid-cols-4 gap-4">
                         <div className="border p-2 bg-slate-50">
                            <label className="font-bold block border-b mb-2 pb-1 uppercase">Duration</label>
                            <div className="grid grid-cols-2 gap-1">
                                <label className="text-right text-slate-500 font-semibold">Original:</label> <span>{activity.duration}</span>
                                <label className="text-right text-slate-500 font-semibold">Remaining:</label> <span>{activity.duration}</span>
                            </div>
                         </div>
                         <div className="border p-2 bg-slate-50">
                            <label className="font-bold block border-b mb-2 pb-1 uppercase">Dates</label>
                            <div className="grid grid-cols-2 gap-1">
                                <label className="text-right text-slate-500 font-semibold">Start:</label> <span>{new Date(activity.startDate).toLocaleDateString()}</span>
                                <label className="text-right text-slate-500 font-semibold">Finish:</label> <span>{new Date(activity.endDate).toLocaleDateString()}</span>
                            </div>
                         </div>
                         <div className="border p-2 bg-slate-50">
                            <label className="font-bold block border-b mb-2 pb-1 uppercase">Float</label>
                            <div className="grid grid-cols-2 gap-1">
                                <label className="text-right text-slate-500 font-semibold">Total Float:</label> <span className={`${(activity.totalFloat || 0) <= 0 ? 'text-red-600 font-bold' : ''}`}>{activity.totalFloat}</span>
                            </div>
                         </div>
                    </div>
                )}

                {tab === 'Resources' && (
                    <div className="flex h-full gap-4">
                        <div className="w-64 flex flex-col gap-2 p-2 bg-slate-50 border border-slate-200">
                            <label className="font-bold text-slate-600">Assign Resource</label>
                            <select className="border px-1 py-1 w-full" value={selRes} onChange={e => setSelRes(e.target.value)} style={{ fontSize: `${fontSizePx}px` }}>
                                <option value="">Select Resource...</option>
                                {resources.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                            </select>
                            
                            <label className="font-bold text-slate-600 mt-2">
                                {selResObj?.type === 'Material' ? 'Total Quantity' : 'Units per Day'}
                            </label>
                            <input type="number" className="border px-1 py-1 w-full" value={inputUnits} onChange={e => setInputUnits(Number(e.target.value))} style={{ fontSize: `${fontSizePx}px` }} />
                            
                            <button onClick={addRes} className="bg-slate-200 border border-slate-300 px-2 py-1 hover:bg-slate-300 mt-2">Assign</button>
                        </div>
                        <div className="flex-grow border border-slate-200 overflow-auto bg-white">
                            <table className="w-full text-left">
                                <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
                                    <tr>
                                        <th className="p-1 pl-2">Resource Name</th>
                                        <th className="p-1">Type</th>
                                        <th className="p-1 text-right pr-2">Budgeted Units (Total)</th>
                                        <th className="p-1 text-right pr-2">Units/Time</th>
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
                                    {myAssigns.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-slate-400">No resources assigned</td></tr>}
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
                                 <span>Predecessors</span>
                                 <button onClick={addPred} className="px-2 py-0.5 bg-white border rounded text-[11px] hover:bg-slate-50">+ Add</button>
                             </div>
                             <div className="flex-grow overflow-auto bg-white">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b">
                                        <tr>
                                            <th className="p-1 pl-2">ID</th>
                                            <th className="p-1 w-16">Type</th>
                                            <th className="p-1 w-12">Lag</th>
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
                                 <span>Successors</span>
                                 <div className="flex gap-1">
                                     <input className="border px-1 py-0.5 w-20 text-[11px]" placeholder="Act ID" value={newSuccId} onChange={e=>setNewSuccId(e.target.value)}/>
                                     <button onClick={addSucc} className="px-2 py-0.5 bg-white border rounded text-[11px] hover:bg-slate-50">+ Add</button>
                                 </div>
                             </div>
                             <div className="flex-grow overflow-auto bg-white">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 text-slate-500 font-semibold border-b">
                                        <tr>
                                            <th className="p-1 pl-2">ID</th>
                                            <th className="p-1">Name</th>
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
                                        {successors.length === 0 && <tr><td colSpan={3} className="p-2 text-center text-slate-400">No successors</td></tr>}
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
