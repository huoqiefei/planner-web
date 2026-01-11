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
                if (entry.contentRect.height > 50) {
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

            // Calculate duration in days (inclusive)
            const durationMs = end.getTime() - current.getTime();
            const durationDays = Math.max(1, Math.round(durationMs / (1000 * 60 * 60 * 24)) + 1);

            // Determine daily value based on resource type
            // Material: Input is Total Quantity -> Spread over duration
            // Labor/Equipment: Input is Daily Peak / Intensity -> Constant per day
            let dailyValue = assign.units;
            if (resource.type === 'Material') {
                dailyValue = assign.units / durationDays;
            }

            // Safety break
            let loop = 0;
            // Iterate day by day for the activity
            while (current <= end && loop < 3000) {
                loop++;
                const key = current.toISOString().split('T')[0];
                dailyUsage[key] = (dailyUsage[key] || 0) + dailyValue; // Sum for concurrency
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
                periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
            } else if (period === 'Quarter') {
                const q = Math.floor(date.getMonth() / 3);
                const startMonth = q * 3;
                periodKey = `${date.getFullYear()}-${String(startMonth + 1).padStart(2, '0')}-01`;
            } else { // Year
                periodKey = `${date.getFullYear()}-01-01`;
            }

            if (resource.type === 'Material') {
                // Material: Accumulate Sum (Consumption over period)
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

    // Layout Calculation
    // Added topPadding (20) to ensure labels and bars don't hit the ceiling
    const topPadding = 20;
    const bottomMargin = 60;
    const leftMargin = 60;

    // Available height for the chart area
    const availableHeight = Math.max(100, containerHeight - 80);
    // Actual chart height (bars area) is availableHeight - topPadding
    const chartHeight = availableHeight - topPadding;

    const barWidth = Math.max(30, Math.min(60, 800 / histogramData.length));
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
                        className="px-3 py-1 text-xs font-bold rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-sm mr-2"
                        title="Export CSV"
                    >
                        Export CSV
                    </button>
                    <div className="flex bg-slate-100 p-0.5 rounded-full border border-slate-200">
                        {['Day', 'Week', 'Month', 'Quarter', 'Year'].map(p => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p as Period)}
                                className={`px-3 py-1 text-xs font-bold rounded-full transition-all ${period === p ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                {p}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {histogramData.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-slate-400 text-xs">No assignments found for this period.</div>
            ) : (
                <div className="overflow-x-auto overflow-y-hidden pb-2 relative flex-grow">
                    <div className="flex">
                        {/* Fixed Y-Axis */}
                        <div className="flex-shrink-0 border-r border-slate-300 mr-1 relative bg-white z-10" style={{ width: leftMargin, height: availableHeight + bottomMargin }}>
                            {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
                                const yPos = topPadding + (chartHeight * (1 - ratio));
                                return (
                                    <div key={ratio} className="absolute right-2 text-[11px] font-medium text-slate-600" style={{ top: yPos - 8 }}>
                                        {Math.round(maxVal * ratio).toLocaleString()}
                                    </div>
                                );
                            })}
                            {/* Y-Axis Title */}
                            <div className="absolute -left-2 top-1/2 -rotate-90 text-[10px] text-slate-400 font-bold tracking-wider whitespace-nowrap" style={{ transformOrigin: 'center' }}>UNITS</div>
                        </div>

                        {/* Scrollable Chart Area */}
                        <svg height={availableHeight + bottomMargin + 20} width={totalWidth - leftMargin} className="min-w-full">
                            {/* Grid Lines */}
                            {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
                                const y = topPadding + chartHeight * (1 - ratio);
                                return (
                                    <line key={ratio} x1="0" y1={y} x2="100%" y2={y} stroke="#e2e8f0" strokeWidth="1" />
                                );
                            })}

                            {/* X-Axis Line */}
                            <line x1="0" y1={topPadding + chartHeight} x2="100%" y2={topPadding + chartHeight} stroke="#64748b" strokeWidth="2" />

                            {/* Limit Line (Only for Labor/Equipment) */}
                            {resource.type !== 'Material' && (
                                <>
                                    <line
                                        x1="0"
                                        y1={topPadding + chartHeight - ((resource.maxUnits / maxVal) * chartHeight)}
                                        x2="100%"
                                        y2={topPadding + chartHeight - ((resource.maxUnits / maxVal) * chartHeight)}
                                        stroke="red" strokeDasharray="4" opacity="0.6" strokeWidth="1.5"
                                    />
                                    <text
                                        x="5"
                                        y={topPadding + chartHeight - ((resource.maxUnits / maxVal) * chartHeight) - 5}
                                        fill="red" fontSize="11" fontWeight="bold"
                                    >
                                        Max Limit ({resource.maxUnits})
                                    </text>
                                </>
                            )}

                            {histogramData.map((d, i) => {
                                const h = (d.value / maxVal) * chartHeight;
                                const x = i * (barWidth + 10) + 10;
                                const isOverLimit = resource.type !== 'Material' && d.value > resource.maxUnits;
                                const barY = topPadding + chartHeight - h;

                                return (
                                    <g key={d.date}>
                                        <rect
                                            x={x}
                                            y={barY}
                                            width={barWidth}
                                            height={h}
                                            fill={isOverLimit ? '#ef4444' : (resource.type === 'Material' ? '#10b981' : '#3b82f6')}
                                            rx="2"
                                        >
                                            <title>{d.date}: {d.value}</title>
                                        </rect>
                                        {/* X-Axis Labels */}
                                        <text
                                            x={x + barWidth / 2}
                                            y={availableHeight + 15}
                                            fontSize="10"
                                            fill="#475569"
                                            textAnchor="end"
                                            fontWeight="500"
                                            transform={`rotate(-45, ${x + barWidth / 2}, ${availableHeight + 15})`}
                                        >
                                            {period === 'Year' ? d.date.substring(0, 4) :
                                                period === 'Quarter' ? `Q${Math.ceil(parseInt(d.date.substring(5, 7)) / 3)} '${d.date.substring(2, 4)}` :
                                                    period === 'Month' ? d.date.substring(0, 7) :
                                                        d.date.substring(5)}
                                        </text>
                                        {/* Value on Bar */}
                                        {barWidth > 25 && (
                                            <text x={x + barWidth / 2} y={barY - 5} fontSize="10" fontWeight="bold" fill="#1e293b" textAnchor="middle">{d.value.toLocaleString()}</text>
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
