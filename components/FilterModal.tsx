import React, { useState, useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { BaseModal } from './Modals';
import { useTranslation } from '../utils/i18n';
import { FilterCondition, SavedFilter } from '../types';

interface FilterModalProps {
    isOpen: boolean;
    onClose: () => void;
    lang?: 'en' | 'zh';
}

export const FilterModal: React.FC<FilterModalProps> = ({ isOpen, onClose, lang = 'en' }) => {
    const { t } = useTranslation(lang);
    const { view, data, activityFilters, resourceFilters, setActivityFilters, setResourceFilters, setData } = useAppStore();

    const [filters, setFilters] = useState<FilterCondition[]>([]);

    useEffect(() => {
        if (isOpen) {
            setFilters(view === 'activities' ? [...activityFilters] : [...resourceFilters]);
        }
    }, [isOpen, view, activityFilters, resourceFilters]);

    // Saved Filters Logic
    const [saveName, setSaveName] = useState('');
    const [selectedSavedId, setSelectedSavedId] = useState('');

    const savedFilters = (data?.meta?.savedFilters || []).filter(sf => sf.scope === (view === 'activities' ? 'activity' : 'resource'));

    const handleSaveFilter = () => {
        if (!saveName.trim() || filters.length === 0) return;
        const newSaved: SavedFilter = {
            id: crypto.randomUUID(),
            name: saveName.trim(),
            scope: view === 'activities' ? 'activity' : 'resource',
            conditions: filters
        };
        const currentSaved = data?.meta?.savedFilters || [];
        setData(prev => prev ? {
            ...prev,
            meta: {
                ...prev.meta,
                savedFilters: [...currentSaved, newSaved]
            }
        } : null);
        setSaveName('');
    };

    const handleLoadFilter = (id: string) => {
        const sf = savedFilters.find(f => f.id === id);
        if (sf) {
            setFilters(sf.conditions);
            setSelectedSavedId(id);
        }
    };

    const handleDeleteSaved = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const currentSaved = data?.meta?.savedFilters || [];
        setData(prev => prev ? {
            ...prev,
            meta: {
                ...prev.meta,
                savedFilters: currentSaved.filter(f => f.id !== id)
            }
        } : null);
        if (selectedSavedId === id) setSelectedSavedId('');
    };


    // Define available fields
    const getFields = () => {
        const common = [];
        if (view === 'activities') {
            common.push(
                { id: 'id', name: t('ActivityID'), type: 'text' },
                { id: 'name', name: t('ActivityName'), type: 'text' },
                { id: 'duration', name: t('Duration'), type: 'number' },
                { id: 'startDate', name: t('Start'), type: 'date' }, // Prop name in Activity interface is startDate
                { id: 'endDate', name: t('Finish'), type: 'date' },
                { id: 'totalFloat', name: t('TotalFloat'), type: 'number' }
            );
        } else {
            common.push(
                { id: 'id', name: t('ResourceID'), type: 'text' },
                { id: 'name', name: t('ResourceName'), type: 'text' },
                { id: 'type', name: t('Type'), type: 'list', options: ['Labor', 'Material', 'Equipment'] },
                { id: 'maxUnits', name: t('MaxUnits'), type: 'number' },
                { id: 'unitPrice', name: t('UnitPrice'), type: 'number' }
            );
        }

        // Custom Fields
        const scope = view === 'activities' ? 'activity' : 'resource';
        const cfs = data?.meta?.customFieldDefinitions?.filter(f => f.scope === scope) || [];
        cfs.forEach(cf => {
            common.push({ id: `cf_${cf.id}`, name: cf.name, type: cf.type, options: cf.options });
        });
        return common;
    };

    const fields = getFields();

    const handleAdd = () => {
        const newFilter: FilterCondition = {
            id: crypto.randomUUID(),
            field: fields[0]?.id || 'name',
            operator: 'contains',
            value: ''
        };
        setFilters([...filters, newFilter]);
    };

    const handleRemove = (id: string) => {
        setFilters(filters.filter(f => f.id !== id));
    };

    const handleChange = (id: string, key: keyof FilterCondition, val: any) => {
        setFilters(filters.map(f => {
            if (f.id !== id) return f;
            if (key === 'field') {
                // Reset operator/value if field changes type?
                // For simplicity, just update. Ideally strict type check.
                const fieldDef = fields.find(fd => fd.id === val);
                let defaultOp = 'contains';
                if (fieldDef?.type === 'number' || fieldDef?.type === 'date') defaultOp = 'equals';
                return { ...f, [key]: val, operator: defaultOp as any, value: '' };
            }
            return { ...f, [key]: val };
        }));
    };

    const handleApply = () => {
        if (view === 'activities') {
            setActivityFilters(filters);
        } else {
            setResourceFilters(filters);
        }
        onClose();
    };

    return (
        <BaseModal isOpen={isOpen} onClose={onClose} title={t('Filter')} className="w-[600px]">
            <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
                {filters.length === 0 && (
                    <div className="text-center text-slate-500 py-8">
                        {t('NoFilters')}
                    </div>
                )}

                <div className="bg-slate-50 border rounded p-3 mb-4 space-y-3">
                    <div className="flex gap-2 items-center">
                        <div className="text-sm font-bold text-slate-700 w-24 flex-shrink-0">{t('SavedFilters')}:</div>
                        <div className="flex-grow flex gap-1">
                            <select
                                className="border rounded px-2 py-1 text-sm flex-grow"
                                value={selectedSavedId}
                                onChange={e => { setSelectedSavedId(e.target.value); handleLoadFilter(e.target.value); }}
                            >
                                <option value="">{t('SelectFilter')}...</option>
                                {savedFilters.map(sf => <option key={sf.id} value={sf.id}>{sf.name}</option>)}
                            </select>
                            {selectedSavedId && (
                                <button onClick={(e) => handleDeleteSaved(selectedSavedId, e)} className="text-red-500 hover:text-red-700 px-2" title={t('Delete')}>
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex gap-2 items-center">
                        <div className="text-sm font-bold text-slate-700 w-24 flex-shrink-0">{t('New')}:</div>
                        <input
                            className="border rounded px-2 py-1 text-sm flex-grow"
                            placeholder={t('FilterName')}
                            value={saveName}
                            onChange={e => setSaveName(e.target.value)}
                        />
                        <button
                            onClick={handleSaveFilter}
                            disabled={!saveName || filters.length === 0}
                            className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
                        >
                            {t('Save')}
                        </button>
                    </div>
                </div>

                {filters.map(f => {
                    const fieldDef = fields.find(fd => fd.id === f.field);
                    const type = fieldDef?.type || 'text';

                    return (
                        <div key={f.id} className="flex gap-2 items-center bg-slate-50 p-2 rounded border border-slate-200">
                            <select
                                className="border rounded px-2 py-1 text-sm w-1/3"
                                value={f.field}
                                onChange={e => handleChange(f.id, 'field', e.target.value)}
                            >
                                {fields.map(fd => (
                                    <option key={fd.id} value={fd.id}>{fd.name}</option>
                                ))}
                            </select>

                            <select
                                className="border rounded px-2 py-1 text-sm w-1/4"
                                value={f.operator}
                                onChange={e => handleChange(f.id, 'operator', e.target.value as any)}
                            >
                                {type === 'text' && (
                                    <>
                                        <option value="contains">{t('Contains')}</option>
                                        <option value="equals">{t('Equals')}</option>
                                    </>
                                )}
                                {(type === 'number' || type === 'date') && (
                                    <>
                                        <option value="equals">=</option>
                                        <option value="gt">&gt;</option>
                                        <option value="lt">&lt;</option>
                                        <option value="gte">&ge;</option>
                                        <option value="lte">&le;</option>
                                        <option value="neq">&ne;</option>
                                    </>
                                )}
                                {type === 'list' && (
                                    <>
                                        <option value="equals">{t('Equals')}</option>
                                        <option value="neq">{t('NotEquals')}</option>
                                    </>
                                )}
                            </select>

                            <div className="flex-grow">
                                {type === 'date' ? (
                                    <input
                                        type="date"
                                        className="border rounded px-2 py-1 text-sm w-full"
                                        value={f.value}
                                        onChange={e => handleChange(f.id, 'value', e.target.value)}
                                    />
                                ) : type === 'list' ? (
                                    <select
                                        className="border rounded px-2 py-1 text-sm w-full"
                                        value={f.value}
                                        onChange={e => handleChange(f.id, 'value', e.target.value)}
                                    >
                                        <option value="">{t('Select')}</option>
                                        {fieldDef?.options?.map(opt => (
                                            <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type={type === 'number' ? 'number' : 'text'}
                                        className="border rounded px-2 py-1 text-sm w-full"
                                        value={f.value}
                                        onChange={e => handleChange(f.id, 'value', e.target.value)}
                                        placeholder={t('Value')}
                                    />
                                )}
                            </div>

                            <button onClick={() => handleRemove(f.id)} className="text-red-500 hover:text-red-700 px-2">
                                ✕
                            </button>
                        </div>
                    );
                })}

                <button
                    onClick={handleAdd}
                    className="w-full py-2 border-2 border-dashed border-slate-300 rounded text-slate-500 hover:border-blue-500 hover:text-blue-500 transition-colors"
                >
                    + {t('AddFilter')}
                </button>
            </div>

            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-slate-100">
                <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded">
                    {t('Cancel')}
                </button>
                <button onClick={handleApply} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                    {t('Apply')}
                </button>
            </div>
        </BaseModal>
    );
};
