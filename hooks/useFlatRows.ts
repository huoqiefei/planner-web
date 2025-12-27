import { useMemo, useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';

export interface FlatRow {
    type: 'WBS' | 'Activity';
    id: string;
    data: any;
    depth: number;
    expanded?: boolean;
    startDate?: string | Date;
    endDate?: string | Date;
    duration?: number;
}

export const useFlatRows = () => {
    const { 
        data: projectData, 
        schedule, 
        expandedWbsIds,
        setExpandedWbsIds 
    } = useAppStore();

    const wbsMap = schedule.wbsMap;

    // Initial Expand
    useEffect(() => {
        if(projectData && projectData.wbs.length > 0 && Object.keys(expandedWbsIds).length === 0) {
            const all: Record<string, boolean> = {};
            projectData.wbs.forEach(w => all[w.id] = true);
            setExpandedWbsIds(all);
        }
    }, [projectData?.wbs.length]);

    const toggleExpand = (id: string) => {
        setExpandedWbsIds(prev => ({...prev, [id]: !prev[id]}));
    };

    const flatRows = useMemo(() => {
        const rows: FlatRow[] = [];
        if(!projectData) return rows;

        const recurse = (parentId: string | null, depth: number) => {
            const childrenWbs = projectData.wbs.filter(w => (parentId === null ? (!w.parentId || w.parentId === 'null') : w.parentId === parentId));
            
            childrenWbs.forEach(node => {
                const isExp = expandedWbsIds[node.id] !== false; // Default true
                const wbsInfo = wbsMap[node.id];
                
                rows.push({
                    type: 'WBS',
                    id: node.id,
                    data: node,
                    depth,
                    expanded: isExp,
                    startDate: wbsInfo?.startDate,
                    endDate: wbsInfo?.endDate,
                    duration: wbsInfo?.duration
                });

                if (isExp) {
                    // Activities
                    const nodeActs = schedule.activities.filter(a => a.wbsId === node.id);
                    nodeActs.forEach(act => {
                        rows.push({
                            type: 'Activity',
                            id: act.id,
                            data: act,
                            depth: depth + 1,
                            startDate: act.startDate,
                            endDate: act.endDate
                        });
                    });
                    // Child WBS
                    recurse(node.id, depth + 1);
                }
            });
        };
        recurse(null, 0);
        return rows;
    }, [projectData, schedule, wbsMap, expandedWbsIds]);

    return { flatRows, toggleExpand };
};
