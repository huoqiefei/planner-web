
import React, { useState, useEffect } from 'react';
import { UserSettings, PrintSettings, Resource, AdminConfig } from '../types';
import { useTranslation } from '../utils/i18n';
import AdminDashboard from './AdminDashboard';

interface ModalProps {
    isOpen: boolean;
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
    className?: string;
}

export const BaseModal: React.FC<ModalProps> = ({ isOpen, title, onClose, children, footer, className }) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-[100]" onClick={onClose}>
            <div className={`bg-white shadow-2xl rounded-lg overflow-hidden border border-slate-100 transform transition-all ${className || 'w-96 max-w-[95vw]'}`} onClick={e => e.stopPropagation()}>
                <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center select-none bg-white">
                    <span className="font-semibold text-slate-800 text-lg">{title}</span>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-full hover:bg-slate-100">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
                    </button>
                </div>
                <div className="p-6 text-sm text-slate-600 leading-relaxed max-h-[70vh] overflow-y-auto">{children}</div>
                {footer && (
                    <div className="bg-slate-50 px-5 py-3 border-t border-slate-100 flex justify-end gap-3">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

// Simple Markdown Parser to avoid heavy dependencies
const SimpleMarkdown: React.FC<{ content: string }> = ({ content }) => {
    if (!content) return <div>Loading...</div>;
    
    const lines = content.split('\n');
    return (
        <div className="space-y-2 text-slate-700">
            {lines.map((line, idx) => {
                const l = line.trim();
                if (l.startsWith('# ')) return <h1 key={idx} className="text-xl font-bold text-blue-900 border-b pb-1 mt-4">{l.substring(2)}</h1>;
                if (l.startsWith('## ')) return <h2 key={idx} className="text-lg font-bold text-slate-800 mt-3">{l.substring(3)}</h2>;
                if (l.startsWith('### ')) return <h3 key={idx} className="text-md font-bold text-slate-700 mt-2">{l.substring(4)}</h3>;
                if (l.startsWith('- ')) return <li key={idx} className="ml-4 list-disc">{parseInline(l.substring(2))}</li>;
                if (l === '') return <div key={idx} className="h-2"></div>;
                return <p key={idx}>{parseInline(l)}</p>;
            })}
        </div>
    );
};

const parseInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`|\[.*?\]\(.*?\))/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
        if (part.startsWith('`') && part.endsWith('`')) return <code key={i} className="bg-slate-100 px-1 rounded text-red-500">{part.slice(1, -1)}</code>;
        if (part.startsWith('[') && part.includes('](')) {
            const [label, url] = part.split('](');
            return <a key={i} href={url.slice(0, -1)} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">{label.slice(1)}</a>;
        }
        return part;
    });
};

export const AlertModal: React.FC<{ isOpen: boolean, msg: string, onClose: () => void, title?: string }> = ({ isOpen, msg, onClose, title }) => (
    <BaseModal isOpen={isOpen} title={title || "System Message"} onClose={onClose} footer={
        <button onClick={onClose} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">OK</button>
    }>
        <div className="flex items-center gap-3">
            <div className="text-yellow-600 text-2xl">⚠</div>
            <div>{msg}</div>
        </div>
    </BaseModal>
);

export const ConfirmModal: React.FC<{ isOpen: boolean, msg: string, onConfirm: () => void, onCancel: () => void, lang?: 'en' | 'zh' }> = ({ isOpen, msg, onConfirm, onCancel, lang = 'en' }) => {
    const { t } = useTranslation(lang as 'en' | 'zh');
    return (
        <BaseModal isOpen={isOpen} title={t('Confirm')} onClose={onCancel} footer={
            <>
                <button onClick={onCancel} className="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50">{t('Cancel')}</button>
                <button onClick={onConfirm} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">{t('Confirm')}</button>
            </>
        }>
            <div className="flex items-center gap-3">
                <div className="text-blue-600 text-2xl">?</div>
                <div>{msg}</div>
            </div>
        </BaseModal>
    );
};

const DEFAULT_ABOUT = `# About Planner Web

**Version:** 1.0.0

**Planner Web** is a professional, web-based project management and scheduling tool inspired by industry standards like Primavera P6.

### Key Features:
- Critical Path Method (CPM) Scheduling
- Dynamic Gantt Chart
- WBS (Work Breakdown Structure) Management
- Resource Analysis (Histogram & Consumption)
- PDF Export & Printing

### Powered By
This application is powered by **[Planner.cn](http://www.planner.cn)**.

*Copyright © 2023 Planner.cn. All rights reserved.*`;

export const AboutModal: React.FC<{ isOpen: boolean, onClose: () => void, customCopyright?: string }> = ({ isOpen, onClose, customCopyright }) => {
    return (
        <BaseModal isOpen={isOpen} title="About" onClose={onClose} footer={
            <div className="w-full flex justify-between items-center">
                 <span className="text-[10px] text-slate-400">{customCopyright || 'Powered by Planner.cn'}</span>
                 <button onClick={onClose} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Close</button>
            </div>
        }>
            <div className="max-h-[60vh] overflow-y-auto">
                 <SimpleMarkdown content={DEFAULT_ABOUT} />
            </div>
        </BaseModal>
    );
};

export const AdminModal: React.FC<{ isOpen: boolean, onClose: () => void, onSave: (c: AdminConfig) => void, adminConfig: AdminConfig }> = ({ isOpen, onClose, onSave, adminConfig }) => {
    return <AdminDashboard isOpen={isOpen} onClose={onClose} onSave={onSave} adminConfig={adminConfig} />; 
};

const DEFAULT_MANUAL = `# Planner Web - User Operation Manual

## 1. Getting Started
- Click **"Create New Project"** or **"File > New"**.
- Open projects via **"File > Import"**.

## 2. WBS & Activities
- **Right-click** to add WBS/Activities.
- **Double-click** cells to edit.
- **Delete** key to remove items.

## 3. Logic (CPM)
- Enter predecessors (e.g., A100FS+5).
- Use **Relationships** tab in details.

## 4. Resources
- Define resources in **Resources** view.
- Assign in **Details > Resources**.

## 5. Printing
- **File > Print Preview**.
- Select columns and paper size.
- Auto-scales Gantt to fit.
`;

export const HelpModal: React.FC<{ isOpen: boolean, onClose: () => void }> = ({ isOpen, onClose }) => {
    const [content, setContent] = useState(DEFAULT_MANUAL);

    // We keep this hook in case we want to support external manual loading in the future,
    // but default to the constant first to prevent flash of empty content or errors.
    useEffect(() => {
        if (isOpen) {
            fetch('manual.md')
                .then(res => {
                    if(!res.ok) throw new Error("File not found");
                    return res.text();
                })
                .then(text => setContent(text))
                .catch(() => {}); // Fallback silently to default
        }
    }, [isOpen]);

    return (
        <BaseModal 
            isOpen={isOpen} 
            title="Planner Web - Help & Documentation" 
            onClose={onClose}
            className="w-[800px] h-[600px] flex flex-col"
            footer={
                <div className="w-full text-center">
                    <p className="text-xs text-slate-500">
                        Copyright &copy; {new Date().getFullYear()} <a href="http://www.planner.cn" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-bold">Planner.cn</a>. All rights reserved.
                    </p>
                </div>
            }
        >
             <div className="flex-grow">
                 <SimpleMarkdown content={content} />
             </div>
        </BaseModal>
    )
}

export const ColumnSetupModal: React.FC<{ isOpen: boolean, onClose: () => void, visibleColumns: string[], onSave: (cols: string[]) => void, lang?: 'en'|'zh' }> = ({ isOpen, onClose, visibleColumns, onSave, lang='en' }) => {
    const [selected, setSelected] = useState<string[]>([]);
    const { t } = useTranslation(lang as 'en' | 'zh');

    useEffect(() => {
        if(isOpen) setSelected(visibleColumns);
    }, [isOpen, visibleColumns]);

    const allCols = [
        { id: 'id', label: 'Activity ID' },
        { id: 'name', label: 'Activity Name' },
        { id: 'duration', label: 'Duration' },
        { id: 'start', label: 'Start Date' },
        { id: 'finish', label: 'Finish Date' },
        { id: 'float', label: 'Total Float' },
        { id: 'preds', label: 'Predecessors' },
        { id: 'budget', label: 'Budget Cost' }
    ];

    const available = allCols.filter(c => !selected.includes(c.id));
    const visible = selected.map(id => allCols.find(c => c.id === id)).filter(c => c !== undefined) as typeof allCols;

    const addToVisible = (id: string) => setSelected([...selected, id]);
    const removeFromVisible = (id: string) => setSelected(selected.filter(x => x !== id));
    
    // Simple drag and drop replacement with click
    const moveUp = (idx: number) => {
        if(idx === 0) return;
        const newSel = [...selected];
        [newSel[idx-1], newSel[idx]] = [newSel[idx], newSel[idx-1]];
        setSelected(newSel);
    }

    if(!isOpen) return null;

    return (
        <BaseModal isOpen={isOpen} title={t('ColumnsSetup')} onClose={onClose} footer={
            <>
                <button onClick={onClose} className="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50">{t('Cancel')}</button>
                <button onClick={() => { onSave(selected); onClose(); }} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">{t('Save')}</button>
            </>
        }>
            <div className="flex gap-4 h-64">
                <div className="flex-1 flex flex-col">
                    <div className="font-bold mb-1 border-b text-slate-600">{t('AvailableCols')}</div>
                    <div className="flex-grow border bg-slate-50 overflow-y-auto p-1">
                        {available.map(c => (
                            <div key={c.id} className="p-1 hover:bg-blue-100 cursor-pointer text-slate-700" onClick={() => addToVisible(c.id)}>
                                {c.label}
                            </div>
                        ))}
                    </div>
                </div>
                <div className="flex flex-col justify-center gap-2">
                     <span className="text-slate-400">⇨</span>
                </div>
                <div className="flex-1 flex flex-col">
                    <div className="font-bold mb-1 border-b text-slate-600">{t('VisibleCols')}</div>
                    <div className="flex-grow border bg-white overflow-y-auto p-1">
                        {visible.map((c, i) => (
                            <div key={c.id} className="p-1 hover:bg-blue-100 cursor-pointer flex justify-between group" onClick={() => removeFromVisible(c.id)}>
                                <span>{c.label}</span>
                                <div className="hidden group-hover:flex gap-1" onClick={e=>e.stopPropagation()}>
                                    <button onClick={()=>moveUp(i)} className="text-[10px] bg-slate-200 px-1 rounded">▲</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </BaseModal>
    );
};

export const UserSettingsModal: React.FC<{ isOpen: boolean, onClose: () => void, settings: UserSettings, onSave: (s: UserSettings) => void }> = ({ isOpen, onClose, settings, onSave }) => {
    const [local, setLocal] = useState(settings);
    const { t } = useTranslation(settings.language);
    
    useEffect(() => {
        setLocal(settings);
    }, [settings, isOpen]);

    const handleSave = () => {
        onSave(local);
        onClose();
    };

    return (
        <BaseModal isOpen={isOpen} title={t('UserPreferences')} onClose={onClose} footer={
            <>
                <button onClick={onClose} className="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50">{t('Cancel')}</button>
                <button onClick={handleSave} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">{t('Save')}</button>
            </>
        }>
            <div className="space-y-4">
                <div>
                    <h4 className="font-bold border-b mb-2 pb-1">{t('General')}</h4>
                    <div className="space-y-2">
                        <div>
                            <label className="block mb-1">{t('DateFormat')}</label>
                            <select className="w-full border p-1" value={local.dateFormat} onChange={e => setLocal({...local, dateFormat: e.target.value as any})}>
                                <option value="YYYY-MM-DD">YYYY-MM-DD (2023-10-30)</option>
                                <option value="DD-MMM-YYYY">DD-MMM-YYYY (30-Oct-2023)</option>
                                <option value="MM/DD/YYYY">MM/DD/YYYY (10/30/2023)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block mb-1">{t('Language')}</label>
                            <select className="w-full border p-1" value={local.language} onChange={e => setLocal({...local, language: e.target.value as any})}>
                                <option value="en">English</option>
                                <option value="zh">Chinese (Simplified)</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block mb-1">{t('InterfaceSize')}</label>
                                <select className="w-full border p-1" value={local.uiSize} onChange={e => setLocal({...local, uiSize: e.target.value as any})}>
                                    <option value="small">{t('Small')}</option>
                                    <option value="medium">{t('Medium')}</option>
                                    <option value="large">{t('Large')}</option>
                                </select>
                            </div>
                            <div>
                                <label className="block mb-1">{t('CustomFontSize')}</label>
                                <input 
                                    type="number" 
                                    className="w-full border p-1" 
                                    value={local.uiFontPx || 13} 
                                    onChange={e => setLocal({...local, uiFontPx: Number(e.target.value)})} 
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div>
                    <h4 className="font-bold border-b mb-2 pb-1">{t('GanttSettings')}</h4>
                    <div className="space-y-2">
                         <div>
                             <label className="block mb-1 font-bold">{t('VerticalInterval')}</label>
                             <select 
                                 className="w-full border p-1"
                                 value={local.gridSettings.verticalInterval || 'auto'}
                                 onChange={e => setLocal({...local, gridSettings: {...local.gridSettings, verticalInterval: e.target.value as any}})}
                             >
                                 <option value="auto">{t('Auto')}</option>
                                 <option value="month">{t('EveryMonth')}</option>
                                 <option value="quarter">{t('EveryQuarter')}</option>
                                 <option value="year">{t('EveryYear')}</option>
                             </select>
                         </div>

                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={local.gridSettings.showVertical} onChange={e => setLocal({...local, gridSettings: {...local.gridSettings, showVertical: e.target.checked}})} />
                            {t('ShowVertical')}
                        </label>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={local.gridSettings.showHorizontal} onChange={e => setLocal({...local, gridSettings: {...local.gridSettings, showHorizontal: e.target.checked}})} />
                            {t('ShowHorizontal')}
                        </label>
                         <label className="flex items-center gap-2">
                            <input type="checkbox" checked={local.gridSettings.showWBSLines} onChange={e => setLocal({...local, gridSettings: {...local.gridSettings, showWBSLines: e.target.checked}})} />
                            {t('ShowWBS')}
                        </label>
                    </div>
                </div>
            </div>
        </BaseModal>
    );
};

export const PrintSettingsModal: React.FC<{ isOpen: boolean, onClose: () => void, onPrint: (s: PrintSettings) => void, onSystemPrint: () => void, lang?: 'en'|'zh' }> = ({ isOpen, onClose, onPrint, onSystemPrint, lang='en' }) => {
    const [settings, setSettings] = useState<PrintSettings>({ 
        paperSize: 'a3', 
        orientation: 'landscape',
        scalingMode: 'fit',
        scalePercent: 100,
        headerText: '',
        footerText: '',
        showPageNumber: true,
        showDate: true
    });
    const { t } = useTranslation(lang as 'en' | 'zh');

    return (
        <BaseModal isOpen={isOpen} title={t('PageSetup')} onClose={onClose} footer={
            <>
                <button onClick={onSystemPrint} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 mr-auto">{t('SystemPrint') || 'Browser Print'}</button>
                <button onClick={onClose} className="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50">{t('Cancel')}</button>
                <button onClick={() => { onPrint(settings); onClose(); }} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">{t('ExportPDF') || 'Export PDF'}</button>
            </>
        }>
            <div className="space-y-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block mb-1 font-bold">{t('PaperSize')}</label>
                        <select className="w-full border p-1 rounded" value={settings.paperSize} onChange={e => setSettings({...settings, paperSize: e.target.value as any})}>
                            <option value="a4">A4</option>
                            <option value="a3">A3</option>
                            <option value="a2">A2</option>
                            <option value="a1">A1</option>
                        </select>
                    </div>
                    <div>
                        <label className="block mb-1 font-bold">{t('Orientation')}</label>
                        <select className="w-full border p-1 rounded" value={settings.orientation} onChange={e => setSettings({...settings, orientation: e.target.value as any})}>
                            <option value="landscape">{t('Landscape')}</option>
                            <option value="portrait">{t('Portrait')}</option>
                        </select>
                    </div>
                </div>

                <div className="border-t pt-2">
                    <label className="block mb-1 font-bold">{t('HeaderFooter')}</label>
                    <div className="space-y-2">
                        <input 
                            type="text" 
                            placeholder={t('HeaderText') as string}
                            className="w-full border p-1 rounded"
                            value={settings.headerText || ''}
                            onChange={e => setSettings({...settings, headerText: e.target.value})}
                        />
                        <input 
                            type="text" 
                            placeholder={t('FooterText') as string}
                            className="w-full border p-1 rounded"
                            value={settings.footerText || ''}
                            onChange={e => setSettings({...settings, footerText: e.target.value})}
                        />
                        <div className="flex gap-4 pt-1">
                            <label className="flex items-center gap-2">
                                <input type="checkbox" checked={settings.showPageNumber} onChange={e => setSettings({...settings, showPageNumber: e.target.checked})} />
                                {t('ShowPageNumbers')}
                            </label>
                            <label className="flex items-center gap-2">
                            <input type="checkbox" checked={settings.showDate} onChange={e => setSettings({...settings, showDate: e.target.checked})} />
                            {t('ShowDate')}
                        </label>
                    </div>
                </div>

                <div className="border-t pt-2">
                    <label className="block mb-1 font-bold">{t('TimeRange')}</label>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">{t('StartDate')}</label>
                            <input type="date" className="w-full border p-1 rounded" value={settings.startDate || ''} onChange={e => setSettings({...settings, startDate: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs text-slate-500 mb-1">{t('EndDate')}</label>
                            <input type="date" className="w-full border p-1 rounded" value={settings.endDate || ''} onChange={e => setSettings({...settings, endDate: e.target.value})} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="border-t pt-2">
                <label className="block mb-1 font-bold">{t('Scaling')}</label>
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2">
                            <input type="radio" name="scale" checked={settings.scalingMode === 'fit'} onChange={() => setSettings({...settings, scalingMode: 'fit'})} />
                            {t('FitToWidth')}
                        </label>
                        <label className="flex items-center gap-2">
                            <input type="radio" name="scale" checked={settings.scalingMode === 'custom'} onChange={() => setSettings({...settings, scalingMode: 'custom'})} />
                            {t('CustomPercent')}
                        </label>
                    </div>
                    {settings.scalingMode === 'custom' && (
                         <div className="mt-1 flex items-center gap-2">
                            <input type="number" className="border w-20 p-1" value={settings.scalePercent} onChange={e => setSettings({...settings, scalePercent: parseInt(e.target.value)||100})} />
                            <span>%</span>
                         </div>
                    )}
                </div>
                <p className="text-xs text-slate-500 italic mt-2">{t('PrintNote')}</p>
            </div>
        </BaseModal>
    );
};

export const BatchAssignModal: React.FC<{ isOpen: boolean, onClose: () => void, onAssign: (resIds: string[], units: number) => void, resources: Resource[], lang?: 'en'|'zh' }> = ({ isOpen, onClose, onAssign, resources, lang='en' }) => {
    const [selectedResIds, setSelectedResIds] = useState<string[]>([]);
    const [units, setUnits] = useState(8);
    const { t } = useTranslation(lang as 'en' | 'zh');

    if (!isOpen) return null;

    const toggleRes = (id: string) => {
        if(selectedResIds.includes(id)) setSelectedResIds(selectedResIds.filter(x => x !== id));
        else setSelectedResIds([...selectedResIds, id]);
    };

    const handleAssign = () => {
        onAssign(selectedResIds, units);
        onClose();
        setSelectedResIds([]);
    };

    return (
        <BaseModal isOpen={isOpen} title={t('BatchAssign')} onClose={onClose} footer={
            <>
                <button onClick={onClose} className="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50">{t('Cancel')}</button>
                <button onClick={handleAssign} disabled={selectedResIds.length === 0} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{t('Assign')}</button>
            </>
        }>
            <div className="flex flex-col h-64">
                <div className="mb-2">
                    <label className="block font-bold mb-1">{t('UnitsPerDay')}</label>
                    <input type="number" className="border w-full p-1" value={units} onChange={e => setUnits(Number(e.target.value))} />
                </div>
                <div className="font-bold mb-1 border-b">{t('SelectRes')}:</div>
                <div className="flex-grow overflow-y-auto border bg-slate-50 p-1">
                    {resources.map(r => (
                        <div key={r.id} className="flex items-center gap-2 p-1 hover:bg-white cursor-pointer" onClick={() => toggleRes(r.id)}>
                            <input type="checkbox" checked={selectedResIds.includes(r.id)} onChange={() => {}} />
                            <span className="flex-grow">{r.name} ({r.type})</span>
                        </div>
                    ))}
                </div>
            </div>
        </BaseModal>
    );
};
