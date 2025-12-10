import React, { useMemo, useState, forwardRef } from 'react';
import { Activity, WBSNode, Predecessor, RelationType } from '../types';

interface ActivityTableProps {
    wbs: WBSNode[];
    activities: Activity[];
    selectedActivityIds: string[];
    onSelectActivity: (id: string, multi: boolean) => void;
    onAddActivity: (wbsId: string) => void;
    onDeleteActivity: (id: string) => void;
    onAddWBS: (parentId: string | null) => void;
    onUpdateActivity: (activity: Activity) => void;
    onUpdateWBS: (id: string, name: string) => void;
    onUpdateActivityID: (oldId: string, newId: string) => void;
    onUpdateWBSID: (oldId: string, newId: string) => void;
    onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}

const formatDate = (date: Date): string => {
    if (isNaN(date.getTime())) return '-';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const formatCurrency = (amount: number): string => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);

const parsePredecessorsString = (input: string): Predecessor[] => {
    if (!input.trim()) return [];
    return input.split(',').map(part => {
        const clean = part.trim();
        const match = clean.match(/^([a-zA-Z0-9.\-_]+)(?:\(([A-Z]{2})?([+\-]?\d+)?\))?$/);
        if (match) {
            return { activityId: match[1], type: (match[2] as RelationType) || 'FS', lag: match[3] ? parseInt(match[3]) : 0 };
        }
        return { activityId: clean, type: 'FS', lag: 0 };
    });
};

const formatPredecessors = (preds: Predecessor[]): string => {
    return preds.map(p => {
        if (p.type === 'FS' && p.lag === 0) return p.activityId;
        const lagStr = p.lag > 0 ? `+${p.lag}` : p.lag < 0 ? `${p.lag}` : '';
        return `${p.activityId}(${p.type}${lagStr})`;
    }).join(', ');
};

