
import React, { useRef } from 'react';
import { User } from '../types';

interface ToolbarProps {
    onNew: () => void;
    onOpen: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSave: () => void;
    onCloudSave?: () => void;
    onPrint: () => void;
    onSettings: () => void;
    title?: string;
    isDirty: boolean;
    uiFontPx?: number;
    showRelations?: boolean;
    onToggleRelations?: () => void;
    showCritical?: boolean;
    onToggleCritical?: () => void;
    user?: User | null;
}

const Icons = {
    New: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"/></svg>,
    Open: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"/></svg>,
    Save: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"/></svg>,
    CloudSave: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>,
    Print: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>,
    Settings: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
    Link: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>,
    Critical: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
};

const Toolbar: React.FC<ToolbarProps> = ({ 
    onNew, onOpen, onSave, onCloudSave, onPrint, onSettings, title, isDirty, uiFontPx,
    showRelations, onToggleRelations, showCritical, onToggleCritical, user
}) => {
    const fileRef = useRef<HTMLInputElement>(null);
    const fontSize = uiFontPx || 13;
    const btnSize = Math.max(30, fontSize * 2.2); 
    const iconSize = Math.max(16, fontSize * 1.2); 
    
    const isViewer = user?.group === 'viewer';

    return (
        <div className="bg-slate-100 p-1 border-b border-slate-300 flex items-center gap-1 shadow-sm flex-shrink-0 select-none" style={{ height: `${btnSize + 8}px` }}>
            {!isViewer && (
                <button onClick={onNew} style={{ width: btnSize, height: btnSize }} className="flex flex-col items-center justify-center hover:bg-slate-200 rounded text-slate-700" title="New">
                    <div style={{ width: iconSize, height: iconSize }}>{Icons.New}</div>
                </button>
            )}
            <button onClick={() => fileRef.current?.click()} style={{ width: btnSize, height: btnSize }} className="flex flex-col items-center justify-center hover:bg-slate-200 rounded text-slate-700" title="Open">
                <div style={{ width: iconSize, height: iconSize }}>{Icons.Open}</div>
            </button>
            <input type="file" ref={fileRef} onChange={onOpen} className="hidden" accept=".json" />
            {title && (
                <>
                    {!isViewer && (
                        <>
                            <button onClick={onSave} style={{ width: btnSize, height: btnSize }} className="flex flex-col items-center justify-center hover:bg-slate-200 rounded text-slate-700" title="Save JSON">
                                <div style={{ width: iconSize, height: iconSize }}>{Icons.Save}</div>
                            </button>
                            {onCloudSave && (
                                <button onClick={onCloudSave} style={{ width: btnSize, height: btnSize }} className="flex flex-col items-center justify-center hover:bg-slate-200 rounded text-slate-700" title="Save to Cloud">
                                    <div style={{ width: iconSize, height: iconSize }}>{Icons.CloudSave}</div>
                                </button>
                            )}
                        </>
                    )}
                    <div className="w-px bg-slate-300 mx-1" style={{ height: btnSize }}></div>
                    
                    {onToggleRelations && (
                        <button onClick={onToggleRelations} style={{ width: btnSize, height: btnSize }} className={`flex flex-col items-center justify-center rounded transition-colors ${showRelations ? 'bg-blue-200 text-blue-800' : 'hover:bg-slate-200 text-slate-700'}`} title="Toggle Relationships">
                            <div style={{ width: iconSize, height: iconSize }}>{Icons.Link}</div>
                        </button>
                    )}
                    {onToggleCritical && (
                        <button onClick={onToggleCritical} style={{ width: btnSize, height: btnSize }} className={`flex flex-col items-center justify-center rounded transition-colors ${showCritical ? 'bg-red-200 text-red-800' : 'hover:bg-slate-200 text-slate-700'}`} title="Show Critical Path">
                            <div style={{ width: iconSize, height: iconSize }}>{Icons.Critical}</div>
                        </button>
                    )}
                    
                    <div className="w-px bg-slate-300 mx-1" style={{ height: btnSize }}></div>
                    
                    {!isViewer && (
                        <>
                        <button onClick={onSettings} style={{ width: btnSize, height: btnSize }} className="flex flex-col items-center justify-center hover:bg-slate-200 rounded text-slate-700" title="Settings">
                            <div style={{ width: iconSize, height: iconSize }}>{Icons.Settings}</div>
                        </button>
                        <button onClick={onPrint} style={{ width: btnSize, height: btnSize }} className="flex flex-col items-center justify-center hover:bg-slate-200 rounded text-slate-700" title="Print">
                            <div style={{ width: iconSize, height: iconSize }}>{Icons.Print}</div>
                        </button>
                        <div className="w-px bg-slate-300 mx-1" style={{ height: btnSize }}></div>
                        </>
                    )}
                    <div className="font-bold text-slate-600 px-2" style={{ fontSize: `${fontSize}px` }}>{title} {isDirty ? '*' : ''}</div>
                </>
            )}
        </div>
    );
};

export default Toolbar;
