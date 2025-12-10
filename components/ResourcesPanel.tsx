
import React, { useState, useMemo } from 'react';
import { Resource, Assignment, Activity, UserSettings } from '../types';

interface ResourcesPanelProps {
    resources: Resource[];
    assignments: Assignment[];
    activities: Activity[];
    onUpdateResources: (resources: Resource[]) => void;
    userSettings: UserSettings;
}

type ZoomLevel = 'Day' | 'Week' | 'Month' | 'Quarter' | 'Year';

const ResizableHeader: React.FC<{ width: number, onResize: (w: number) => void, children: React.ReactNode, align?: 'left'|'center'|'right' }> = ({ width, onResize, children, align='left' }) => {
    const handleMouseDown = (e: React.MouseEvent) => {
        const startX = e.pageX;
        const startW = width;
        const onMove = (mv: MouseEvent) => onResize(Math.max(40, startW + (mv.pageX - startX)));
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    };
    return (
        <div className="border-r border-slate-400 px-2 h-full flex items-center relative overflow-visible select-none" style={{ width, justifyContent: align==='right'?'flex-end':align==='center'?'center':'flex-start' }}>
            {children}
            <div className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 z-10" onMouseDown={handleMouseDown}></div>
        </div>
    );
};

const ResourcesPanel: React.FC<ResourcesPanelProps> = ({ resources, assignments, activities, onUpdateResources, userSettings }) => {
    const [selResId, setSelResId] = useState<string | null>(null);
    const [tab, setTab] = useState<'General' | 'Histogram'>('General');
    const [zoom, setZoom] = useState<ZoomLevel>('Week');
    const [colWidths, setColWidths] = useState({ id: 100, name: 300, type: 80, unit: 60, max: 100 });
    const [ctx, setCtx] = useState<{x:number, y:number, id:string} | null>(null);
    const [editing, setEditing] = useState<{id:string, field:string} | null>(null);
    const [val, setVal] = useState('');

    const selectedResource = resources.find(r => r.id === selResId);

    // Dynamic Sizes based on User Settings
    const fontSizePx = userSettings.uiFontPx || 13;
    const ROW_HEIGHT = Math.max(28, fontSizePx + 15);

    const generateResId = () => {
        const max = resources.reduce((m, r) => {
            const match = r.id.match(/(\d+)/);
            return match ? Math.max(m, parseInt(match[1])) : m;
        }, 1000);
        return `R${max + 10}`;
    };

    const addRes = () => {
        const newRes: Resource = { id: generateResId(), name: 'New Resource', type: 'Labor', unit: 'h', maxUnits: 8 };
        onUpdateResources([...resources, newRes]);
        setSelResId(newRes.id);
        setCtx(null);
    };

    const deleteRes = (id: string) => {
        onUpdateResources(resources.filter(r => r.id !== id));
        if (selResId === id) setSelResId(null);
        setCtx(null);
    };

    const updateRes = (id: string, field: keyof Resource, val: any) => {
        onUpdateResources(resources.map(r => r.id === id ? { ...r, [field]: val } : r));
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
        if(e.key === 'Delete' && selResId && !editing) {
            deleteRes(selResId);
        }
    };

    const histogramData = useMemo(() => {
        if (!selectedResource || !activities.length) return [];
        
        const dailyUsage: Record<string, number> = {};
        let minT = Infinity; let maxT = -Infinity;

        assignments.filter(a => a.resourceId === selectedResource.id).forEach(assign => {
            const act = activities.find(a => a.id === assign.activityId);
            if (!act || act.duration <= 0) return;

            // Logic: Assignment Units is always stored as TOTAL.
            // Daily Rate = Total / Duration.
            const dailyVal = assign.units / act.duration;

            let curr = new Date(act.startDate);
            const end = new Date(act.endDate);
            
            while(curr <= end) {
                const k = curr.toISOString().split('T')[0];
                dailyUsage[k] = (dailyUsage[k] || 0) + dailyVal;
                minT = Math.min(minT, curr.getTime());
                maxT = Math.max(maxT, curr.getTime());
                curr.setDate(curr.getDate() + 1);
            }
        });

        if(minT === Infinity) return [];

        const startDate = new Date(minT); startDate.setDate(startDate.getDate() - 7);
        const endDate = new Date(maxT); endDate.setDate(endDate.getDate() + 30);

        const aggregated: Record<string, number> = {};

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const k = d.toISOString().split('T')[0];
            const val = dailyUsage[k] || 0;
            
            let periodKey = k;
            if (zoom === 'Week') {
                const day = d.getDay();
                const diff = d.getDate() - day + (day === 0 ? -6 : 1);
                const mon = new Date(d); mon.setDate(diff);
                periodKey = mon.toISOString().split('T')[0];
            } else if (zoom === 'Month') {
                periodKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2,'0')}-01`;
            } else if (zoom === 'Quarter') {
                 const q = Math.floor(d.getMonth()/3)+1;
                 periodKey = `${d.getFullYear()}-Q${q}`;
            } else if (zoom === 'Year') {
                periodKey = `${d.getFullYear()}`;
            }

            if (selectedResource.type === 'Material') {
                // Sum of consumption over the period
                aggregated[periodKey] = (aggregated[periodKey] || 0) + val;
            } else {
                // Labor/Equipment: Peak (Max) intensity in the period
                aggregated[periodKey] = Math.max(aggregated[periodKey] || 0, val);
            }
        }

        return Object.keys(aggregated).sort().map(k => ({ date: k, val: aggregated[k] }));

    }, [selectedResource, activities, assignments, zoom]);

    const exportData = () => {
        if (!histogramData.length) return;
        const csv = "Date,Value\n" + histogramData.map(d => `${d.date},${d.val.toFixed(2)}`).join("\n");
        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Resource_${selectedResource?.name}_${zoom}.csv`;
        link.click();
    };

    return (
        <div className="flex flex-col h-full bg-white select-none outline-none" onClick={() => setCtx(null)} style={{ fontSize: `${fontSizePx}px` }} tabIndex={0} onKeyDown={handleKeyDown}>
            {/* Top: Resource Table */}
            <div className="flex-grow flex flex-col h-1/2 overflow-hidden border-b-4 border-slate-300">
                <div className="p6-header">
                    <div className="w-8 border-r px-1 text-center font-bold text-slate-500">
                        <button onClick={addRes} className="text-green-600 hover:text-green-800 text-lg leading-none">+</button>
                    </div>
                    <ResizableHeader width={colWidths.id} onResize={w=>setColWidths({...colWidths, id:w})}>ID</ResizableHeader>
                    <ResizableHeader width={colWidths.name} onResize={w=>setColWidths({...colWidths, name:w})}>Resource Name</ResizableHeader>
                    <ResizableHeader width={colWidths.type} onResize={w=>setColWidths({...colWidths, type:w})}>Type</ResizableHeader>
                    <ResizableHeader width={colWidths.unit} onResize={w=>setColWidths({...colWidths, unit:w})} align="center">Unit</ResizableHeader>
                    <ResizableHeader width={colWidths.max} onResize={w=>setColWidths({...colWidths, max:w})} align="right">Max/Time</ResizableHeader>
                </div>
                <div className="overflow-y-auto custom-scrollbar bg-white flex-grow">
                    {resources.map(r => (
                        <div 
                            key={r.id} 
                            onClick={() => setSelResId(r.id)}
                            onContextMenu={(e) => { e.preventDefault(); setSelResId(r.id); setCtx({x:e.clientX, y:e.clientY, id:r.id}); }}
                            className={`p6-row ${selResId === r.id ? 'selected' : ''}`}
                            style={{ height: ROW_HEIGHT }}
                        >
                            <div className="w-8 p6-cell justify-center"></div>
                            <div className="p6-cell" style={{width: colWidths.id}}>{r.id}</div>
                            <div className="p6-cell" style={{width: colWidths.name}}>
                                {editing?.id===r.id && editing.field==='name' ? 
                                    <input autoFocus className="w-full h-full px-1" value={val} onChange={e=>setVal(e.target.value)} onBlur={saveEdit} onKeyDown={e=>e.key==='Enter'&&saveEdit()}/> :
                                    <span onDoubleClick={()=>startEdit(r.id, 'name', r.name)} className="w-full truncate">{r.name}</span>
                                }
                            </div>
                            <div className="p6-cell" style={{width: colWidths.type}}>
                                {editing?.id===r.id && editing.field==='type' ? 
                                    <select autoFocus className="w-full h-full" value={val} onChange={e=>{updateRes(r.id, 'type', e.target.value); setEditing(null);}} onBlur={()=>setEditing(null)}>
                                        <option>Labor</option><option>Equipment</option><option>Material</option>
                                    </select> :
                                    <span onDoubleClick={()=>startEdit(r.id, 'type', r.type)} className="w-full truncate">{r.type}</span>
                                }
                            </div>
                            <div className="p6-cell justify-center" style={{width: colWidths.unit}}>
                                {editing?.id===r.id && editing.field==='unit' ? 
                                    <input autoFocus className="w-full h-full text-center" value={val} onChange={e=>setVal(e.target.value)} onBlur={saveEdit} onKeyDown={e=>e.key==='Enter'&&saveEdit()}/> :
                                    <span onDoubleClick={()=>startEdit(r.id, 'unit', r.unit)}>{r.unit}</span>
                                }
                            </div>
                            <div className="p6-cell justify-end" style={{width: colWidths.max}}>
                                {editing?.id===r.id && editing.field==='maxUnits' ? 
                                    <input autoFocus className="w-full h-full text-right" value={val} onChange={e=>setVal(e.target.value)} onBlur={saveEdit} onKeyDown={e=>e.key==='Enter'&&saveEdit()}/> :
                                    <span onDoubleClick={()=>startEdit(r.id, 'maxUnits', r.maxUnits)}>{r.maxUnits}</span>
                                }
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Bottom: Details Panel */}
            <div className="h-1/2 flex flex-col bg-slate-50">
                <div className="flex bg-slate-100 border-b border-slate-300 px-1 pt-1 gap-1 h-8 items-end">
                    {['General', 'Histogram'].map(t => (
                        <button key={t} onClick={() => setTab(t as any)} className={`px-4 py-1 uppercase font-bold border-t border-l border-r rounded-t-sm ${tab === t ? 'bg-white text-black border-b-white -mb-px' : 'text-slate-500 border-b-slate-300 hover:bg-slate-200'}`}>
                            {t}
                        </button>
                    ))}
                </div>

                <div className="flex-grow overflow-auto p-4 bg-white relative">
                    {!selectedResource ? (
                        <div className="flex h-full items-center justify-center text-slate-400">Select a resource</div>
                    ) : (
                        <>
                            {tab === 'General' && (
                                <div className="max-w-2xl grid grid-cols-2 gap-4">
                                    <div><label className="block text-slate-500 font-bold mb-0.5">ID</label><input disabled className="w-full border p-1 bg-slate-50" value={selectedResource.id} style={{ fontSize: `${fontSizePx}px` }} /></div>
                                    <div><label className="block text-slate-500 font-bold mb-0.5">Name</label><input className="w-full border p-1" value={selectedResource.name} onChange={e=>updateRes(selectedResource.id, 'name', e.target.value)} style={{ fontSize: `${fontSizePx}px` }} /></div>
                                    <div><label className="block text-slate-500 font-bold mb-0.5">Type</label>
                                        <select className="w-full border p-1" value={selectedResource.type} onChange={e=>updateRes(selectedResource.id, 'type', e.target.value)} style={{ fontSize: `${fontSizePx}px` }}>
                                            <option>Labor</option><option>Equipment</option><option>Material</option>
                                        </select>
                                    </div>
                                    <div><label className="block text-slate-500 font-bold mb-0.5">Max Units/Time</label><input type="number" className="w-full border p-1" value={selectedResource.maxUnits} onChange={e=>updateRes(selectedResource.id, 'maxUnits', Number(e.target.value))} style={{ fontSize: `${fontSizePx}px` }} /></div>
                                </div>
                            )}

                            {tab === 'Histogram' && (
                                <div className="flex flex-col h-full">
                                    <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-100">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-slate-700">{selectedResource.name}</span>
                                            <span className="text-[11px] bg-slate-200 px-2 py-0.5 rounded text-slate-600">
                                                {selectedResource.type === 'Material' ? 'Total Quantity' : 'Max Intensity'}
                                            </span>
                                        </div>
                                        <div className="flex gap-2">
                                            {(['Day', 'Week', 'Month', 'Quarter', 'Year'] as const).map(z => (
                                                <button key={z} onClick={() => setZoom(z)} className={`px-2 py-0.5 text-[11px] uppercase border rounded ${zoom === z ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' : 'hover:bg-slate-50'}`}>{z}</button>
                                            ))}
                                            <button onClick={exportData} className="ml-2 px-2 py-0.5 text-[11px] bg-green-50 border border-green-500 text-green-700 rounded hover:bg-green-100">Export CSV</button>
                                        </div>
                                    </div>
                                    
                                    <div className="flex-grow overflow-x-auto overflow-y-hidden custom-scrollbar relative border border-slate-200 bg-slate-50">
                                        {histogramData.length === 0 ? <div className="flex items-center justify-center h-full text-slate-400">No data</div> : (
                                            <div style={{ height: '100%', minWidth: '100%' }}>
                                                {(() => {
                                                    const maxVal = Math.max(...histogramData.map(d => d.val), selectedResource.maxUnits);
                                                    const barWidth = Math.max(30, 800 / histogramData.length);
                                                    const height = 180;

                                                    return (
                                                        <svg height="100%" width={Math.max(histogramData.length * (barWidth + 5), 800)} style={{display: 'block'}}>
                                                            <g transform="translate(40, 20)">
                                                                <line x1="0" y1={height} x2="100%" y2={height} stroke="#cbd5e1" />
                                                                <line x1="0" y1="0" x2="0" y2={height} stroke="#cbd5e1" />
                                                                {selectedResource.type !== 'Material' && (
                                                                    <>
                                                                        <line x1="0" y1={height - (selectedResource.maxUnits/maxVal*height)} x2="100%" y2={height - (selectedResource.maxUnits/maxVal*height)} stroke="red" strokeDasharray="4" opacity="0.6" />
                                                                        <text x="-35" y={height - (selectedResource.maxUnits/maxVal*height) + 4} fill="red" fontSize="10">Max</text>
                                                                    </>
                                                                )}
                                                                {histogramData.map((d, i) => {
                                                                    const h = maxVal > 0 ? (d.val / maxVal) * height : 0;
                                                                    const x = i * (barWidth + 5);
                                                                    const isOver = selectedResource.type !== 'Material' && d.val > selectedResource.maxUnits;
                                                                    return (
                                                                        <g key={d.date}>
                                                                            <rect x={x} y={height - h} width={barWidth} height={h} fill={isOver ? '#ef4444' : (selectedResource.type === 'Material' ? '#10b981' : '#3b82f6')} />
                                                                            <text x={x + barWidth/2} y={height - h - 5} fontSize="10" textAnchor="middle" fill="#333">{d.val % 1 !== 0 ? d.val.toFixed(1) : d.val}</text>
                                                                            <text x={x + barWidth/2} y={height + 15} fontSize="10" textAnchor="middle" fill="#64748b">{d.date}</text>
                                                                        </g>
                                                                    );
                                                                })}
                                                            </g>
                                                        </svg>
                                                    );
                                                })()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {ctx && (
                 <div className="fixed bg-white border shadow-lg z-50 py-1" style={{top: ctx.y, left: ctx.x}}>
                     <div className="px-4 py-1 hover:bg-blue-600 hover:text-white cursor-pointer text-xs" onClick={()=>addRes()}>Add Resource</div>
                     <div className="px-4 py-1 hover:bg-red-600 hover:text-white cursor-pointer text-xs" onClick={()=>deleteRes(ctx.id)}>Delete Resource</div>
                 </div>
            )}
        </div>
    );
};

export default ResourcesPanel;
