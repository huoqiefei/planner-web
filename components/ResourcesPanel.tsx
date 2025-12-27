import React, { useState } from 'react';
import { Resource } from '../types';
import { useTranslation } from '../utils/i18n';
import { useAppStore } from '../stores/useAppStore';
import { useProjectOperations } from '../hooks/useProjectOperations';

import ResourceTable from './ResourceTable';
import { ResourceDetails } from './ResourceDetails';

const ResourcesPanel: React.FC = () => {
    const { 
        data, 
        setSelIds, 
        userSettings 
    } = useAppStore();

    const { handleResourceUpdate } = useProjectOperations();
    const { t } = useTranslation(userSettings.language);

    const resources = data?.resources || [];

    const generateResId = () => {
        const max = resources.reduce((m, r) => {
            const match = r.id.match(/(\d+)/);
            return match ? Math.max(m, parseInt(match[1])) : m;
        }, 1000);
        return `R${max + 10}`;
    };

    const addRes = () => {
        const newRes: Resource = { id: generateResId(), name: t('NewResource'), type: 'Labor', unit: 'h', maxUnits: 8 };
        handleResourceUpdate([...resources, newRes]);
        setSelIds([newRes.id]);
    };

    return (
        <div className="flex-grow flex flex-col h-full bg-white select-none">
            {/* Toolbar */}
            <div className="h-10 border-b border-slate-300 bg-slate-100 flex items-center px-2 gap-2 shadow-sm flex-shrink-0">
                <button onClick={addRes} className="flex items-center gap-1 px-3 py-1 bg-white border border-slate-300 rounded shadow-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-all">
                    <span className="text-green-600 font-bold text-lg">+</span> <span>{t('AddResource')}</span>
                </button>
            </div>

            {/* Content: Split View */}
            <div className="flex-grow flex flex-col overflow-hidden relative">
                {/* Top: Resource Table */}
                <div className="flex-grow overflow-hidden flex flex-col">
                    <ResourceTable />
                </div>
                
                {/* Bottom: Details Panel */}
                <ResourceDetails />
            </div>
        </div>
    );
};

export default ResourcesPanel;
