import React, { useMemo, useState } from 'react';
import { Resource, Assignment, Activity } from '../types';

interface ResourceHistogramProps {
    resource: Resource;
    assignments: Assignment[];
    activities: Activity[];
}

type Period = 'Day' | 'Week' | 'Month';

const ResourceHistogram: React.FC<ResourceHistogramProps> = ({ resource, assignments, activities }) => {
    const [period, setPeriod] = useState<Period>('Week');

    const data = useMemo(() => {
        // Daily Usage Map
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
            } else {
                periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2,'0')}-01`;
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

    const maxVal = Math.max(...data.map(d => d.value), resource.maxUnits * (resource.type === 'Material' && period !== 'Day' ? 10 : 1.2)) || 10;
    const height = 150;
    const barWidth = Math.max(20, Math.min(50, 600 / data.length));
    const totalWidth = Math.max(data.length * (barWidth + 5), 100); // Dynamic width

    return (
        <div className="p-4 bg-white rounded-sm border border-slate-300 shadow-sm flex flex-col flex-grow">
            <div className="flex justify-between mb-4 border-b border-slate-100 pb-2">
                <div>
                    <h4 className="text-sm font-bold text-slate-700">
                        {resource.type === 'Material' ? 'Consumption' : 'Intensity'} Analysis
                    </h4>
                    <p className="text-[10px] text-slate-500">
                        {resource.type === 'Material' ? 'Cumulative Sum' : 'Peak Daily Usage'} per {period}
                    </p>
                </div>
                <div className="flex gap-2">
                    {['Day', 'Week', 'Month'].map(p => (
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
            
            {data.length === 0 ? (
                <div className="h-[150px] flex items-center justify-center text-slate-400 text-xs">No assignments found for this period.</div>
            ) : (
                // Added overflow-x-auto for horizontal scrolling
                <div className="overflow-x-auto overflow-y-hidden custom-scrollbar pb-2">
                    <svg height={height + 40} width={totalWidth} className="min-w-full">
                        {/* Limit Line (Only for Labor/Equipment) */}
                        {resource.type !== 'Material' && (
                            <>
                                <line x1="0" y1={height - (resource.maxUnits / maxVal * height)} x2="100%" y2={height - (resource.maxUnits / maxVal * height)} stroke="red" strokeDasharray="4" opacity="0.5" />
                                <text x="2" y={height - (resource.maxUnits / maxVal * height) - 5} fill="red" fontSize="10">Max Limit</text>
                            </>
                        )}

                        {data.map((d, i) => {
                            const h = (d.value / maxVal) * height;
                            const x = i * (barWidth + 5);
                            const isOverLimit = resource.type !== 'Material' && d.value > resource.maxUnits;
                            
                            return (
                                <g key={d.date}>
                                    <rect 
                                        x={x} 
                                        y={height - h} 
                                        width={barWidth} 
                                        height={h} 
                                        fill={isOverLimit ? '#ef4444' : (resource.type === 'Material' ? '#10b981' : '#3b82f6')} 
                                    />
                                    <text x={x} y={height + 15} fontSize="9" fill="#64748b" transform={`rotate(0 ${x},${height+15})`}>{d.date.substring(5)}</text>
                                    <text x={x + barWidth/2} y={height - h - 5} fontSize="9" fill="#334155" textAnchor="middle">{d.value.toLocaleString()}</text>
                                </g>
                            )
                        })}
                    </svg>
                </div>
            )}
        </div>
    );
};

export default ResourceHistogram;