import React, { useState } from 'react';
import { Resource } from '../types';
import { useTranslation } from '../utils/i18n';
import { useAppStore } from '../stores/useAppStore';
import { useProjectOperations } from '../hooks/useProjectOperations';
import { ResizableHeader } from './ResizableHeader';

const ResourceTable: React.FC = () => {
    const { 
        data, 
        selIds, 
        setSelIds, 
        userSettings 
    } = useAppStore();

    const { handleResourceUpdate } = useProjectOperations();
    const { t } = useTranslation(userSettings.language);

    const resources = data?.resources || [];

    const [colWidths, setColWidths] = useState({ id: 100, name: 300, type: 80, unit: 60, max: 100 });
    const [ctx, setCtx] = useState<{x:number, y:number, id:string} | null>(null);
    const [editing, setEditing] = useState<{id:string, field:string} | null>(null);
    const [val, setVal] = useState('');
    const [lastClickedIndex, setLastClickedIndex] = useState<number>(-1);
    
    // Dynamic Sizes based on User Settings
    const fontSizePx = userSettings.uiFontPx || 13;
    const ROW_HEIGHT = Math.max(28, fontSizePx + 15);

    const deleteRes = (id: string) => {
        handleResourceUpdate(resources.filter(r => r.id !== id));
        if (selIds.includes(id)) setSelIds(selIds.filter(sid => sid !== id));
        setCtx(null);
    };

    const updateRes = (id: string, field: keyof Resource, val: any) => {
        handleResourceUpdate(resources.map(r => r.id === id ? { ...r, [field]: val } : r));
    };

    const startEdit = (id: string, field: string, v: any) => {
        setEditing({id, field});
        setVal(String(v));
    };
    
    const saveEdit = () => {
        if(editing) updateRes(editing.id, editing.field as any, editing.field==='maxUnits'?Number(val):val);
        setEditing(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if(e.key === 'Delete' && selIds.length > 0 && !editing) {
            // Delete all selected resources
            const remaining = resources.filter(r => !selIds.includes(r.id));
            handleResourceUpdate(remaining);
            setSelIds([]);
        }
    };

    const handleRowClick = (id: string, index: number, event: React.MouseEvent) => {
        if (event.shiftKey && lastClickedIndex !== -1) {
             const start = Math.min(lastClickedIndex, index);
             const end = Math.max(lastClickedIndex, index);
             const range = resources.slice(start, end + 1).map(r => r.id);
             setSelIds(event.ctrlKey ? [...new Set([...selIds, ...range])] : range);
        } else if (event.ctrlKey || event.metaKey) {
             if (selIds.includes(id)) setSelIds(selIds.filter(x => x !== id));
             else setSelIds([...selIds, id]);
             setLastClickedIndex(index);
        } else {
             setSelIds([id]);
             setLastClickedIndex(index);
        }
    };

    const handleContextMenu = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        if (!selIds.includes(id)) {
            setSelIds([id]);
        }
        setCtx({ x: e.pageX, y: e.pageY, id });
    };

    return (
        <div className="flex-grow flex flex-col overflow-hidden" onKeyDown={handleKeyDown} tabIndex={0} onClick={()=>setCtx(null)}>
            {/* Header */}
            <div className="flex bg-slate-100 border-b border-slate-300 font-bold text-slate-700 shadow-sm" style={{ height: 36, fontSize: `${fontSizePx}px` }}>
                <ResizableHeader width={colWidths.id} onResize={w=>setColWidths({...colWidths, id:w})}>{t('ResourceID')}</ResizableHeader>
                <ResizableHeader width={colWidths.name} onResize={w=>setColWidths({...colWidths, name:w})}>{t('ResourceName')}</ResizableHeader>
                <ResizableHeader width={colWidths.type} onResize={w=>setColWidths({...colWidths, type:w})}>{t('Type')}</ResizableHeader>
                <ResizableHeader width={colWidths.unit} onResize={w=>setColWidths({...colWidths, unit:w})}>{t('Unit')}</ResizableHeader>
                <ResizableHeader width={colWidths.max} onResize={w=>setColWidths({...colWidths, max:w})}>{t('MaxUnits')}</ResizableHeader>
            </div>
            {/* Body */}
            <div className="flex-grow overflow-auto bg-slate-50">
                    {resources.map((r, idx) => (
                        <div 
                        key={r.id} 
                        className={`flex border-b border-slate-200 hover:bg-blue-50 transition-colors cursor-pointer ${selIds.includes(r.id) ? 'bg-blue-100' : (idx%2===0?'bg-white':'bg-slate-50')}`}
                        style={{ height: ROW_HEIGHT, fontSize: `${fontSizePx}px` }}
                        onClick={(e) => handleRowClick(r.id, idx, e)}
                        onContextMenu={(e) => handleContextMenu(e, r.id)}
                        >
                            <div className="border-r border-slate-200 px-2 flex items-center truncate text-slate-500" style={{ width: colWidths.id }}>{r.id}</div>
                            <div className="border-r border-slate-200 px-2 flex items-center truncate font-medium text-slate-700" style={{ width: colWidths.name }}>
                                {editing?.id===r.id && editing?.field==='name' ? (
                                    <input autoFocus className="w-full h-full px-1 border-2 border-blue-400 rounded" value={val} onChange={e=>setVal(e.target.value)} onBlur={saveEdit} onKeyDown={e=>e.key==='Enter'&&saveEdit()} />
                                ) : (
                                    <span onDoubleClick={()=>startEdit(r.id, 'name', r.name)} className="w-full">{r.name}</span>
                                )}
                            </div>
                            <div className="border-r border-slate-200 px-2 flex items-center truncate" style={{ width: colWidths.type }}>
                                <select className="w-full bg-transparent border-none outline-none cursor-pointer" value={r.type} onChange={e=>updateRes(r.id, 'type', e.target.value)}>
                                    <option value="Labor">{t('Labor')}</option>
                                    <option value="Material">{t('Material')}</option>
                                    <option value="Equipment">{t('Equipment')}</option>
                                </select>
                            </div>
                            <div className="border-r border-slate-200 px-2 flex items-center truncate" style={{ width: colWidths.unit }}>
                                {editing?.id===r.id && editing?.field==='unit' ? (
                                    <input autoFocus className="w-full h-full px-1 border-2 border-blue-400 rounded" value={val} onChange={e=>setVal(e.target.value)} onBlur={saveEdit} onKeyDown={e=>e.key==='Enter'&&saveEdit()} />
                                ) : (
                                    <span onDoubleClick={()=>startEdit(r.id, 'unit', r.unit)} className="w-full">{r.unit}</span>
                                )}
                            </div>
                            <div className="border-r border-slate-200 px-2 flex items-center truncate text-right justify-end" style={{ width: colWidths.max }}>
                                {editing?.id===r.id && editing?.field==='maxUnits' ? (
                                    <input autoFocus type="number" className="w-full h-full px-1 border-2 border-blue-400 rounded text-right" value={val} onChange={e=>setVal(e.target.value)} onBlur={saveEdit} onKeyDown={e=>e.key==='Enter'&&saveEdit()} />
                                ) : (
                                    <span onDoubleClick={()=>startEdit(r.id, 'maxUnits', r.maxUnits)} className="w-full text-right">{r.maxUnits}</span>
                                )}
                            </div>
                        </div>
                    ))}
                    {resources.length === 0 && (
                        <div className="p-8 text-center text-slate-400 flex flex-col items-center gap-2">
                            <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                            <span>{t('NoResourcesDefined')}</span>
                        </div>
                    )}
            </div>

            {/* Context Menu */}
            {ctx && (
                <div 
                    className="fixed bg-white border border-slate-300 shadow-xl rounded py-1 z-50 min-w-[120px]" 
                    style={{ left: ctx.x, top: ctx.y }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button className="w-full text-left px-4 py-2 hover:bg-slate-100 text-red-600 flex items-center gap-2" onClick={() => deleteRes(ctx.id)}>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        {t('Delete')}
                    </button>
                </div>
            )}
        </div>
    );
};

export default ResourceTable;
