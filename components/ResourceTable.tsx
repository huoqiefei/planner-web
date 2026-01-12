import React, { useState, useEffect } from 'react';
import { Resource } from '../types';
import { useTranslation } from '../utils/i18n';
import { useAppStore } from '../stores/useAppStore';
import { useProjectOperations } from '../hooks/useProjectOperations';
import { ResizableHeader } from './ResizableHeader';
import { matchFilter } from '../utils/filterUtils';

interface ResourceTableProps {
    [key: string]: any;
}

const ResourceTable: React.FC<ResourceTableProps> = () => {
    const {
        data,
        selIds,
        setSelIds,
        userSettings,
        setCtx,
        resourceFilters
    } = useAppStore();

    const allResources = data?.resources || [];
    const resources = allResources.filter(r => matchFilter(r, resourceFilters));


    const { handleResourceUpdate } = useProjectOperations();
    const { t } = useTranslation(userSettings.language);

    const visibleCols = userSettings.resourceVisibleColumns || ['id', 'name', 'type', 'unit', 'maxUnits', 'unitPrice'];
    const allCustomFields = data?.meta?.customFieldDefinitions?.filter(f => f.scope === 'resource') || [];
    const customFields = allCustomFields.filter(cf => visibleCols.includes(cf.id));

    const [colWidths, setColWidths] = useState<Record<string, number>>({
        id: 100, name: 300, type: 80, unit: 60, maxUnits: 100, unitPrice: 80
    });
    // const [ctx, setCtx] = useState<{x:number, y:number, id:string} | null>(null); // Removed local
    const [editing, setEditing] = useState<{ id: string, field: string } | null>(null);
    const [val, setVal] = useState('');
    const [lastClickedIndex, setLastClickedIndex] = useState<number>(-1);

    useEffect(() => {
        setLastClickedIndex(-1);
    }, [resources]);

    // Dynamic Sizes based on User Settings
    const fontSizePx = userSettings.uiFontPx || 13;
    const ROW_HEIGHT = Math.max(28, fontSizePx + 15);

    // definition of deleteRes removed

    const updateRes = (id: string, field: keyof Resource, val: any) => {
        handleResourceUpdate(resources.map(r => r.id === id ? { ...r, [field]: val } : r));
    };

    const updateCustomField = (id: string, fieldId: string, val: any) => {
        handleResourceUpdate(resources.map(r => {
            if (r.id === id) {
                const newFields = { ...(r.customFields || {}), [fieldId]: val };
                return { ...r, customFields: newFields };
            }
            return r;
        }));
    };

    const startEdit = (id: string, field: string, v: any) => {
        setEditing({ id, field });
        setVal(String(v));
    };

    const saveEdit = () => {
        if (editing) {
            if (customFields.find(f => f.id === editing.field)) {
                updateCustomField(editing.id, editing.field, val);
            } else {
                updateRes(editing.id, editing.field as any, (editing.field === 'maxUnits' || editing.field === 'unitPrice') ? Number(val) : val);
            }
        }
        setEditing(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Delete' && selIds.length > 0 && !editing) {
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
            const finalSel = (event.ctrlKey || event.metaKey) ? [...new Set([...selIds, ...range])] : range;
            setSelIds(finalSel);
        } else if (event.ctrlKey || event.metaKey) {
            if (selIds.includes(id)) {
                setSelIds(selIds.filter(x => x !== id));
            } else {
                setSelIds([...selIds, id]);
            }
            setLastClickedIndex(index);
        } else {
            setSelIds([id]);
            setLastClickedIndex(index);
        }
    };

    const handleContextMenu = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();
        let newSelIds = selIds;
        if (!selIds.includes(id)) {
            if (e.ctrlKey || e.metaKey) {
                newSelIds = [...selIds, id];
            } else {
                newSelIds = [id];
            }
            setSelIds(newSelIds);
        }
        setCtx({ x: e.pageX, y: e.pageY, type: 'Resource', id, selIds: newSelIds });
    };

    return (
        <div className="flex-grow flex flex-col overflow-hidden" onKeyDown={handleKeyDown} tabIndex={0} onClick={() => setCtx(null)}>
            {/* Header */}
            <div className="flex bg-slate-100 border-b border-slate-300 font-bold text-slate-700 shadow-sm" style={{ height: 36, fontSize: `${fontSizePx}px` }}>
                {visibleCols.includes('id') && <ResizableHeader width={colWidths.id || 100} onResize={w => setColWidths({ ...colWidths, id: w })}>{t('ResourceID')}</ResizableHeader>}
                {visibleCols.includes('name') && <ResizableHeader width={colWidths.name || 300} onResize={w => setColWidths({ ...colWidths, name: w })}>{t('ResourceName')}</ResizableHeader>}
                {visibleCols.includes('type') && <ResizableHeader width={colWidths.type || 80} onResize={w => setColWidths({ ...colWidths, type: w })}>{t('Type')}</ResizableHeader>}
                {visibleCols.includes('unit') && <ResizableHeader width={colWidths.unit || 60} onResize={w => setColWidths({ ...colWidths, unit: w })}>{t('Unit')}</ResizableHeader>}
                {visibleCols.includes('unitPrice') && <ResizableHeader width={colWidths.unitPrice || 80} onResize={w => setColWidths({ ...colWidths, unitPrice: w })}>{t('UnitPrice')}</ResizableHeader>}
                {visibleCols.includes('maxUnits') && <ResizableHeader width={colWidths.maxUnits || 100} onResize={w => setColWidths({ ...colWidths, maxUnits: w })}>{t('MaxUnits')}</ResizableHeader>}
                {customFields.map(cf => (
                    <ResizableHeader key={cf.id} width={colWidths[cf.id] || 100} onResize={w => setColWidths({ ...colWidths, [cf.id]: w })}>{cf.name}</ResizableHeader>
                ))}
            </div>
            {/* Body */}
            <div className="flex-grow overflow-auto bg-slate-50">
                {resources.map((r, idx) => (
                    <div
                        key={r.id}
                        className={`flex border-b border-slate-200 transition-colors cursor-pointer select-none ${selIds.includes(r.id) ? '!bg-blue-200 !hover:bg-blue-300' : ('hover:bg-blue-50 ' + (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'))}`}
                        style={{ height: ROW_HEIGHT, fontSize: `${fontSizePx}px` }}
                        onClick={(e) => handleRowClick(r.id, idx, e)}
                        onContextMenu={(e) => handleContextMenu(e, r.id)}
                    >
                        {visibleCols.includes('id') && <div className="border-r border-slate-200 px-2 flex items-center truncate text-slate-500" style={{ width: colWidths.id }}>{r.id}</div>}
                        {visibleCols.includes('name') && <div className="border-r border-slate-200 px-2 flex items-center truncate font-medium text-slate-700" style={{ width: colWidths.name }}>
                            {editing?.id === r.id && editing?.field === 'name' ? (
                                <input autoFocus className="w-full h-full px-1 border-2 border-blue-400 rounded" value={val} onChange={e => setVal(e.target.value)} onBlur={saveEdit} onKeyDown={e => e.key === 'Enter' && saveEdit()} />
                            ) : (
                                <span onDoubleClick={() => startEdit(r.id, 'name', r.name)} className="w-full">{r.name}</span>
                            )}
                        </div>}
                        {visibleCols.includes('type') && <div className="border-r border-slate-200 px-2 flex items-center truncate" style={{ width: colWidths.type }}>
                            <select className="w-full bg-transparent border-none outline-none cursor-pointer" value={r.type} onChange={e => updateRes(r.id, 'type', e.target.value)}>
                                <option value="Labor">{t('Labor')}</option>
                                <option value="Material">{t('Material')}</option>
                                <option value="Equipment">{t('Equipment')}</option>
                            </select>
                        </div>}
                        {visibleCols.includes('unit') && <div className="border-r border-slate-200 px-2 flex items-center truncate" style={{ width: colWidths.unit }}>
                            {editing?.id === r.id && editing?.field === 'unit' ? (
                                <input autoFocus className="w-full h-full px-1 border-2 border-blue-400 rounded" value={val} onChange={e => setVal(e.target.value)} onBlur={saveEdit} onKeyDown={e => e.key === 'Enter' && saveEdit()} />
                            ) : (
                                <span onDoubleClick={() => startEdit(r.id, 'unit', r.unit)} className="w-full">{r.unit}</span>
                            )}
                        </div>}
                        {visibleCols.includes('unitPrice') && <div
                            className="border-r border-slate-200 px-2 flex items-center truncate text-right justify-end"
                            style={{ width: colWidths.unitPrice || 80 }}
                            onDoubleClick={() => startEdit(r.id, 'unitPrice', r.unitPrice)}
                        >
                            {editing?.id === r.id && editing?.field === 'unitPrice' ? (
                                <input
                                    autoFocus
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    className="w-full h-full px-1 border-2 border-blue-400 rounded text-right"
                                    value={val}
                                    onChange={e => setVal(e.target.value)}
                                    onBlur={saveEdit}
                                    onKeyDown={e => e.key === 'Enter' && saveEdit()}
                                    onClick={e => e.stopPropagation()}
                                />
                            ) : (
                                <span className="w-full text-right block">{r.unitPrice}</span>
                            )}
                        </div>}
                        {visibleCols.includes('maxUnits') && <div className="border-r border-slate-200 px-2 flex items-center truncate text-right justify-end" style={{ width: colWidths.maxUnits || 100 }}>
                            {editing?.id === r.id && editing?.field === 'maxUnits' ? (
                                <input autoFocus type="text" inputMode="numeric" pattern="[0-9]*" className="w-full h-full px-1 border-2 border-blue-400 rounded text-right" value={val} onChange={e => setVal(e.target.value)} onBlur={saveEdit} onKeyDown={e => e.key === 'Enter' && saveEdit()} />
                            ) : (
                                <span onDoubleClick={() => startEdit(r.id, 'maxUnits', r.maxUnits)} className="w-full text-right">{r.maxUnits}</span>
                            )}
                        </div>}
                        {customFields.map(cf => (
                            <div
                                key={cf.id}
                                className="border-r border-slate-200 px-2 flex items-center truncate"
                                style={{ width: colWidths[cf.id] || 100 }}
                                onDoubleClick={() => {
                                    if (!editing || editing.id !== r.id || editing.field !== cf.id) {
                                        startEdit(r.id, cf.id, r.customFields?.[cf.id] || '');
                                    }
                                }}
                            >
                                {editing?.id === r.id && editing?.field === cf.id ? (
                                    cf.type === 'list' && cf.options ? (
                                        <select
                                            autoFocus
                                            className="w-full h-full px-1 border-2 border-blue-400 rounded bg-white"
                                            value={val}
                                            onChange={e => setVal(e.target.value)}
                                            onBlur={saveEdit}
                                            onKeyDown={e => e.key === 'Enter' && saveEdit()}
                                            onDoubleClick={(e) => e.stopPropagation()}
                                        >
                                            <option value="">-</option>
                                            {cf.options.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            autoFocus
                                            type={cf.type === 'number' ? 'text' : cf.type === 'date' ? 'date' : 'text'}
                                            inputMode={cf.type === 'number' ? 'numeric' : undefined}
                                            pattern={cf.type === 'number' ? '[0-9]*' : undefined}
                                            className="w-full h-full px-1 border-2 border-blue-400 rounded"
                                            value={val}
                                            onChange={e => setVal(e.target.value)}
                                            onBlur={saveEdit}
                                            onKeyDown={e => e.key === 'Enter' && saveEdit()}
                                            onDoubleClick={(e) => e.stopPropagation()}
                                        />
                                    )
                                ) : (
                                    <span className="w-full text-xs">{r.customFields?.[cf.id] || '-'}</span>
                                )}
                            </div>
                        ))}
                    </div>
                ))}
                {resources.length === 0 && (
                    <div
                        className="p-8 text-center text-slate-400 flex flex-grow flex-col items-center gap-2"
                        onContextMenu={(e) => {
                            e.preventDefault();
                            setCtx({ x: e.pageX, y: e.pageY, type: 'Resource', id: 'null' });
                        }}
                    >
                        <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                        <span>{t('NoResourcesDefined')}</span>
                    </div>
                )}
                {/* Bottom padding for easier data entry - hidden in print */}
                <div className="h-72 w-full print:hidden" />
            </div>


        </div>
    );
};

export default ResourceTable;
