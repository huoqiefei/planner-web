import React, { useState } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { useProjectOperations } from '../hooks/useProjectOperations';
import { useTranslation } from '../utils/i18n';
import ResourceHistogram from './ResourceHistogram';
import { Resource } from '../types';

export const ResourceDetails: React.FC = () => {
    const {
        data,
        selIds,
        userSettings,
        showDetails,
        setShowDetails
    } = useAppStore();

    const { handleResourceUpdate } = useProjectOperations();
    const { t } = useTranslation(userSettings.language);

    const [tab, setTab] = useState<'General' | 'Histogram'>('General');
    const [editVal, setEditVal] = useState<string>('');
    const [height, setHeight] = useState(350);
    const [isDragging, setIsDragging] = useState(false);

    const resources = data?.resources || [];
    const resource = selIds.length === 1 ? resources.find(r => r.id === selIds[0]) : undefined;

    const fontSizePx = userSettings.uiFontPx || 13;

    // Resizing Logic
    const startDrag = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        const startY = e.clientY;
        const startHeight = height;

        const onMouseMove = (moveEvent: MouseEvent) => {
            const deltaY = startY - moveEvent.clientY; // Drag up increases height
            const newHeight = Math.min(Math.max(startHeight + deltaY, 200), 800);
            setHeight(newHeight);
        };

        const onMouseUp = () => {
            setIsDragging(false);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    if (!showDetails) {
        return (
            <div className="h-8 border-t border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-700 flex items-center justify-between px-2 flex-shrink-0 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors" onClick={() => setShowDetails(true)}>
                <span className="font-bold text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider">{t('ResourceDetails')}</span>
                <button className="text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" /></svg>
                </button>
            </div>
        );
    }

    if (!resource) {
        return (
            <div className="h-64 border-t border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 flex flex-col" style={{ fontSize: `${fontSizePx}px` }}>
                <div className="bg-slate-200 dark:bg-slate-700 border-b border-slate-300 dark:border-slate-600 px-1 pt-1 h-8 flex justify-between items-center">
                    <div className="flex gap-1 h-full items-end">
                        <button className="px-4 py-1 uppercase font-bold border-t border-l border-r rounded-t-sm bg-white dark:bg-slate-800 text-black dark:text-slate-200 border-b-white dark:border-b-slate-800 -mb-px border-slate-300 dark:border-slate-600">{t('General')}</button>
                    </div>
                    <button onClick={() => setShowDetails(false)} className="mr-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                </div>
                <div className="flex-grow flex items-center justify-center text-slate-400 dark:text-slate-500">
                    {t('NoResourceSelected')}
                </div>
            </div>
        );
    }

    const updateRes = (field: keyof Resource, val: any) => {
        handleResourceUpdate(resources.map(r => r.id === resource.id ? { ...r, [field]: val } : r));
    };

    return (
        <div className="bg-white dark:bg-slate-800 flex flex-col flex-shrink-0 shadow-[0_-2px_5px_rgba(0,0,0,0.05)] relative" style={{ height, fontSize: `${fontSizePx}px` }}>
            {/* Drag Handle */}
            <div
                className="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize bg-slate-300 dark:bg-slate-600 hover:bg-blue-400 transition-colors z-20"
                onMouseDown={startDrag}
            />
            {/* Header Tabs */}
            <div className="flex bg-slate-100 dark:bg-slate-700 border-b border-slate-300 dark:border-slate-600 px-1 pt-2.5 gap-1 select-none h-10 items-end justify-between">
                <div className="flex gap-1 h-full items-end">
                    <button onClick={() => setTab('General')} className={`px-4 py-1 uppercase font-bold border-t border-l border-r rounded-t-sm outline-none ${tab === 'General' ? 'bg-white dark:bg-slate-800 text-black dark:text-slate-200 border-b-white dark:border-b-slate-800 -mb-px border-slate-300 dark:border-slate-600' : 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 border-b-slate-300 dark:border-b-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 border-slate-300 dark:border-slate-600'}`}>{t('General')}</button>
                    <button onClick={() => setTab('Histogram')} className={`px-4 py-1 uppercase font-bold border-t border-l border-r rounded-t-sm outline-none ${tab === 'Histogram' ? 'bg-white dark:bg-slate-800 text-black dark:text-slate-200 border-b-white dark:border-b-slate-800 -mb-px border-slate-300 dark:border-slate-600' : 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 border-b-slate-300 dark:border-b-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 border-slate-300 dark:border-slate-600'}`}>{t('Histogram')}</button>
                </div>
                <button onClick={() => setShowDetails(false)} className="mr-2 mb-1 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400" title={t('Collapse')}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
            </div>

            {/* Content */}
            <div className="flex-grow overflow-auto p-4">
                {tab === 'General' && (
                    <div className="max-w-4xl grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <div>
                                <label className="block text-slate-500 dark:text-slate-400 mb-0.5 font-semibold">{t('ResourceID')}</label>
                                <input disabled value={resource.id} className="w-full border border-slate-300 dark:border-slate-600 px-1 py-1 bg-slate-50 dark:bg-slate-700 text-slate-500 dark:text-slate-400" />
                            </div>
                            <div>
                                <label className="block text-slate-500 dark:text-slate-400 mb-0.5 font-semibold">{t('ResourceName')}</label>
                                <input value={resource.name} onChange={e => updateRes('name', e.target.value)} className="w-full border border-slate-300 dark:border-slate-600 px-1 py-1 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div>
                                <label className="block text-slate-500 dark:text-slate-400 mb-0.5 font-semibold">{t('Type')}</label>
                                <select value={resource.type} onChange={e => updateRes('type', e.target.value)} className="w-full border border-slate-300 dark:border-slate-600 px-1 py-1 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100">
                                    <option value="Labor">{t('Labor')}</option>
                                    <option value="Material">{t('Material')}</option>
                                    <option value="Equipment">{t('Equipment')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-slate-500 dark:text-slate-400 mb-0.5 font-semibold">{t('Unit')}</label>
                                <input value={resource.unit} onChange={e => updateRes('unit', e.target.value)} className="w-full border border-slate-300 dark:border-slate-600 px-1 py-1 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div>
                                <label className="block text-slate-500 dark:text-slate-400 mb-0.5 font-semibold">{t('MaxUnits')}</label>
                                <input type="number" value={resource.maxUnits} onChange={e => updateRes('maxUnits', Number(e.target.value))} className="w-full border border-slate-300 dark:border-slate-600 px-1 py-1 text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
                            </div>
                            <div>
                                <label className="block text-slate-500 dark:text-slate-400 mb-0.5 font-semibold">{t('UnitPrice')}</label>
                                <input type="number" value={resource.unitPrice} onChange={e => updateRes('unitPrice', Number(e.target.value))} className="w-full border border-slate-300 dark:border-slate-600 px-1 py-1 text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100" />
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'Histogram' && (
                    <div className="h-full w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 p-2">
                        <ResourceHistogram resourceId={resource.id} />
                    </div>
                )}
            </div>
        </div>
    );
};
