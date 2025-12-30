
import React, { useState } from 'react';
import { Resource, Activity } from '../types';
import { BaseModal } from './Modals';

interface BatchAssignModalProps {
    isOpen: boolean;
    onClose: () => void;
    selectedActivityIds: string[];
    resources: Resource[];
    onAssign: (resourceId: string, units: number) => void;
}

const BatchAssignModal: React.FC<BatchAssignModalProps> = ({ isOpen, onClose, selectedActivityIds, resources, onAssign }) => {
    const [selectedResId, setSelectedResId] = useState('');
    const [units, setUnits] = useState(8);

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (selectedResId) {
            onAssign(selectedResId, units);
            onClose();
        }
    };

    return (
        <BaseModal
            isOpen={isOpen}
            title="Batch Assign Resource"
            onClose={onClose}
            className="w-96"
            footer={
                <>
                    <button onClick={onClose} className="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50 text-slate-700">Cancel</button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={!selectedResId}
                        className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white px-3 py-1 rounded"
                    >
                        Assign
                    </button>
                </>
            }
        >
            <div className="space-y-4">
                <p className="text-sm text-slate-500 mb-4">Assigning to {selectedActivityIds.length} selected activities.</p>
                
                <div>
                    <label className="block text-slate-700 text-sm font-medium mb-1">Resource</label>
                    <select 
                        className="w-full bg-white text-slate-700 p-2 rounded border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        value={selectedResId}
                        onChange={(e) => setSelectedResId(e.target.value)}
                    >
                        <option value="">Select Resource...</option>
                        {resources.map(r => (
                            <option key={r.id} value={r.id}>{r.name} ({r.type})</option>
                        ))}
                    </select>
                </div>
                <div>
                        <label className="block text-slate-700 text-sm font-medium mb-1">Units per Day</label>
                        <input 
                        type="number" 
                        className="w-full bg-white text-slate-700 p-2 rounded border border-slate-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                        value={units}
                        onChange={(e) => setUnits(Number(e.target.value))}
                        />
                </div>
            </div>
        </BaseModal>
    );
};

export default BatchAssignModal;
