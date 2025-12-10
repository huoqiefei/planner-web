import React, { useMemo } from 'react';
import { ProjectData, Activity } from '../types';

interface DashboardProps {
    projectData: ProjectData;
    scheduledActivities: Activity[];
    projectDuration: number;
}

const StatCard: React.FC<{ title: string, value: string | number, icon: React.ReactElement, color: string }> = ({ title, value, icon, color }) => (
    <div className="bg-white p-4 rounded-sm border border-slate-200 shadow-sm flex items-center">
        <div className={`p-3 rounded-full mr-4 bg-${color}-50`}>
            {icon}
        </div>
        <div>
            <p className="text-xs text-slate-500 uppercase font-semibold">{title}</p>
            <p className="text-xl font-bold text-slate-800">{value}</p>
        </div>
    </div>
);

const Dashboard: React.FC<DashboardProps> = ({ projectData, scheduledActivities, projectDuration }) => {
    
    const dashboardStats = useMemo(() => {
        const totalCost = projectData.activities.reduce((sum, act) => sum + act.budgetedCost, 0);
        const criticalTasks = scheduledActivities.filter(act => act.isCritical).length;
        
        const now = new Date();
        const upcomingMilestones = scheduledActivities
            .filter(act => act.duration === 0 && act.startDate > now)
            .sort((a,b) => a.startDate.getTime() - b.startDate.getTime())
            .slice(0, 5);

        return {
            totalCost,
            criticalTasks,
            upcomingMilestones
        };
    }, [projectData, scheduledActivities]);

    const formatCurrency = (amount: number): string => {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);
    };
    
    const formatDate = (date: Date): string => {
        if (isNaN(date.getTime())) return 'N/A';
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    return (
        <div className="flex-grow bg-slate-100 overflow-y-auto p-6 space-y-6">
            <h2 className="text-xl font-semibold text-slate-800 border-b border-slate-200 pb-2">Project Overview</h2>
            
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard 
                    title="Total Duration" 
                    value={`${projectDuration} Days`} 
                    color="blue"
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
                />
                <StatCard 
                    title="Total Budget" 
                    value={formatCurrency(dashboardStats.totalCost)} 
                    color="green"
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v.01" /></svg>}
                />
                <StatCard 
                    title="Total Activities" 
                    value={projectData.activities.length} 
                    color="indigo"
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>}
                />
                <StatCard 
                    title="Critical Tasks" 
                    value={dashboardStats.criticalTasks} 
                    color="red"
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>}
                />
            </div>
            
            {/* Milestones and Risks */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                 <div className="bg-white p-4 rounded-sm border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase">Upcoming Milestones</h3>
                    {dashboardStats.upcomingMilestones.length > 0 ? (
                        <ul className="space-y-2">
                            {dashboardStats.upcomingMilestones.map(milestone => (
                                <li key={milestone.id} className="flex justify-between items-center bg-slate-50 p-2 rounded border border-slate-100">
                                    <span className="font-medium text-slate-700 text-sm">{milestone.name}</span>
                                    <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">{formatDate(milestone.startDate)}</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-slate-400 text-center py-4 text-sm">No upcoming milestones found.</p>
                    )}
                 </div>
                 
                 <div className="bg-white p-4 rounded-sm border border-slate-200 shadow-sm">
                    <h3 className="text-sm font-bold text-slate-700 mb-4 uppercase">Notifications</h3>
                    <div className="text-slate-500 text-center py-4 text-sm">
                        <p>No critical alerts.</p>
                    </div>
                 </div>
            </div>
        </div>
    );
};

export default Dashboard;