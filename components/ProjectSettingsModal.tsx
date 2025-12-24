
import React, { useState, useEffect } from 'react';
import { ProjectData, Calendar, CalendarException } from '../types';
import { AlertModal } from './Modals';

interface ProjectSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectData: ProjectData;
    onUpdateProject: (meta: ProjectData['meta'], calendars: Calendar[]) => void;
}

const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ isOpen, onClose, projectData, onUpdateProject }) => {
    const [meta, setMeta] = useState(projectData.meta!);
    const [calendars, setCalendars] = useState<Calendar[]>(projectData.calendars || []);
    const [activeTab, setActiveTab] = useState<'General' | 'Defaults' | 'Calendars'>('General');
    const [selectedCalId, setSelectedCalId] = useState<string>('');
    
    // Holiday Range State
    const [holidayStart, setHolidayStart] = useState('');
    const [holidayEnd, setHolidayEnd] = useState('');
    const [alertMsg, setAlertMsg] = useState<string | null>(null);

    useEffect(() => {
        if(projectData.meta) setMeta(projectData.meta);
        if(projectData.calendars) {
            setCalendars(projectData.calendars);
            if(projectData.calendars.length > 0 && !selectedCalId) {
                setSelectedCalId(projectData.calendars[0].id);
            }
        }
    }, [projectData, isOpen]);

    const handleSave = () => {
        onUpdateProject(meta, calendars);
        onClose();
    };

    const handleUpdateCalendar = (id: string, updates: Partial<Calendar>) => {
        setCalendars(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    const toggleWeekDay = (calId: string, dayIndex: number) => {
        const cal = calendars.find(c => c.id === calId);
        if(!cal) return;
        const newWeek = [...cal.weekDays];
        newWeek[dayIndex] = !newWeek[dayIndex];
        handleUpdateCalendar(calId, { weekDays: newWeek });
    };

    const addHolidayRange = () => {
        if(!selectedCalId || !holidayStart) return;
        const cal = calendars.find(c => c.id === selectedCalId);
        if(!cal) return;
        
        const start = new Date(holidayStart);
        const end = holidayEnd ? new Date(holidayEnd) : new Date(holidayStart);
        
        // Ensure start <= end
        if (start > end) {
            setAlertMsg("Start date must be before end date");
            return;
        }

        const newExceptions = [...cal.exceptions];
        let curr = new Date(start);
        let count = 0;

        // Loop through dates adding exceptions
        while (curr <= end && count < 365) { // Safety limit
            const dateStr = curr.toISOString().split('T')[0];
            // Avoid duplicates
            if (!newExceptions.some(e => e.date === dateStr)) {
                newExceptions.push({ date: dateStr, isWorking: false });
            }
            curr.setDate(curr.getDate() + 1);
            count++;
        }
        
        handleUpdateCalendar(selectedCalId, { exceptions: newExceptions });
        setHolidayStart('');
        setHolidayEnd('');
    };

    const deleteException = (date: string) => {
        const cal = calendars.find(c => c.id === selectedCalId);
        if(!cal) return;
        handleUpdateCalendar(selectedCalId, { exceptions: cal.exceptions.filter(e => e.date !== date) });
    };
    
    const addNewCalendar = () => {
        const newCal: Calendar = {
            id: `cal-${Date.now()}`,
            name: 'New Calendar',
            isDefault: false,
            hoursPerDay: 8,
            weekDays: [false, true, true, true, true, true, false],
            exceptions: []
        };
        setCalendars([...calendars, newCal]);
        setSelectedCalId(newCal.id);
    };

    if (!isOpen || !meta) return null;

    const selectedCal = calendars.find(c => c.id === selectedCalId);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white border border-slate-300 rounded-lg w-[800px] max-h-[90vh] flex flex-col shadow-2xl">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <h2 className="text-xl font-bold text-slate-800">Project Settings</h2>
                    <div className="flex gap-2">
                        <button onClick={() => setActiveTab('General')} className={`px-3 py-1 text-sm rounded ${activeTab === 'General' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}>General</button>
                        <button onClick={() => setActiveTab('Defaults')} className={`px-3 py-1 text-sm rounded ${activeTab === 'Defaults' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}>Defaults</button>
                        <button onClick={() => setActiveTab('Calendars')} className={`px-3 py-1 text-sm rounded ${activeTab === 'Calendars' ? 'bg-blue-600 text-white' : 'text-slate-500 hover:text-slate-700'}`}>Calendars</button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto flex-grow">
                    {activeTab === 'General' && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-slate-500 text-xs font-bold mb-1">Project Code (for WBS)</label>
                                <input 
                                    className="w-full bg-white text-slate-800 rounded p-2 text-sm border border-slate-300"
                                    value={meta.projectCode || ''}
                                    onChange={e => setMeta({...meta, projectCode: e.target.value})}
                                    placeholder="e.g. PROJ-01"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-500 text-xs font-bold mb-1">Project Name</label>
                                <input 
                                    className="w-full bg-white text-slate-800 rounded p-2 text-sm border border-slate-300"
                                    value={meta.title}
                                    onChange={e => setMeta({...meta, title: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-slate-500 text-xs font-bold mb-1">Project Start Date</label>
                                <input 
                                    type="date"
                                    className="w-full bg-white text-slate-800 rounded p-2 text-sm border border-slate-300"
                                    value={meta.projectStartDate}
                                    onChange={e => setMeta({...meta, projectStartDate: e.target.value})}
                                />
                            </div>
                             <div>
                                <label className="block text-slate-500 text-xs font-bold mb-1">Default Calendar</label>
                                <select 
                                    className="w-full bg-white text-slate-800 rounded p-2 text-sm border border-slate-300"
                                    value={meta.defaultCalendarId}
                                    onChange={e => setMeta({...meta, defaultCalendarId: e.target.value})}
                                >
                                    {calendars.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {activeTab === 'Defaults' && (
                        <div className="space-y-4">
                            <h4 className="font-bold text-slate-700 border-b border-slate-200 pb-2">Activity ID Auto-numbering</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-slate-500 text-xs font-bold mb-1">Prefix</label>
                                    <input 
                                        className="w-full bg-white text-slate-800 rounded p-2 text-sm border border-slate-300"
                                        value={meta.activityIdPrefix || 'A'}
                                        onChange={e => setMeta({...meta, activityIdPrefix: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-500 text-xs font-bold mb-1">Increment Step</label>
                                    <input 
                                        type="number"
                                        className="w-full bg-white text-slate-800 rounded p-2 text-sm border border-slate-300"
                                        value={meta.activityIdIncrement || 10}
                                        onChange={e => setMeta({...meta, activityIdIncrement: Number(e.target.value)})}
                                    />
                                </div>
                            </div>

                            <h4 className="font-bold text-slate-700 border-b border-slate-200 pb-2 pt-4">Resource ID Auto-numbering</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-slate-500 text-xs font-bold mb-1">Prefix</label>
                                    <input 
                                        className="w-full bg-white text-slate-800 rounded p-2 text-sm border border-slate-300"
                                        value={meta.resourceIdPrefix || 'R'}
                                        onChange={e => setMeta({...meta, resourceIdPrefix: e.target.value})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-slate-500 text-xs font-bold mb-1">Increment Step</label>
                                    <input 
                                        type="number"
                                        className="w-full bg-white text-slate-800 rounded p-2 text-sm border border-slate-300"
                                        value={meta.resourceIdIncrement || 10}
                                        onChange={e => setMeta({...meta, resourceIdIncrement: Number(e.target.value)})}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'Calendars' && (
                        <div className="flex h-full gap-4">
                            {/* Calendar List */}
                            <div className="w-1/3 border-r border-slate-200 pr-4">
                                <div className="flex justify-between items-center mb-2">
                                    <h4 className="font-bold text-slate-700">Calendars</h4>
                                    <button onClick={addNewCalendar} className="text-xs bg-green-600 px-2 py-1 rounded text-white hover:bg-green-700">+</button>
                                </div>
                                <ul className="space-y-1">
                                    {calendars.map(cal => (
                                        <li 
                                            key={cal.id}
                                            onClick={() => setSelectedCalId(cal.id)}
                                            className={`p-2 rounded cursor-pointer text-sm ${selectedCalId === cal.id ? 'bg-blue-100 text-blue-900 font-medium' : 'text-slate-600 hover:bg-slate-100'}`}
                                        >
                                            {cal.name}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Calendar Details */}
                            {selectedCal && (
                                <div className="w-2/3 pl-4 space-y-4">
                                    <div>
                                        <label className="block text-slate-500 text-xs mb-1">Name</label>
                                        <input 
                                            className="w-full bg-white border border-slate-300 p-1 rounded text-slate-800 text-sm"
                                            value={selectedCal.name}
                                            onChange={e => handleUpdateCalendar(selectedCal.id, { name: e.target.value })}
                                        />
                                    </div>
                                    
                                    <div>
                                        <label className="block text-slate-500 text-xs mb-1">Standard Work Week</label>
                                        <div className="flex gap-1">
                                            {selectedCal.weekDays.map((isWorking, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => toggleWeekDay(selectedCal.id, idx)}
                                                    className={`w-8 h-8 rounded text-xs font-bold border ${isWorking ? 'bg-green-100 border-green-300 text-green-800' : 'bg-slate-100 border-slate-300 text-slate-400'}`}
                                                >
                                                    {days[idx].charAt(0)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-slate-500 text-xs mb-1">Daily Work Hours</label>
                                        <input 
                                            type="number"
                                            className="w-20 bg-white border border-slate-300 p-1 rounded text-slate-800 text-sm"
                                            value={selectedCal.hoursPerDay}
                                            onChange={e => handleUpdateCalendar(selectedCal.id, { hoursPerDay: Number(e.target.value) })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-slate-500 text-xs mb-1">Exceptions (Holidays/Non-Work)</label>
                                        <div className="flex gap-2 mb-2 items-end bg-slate-100 p-2 rounded border border-slate-200">
                                            <div>
                                                <label className="block text-[10px] text-slate-500 mb-0.5">Start Date</label>
                                                <input 
                                                    type="date" 
                                                    className="bg-white border border-slate-300 text-slate-800 p-1 rounded text-xs w-32"
                                                    value={holidayStart}
                                                    onChange={e => setHolidayStart(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-slate-500 mb-0.5">End Date (Opt)</label>
                                                <input 
                                                    type="date" 
                                                    className="bg-white border border-slate-300 text-slate-800 p-1 rounded text-xs w-32"
                                                    value={holidayEnd}
                                                    onChange={e => setHolidayEnd(e.target.value)}
                                                />
                                            </div>
                                            <button onClick={addHolidayRange} className="bg-slate-600 hover:bg-slate-700 px-3 py-1 rounded text-xs text-white h-7">Add Range</button>
                                        </div>
                                        
                                        <div className="max-h-32 overflow-y-auto bg-slate-50 border border-slate-200 p-2 rounded">
                                            {selectedCal.exceptions.length === 0 && <div className="text-center text-slate-400 text-xs py-2">No exceptions added.</div>}
                                            {selectedCal.exceptions.sort((a,b)=>a.date.localeCompare(b.date)).map((ex, i) => (
                                                <div key={i} className="flex justify-between text-xs text-slate-600 py-1 border-b border-slate-200 last:border-0">
                                                    <span>{ex.date} <span className="text-red-500">({ex.isWorking ? 'Work' : 'Non-Work'})</span></span>
                                                    <button onClick={() => deleteException(ex.date)} className="text-red-500 font-bold hover:text-red-700 px-2">×</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50 rounded-b-lg">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-800">Cancel</button>
                    <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm font-semibold shadow-sm">Apply Changes</button>
                </div>
            </div>
            <AlertModal 
                isOpen={!!alertMsg} 
                msg={alertMsg || ''} 
                onClose={() => setAlertMsg(null)} 
            />
        </div>
    );
};

export default ProjectSettingsModal;
