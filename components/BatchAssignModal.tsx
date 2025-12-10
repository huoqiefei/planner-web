
import React, { useState } from 'react';
import { Resource, Activity } from '../types';

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
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 w-96 shadow-xl">
                <h3 className="text-lg font-bold text-white mb-2">Batch Assign Resource</h3>
                <p className="text-sm text-gray-400 mb-4">Assigning to {selectedActivityIds.length} selected activities.</p>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-gray-400 text-xs mb-1">Resource</label>
                        <select 
                            className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600"
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
                         <label className="block text-gray-400 text-xs mb-1">Units per Day</label>
                         <input 
                            type="number" 
                            className="w-full bg-gray-700 text-white p-2 rounded border border-gray-600"
                            value={units}
                            onChange={(e) => setUnits(Number(e.target.value))}
                         />
                    </div>
                </div>

                <div className="flex justify-end gap-2 mt-6">
                    <button onClick={onClose} className="px-3 py-1 text-gray-400 hover:text-white">Cancel</button>
                    <button 
                        onClick={handleSubmit} 
                        disabled={!selectedResId}
                        className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white px-4 py-2 rounded"
                    >
                        Assign
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BatchAssignModal;
