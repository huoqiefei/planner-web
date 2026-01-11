import React, { useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';

import { ToolbarCustomButton } from '../types';

interface ToolbarProps {
    onNew: () => void;
    onOpen: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSave: () => void;
    onCloudSave?: () => void;
    onPrint: () => void;
    onSettings: () => void;
    onAddResource?: () => void;
}

const Icons = {
    New: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
    Open: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>,
    Save: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>,
    CloudSave: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>,
    Print: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>,
    Settings: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    Link: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
    Critical: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    Undo: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>,
    Redo: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>,
    AddResource: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>,
    RowNumbers: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h10M7 12h10M7 17h10M3 7h.01M3 12h.01M3 17h.01" /></svg>
};

const Toolbar: React.FC<ToolbarProps> = ({
    onNew, onOpen, onSave, onCloudSave, onPrint, onSettings, onAddResource
}) => {
    const {
        data, isDirty, userSettings, setUserSettings,
        showRelations, setShowRelations,
        showCritical, setShowCritical,
        adminConfig
    } = useAppStore();

    const title = data?.meta.title;
    const uiFontPx = userSettings.uiFontPx;
    const customButtons = adminConfig?.customToolbar || [];

    const fileRef = useRef<HTMLInputElement>(null);
    const fontSize = uiFontPx || 13;
    const btnSize = Math.max(30, fontSize * 2.2);
    const iconSize = Math.max(16, fontSize * 1.2);

    const executeCustomAction = (btn: ToolbarCustomButton) => {
        if (btn.action === 'link') {
            window.open(btn.target, '_blank');
        } else if (btn.action === 'script') {
            try {
                // eslint-disable-next-line no-new-func
                new Function(btn.target)();
            } catch (e) {
                console.error("Custom Script Error:", e);
                alert("Script failed: " + e);
            }
        }
    };

    const renderCustomBtn = (btn: ToolbarCustomButton) => (
        <button key={btn.id} onClick={() => executeCustomAction(btn)} style={{ width: btnSize, height: btnSize }} className="flex flex-col items-center justify-center hover:bg-slate-200 rounded text-slate-700" title={btn.tooltip || btn.label}>
            <div style={{ width: iconSize, height: iconSize }}>
                {(Icons as any)[btn.icon as any] || (btn.icon?.startsWith('M') ? <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={btn.icon} /></svg> : <span className="text-xs font-bold">{btn.label?.substring(0, 2) || '?'}</span>)}
            </div>
        </button>
    );

    return (
        <div className="toolbar-container bg-white/80 backdrop-blur-md p-1 border-b border-slate-200 flex items-center gap-1 shadow-sm flex-shrink-0 select-none z-50 relative" style={{ height: `${btnSize + 8}px` }}>
            <button onClick={onNew} style={{ width: btnSize, height: btnSize }} className="flex flex-col items-center justify-center hover:bg-blue-50 hover:text-blue-600 rounded-md text-slate-600 transition-colors" title="New">
                <div style={{ width: iconSize, height: iconSize }}>{Icons.New}</div>
            </button>
            <button onClick={() => fileRef.current?.click()} style={{ width: btnSize, height: btnSize }} className="flex flex-col items-center justify-center hover:bg-slate-200 rounded text-slate-700" title="Open">
                <div style={{ width: iconSize, height: iconSize }}>{Icons.Open}</div>
            </button>
            <input type="file" ref={fileRef} onChange={onOpen} className="hidden" accept=".json" />
            {title && (
                <>
                    <button onClick={onSave} style={{ width: btnSize, height: btnSize }} className="flex flex-col items-center justify-center hover:bg-slate-200 rounded text-slate-700" title="Save JSON">
                        <div style={{ width: iconSize, height: iconSize }}>{Icons.Save}</div>
                    </button>
                    {onCloudSave && import.meta.env.VITE_ENABLE_CLOUD_FEATURES === 'true' && (
                        <button onClick={onCloudSave} style={{ width: btnSize, height: btnSize }} className="flex flex-col items-center justify-center hover:bg-slate-200 rounded text-slate-700" title="Save to Cloud">
                            <div style={{ width: iconSize, height: iconSize }}>{Icons.CloudSave}</div>
                        </button>
                    )}
                    <div className="w-px bg-slate-300 mx-1" style={{ height: btnSize }}></div>



                    {/* Undo / Redo */}
                    <button onClick={() => (useAppStore as any).temporal.getState().undo()} style={{ width: btnSize, height: btnSize }} className="flex flex-col items-center justify-center hover:bg-slate-200 rounded text-slate-700" title="Undo (Ctrl+Z)">
                        <div style={{ width: iconSize, height: iconSize }}>{Icons.Undo}</div>
                    </button>
                    <button onClick={() => (useAppStore as any).temporal.getState().redo()} style={{ width: btnSize, height: btnSize }} className="flex flex-col items-center justify-center hover:bg-slate-200 rounded text-slate-700" title="Redo (Ctrl+Y)">
                        <div style={{ width: iconSize, height: iconSize }}>{Icons.Redo}</div>
                    </button>
                    <div className="w-px bg-slate-300 mx-1" style={{ height: btnSize }}></div>

                    {/* Relations Toggle */}
                    <button onClick={() => setShowRelations(!showRelations)} style={{ width: btnSize, height: btnSize }} className={`flex flex-col items-center justify-center rounded transition-colors ${showRelations ? 'bg-blue-200 text-blue-800' : 'hover:bg-slate-200 text-slate-700'}`} title="Toggle Relationships">
                        <div style={{ width: iconSize, height: iconSize }}>{Icons.Link}</div>
                    </button>

                    {/* Critical Path Toggle */}
                    <button onClick={() => setShowCritical(!showCritical)} style={{ width: btnSize, height: btnSize }} className={`flex flex-col items-center justify-center rounded transition-colors ${showCritical ? 'bg-red-200 text-red-800' : 'hover:bg-slate-200 text-slate-700'}`} title="Show Critical Path">
                        <div style={{ width: iconSize, height: iconSize }}>{Icons.Critical}</div>
                    </button>

                    {/* Row Numbers Toggle */}
                    <button onClick={() => {
                        const show = !(userSettings.gridSettings.showRowNumbers ?? true);
                        setUserSettings(s => ({ ...s, gridSettings: { ...s.gridSettings, showRowNumbers: show } }));
                    }} style={{ width: btnSize, height: btnSize }} className={`flex flex-col items-center justify-center rounded transition-colors ${userSettings.gridSettings.showRowNumbers ?? true ? 'bg-orange-100 text-orange-700' : 'hover:bg-slate-200 text-slate-700'}`} title="Toggle Row Numbers">
                        <div style={{ width: iconSize, height: iconSize }}>{Icons.RowNumbers}</div>
                    </button>

                    {onAddResource && (
                        <>
                            <div className="w-px bg-slate-300 mx-1" style={{ height: btnSize }}></div>
                            <button onClick={onAddResource} style={{ width: btnSize, height: btnSize }} className="flex flex-col items-center justify-center hover:bg-blue-50 hover:text-blue-600 rounded-md text-slate-600 transition-colors" title="Add Resource">
                                <div style={{ width: iconSize, height: iconSize }}>{Icons.AddResource}</div>
                            </button>
                        </>
                    )}

                    <div className="w-px bg-slate-300 mx-1" style={{ height: btnSize }}></div>

                    {/* Custom Buttons Left/Default */}
                    {customButtons.filter(b => b.position !== 'right').map(renderCustomBtn)}
                    {customButtons.filter(b => b.position !== 'right').length > 0 && <div className="w-px bg-slate-300 mx-1" style={{ height: btnSize }}></div>}

                    <button onClick={onSettings} style={{ width: btnSize, height: btnSize }} className="flex flex-col items-center justify-center hover:bg-slate-200 rounded text-slate-700" title="Settings">
                        <div style={{ width: iconSize, height: iconSize }}>{Icons.Settings}</div>
                    </button>
                    <button onClick={onPrint} style={{ width: btnSize, height: btnSize }} className="flex flex-col items-center justify-center hover:bg-slate-200 rounded text-slate-700" title="Print">
                        <div style={{ width: iconSize, height: iconSize }}>{Icons.Print}</div>
                    </button>

                    {/* Custom Buttons Right */}
                    {customButtons.filter(b => b.position === 'right').length > 0 && <div className="w-px bg-slate-300 mx-1" style={{ height: btnSize }}></div>}
                    {customButtons.filter(b => b.position === 'right').map(renderCustomBtn)}
                </>
            )}
        </div>
    );
};

export default Toolbar;
