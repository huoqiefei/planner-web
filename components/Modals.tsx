
import React, { useState, useEffect } from 'react';
import { UserSettings, PrintSettings, Resource } from '../types';
import { useTranslation } from '../utils/i18n';

interface ModalProps {
    isOpen: boolean;
    title: string;
    onClose: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
}

export const BaseModal: React.FC<ModalProps> = ({ isOpen, title, onClose, children, footer }) => {
    if (!isOpen) return null;
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="bg-white border border-slate-400 shadow-2xl w-96 max-w-[95vw] rounded-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="bg-blue-900 text-white px-3 py-1 text-sm font-bold flex justify-between items-center shadow-sm select-none">
                    <span>{title}</span>
                    <button onClick={onClose} className="hover:text-red-300 font-bold">✕</button>
                </div>
                <div className="p-4 text-xs text-slate-700">{children}</div>
                {footer && (
                    <div className="bg-slate-100 p-2 border-t flex justify-end gap-2">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};

export const AlertModal: React.FC<{ isOpen: boolean, msg: string, onClose: () => void }> = ({ isOpen, msg, onClose }) => (
    <BaseModal isOpen={isOpen} title="System Message" onClose={onClose} footer={
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

export const AboutModal: React.FC<{ isOpen: boolean, onClose: () => void }> = ({ isOpen, onClose }) => (
    <BaseModal isOpen={isOpen} title="About" onClose={onClose} footer={
        <button onClick={onClose} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">Close</button>
    }>
        <div className="text-center p-4">
            <h2 className="text-lg font-bold text-blue-900 mb-2">Planner Web</h2>
            <p className="mb-4">Professional CPM Scheduling Tool</p>
            <p className="font-bold text-slate-500 border-t pt-2">Powered by planner.cn</p>
        </div>
    </BaseModal>
);

export const AdminModal: React.FC<{ isOpen: boolean, onClose: () => void }> = ({ isOpen, onClose }) => {
    const [password, setPassword] = useState('');
    const [auth, setAuth] = useState(false);

    const login = () => {
        if (password === 'admin') setAuth(true); // Simple mock auth
        else alert('Invalid password');
    };

    if (!isOpen) return null;

    if (!auth) {
        return (
            <BaseModal isOpen={isOpen} title="Admin Login" onClose={onClose}>
                <div className="space-y-4">
                    <p>Enter Admin Password:</p>
                    <input type="password" className="border w-full p-2" value={password} onChange={e => setPassword(e.target.value)} />
                    <button onClick={login} className="w-full bg-blue-600 text-white p-2 rounded">Login</button>
                </div>
            </BaseModal>
        );
    }

    return (
        <BaseModal isOpen={isOpen} title="Admin Console" onClose={onClose}>
            <div className="space-y-4">
                <h3 className="font-bold text-lg">System Settings</h3>
                <div className="bg-slate-100 p-2 rounded">
                    <p className="font-bold">Server Status: <span className="text-green-600">Online</span></p>
                    <p>Version: 1.0.0 (Build 20231030)</p>
                </div>
                <button className="w-full border p-2 bg-white hover:bg-slate-50">Manage Users</button>
                <button className="w-full border p-2 bg-white hover:bg-slate-50">View Logs</button>
                <button className="w-full border p-2 bg-red-100 hover:bg-red-200 text-red-700">Reset System Defaults</button>
            </div>
        </BaseModal>
    );
};

export const HelpModal: React.FC<{ isOpen: boolean, onClose: () => void }> = ({ isOpen, onClose }) => {
    if(!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
             <div className="bg-white w-[800px] h-[600px] flex flex-col rounded shadow-2xl overflow-hidden">
                 <div className="bg-blue-900 text-white p-3 font-bold flex justify-between shrink-0">
                     <span>Planner Web - Help & Documentation</span>
                     <button onClick={onClose} className="hover:text-red-300">✕</button>
                 </div>
                 
                 <div className="flex-grow overflow-y-auto p-8 prose prose-sm max-w-none text-slate-700">
                     <h1 className="text-2xl font-bold mb-4 pb-2 border-b">User Operation Manual</h1>
                     
                     <div className="space-y-6">
                         <section>
                             <h3 className="font-bold text-lg text-blue-900">1. Getting Started</h3>
                             <p>Welcome to Planner Web. To begin, click <b>"Create New Project"</b> on the landing page or select <b>"File > New"</b> from the menu. You can also open existing projects (`.json`) using <b>"File > Import"</b>.</p>
                             <ul className="list-disc pl-5 mt-2 space-y-1">
                                 <li>Set project defaults (ID prefix, Start Date) in <b>"Project > Project Information"</b>.</li>
                                 <li>Define standard working days and holidays in the same dialog under the <b>Calendars</b> tab.</li>
                             </ul>
                         </section>

                         <section>
                             <h3 className="font-bold text-lg text-blue-900">2. WBS & Activities</h3>
                             <p>Build your schedule hierarchy in the <b>Activities</b> view.</p>
                             <ul className="list-disc pl-5 mt-2 space-y-1">
                                 <li><b>Add WBS:</b> Right-click on a row to add a Child WBS.</li>
                                 <li><b>Add Activity:</b> Right-click a WBS or Activity to add a new task.</li>
                                 <li><b>Edit:</b> Double-click any cell (Name, Duration, Start Date) to edit directly.</li>
                                 <li><b>Delete:</b> Select a row and press the <b>Delete</b> key or use the right-click menu.</li>
                                 <li><b>Copy/Paste:</b> Use Ctrl+C/Ctrl+V or the Edit menu to duplicate WBS structures or activities.</li>
                             </ul>
                         </section>

                         <section>
                             <h3 className="font-bold text-lg text-blue-900">3. Logic & Scheduling</h3>
                             <p>The system uses the Critical Path Method (CPM) to calculate dates automatically.</p>
                             <ul className="list-disc pl-5 mt-2 space-y-1">
                                 <li><b>Add Links:</b> Type into the "Predecessors" column (e.g., `A100`, `A100SS+5`) or use the <b>Relationships</b> tab in the Details Panel.</li>
                                 <li><b>Schedule:</b> Calculations run instantly upon any change.</li>
                                 <li><b>Critical Path:</b> Toggle the Critical Path icon in the toolbar to highlight critical tasks in red.</li>
                             </ul>
                         </section>

                         <section>
                             <h3 className="font-bold text-lg text-blue-900">4. Resource Management</h3>
                             <p>Manage labor, material, and equipment in the <b>Resources</b> view.</p>
                             <ul className="list-disc pl-5 mt-2 space-y-1">
                                 <li><b>Define:</b> Add resources and set their type and max limits.</li>
                                 <li><b>Assign:</b> In the Activities view, use the Details Panel to assign resources to the selected task.</li>
                                 <li><b>Analyze:</b> Switch to the Resource View histogram to analyze intensity (Max/Period) or consumption (Sum/Period).</li>
                             </ul>
                         </section>

                         <section>
                             <h3 className="font-bold text-lg text-blue-900">5. View & Print</h3>
                             <ul className="list-disc pl-5 mt-2 space-y-1">
                                 <li><b>Zoom:</b> Use the zoom buttons or drag the Gantt chart header to scale the timeline.</li>
                                 <li><b>Columns:</b> Resize column headers in the table.</li>
                                 <li><b>Print:</b> Go to <b>"File > Print Preview"</b> to generate a PDF. Supported formats: A4, A3, A2, A1.</li>
                             </ul>
                         </section>
                     </div>
                 </div>

                 <div className="bg-slate-100 border-t p-4 text-center shrink-0">
                     <p className="text-sm font-bold text-slate-600">Powered by Planner.cn</p>
                     <p className="text-xs text-slate-500 mt-1">
                         Copyright &copy; {new Date().getFullYear()} <a href="http://www.planner.cn" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline font-bold">Planner.cn</a>. All rights reserved.
                     </p>
                 </div>
             </div>
        </div>
    )
}

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

export const PrintSettingsModal: React.FC<{ isOpen: boolean, onClose: () => void, onPrint: (s: PrintSettings) => void, lang?: 'en'|'zh' }> = ({ isOpen, onClose, onPrint, lang='en' }) => {
    const [settings, setSettings] = useState<PrintSettings>({ paperSize: 'a3', orientation: 'landscape' });
    const { t } = useTranslation(lang as 'en' | 'zh');

    return (
        <BaseModal isOpen={isOpen} title={t('PageSetup')} onClose={onClose} footer={
            <>
                <button onClick={onClose} className="px-3 py-1 bg-white border border-slate-300 rounded hover:bg-slate-50">{t('Cancel')}</button>
                <button onClick={() => { onPrint(settings); onClose(); }} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700">{t('PrintPreview')}</button>
            </>
        }>
            <div className="space-y-4">
                <div>
                    <label className="block mb-1 font-bold">{t('PaperSize')}</label>
                    <select className="w-full border p-1" value={settings.paperSize} onChange={e => setSettings({...settings, paperSize: e.target.value as any})}>
                        <option value="a4">A4</option>
                        <option value="a3">A3</option>
                        <option value="a2">A2</option>
                        <option value="a1">A1</option>
                    </select>
                </div>
                <div>
                    <label className="block mb-1 font-bold">{t('Orientation')}</label>
                    <div className="flex gap-4 mt-1">
                        <label className="flex items-center gap-1">
                            <input type="radio" name="orient" checked={settings.orientation === 'landscape'} onChange={() => setSettings({...settings, orientation: 'landscape'})} /> {t('Landscape')}
                        </label>
                        <label className="flex items-center gap-1">
                            <input type="radio" name="orient" checked={settings.orientation === 'portrait'} onChange={() => setSettings({...settings, orientation: 'portrait'})} /> {t('Portrait')}
                        </label>
                    </div>
                </div>
                <div className="text-[10px] text-slate-500 mt-2 bg-yellow-50 p-2 border border-yellow-200">
                    {t('PrintNote')}
                </div>
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
