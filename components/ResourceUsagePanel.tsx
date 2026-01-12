import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { useTranslation } from '../utils/i18n';
import { Resource, Activity, Assignment } from '../types';

interface ResourceUsagePanelProps {
    onCtxAction?: (action: string) => void;
}

const ResourceUsagePanel: React.FC<ResourceUsagePanelProps> = ({ onCtxAction }) => {
    const {
        data: projectData,
        schedule,
        userSettings,
        setData,
        selIds,
        setSelIds,
        setCtx
    } = useAppStore();
    const { t } = useTranslation(userSettings.language);

    const activities = schedule.activities || [];
    const resources = projectData?.resources || [];
    const assignments = projectData?.assignments || [];

    // Table State
    const [colWidths, setColWidths] = useState<Record<string, number>>({
        id: 100,
        name: 200,
        duration: 70,
        start: 100,
        finish: 100
    });
    const [resWidths, setResWidths] = useState<Record<string, number>>({});

    // Editing State
    const [editingCell, setEditingCell] = useState<{ actId: string, resId: string } | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Selection state
    const [lastClickedIndex, setLastClickedIndex] = useState<number>(-1);

    // Resizing State
    const resizingRef = useRef<{ id: string, startX: number, startWidth: number, isResource?: boolean } | null>(null);

    useEffect(() => {
        if (editingCell && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingCell]);

    // Resize Handler
    const handleMouseDown = (e: React.MouseEvent, id: string, isResource = false) => {
        e.preventDefault();
        const startX = e.pageX;
        const startWidth = isResource ? (resWidths[id] || 100) : colWidths[id];
        resizingRef.current = { id, startX, startWidth, isResource };

        const onMouseMove = (moveEvent: MouseEvent) => {
            if (!resizingRef.current) return;
            const delta = moveEvent.pageX - resizingRef.current.startX;
            const newWidth = Math.max(40, resizingRef.current.startWidth + delta);

            if (resizingRef.current.isResource) {
                setResWidths(prev => ({ ...prev, [resizingRef.current!.id]: newWidth }));
            } else {
                setColWidths(prev => ({ ...prev, [resizingRef.current!.id]: newWidth }));
            }
        };

        const onMouseUp = () => {
            resizingRef.current = null;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    };

    // 1. Filter: Only display activities with at least one resource assignment
    const assignedActivities = useMemo(() => {
        return activities.filter(act =>
            assignments.some(assign => assign.activityId === act.id)
        );
    }, [activities, assignments]);

    // 2. Column Definitions
    const baseCols = [
        { id: 'id', name: t('ActivityID') },
        { id: 'name', name: t('ActivityName') },
        { id: 'duration', name: t('Duration') },
        { id: 'start', name: t('Start') },
        { id: 'finish', name: t('Finish') },
    ];

    // Helper to format date according to YYYY-MM-DD requirement
    const formatDate = (date: any) => {
        if (!date) return '-';
        try {
            const d = new Date(date);
            if (isNaN(d.getTime())) return date.toString();
            return d.toISOString().split('T')[0];
        } catch (e) {
            return date.toString();
        }
    };

    // Helper to get assignment value for a specific activity and resource
    const getAssignmentValue = (actId: string, resId: string) => {
        const assign = assignments.find(a => a.activityId === actId && a.resourceId === resId);
        if (!assign) return null;
        return Number(assign.units.toFixed(2));
    };

    // CSV Export Logic
    useEffect(() => {
        const handleExport = () => {
            const headers = [t('ActivityID'), t('ActivityName'), t('Duration'), t('Start'), t('Finish'), ...resources.map(r => r.name)];
            const rows = assignedActivities.map(act => {
                const base = [
                    act.id,
                    act.name,
                    act.duration,
                    formatDate(act.startDate),
                    formatDate(act.endDate)
                ];
                const resValues = resources.map(res => getAssignmentValue(act.id, res.id) || '');
                return [...base, ...resValues];
            });

            const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
            const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `Resource_Allocation_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        };

        window.addEventListener('export-allocation-csv', handleExport);
        return () => window.removeEventListener('export-allocation-csv', handleExport);
    }, [assignedActivities, resources, assignments, t]);

    // Selection Handlers
    const handleRowClick = (id: string, index: number, event: React.MouseEvent) => {
        if (event.shiftKey && lastClickedIndex !== -1) {
            const start = Math.min(lastClickedIndex, index);
            const end = Math.max(lastClickedIndex, index);
            const range = assignedActivities.slice(start, end + 1).map(a => a.id);
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
            newSelIds = [id];
            setSelIds(newSelIds);
        }
        setCtx({ x: e.pageX, y: e.pageY, type: 'Assignment', id, selIds: newSelIds });
    };

    const handleStartEdit = (actId: string, resId: string, val: number | null) => {
        setEditingCell({ actId, resId });
        setEditValue(val === null ? '' : val.toString());
    };

    const handleSaveEdit = () => {
        if (!editingCell) return;
        const newVal = parseFloat(editValue);

        setData(prev => {
            if (!prev) return prev;
            const newAssignments = [...prev.assignments];
            const idx = newAssignments.findIndex(a => a.activityId === editingCell.actId && a.resourceId === editingCell.resId);

            if (idx >= 0) {
                if (isNaN(newVal)) {
                    setEditingCell(null);
                    return prev;
                }
                newAssignments[idx] = { ...newAssignments[idx], units: newVal };
            } else if (!isNaN(newVal) && newVal > 0) {
                newAssignments.push({
                    activityId: editingCell.actId,
                    resourceId: editingCell.resId,
                    units: newVal
                });
            }

            return { ...prev, assignments: newAssignments };
        });
        setEditingCell(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSaveEdit();
        if (e.key === 'Escape') setEditingCell(null);
    };

    // Global KeyDown for Batch Delete
    useEffect(() => {
        const onGlobalKeyDown = (e: KeyboardEvent) => {
            if (editingCell) return;
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (selIds.length > 0) {
                    e.preventDefault();
                    setCtx({ x: window.innerWidth / 2, y: window.innerHeight / 2, type: 'Assignment', id: selIds[0], selIds });
                    onCtxAction?.('delAssignment');
                }
            }
        };
        window.addEventListener('keydown', onGlobalKeyDown);
        return () => window.removeEventListener('keydown', onGlobalKeyDown);
    }, [selIds, editingCell, setCtx]);

    // Handle the custom delete trigger to show confirmation
    useEffect(() => {
        const handleTriggerDelete = () => {
            // This will be handled by handleCtxAction in useProjectOperations if we set the ctx
            // Actually, we can just call handleCtxAction if we have access to it, 
            // but we don't here. So we rely on the context menu being "open" conceptually.
            // Or just trigger the delAssignment action.
            // Since we set the ctx, the context menu UI might flash. 
            // A better way is to pull the handler. 
        };
        // For now, setting ctx and letting useProjectOperations handle it via something else?
        // Wait, handleCtxAction is called with an action string.
    }, []);

    return (
        <div className="flex-grow flex flex-col h-full bg-white overflow-hidden relative" onClick={() => setCtx(null)}>
            {/* Header */}
            <div className="h-10 border-b bg-slate-50 flex items-center px-4 shrink-0 z-30">
                <div className="text-sm font-bold text-slate-700">{t('ResourceAllocation')}</div>
            </div>

            {/* Matrix Area */}
            <div className="flex-grow overflow-auto relative p6-table-body custom-scrollbar bg-slate-100/50 p-4 md:p-8">
                <style>{`
                    @media print {
                        .resource-usage-container {
                            display: block !important;
                            width: 100% !important;
                            overflow: visible !important;
                            padding: 0 !important;
                            background: white !important;
                        }
                        .resource-usage-table-wrapper {
                            display: block !important;
                            width: 100% !important;
                            overflow: visible !important;
                            box-shadow: none !important;
                            border: none !important;
                        }
                        table {
                            width: 100% !important;
                            table-layout: auto !important;
                            border-collapse: collapse !important;
                        }
                        th, td {
                            page-break-inside: avoid !important;
                        }
                        thead {
                            display: table-header-group !important;
                        }
                        .sticky {
                            position: static !important;
                            box-shadow: none !important;
                        }
                        .custom-scrollbar::-webkit-scrollbar {
                            display: none !important;
                        }
                    }
                `}</style>
                <div className="resource-usage-container min-h-full">
                    <div className="resource-usage-table-wrapper mx-auto w-fit bg-white border border-slate-200 overflow-hidden">
                        {assignedActivities.length > 0 ? (
                            <table className="border-collapse text-[12px] min-w-full table-fixed">
                                <thead className="sticky top-0 z-20 bg-slate-100 shadow-sm">
                                    <tr>
                                        {baseCols.map((c, i) => {
                                            const isFrozen = c.id === 'id' || c.id === 'name';
                                            const leftOffset = c.id === 'name' ? colWidths.id : 0;
                                            return (
                                                <th
                                                    key={c.id}
                                                    className={`border-b border-r border-slate-300 px-2 py-2 text-left text-slate-600 font-bold bg-slate-100 relative group
                                                        ${isFrozen ? 'sticky z-20' : ''}`}
                                                    style={{
                                                        width: colWidths[c.id],
                                                        minWidth: colWidths[c.id],
                                                        left: isFrozen ? leftOffset : undefined
                                                    }}
                                                >
                                                    <div className="truncate">{c.name}</div>
                                                    <div
                                                        className="absolute right-0 top-0 w-1.5 h-full cursor-col-resize hover:bg-blue-400/50 active:bg-blue-600 transition-colors z-10 print:hidden"
                                                        onMouseDown={(e) => handleMouseDown(e, c.id)}
                                                    />
                                                </th>
                                            );
                                        })}
                                        {resources.map(res => (
                                            <th
                                                key={res.id}
                                                className="border-b border-r border-slate-300 px-2 py-2 text-left text-slate-600 font-bold bg-slate-50 relative group"
                                                style={{ width: resWidths[res.id] || 100, minWidth: resWidths[res.id] || 100 }}
                                                title={res.name}
                                            >
                                                <div className="truncate">{res.name}</div>
                                                <div className="text-[10px] font-normal text-slate-400 capitalize">({t(res.type as any)})</div>
                                                <div
                                                    className="absolute right-0 top-0 w-1.5 h-full cursor-col-resize hover:bg-blue-400/50 active:bg-blue-600 transition-colors z-10 print:hidden"
                                                    onMouseDown={(e) => handleMouseDown(e, res.id, true)}
                                                />
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {assignedActivities.map((act, idx) => (
                                        <tr
                                            key={act.id}
                                            className={`
                                                ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} 
                                                ${selIds.includes(act.id) ? '!bg-blue-200 hover:!bg-blue-300' : 'hover:bg-blue-50'} 
                                                transition-colors group cursor-pointer
                                            `}
                                            onClick={(e) => handleRowClick(act.id, idx, e)}
                                            onContextMenu={(e) => handleContextMenu(e, act.id)}
                                        >
                                            <td
                                                className="border-b border-r border-slate-200 px-2 py-1 font-bold text-slate-700 sticky left-0 z-10 bg-inherit"
                                                style={{ width: colWidths.id, minWidth: colWidths.id }}
                                            >
                                                {act.id}
                                            </td>
                                            <td
                                                className="border-b border-r border-slate-200 px-2 py-1 truncate sticky z-10 bg-inherit"
                                                style={{ width: colWidths.name, minWidth: colWidths.name, left: colWidths.id }}
                                                title={act.name}
                                            >
                                                {act.name}
                                            </td>
                                            <td className="border-b border-r border-slate-200 px-2 py-1 text-left" style={{ width: colWidths.duration }}>{act.duration}</td>
                                            <td className="border-b border-r border-slate-200 px-2 py-1 text-left font-mono text-slate-600" style={{ width: colWidths.start }}>{formatDate(act.startDate)}</td>
                                            <td className="border-b border-r border-slate-200 px-2 py-1 text-left font-mono text-slate-600" style={{ width: colWidths.finish }}>{formatDate(act.endDate)}</td>

                                            {resources.map(res => {
                                                const val = getAssignmentValue(act.id, res.id);
                                                const isEditing = editingCell?.actId === act.id && editingCell?.resId === res.id;

                                                return (
                                                    <td
                                                        key={res.id}
                                                        className={`border-b border-r border-slate-200 px-2 py-1 text-left select-none cursor-pointer hover:bg-blue-100/50 ${val !== null ? 'bg-blue-50/30' : ''}`}
                                                        style={{ width: resWidths[res.id] || 100, minWidth: resWidths[res.id] || 100 }}
                                                        onDoubleClick={(e) => { e.stopPropagation(); handleStartEdit(act.id, res.id, val); }}
                                                    >
                                                        {isEditing ? (
                                                            <input
                                                                ref={inputRef}
                                                                type="number"
                                                                value={editValue}
                                                                onChange={(e) => setEditValue(e.target.value)}
                                                                onBlur={handleSaveEdit}
                                                                onKeyDown={handleKeyDown}
                                                                className="w-full h-full border border-blue-500 rounded outline-none px-1 text-left font-semibold"
                                                            />
                                                        ) : (
                                                            val !== null ? (
                                                                <span className="font-semibold text-blue-900">{val}</span>
                                                            ) : (
                                                                <span className="text-slate-300">-</span>
                                                            )
                                                        )}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div
                                className="p-8 text-center text-slate-400 flex flex-grow flex-col items-center gap-2"
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    setCtx({ x: e.pageX, y: e.pageY, type: 'Assignment', id: 'null' });
                                }}
                            >
                                <svg className="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                                <span>{t('NoResourceAssignments')}</span>
                            </div>
                        )}
                    </div>
                    {/* Bottom padding for easier data entry - hidden in print */}
                    <div className="h-72 w-full print:hidden" />
                </div>
            </div>
        </div>
    );
};

export default ResourceUsagePanel;