const ActivityTable = forwardRef<HTMLDivElement, ActivityTableProps>(({ 
    wbs, activities, selectedActivityIds, onSelectActivity, onAddActivity, onDeleteActivity, onAddWBS, 
    onUpdateActivity, onUpdateWBS, onUpdateActivityID, onUpdateWBSID, onScroll
}, ref) => {
    const [editingCell, setEditingCell] = useState<{id: string, field: string} | null>(null);
    const [editValue, setEditValue] = useState<string>('');

    const startEditing = (id: string, field: string, value: any) => {
        setEditingCell({ id, field });
        if (field === 'predecessors') {
             const act = activities.find(a => a.id === id);
             setEditValue(act ? formatPredecessors(act.predecessors) : '');
        } else {
            setEditValue(String(value));
        }
    };

    const saveEdit = () => {
        if (!editingCell) return;
        if (editingCell.field === 'id') {
             const isWBS = wbs.some(w => w.id === editingCell.id);
             if (isWBS) onUpdateWBSID(editingCell.id, editValue);
             else onUpdateActivityID(editingCell.id, editValue);
             setEditingCell(null);
             return;
        }
        const activity = activities.find(a => a.id === editingCell.id);
        if (activity) {
            let updated = { ...activity };
            if (editingCell.field === 'name') updated.name = editValue;
            if (editingCell.field === 'duration') updated.duration = Number(editValue) || 0;
            if (editingCell.field === 'budgetedCost') updated.budgetedCost = Number(editValue) || 0;
            if (editingCell.field === 'predecessors') updated.predecessors = parsePredecessorsString(editValue);
            onUpdateActivity(updated);
        } else {
            const wbsNode = wbs.find(w => w.id === editingCell.id);
            if (wbsNode && editingCell.field === 'name') onUpdateWBS(wbsNode.id, editValue);
        }
        setEditingCell(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') saveEdit();
        if (e.key === 'Escape') setEditingCell(null);
    };

    const renderedRows = useMemo(() => {
        const rows: React.ReactElement[] = [];
        const processedWbs = new Set<string>();

        const renderNode = (node: WBSNode, depth: number) => {
            if (processedWbs.has(node.id)) return;
            processedWbs.add(node.id);

            const isEditingWBS = editingCell?.id === node.id && editingCell?.field === 'name';
            const isEditingWBSID = editingCell?.id === node.id && editingCell?.field === 'id';
            const wbsColor = ['bg-slate-300', 'bg-slate-200', 'bg-slate-100', 'bg-white'][Math.min(depth, 3)];

            rows.push(
                <tr key={`wbs-${node.id}`} className={`${wbsColor} font-bold text-blue-900 hover:brightness-95 group border-b border-slate-300`}>
                    <td className="p-1 border-r border-slate-300 whitespace-nowrap flex items-center justify-between" style={{ paddingLeft: `${depth * 20 + 4}px` }}>
                        <span className="truncate flex items-center flex-grow">
                           <span className="mr-1 text-yellow-600">📁</span>
                           {isEditingWBSID ? (
                                <input autoFocus className="w-20 bg-white text-black px-1 py-0.5 outline-none border border-blue-500 rounded-sm"
                                    value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} onClick={(e) => e.stopPropagation()} />
                           ) : (
                               <span onDoubleClick={(e) => { e.stopPropagation(); startEditing(node.id, 'id', node.id); }} className="cursor-pointer hover:bg-white/50 px-1 rounded-sm">{node.id}</span>
                           )}
                        </span>
                        <div className="opacity-0 group-hover:opacity-100 flex gap-1 mr-2">
                            <button onClick={(e) => { e.stopPropagation(); onAddActivity(node.id); }} className="text-[10px] bg-green-600 hover:bg-green-700 px-1.5 py-0.5 rounded text-white">+Task</button>
                            <button onClick={(e) => { e.stopPropagation(); onAddWBS(node.id); }} className="text-[10px] bg-blue-600 hover:bg-blue-700 px-1.5 py-0.5 rounded text-white">+WBS</button>
                        </div>
                    </td>
                    <td colSpan={6} className="p-1 border-r border-slate-300 text-sm">
                        {isEditingWBS ? (
                             <input autoFocus className="w-full bg-white text-black px-1 py-0.5 outline-none border border-blue-500 rounded-sm"
                                value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} onClick={(e) => e.stopPropagation()} />
                        ) : (
                            <span className="cursor-pointer hover:bg-white/50 block w-full select-text px-1" onDoubleClick={(e) => { e.stopPropagation(); startEditing(node.id, 'name', node.name); }}>{node.name}</span>
                        )}
                    </td>
                </tr>
            );

            const nodeActivities = activities.filter(a => a.wbsId === node.id);
            nodeActivities.forEach(activity => {
                const isSelected = selectedActivityIds.includes(activity.id);
                const renderCell = (field: string, value: React.ReactNode, rawValue: any, align: 'left'|'center'|'right' = 'left') => {
                    const isEditing = editingCell?.id === activity.id && editingCell?.field === field;
                    if (isEditing) {
                        return (
                            <input autoFocus className={`w-full bg-white text-black px-1 py-0.5 outline-none border border-blue-500 shadow-sm text-${align}`}
                                value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} onClick={(e) => e.stopPropagation()} />
                        );
                    }
                    return (
                        <div onDoubleClick={() => startEditing(activity.id, field, rawValue)} className={`cursor-pointer w-full h-full truncate text-${align} px-1 select-none`}>{value}</div>
                    );
                };
                const isEditingID = editingCell?.id === activity.id && editingCell?.field === 'id';

                rows.push(
                    <tr key={`act-${activity.id}`} onClick={(e) => onSelectActivity(activity.id, e.ctrlKey || e.metaKey)}
                        className={`border-b border-slate-200 text-xs transition-colors group ${isSelected ? 'bg-blue-100 text-blue-900' : 'bg-white text-slate-700 hover:bg-slate-50'} ${activity.isCritical && !isSelected ? 'text-red-700 font-medium' : ''}`}>
                        <td className="p-0 border-r border-slate-300 whitespace-nowrap flex justify-between items-center h-6" style={{ paddingLeft: `${(depth + 1) * 20 + 8}px` }}>
                            <span className="flex items-center truncate flex-grow">
                                <span className={`mr-2 ${activity.duration === 0 ? 'text-purple-600' : 'text-green-600'}`}>{activity.duration === 0 ? '◆' : '▬'}</span>
                                {isEditingID ? (
                                    <input autoFocus className="w-24 bg-white text-black px-1 py-0.5 outline-none border border-blue-500 rounded-sm"
                                        value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={handleKeyDown} onClick={(e) => e.stopPropagation()} />
                                ) : (
                                    <span onDoubleClick={(e) => { e.stopPropagation(); startEditing(activity.id, 'id', activity.id); }} className="cursor-pointer hover:bg-white/50 px-1 rounded-sm">{activity.id}</span>
                                )}
                            </span>
                            <button onClick={(e) => { e.stopPropagation(); onDeleteActivity(activity.id); }} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 px-1 font-bold mr-1">×</button>
                        </td>
                        <td className="p-0 border-r border-slate-300">{renderCell('name', activity.name, activity.name)}</td>
                        <td className="p-0 border-r border-slate-300">{renderCell('duration', activity.duration, activity.duration, 'center')}</td>
                        <td className="p-1 border-r border-slate-300 text-center text-slate-600">{formatDate(activity.startDate)}</td>
                        <td className="p-1 border-r border-slate-300 text-center text-slate-600">{formatDate(activity.endDate)}</td>
                        <td className="p-0 border-r border-slate-300">{renderCell('budgetedCost', formatCurrency(activity.budgetedCost), activity.budgetedCost, 'right')}</td>
                        <td className="p-0 border-r border-slate-300">{renderCell('predecessors', formatPredecessors(activity.predecessors), activity.predecessors)}</td>
                    </tr>
                );
            });
            const children = wbs.filter(child => child.parentId === node.id);
            children.forEach(childNode => renderNode(childNode, depth + 1));
        };
        
        const rootNodes = wbs.filter(node => !node.parentId || node.parentId === 'null');
        if (rootNodes.length === 0 && wbs.length > 0) renderNode(wbs[0], 0);
        else rootNodes.forEach(rootNode => renderNode(rootNode, 0));
        
        rows.push(<tr key="add-root-wbs" className="bg-slate-50 hover:bg-slate-100 cursor-pointer text-xs group" onClick={() => onAddWBS(null)}>
            <td colSpan={7} className="p-2 text-center text-slate-400 border-t border-slate-200 group-hover:text-blue-500">+ Add New WBS Layer</td></tr>
        );
        return rows;
    }, [wbs, activities, selectedActivityIds, editingCell, editValue]);

    return (
        <div className="w-[800px] flex-shrink-0 bg-white overflow-hidden flex flex-col border-r border-slate-300 select-none">
             <div className="bg-slate-200 text-slate-700 text-xs font-semibold border-b border-slate-300 flex shadow-sm z-10">
                <div className="p-2 border-r border-slate-300 w-64 text-center">Activity ID</div>
                <div className="p-2 border-r border-slate-300 min-w-[200px] flex-grow text-center">Activity Name</div>
                <div className="p-2 border-r border-slate-300 w-16 text-center">Dur</div>
                <div className="p-2 border-r border-slate-300 w-24 text-center">Start</div>
                <div className="p-2 border-r border-slate-300 w-24 text-center">Finish</div>
                <div className="p-2 border-r border-slate-300 w-28 text-center">Budget</div>
                <div className="p-2 w-32 text-center">Predecessors</div>
             </div>
             <div className="overflow-x-auto overflow-y-auto h-full custom-scrollbar bg-white" ref={ref} onScroll={onScroll}>
                <table className="w-full border-collapse text-xs table-fixed">
                    <colgroup><col className="w-64" /><col className="min-w-[200px]" /><col className="w-16" /><col className="w-24" /><col className="w-24" /><col className="w-28" /><col className="w-32" /></colgroup>
                    <tbody>{renderedRows}</tbody>
                </table>
            </div>
        </div>
    );
});

export default ActivityTable;