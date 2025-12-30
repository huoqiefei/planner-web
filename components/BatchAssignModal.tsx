import React, { useState } from 'react';
import { Resource } from '../types';
import { BaseModal } from './Modals';
import { useTranslation } from '../utils/i18n';

interface BatchAssignModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAssign: (resIds: string[], units: number) => void;
    resources: Resource[];
    lang?: 'en' | 'zh';
    selectedCount?: number;
}

export const BatchAssignModal: React.FC<BatchAssignModalProps> = ({ 
    isOpen, 
    onClose, 
    onAssign, 
    resources, 
    lang = 'en',
    selectedCount 
}) => {
    const [selectedResIds, setSelectedResIds] = useState<string[]>([]);
    const [units, setUnits] = useState(8);
    const { t } = useTranslation(lang);

    if (!isOpen) return null;

    const toggleRes = (id: string) => {
        if (selectedResIds.includes(id)) setSelectedResIds(selectedResIds.filter(x => x !== id));
        else setSelectedResIds([...selectedResIds, id]);
    };

    const handleAssign = () => {
        onAssign(selectedResIds, units);
        onClose();
        setSelectedResIds([]);
    };

    return (
        <BaseModal 
            isOpen={isOpen} 
            title={t('BatchAssign')} 
            onClose={onClose} 
            footer={
                <>
                    <button onClick={onClose} className="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50">{t('Cancel')}</button>
                    <button onClick={handleAssign} disabled={selectedResIds.length === 0} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{t('Assign')}</button>
                </>
            }
        >
            <div className="flex flex-col h-64 space-y-4">
                {selectedCount !== undefined && selectedCount > 0 && (
                    <p className="text-sm text-slate-500">
                        {lang === 'zh' ? `正在为 ${selectedCount} 个作业分配资源` : `Assigning to ${selectedCount} selected activities`}
                    </p>
                )}
                
                <div>
                    <label className="block font-bold mb-1 text-slate-700">{t('UnitsPerDay')}</label>
                    <input 
                        type="number" 
                        className="w-full bg-white text-slate-700 p-2 rounded border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        value={units} 
                        onChange={e => setUnits(Number(e.target.value))} 
                    />
                </div>
                
                <div className="flex-grow flex flex-col min-h-0">
                    <div className="font-bold mb-1 border-b text-slate-700">{t('SelectRes')}:</div>
                    <div className="flex-grow overflow-y-auto border bg-slate-50 p-1 rounded">
                        {resources.map(r => (
                            <div key={r.id} className="flex items-center gap-2 p-1 hover:bg-white cursor-pointer rounded" onClick={() => toggleRes(r.id)}>
                                <input type="checkbox" checked={selectedResIds.includes(r.id)} onChange={() => {}} />
                                <span className="flex-grow text-slate-700">{r.name} ({r.type})</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </BaseModal>
    );
};

export default BatchAssignModal;
