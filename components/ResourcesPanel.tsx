import React, { useState } from 'react';
import { Resource } from '../types';
import { useTranslation } from '../utils/i18n';
import { useAppStore } from '../stores/useAppStore';
import { useProjectOperations } from '../hooks/useProjectOperations';

import ResourceHistogram from './ResourceHistogram';
import ResourceTable from './ResourceTable';

const ResourcesPanel: React.FC = () => {
    const { 
        data, 
        selIds, 
        setSelIds, 
        userSettings 
    } = useAppStore();

    const { handleResourceUpdate } = useProjectOperations();
    const { t } = useTranslation(userSettings.language);

    const resources = data?.resources || [];

    const [tab, setTab] = useState<'General' | 'Histogram'>('General');
    
    const selResId = selIds.length > 0 ? selIds[selIds.length-1] : null;

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
            <div className="h-10 border-b border-slate-300 bg-slate-100 flex items-center px-2 gap-2 shadow-sm">
                <button onClick={addRes} className="flex items-center gap-1 px-3 py-1 bg-white border border-slate-300 rounded shadow-sm hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition-all">
                    <span className="text-green-600 font-bold text-lg">+</span> <span>{t('AddResource')}</span>
                </button>
                <div className="w-px h-6 bg-slate-300 mx-1"></div>
                <div className="flex gap-1 bg-white border border-slate-300 rounded p-0.5">
                    <button onClick={() => setTab('General')} className={`px-3 py-1 rounded-sm text-sm font-medium transition-colors ${tab==='General'?'bg-blue-100 text-blue-700':'text-slate-600 hover:bg-slate-100'}`}>{t('ResourceSheet')}</button>
                    <button onClick={() => setTab('Histogram')} className={`px-3 py-1 rounded-sm text-sm font-medium transition-colors ${tab==='Histogram'?'bg-blue-100 text-blue-700':'text-slate-600 hover:bg-slate-100'}`}>{t('Histogram')}</button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-grow flex flex-col overflow-hidden relative">
                {tab === 'General' && <ResourceTable />}
                
                {tab === 'Histogram' && (
                    <div className="flex-grow flex flex-col bg-slate-50 p-2 overflow-hidden">
                         {selResId ? (
                             <ResourceHistogram resourceId={selResId} />
                         ) : (
                             <div className="flex-grow flex items-center justify-center text-slate-400 flex-col gap-2">
                                 <svg className="w-16 h-16 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
                                 <span>{t('SelectResourceToViewHistogram')}</span>
                             </div>
                         )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ResourcesPanel;
