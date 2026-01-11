import { useMemo, useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { matchFilter } from '../utils/filterUtils';

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
        setExpandedWbsIds,
        activityFilters
    } = useAppStore();

    const wbsMap = schedule.wbsMap;

    // Initial Expand
    useEffect(() => {
        if (projectData && projectData.wbs.length > 0 && Object.keys(expandedWbsIds).length === 0) {
            const all: Record<string, boolean> = {};
            projectData.wbs.forEach(w => all[w.id] = true);
            setExpandedWbsIds(all);
        }
    }, [projectData?.wbs.length]);

    const toggleExpand = (id: string) => {
        setExpandedWbsIds(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const flatRows = useMemo(() => {
        const rows: FlatRow[] = [];
        if (!projectData) return rows;

        // Optimization: Pre-process maps for O(1) lookup
        const wbsChildrenMap: Record<string, typeof projectData.wbs> = { root: [] };
        const wbsParentMap: Record<string, string> = {}; // For upward traversal

        projectData.wbs.forEach(w => {
            const pid = w.parentId && w.parentId !== 'null' ? w.parentId : 'root';
            if (!wbsChildrenMap[pid]) wbsChildrenMap[pid] = [];
            wbsChildrenMap[pid].push(w);
            if (pid !== 'root') wbsParentMap[w.id] = pid;
        });

        const wbsActivitiesMap: Record<string, typeof schedule.activities> = {};
        schedule.activities.forEach(a => {
            if (!wbsActivitiesMap[a.wbsId]) wbsActivitiesMap[a.wbsId] = [];
            wbsActivitiesMap[a.wbsId].push(a);
        });

        const isFiltering = activityFilters && activityFilters.length > 0;
        const visibleIds = new Set<string>();

        if (isFiltering) {

            // 1. Check Activities
            schedule.activities.forEach(act => {
                if (matchFilter(act, activityFilters)) {
                    visibleIds.add(act.id);
                    // Add ancestors
                    let currWbsId = act.wbsId;
                    while (currWbsId) {
                        visibleIds.add(currWbsId);
                        currWbsId = wbsParentMap[currWbsId];
                    }
                }
            });

            // 2. Check WBS Nodes
            projectData.wbs.forEach(w => {
                // Check if WBS itself matches filter (e.g. name filter)
                if (matchFilter(w, activityFilters)) {
                    visibleIds.add(w.id);
                    let currId = w.id;
                    while (currId && wbsParentMap[currId]) {
                        currId = wbsParentMap[currId];
                        visibleIds.add(currId);
                    }
                    if (w.parentId && w.parentId !== 'null' && w.parentId !== 'root') visibleIds.add(w.parentId); // Ensure immediate parent always added
                }
            });
        }

        const recurse = (parentId: string | 'root', depth: number) => {
            const childrenWbs = wbsChildrenMap[parentId] || [];

            childrenWbs.forEach(node => {
                if (isFiltering && !visibleIds.has(node.id)) return; // Skip if filter active and not visible

                const isExp = isFiltering ? true : (expandedWbsIds[node.id] !== false);
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
                    const nodeActs = wbsActivitiesMap[node.id] || [];
                    nodeActs.forEach(act => {
                        if (isFiltering && !visibleIds.has(act.id)) return;
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
        recurse('root', 0);
        return rows;
    }, [projectData, schedule, wbsMap, expandedWbsIds, activityFilters]);

    return { flatRows, toggleExpand };
};
