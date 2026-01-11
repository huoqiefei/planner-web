import React, { useState, useEffect } from 'react';
import { ProjectData, Calendar, CalendarException, CustomFieldDefinition } from '../types';
import { AlertModal, BaseModal } from './Modals';
import { useTranslation } from '../utils/i18n';
import { useAppStore } from '../stores/useAppStore';

interface ProjectSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectData: ProjectData;
    onUpdateProject: (meta: ProjectData['meta'], calendars: Calendar[]) => void;
    lang?: 'en' | 'zh';
    initialTab?: 'general' | 'defaults' | 'calendars' | 'custom_fields';
}

const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ isOpen, onClose, projectData, onUpdateProject, lang = 'en', initialTab }) => {
    const { t } = useTranslation(lang);
    const { user } = useAppStore();
    const [meta, setMeta] = useState(projectData.meta!);
    const [calendars, setCalendars] = useState<Calendar[]>(projectData.calendars || []);
    const [customFieldDefinitions, setCustomFieldDefinitions] = useState<CustomFieldDefinition[]>(projectData.meta?.customFieldDefinitions || []);
    const [activeTab, setActiveTab] = useState<'General' | 'Defaults' | 'Calendars' | 'Custom Fields'>('General');
    const [selectedCalId, setSelectedCalId] = useState<string>('');

    // Holiday Range State
    const [holidayStart, setHolidayStart] = useState('');
    const [holidayEnd, setHolidayEnd] = useState('');
    const [alertMsg, setAlertMsg] = useState<string | null>(null);

    // Custom Field State
    const [newField, setNewField] = useState<Partial<CustomFieldDefinition>>({ name: '', scope: 'activity', type: 'text' });

    useEffect(() => {
        if (projectData.meta) {
            setMeta(projectData.meta);
            setCustomFieldDefinitions(projectData.meta.customFieldDefinitions || []);
        }
        if (projectData.calendars) {
            setCalendars(projectData.calendars);
            if (projectData.calendars.length > 0 && !selectedCalId) {
                setSelectedCalId(projectData.calendars[0].id);
            }
        }
        // Set initial tab if provided
        if (isOpen && initialTab) {
            const tabMap = {
                'general': 'General',
                'defaults': 'Defaults',
                'calendars': 'Calendars',
                'custom_fields': 'Custom Fields'
            } as const;
            setActiveTab(tabMap[initialTab] as any);
        }
    }, [projectData, isOpen, initialTab]);

    const handleSave = () => {
        const updatedMeta = { ...meta, customFieldDefinitions };
        onUpdateProject(updatedMeta, calendars);
        onClose();
    };

    const handleUpdateCalendar = (id: string, updates: Partial<Calendar>) => {
        setCalendars(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
    };

    const toggleWeekDay = (calId: string, dayIndex: number) => {
        const cal = calendars.find(c => c.id === calId);
        if (!cal) return;
        const newWeek = [...cal.weekDays];
        newWeek[dayIndex] = !newWeek[dayIndex];
        handleUpdateCalendar(calId, { weekDays: newWeek });
    };

    const addHolidayRange = () => {
        if (!selectedCalId || !holidayStart) return;
        const cal = calendars.find(c => c.id === selectedCalId);
        if (!cal) return;

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
        if (!cal) return;
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

    const addCustomField = () => {
        if (!newField.name) return;

        // Check limits
        const role = user?.plannerRole || 'trial';
        const limitVar = `VITE_LIMIT_CF_${role.toUpperCase()}`;
        const limit = parseInt(import.meta.env[limitVar] || (role === 'trial' ? '0' : role === 'licensed' ? '5' : '20'));

        if (customFieldDefinitions.length >= limit && role !== 'admin') {
            setAlertMsg(`${t('CustomFieldLimitReached') || 'Custom Field limit reached for your plan'} (${limit})`);
            return;
        }

        const id = `cf_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        setCustomFieldDefinitions([...customFieldDefinitions, { ...newField, id } as CustomFieldDefinition]);
        setNewField({ name: '', scope: 'activity', type: 'text' });
    };

    const deleteCustomField = (id: string) => {
        setCustomFieldDefinitions(customFieldDefinitions.filter(f => f.id !== id));
    };

    if (!isOpen || !meta) return null;

    const selectedCal = calendars.find(c => c.id === selectedCalId);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return (
        <BaseModal
            isOpen={isOpen}
            title={t('ProjectSettings')}
            onClose={onClose}
            className="w-[800px] max-h-[90vh] flex flex-col"
            footer={
                <div className="flex justify-end gap-2 w-full">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded hover:bg-slate-50">{t('Cancel')}</button>
                    <button onClick={handleSave} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">{t('Save')}</button>
                </div>
            }
        >
            <div className="flex flex-col h-full">
                <div className="flex gap-2 mb-6 border-b border-slate-100 pb-2">
                    {['General', 'Defaults', 'Calendars', 'Custom Fields'].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab as any)}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === tab ? 'bg-blue-50 text-blue-700' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
                        >
                            {tab === 'Custom Fields' ? t('CustomFields') : t(tab as any)}
                        </button>
                    ))}
                </div>

                <div className="flex-grow">
                    {activeTab === 'General' && (
                        <div className="space-y-4 max-w-lg">
                            <div>
                                <label className="block text-slate-500 text-xs font-bold mb-1">{t('ProjectCode')}</label>
                                <input
                                    className="w-full bg-white text-slate-800 rounded p-2 text-sm border border-slate-300 focus:border-blue-500 focus:outline-none"
                                    value={meta.projectCode || ''}
                                    onChange={e => setMeta({ ...meta, projectCode: e.target.value })}
                                    placeholder="e.g. PROJ-01"
                                />
                            </div>
                            <div>
                                <label className="block text-slate-500 text-xs font-bold mb-1">{t('ProjectName')}</label>
                                <input
                                    className="w-full bg-white text-slate-800 rounded p-2 text-sm border border-slate-300 focus:border-blue-500 focus:outline-none"
                                    value={meta.title}
                                    onChange={e => setMeta({ ...meta, title: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-slate-500 text-xs font-bold mb-1">{t('StartDate')}</label>
                                <input
                                    type="date"
                                    className="w-full bg-white text-slate-800 rounded p-2 text-sm border border-slate-300 focus:border-blue-500 focus:outline-none"
                                    value={meta.projectStartDate}
                                    onChange={e => setMeta({ ...meta, projectStartDate: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-slate-500 text-xs font-bold mb-1">{t('DefaultCal')}</label>
                                <select
                                    className="w-full bg-white text-slate-800 rounded p-2 text-sm border border-slate-300 focus:border-blue-500 focus:outline-none"
                                    value={meta.defaultCalendarId}
                                    onChange={e => setMeta({ ...meta, defaultCalendarId: e.target.value })}
                                >
                                    {calendars.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {activeTab === 'Defaults' && (
                        <div className="space-y-6 max-w-lg">
                            <div>
                                <h4 className="font-bold text-slate-700 border-b border-slate-200 pb-2 mb-4">{t('AutoNumbering')} ({t('Activities')})</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-slate-500 text-xs font-bold mb-1">{t('Prefix')}</label>
                                        <input
                                            className="w-full bg-white text-slate-800 rounded p-2 text-sm border border-slate-300 focus:border-blue-500 focus:outline-none"
                                            value={meta.activityIdPrefix || 'A'}
                                            onChange={e => setMeta({ ...meta, activityIdPrefix: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-500 text-xs font-bold mb-1">{t('Increment')}</label>
                                        <input
                                            type="number"
                                            className="w-full bg-white text-slate-800 rounded p-2 text-sm border border-slate-300 focus:border-blue-500 focus:outline-none"
                                            value={meta.activityIdIncrement || 10}
                                            onChange={e => setMeta({ ...meta, activityIdIncrement: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-bold text-slate-700 border-b border-slate-200 pb-2 mb-4">{t('AutoNumbering')} ({t('Resources')})</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-slate-500 text-xs font-bold mb-1">{t('Prefix')}</label>
                                        <input
                                            className="w-full bg-white text-slate-800 rounded p-2 text-sm border border-slate-300 focus:border-blue-500 focus:outline-none"
                                            value={meta.resourceIdPrefix || 'R'}
                                            onChange={e => setMeta({ ...meta, resourceIdPrefix: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-slate-500 text-xs font-bold mb-1">{t('Increment')}</label>
                                        <input
                                            type="number"
                                            className="w-full bg-white text-slate-800 rounded p-2 text-sm border border-slate-300 focus:border-blue-500 focus:outline-none"
                                            value={meta.resourceIdIncrement || 10}
                                            onChange={e => setMeta({ ...meta, resourceIdIncrement: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'Calendars' && (
                        <div className="flex h-[400px] gap-6">
                            {/* Calendar List */}
                            <div className="w-1/3 border border-slate-200 rounded-lg p-4 bg-slate-50">
                                <div className="flex justify-between items-center mb-4">
                                    <h4 className="font-bold text-slate-700">{t('Calendars')}</h4>
                                    <button onClick={addNewCalendar} className="text-xs bg-green-600 px-2 py-1 rounded text-white hover:bg-green-700 transition-colors shadow-sm">+ {t('Add')}</button>
                                </div>
                                <ul className="space-y-1">
                                    {calendars.map(cal => (
                                        <li
                                            key={cal.id}
                                            onClick={() => setSelectedCalId(cal.id)}
                                            className={`p-2 rounded cursor-pointer text-sm transition-colors ${selectedCalId === cal.id ? 'bg-white shadow text-blue-700 font-medium border border-blue-100' : 'text-slate-600 hover:bg-slate-200'}`}
                                        >
                                            {cal.name}
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* Calendar Details */}
                            {selectedCal && (
                                <div className="w-2/3 space-y-4 overflow-y-auto pr-2">
                                    <div>
                                        <label className="block text-slate-500 text-xs font-bold mb-1">{t('CalendarName')}</label>
                                        <input
                                            className="w-full bg-white border border-slate-300 p-2 rounded text-slate-800 text-sm focus:border-blue-500 focus:outline-none"
                                            value={selectedCal.name}
                                            onChange={e => handleUpdateCalendar(selectedCal.id, { name: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-slate-500 text-xs font-bold mb-2">{t('StandardWorkWeek')}</label>
                                        <div className="flex gap-2">
                                            {selectedCal.weekDays.map((isWorking, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => toggleWeekDay(selectedCal.id, idx)}
                                                    className={`w-9 h-9 rounded text-xs font-bold border transition-colors ${isWorking ? 'bg-green-50 border-green-400 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-400 hover:border-slate-300'}`}
                                                >
                                                    {days[idx].charAt(0)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-slate-500 text-xs font-bold mb-1">{t('DailyWorkHours')}</label>
                                        <input
                                            type="number"
                                            className="w-24 bg-white border border-slate-300 p-2 rounded text-slate-800 text-sm focus:border-blue-500 focus:outline-none"
                                            value={selectedCal.hoursPerDay}
                                            onChange={e => handleUpdateCalendar(selectedCal.id, { hoursPerDay: Number(e.target.value) })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-slate-500 text-xs font-bold mb-2">{t('ExceptionsOrHolidays')}</label>
                                        <div className="flex gap-2 mb-3 items-end bg-slate-50 p-3 rounded border border-slate-200">
                                            <div>
                                                <label className="block text-[10px] text-slate-500 mb-1">{t('StartDate')}</label>
                                                <input
                                                    type="date"
                                                    className="bg-white border border-slate-300 text-slate-800 p-1.5 rounded text-xs w-32 focus:border-blue-500 focus:outline-none"
                                                    value={holidayStart}
                                                    onChange={e => setHolidayStart(e.target.value)}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] text-slate-500 mb-1">{t('EndDate')} ({t('Optional')})</label>
                                                <input
                                                    type="date"
                                                    className="bg-white border border-slate-300 text-slate-800 p-1.5 rounded text-xs w-32 focus:border-blue-500 focus:outline-none"
                                                    value={holidayEnd}
                                                    onChange={e => setHolidayEnd(e.target.value)}
                                                />
                                            </div>
                                            <button onClick={addHolidayRange} className="bg-slate-600 hover:bg-slate-700 px-3 py-1.5 rounded text-xs text-white shadow-sm transition-colors">{t('AddRange')}</button>
                                        </div>

                                        <div className="max-h-40 overflow-y-auto bg-white border border-slate-200 p-2 rounded shadow-inner">
                                            {selectedCal.exceptions.length === 0 && <div className="text-center text-slate-400 text-xs py-4">{t('NoExceptionsDefined')}</div>}
                                            {selectedCal.exceptions.sort((a, b) => a.date.localeCompare(b.date)).map((ex, i) => (
                                                <div key={i} className="flex justify-between items-center text-xs text-slate-600 py-2 border-b border-slate-100 last:border-0 hover:bg-slate-50 px-2 rounded">
                                                    <span>{ex.date} <span className="text-red-500 font-medium ml-2">({ex.isWorking ? t('IsWorkDay') : t('IsNonWork')})</span></span>
                                                    <button onClick={() => deleteException(ex.date)} className="text-slate-400 hover:text-red-500 transition-colors p-1">
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'Custom Fields' && (
                        <div className="space-y-6">
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                <h4 className="font-bold text-slate-700 mb-3 text-sm">{t('AddCustomField')}</h4>
                                <div className="flex gap-4 items-end">
                                    <div className="flex-grow">
                                        <label className="block text-slate-500 text-xs font-bold mb-1">{t('FieldName')}</label>
                                        <input
                                            className="w-full bg-white border border-slate-300 p-2 rounded text-slate-800 text-sm focus:border-blue-500 focus:outline-none"
                                            value={newField.name || ''}
                                            onChange={e => setNewField({ ...newField, name: e.target.value })}
                                            placeholder="e.g. Budget Code"
                                        />
                                    </div>
                                    <div className="w-40">
                                        <label className="block text-slate-500 text-xs font-bold mb-1">{t('FieldScope')}</label>
                                        <select
                                            className="w-full bg-white border border-slate-300 p-2 rounded text-slate-800 text-sm focus:border-blue-500 focus:outline-none"
                                            value={newField.scope}
                                            onChange={e => setNewField({ ...newField, scope: e.target.value as any })}
                                        >
                                            <option value="activity">{t('ScopeActivity')}</option>
                                            <option value="resource">{t('ScopeResource')}</option>
                                        </select>
                                    </div>
                                    <div className="w-40">
                                        <label className="block text-slate-500 text-xs font-bold mb-1">{t('FieldType')}</label>
                                        <select
                                            className="w-full bg-white border border-slate-300 p-2 rounded text-slate-800 text-sm focus:border-blue-500 focus:outline-none"
                                            value={newField.type}
                                            onChange={e => setNewField({ ...newField, type: e.target.value as any })}
                                        >
                                            <option value="text">{t('TypeString')}</option>
                                            <option value="number">{t('TypeNumber')}</option>
                                            <option value="date">{t('TypeDate')}</option>
                                            <option value="list">List</option>
                                        </select>
                                    </div>
                                    {newField.type === 'list' && (
                                        <div className="flex-grow">
                                            <label className="block text-slate-500 text-xs font-bold mb-1">{t('FieldOptions')}</label>
                                            <input
                                                className="w-full bg-white border border-slate-300 p-2 rounded text-slate-800 text-sm focus:border-blue-500 focus:outline-none"
                                                value={newField.options?.join(',') || ''}
                                                onChange={e => setNewField({ ...newField, options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                                placeholder="Option 1, Option 2"
                                            />
                                        </div>
                                    )}
                                    <button onClick={addCustomField} disabled={!newField.name} className="px-4 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">{t('Add')}</button>
                                </div>
                            </div>

                            <div>
                                <h4 className="font-bold text-slate-700 mb-3 text-sm">{t('CustomFields')}</h4>
                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                                            <tr>
                                                <th className="px-4 py-2">{t('FieldName')}</th>
                                                <th className="px-4 py-2">{t('FieldScope')}</th>
                                                <th className="px-4 py-2">{t('FieldType')}</th>
                                                <th className="px-4 py-2 text-right">{t('Actions')}</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {customFieldDefinitions.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="px-4 py-8 text-center text-slate-400">{t('NoData')}</td>
                                                </tr>
                                            )}
                                            {customFieldDefinitions.map(def => (
                                                <tr key={def.id} className="hover:bg-slate-50">
                                                    <td className="px-4 py-2 font-medium text-slate-700">{def.name}</td>
                                                    <td className="px-4 py-2 text-slate-600 capitalize">{def.scope === 'activity' ? t('ScopeActivity') : t('ScopeResource')}</td>
                                                    <td className="px-4 py-2 text-slate-600 capitalize">{def.type}</td>
                                                    <td className="px-4 py-2 text-right">
                                                        <button onClick={() => deleteCustomField(def.id)} className="text-red-500 hover:text-red-700 font-medium text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors">{t('Delete')}</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <AlertModal isOpen={!!alertMsg} msg={alertMsg || ''} onClose={() => setAlertMsg(null)} />
            </div>
        </BaseModal>
    );
};

export default ProjectSettingsModal;