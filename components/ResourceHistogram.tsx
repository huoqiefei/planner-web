import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Resource, Assignment, Activity } from '../types';
import { useAppStore } from '../stores/useAppStore';

interface ResourceHistogramProps {
    resourceId: string;
}

type Period = 'Day' | 'Week' | 'Month' | 'Quarter' | 'Year';

const ResourceHistogram: React.FC<ResourceHistogramProps> = ({ resourceId }) => {
    const { data: projectData, schedule } = useAppStore();
    const [period, setPeriod] = useState<Period>('Week');
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerHeight, setContainerHeight] = useState(250);

    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(entries => {
            for (let entry of entries) {
                if(entry.contentRect.height > 50) {
                    setContainerHeight(entry.contentRect.height);
                }
            }
        });
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    const resource = useMemo(() => 
        projectData?.resources.find(r => r.id === resourceId), 
    [projectData, resourceId]);

    const assignments = projectData?.assignments || [];
    const activities = schedule.activities || [];

    const histogramData = useMemo(() => {
        if (!resource) return [];

        const dailyUsage: Record<string, number> = {};

        activities.forEach(act => {
            const assign = assignments.find(a => a.activityId === act.id && a.resourceId === resource.id);
            if (!assign) return;

            let current = new Date(act.startDate);
            const end = new Date(act.endDate);
            // Safety break
            let loop = 0;
            // Iterate day by day for the activity
            while(current <= end && loop < 3000) { 
                loop++;
                const key = current.toISOString().split('T')[0];
                dailyUsage[key] = (dailyUsage[key] || 0) + assign.units;
                current.setDate(current.getDate() + 1);
            }
        });

        // Now aggregate based on Period and Resource Type
        const aggregatedMap: Record<string, number> = {};
        
        Object.keys(dailyUsage).forEach(dateStr => {
            const date = new Date(dateStr);
            let periodKey = '';
            
            if (period === 'Day') {
                periodKey = dateStr;
            } else if (period === 'Week') {
                const d = new Date(date);
                const day = d.getDay(); // 0-6
                const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
                const monday = new Date(d.setDate(diff));
                periodKey = monday.toISOString().split('T')[0];
            } else if (period === 'Month') {
                periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-01`;
            } else if (period === 'Quarter') {
                const q = Math.floor(date.getMonth() / 3);
                const startMonth = q * 3;
                periodKey = `${date.getFullYear()}-${String(startMonth + 1).padStart(2,'0')}-01`;
            } else { // Year
                periodKey = `${date.getFullYear()}-01-01`;
            }

            if (resource.type === 'Material') {
                // Accumulate Sum for Material
                aggregatedMap[periodKey] = (aggregatedMap[periodKey] || 0) + dailyUsage[dateStr];
            } else {
                // Labor/Equipment: Peak Usage (Max of days in that period)
                const currentMax = aggregatedMap[periodKey] || 0;
                aggregatedMap[periodKey] = Math.max(currentMax, dailyUsage[dateStr]);
            }
        });

        const sortedKeys = Object.keys(aggregatedMap).sort();
        if (sortedKeys.length === 0) return [];
        
        return sortedKeys.map(k => ({ date: k, value: aggregatedMap[k] }));

    }, [resource, assignments, activities, period]);

    const downloadCSV = () => {
        if (histogramData.length === 0) return;
        const headers = ['Date', 'Value'];
        const rows = histogramData.map(d => `${d.date},${d.value}`);
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `${resource.name}_histogram.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!resource) return <div className="p-4 text-slate-400">Resource not found</div>;

    const maxVal = Math.max(...histogramData.map(d => d.value), resource.maxUnits * (resource.type === 'Material' && period !== 'Day' ? 10 : 1.2)) || 10;
    const height = Math.max(100, containerHeight - 80); 
    const leftMargin = 60; // Increased space for Y-axis labels
    const bottomMargin = 60; // Increased space for X-axis labels (rotated)
    const barWidth = Math.max(30, Math.min(60, 800 / histogramData.length)); // Slightly wider bars
    const totalWidth = Math.max(histogramData.length * (barWidth + 10) + leftMargin, 100);

    return (
        <div ref={containerRef} className="p-4 bg-white rounded-sm border border-slate-300 shadow-sm flex flex-col flex-grow h-full">
            <div className="flex justify-between mb-4 border-b border-slate-100 pb-2 flex-shrink-0">
                <div>
                    <h4 className="text-sm font-bold text-slate-700">
                        {resource.type === 'Material' ? 'Consumption' : 'Intensity'} Analysis
                    </h4>
                    <p className="text-[10px] text-slate-500">
                        {resource.type === 'Material' ? 'Cumulative Sum' : 'Peak Daily Usage'} per {period}
                    </p>
                </div>
                <div className="flex gap-2 items-center">
                    <button 
                        onClick={downloadCSV}
                        className="px-2 py-1 text-xs rounded border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 mr-2"
                        title="Export CSV"
                    >
                        Export CSV
                    </button>
                    {['Day', 'Week', 'Month', 'Quarter', 'Year'].map(p => (
                        <button 
                            key={p} 
                            onClick={() => setPeriod(p as Period)}
                            className={`px-2 py-1 text-xs rounded border transition-colors ${period === p ? 'bg-blue-50 border-blue-400 text-blue-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>
            
            {histogramData.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-slate-400 text-xs">No assignments found for this period.</div>
            ) : (
                <div className="overflow-x-auto overflow-y-hidden custom-scrollbar pb-2 relative">
                    <div className="flex">
                        {/* Fixed Y-Axis */}
                        <div className="flex-shrink-0 border-r border-slate-300 mr-1 relative" style={{ width: leftMargin, height: height + bottomMargin }}>
                            {[0, 0.25, 0.5, 0.75, 1].map(ratio => (
                                <div key={ratio} className="absolute right-2 text-[11px] font-medium text-slate-600" style={{ bottom: ratio * height + bottomMargin - 8 }}>
                                    {Math.round(maxVal * ratio).toLocaleString()}
                                </div>
                            ))}
                            {/* Y-Axis Title */}
                            <div className="absolute -left-2 top-1/2 -rotate-90 text-[10px] text-slate-400 font-bold tracking-wider whitespace-nowrap" style={{ transformOrigin: 'center' }}>UNITS</div>
                        </div>

                        {/* Scrollable Chart Area */}
                        <svg height={height + bottomMargin + 20} width={totalWidth - leftMargin} className="min-w-full">
                            {/* Grid Lines */}
                            {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
                                const y = height - (ratio * height);
                                return (
                                    <line key={ratio} x1="0" y1={y} x2="100%" y2={y} stroke="#e2e8f0" strokeWidth="1" />
                                );
                            })}

                            {/* X-Axis Line */}
                            <line x1="0" y1={height} x2="100%" y2={height} stroke="#64748b" strokeWidth="2" />

                            {/* Limit Line (Only for Labor/Equipment) */}
                            {resource.type !== 'Material' && (
                                <>
                                    <line x1="0" y1={height - (resource.maxUnits / maxVal * height)} x2="100%" y2={height - (resource.maxUnits / maxVal * height)} stroke="red" strokeDasharray="4" opacity="0.6" strokeWidth="1.5" />
                                    {/* Label for limit line moved to chart area to be visible */}
                                    <text x="5" y={height - (resource.maxUnits / maxVal * height) - 5} fill="red" fontSize="11" fontWeight="bold">Max Limit ({resource.maxUnits})</text>
                                </>
                            )}

                            {histogramData.map((d, i) => {
                                const h = (d.value / maxVal) * height;
                                const x = i * (barWidth + 10) + 10; // Added spacing
                                const isOverLimit = resource.type !== 'Material' && d.value > resource.maxUnits;
                                
                                return (
                                    <g key={d.date}>
                                        <rect 
                                            x={x} 
                                            y={height - h} 
                                            width={barWidth} 
                                            height={h} 
                                            fill={isOverLimit ? '#ef4444' : (resource.type === 'Material' ? '#10b981' : '#3b82f6')} 
                                            rx="2"
                                        >
                                            <title>{d.date}: {d.value}</title>
                                        </rect>
                                        {/* X-Axis Labels - Rotated for clarity */}
                                        <text 
                                            x={x + barWidth/2} 
                                            y={height + 15} 
                                            fontSize="10" 
                                            fill="#475569" 
                                            textAnchor="end" 
                                            fontWeight="500"
                                            transform={`rotate(-45, ${x + barWidth/2}, ${height + 15})`}
                                        >
                                            {period === 'Year' ? d.date.substring(0, 4) : 
                                             period === 'Quarter' ? `Q${Math.ceil(parseInt(d.date.substring(5,7))/3)} '${d.date.substring(2,4)}` : 
                                             period === 'Month' ? d.date.substring(0, 7) : 
                                             d.date.substring(5)}
                                        </text>
                                        {/* Value on Bar - Only if it fits or is significant */}
                                        {barWidth > 25 && (
                                            <text x={x + barWidth/2} y={height - h - 5} fontSize="10" fontWeight="bold" fill="#1e293b" textAnchor="middle">{d.value.toLocaleString()}</text>
                                        )}
                                    </g>
                                )
                            })}
                        </svg>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ResourceHistogram;
