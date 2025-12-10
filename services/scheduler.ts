
import { Activity, Calendar, ProjectData, ScheduleResult, Predecessor } from '../types';

export function getCalendar(calendarId: string | undefined, data: ProjectData): Calendar {
    const calendars = data.calendars || []; 
    const def = calendars.find(c => c.id === data.meta?.defaultCalendarId) || calendars.find(c => c.isDefault);
    return calendars.find(c => c.id === calendarId) || def || { 
        id: 'default', name: 'Standard', isDefault: true, 
        weekDays: [false, true, true, true, true, true, false], 
        hoursPerDay: 8, exceptions: [] 
    };
}

export function isWorkingDay(date: Date, calendar: Calendar): boolean {
    const dateString = date.toISOString().split('T')[0];
    const exception = calendar.exceptions?.find(e => e.date === dateString);
    if (exception) return exception.isWorking;
    return calendar.weekDays[date.getDay()];
}

export function findNextWorkingDay(date: Date, calendar: Calendar, direction: 'forward' | 'backward' = 'forward'): Date {
    let curr = new Date(date);
    // If we are currently on a non-working day, move until we hit a working day
    let loops = 0;
    while (!isWorkingDay(curr, calendar) && loops < 3650) {
        curr.setDate(curr.getDate() + (direction === 'forward' ? 1 : -1));
        loops++;
    }
    return curr;
}

export function addWorkingDays(start: Date, days: number, calendar: Calendar): Date {
    let curr = new Date(start);
    
    // Initial check: if start is non-working, move to next working day before counting
    if (!isWorkingDay(curr, calendar)) {
        curr = findNextWorkingDay(curr, calendar, days >= 0 ? 'forward' : 'backward');
    }

    if (days === 0) return curr;

    let remaining = Math.abs(days);
    const direction = days > 0 ? 1 : -1;
    let loops = 0;

    while (remaining > 0 && loops < 5000) {
        curr.setDate(curr.getDate() + direction);
        if (isWorkingDay(curr, calendar)) {
            remaining--;
        }
        loops++;
    }
    return curr;
}

// Fixed logic: Finish date is inclusive of the work day. 
export function calculateFinish(start: Date, duration: number, calendar: Calendar): Date {
    if (duration <= 0) return new Date(start); // Milestones
    return addWorkingDays(start, duration - 1, calendar);
}

// Start calculation from finish
export function calculateStart(finish: Date, duration: number, calendar: Calendar): Date {
    if (duration <= 0) return new Date(finish);
    return addWorkingDays(finish, -(duration - 1), calendar);
}

export function calculateSchedule(projectData: ProjectData): ScheduleResult {
    const { activities, meta } = projectData;
    if (!activities || activities.length === 0) return { activities: [], wbsMap: {} };
    
    const projectStartDate = meta?.projectStartDate ? new Date(meta.projectStartDate) : new Date();
    const activityMap: Record<string, Activity> = {};
    
    // Initialize
    const scheduledActivities: Activity[] = activities.map(a => ({
        ...a,
        predecessors: Array.isArray(a.predecessors) ? a.predecessors : [],
        startDate: new Date(), endDate: new Date(),
        earlyStart: new Date(0), earlyFinish: new Date(0),
        lateStart: new Date(0), lateFinish: new Date(0),
        totalFloat: 0, isCritical: false,
        activityType: a.activityType || (a.duration === 0 ? 'Finish Milestone' : 'Task')
    }));
    
    scheduledActivities.forEach(act => activityMap[act.id] = act);

    // --- 1. Forward Pass ---
    for (let pass = 0; pass < activities.length + 2; pass++) {
        let changed = false;
        scheduledActivities.forEach(act => {
            const calendar = getCalendar(act.calendarId, projectData);
            let calculatedEarlyStart = new Date(projectStartDate);

            // Predecessor Logic
            if (act.predecessors.length > 0) {
                let maxStart = new Date(0);
                act.predecessors.forEach(pred => {
                    const pAct = activityMap[pred.activityId];
                    if (!pAct) return;
                    let constraintDate = new Date(0);
                    const pFinish = new Date(pAct.earlyFinish);
                    const pStart = new Date(pAct.earlyStart);
                    const lag = pred.lag || 0;

                    if (pred.type === 'FS') {
                        // Finish to Start: Pred Finish + Lag + 1 Day (next day)
                        let d = addWorkingDays(pFinish, lag, calendar); 
                        d.setDate(d.getDate() + 1); 
                        d = findNextWorkingDay(d, calendar, 'forward');
                        constraintDate = d;
                    } else if (pred.type === 'SS') {
                        constraintDate = addWorkingDays(pStart, lag, calendar);
                    } else if (pred.type === 'FF') {
                        let finishConstraint = addWorkingDays(pFinish, lag, calendar);
                        constraintDate = calculateStart(finishConstraint, act.duration, calendar);
                    } else if (pred.type === 'SF') {
                        let finishConstraint = addWorkingDays(pStart, lag, calendar);
                        constraintDate = calculateStart(finishConstraint, act.duration, calendar);
                    }
                    if (constraintDate > maxStart) maxStart = constraintDate;
                });
                calculatedEarlyStart = maxStart;
                
                if (calculatedEarlyStart < projectStartDate) calculatedEarlyStart = new Date(projectStartDate);
                calculatedEarlyStart = findNextWorkingDay(calculatedEarlyStart, calendar, 'forward');
            } else {
                calculatedEarlyStart = findNextWorkingDay(projectStartDate, calendar, 'forward');
            }

            if (Math.abs(calculatedEarlyStart.getTime() - act.earlyStart.getTime()) > 1000) {
                act.earlyStart = calculatedEarlyStart;
                act.earlyFinish = calculateFinish(act.earlyStart, act.duration, calendar);
                changed = true;
            }
        });
        if (!changed) break;
    }

    // --- 2. Backward Pass ---
    
    // Find Project Finish Date (Max Early Finish)
    let maxProjectFinish = new Date(0);
    scheduledActivities.forEach(a => { if(a.earlyFinish > maxProjectFinish) maxProjectFinish = a.earlyFinish; });

    // Initialize Late dates to Project Finish
    scheduledActivities.forEach(act => {
        act.lateFinish = new Date(maxProjectFinish);
        const calendar = getCalendar(act.calendarId, projectData);
        act.lateStart = calculateStart(act.lateFinish, act.duration, calendar);
    });

    // Build Successor Map for efficient backward pass
    const successorMap: Record<string, { id: string, type: string, lag: number }[]> = {};
    scheduledActivities.forEach(act => {
        act.predecessors.forEach(p => {
            if (!successorMap[p.activityId]) successorMap[p.activityId] = [];
            successorMap[p.activityId].push({ id: act.id, type: p.type || 'FS', lag: p.lag || 0 });
        });
    });

    // Backward Loop
    for (let pass = 0; pass < activities.length + 2; pass++) {
        let changed = false;
        // Iterate roughly reverse order for speed, but loop handles convergence
        for (let i = scheduledActivities.length - 1; i >= 0; i--) {
            const act = scheduledActivities[i];
            const successors = successorMap[act.id] || [];
            
            const calendar = getCalendar(act.calendarId, projectData);
            let calculatedLateFinish = new Date(maxProjectFinish);

            if (successors.length > 0) {
                let minLateFinish = new Date(8640000000000000); // Max Date

                successors.forEach(succ => {
                    const sAct = activityMap[succ.id];
                    if (!sAct) return;

                    const sStart = new Date(sAct.lateStart);
                    const sFinish = new Date(sAct.lateFinish);
                    const lag = succ.lag;
                    
                    let constraintDate = new Date(maxProjectFinish);

                    // Logic: Pred.LateDate <= Succ.LateDate - Relationship Logic
                    // We reverse the forward pass logic.
                    
                    if (succ.type === 'FS') {
                        // S.Start = P.Finish + Lag + 1
                        // P.Finish = S.Start - 1 - Lag
                        let d = new Date(sStart);
                        d.setDate(d.getDate() - 1); // Reverse the +1 day gap
                        d = addWorkingDays(d, -lag, calendar);
                        // Ensure it's a valid working day for finish
                        d = findNextWorkingDay(d, calendar, 'backward');
                        constraintDate = d;
                    } else if (succ.type === 'SS') {
                        // S.Start = P.Start + Lag
                        // P.Start = S.Start - Lag
                        // We need P.Finish, so calculate from P.Start
                        let pStart = addWorkingDays(sStart, -lag, calendar);
                        constraintDate = calculateFinish(pStart, act.duration, calendar);
                    } else if (succ.type === 'FF') {
                        // S.Finish = P.Finish + Lag
                        // P.Finish = S.Finish - Lag
                        constraintDate = addWorkingDays(sFinish, -lag, calendar);
                    } else if (succ.type === 'SF') {
                         // S.Finish = P.Start + Lag
                         // P.Start = S.Finish - Lag
                         let pStart = addWorkingDays(sFinish, -lag, calendar);
                         constraintDate = calculateFinish(pStart, act.duration, calendar);
                    }

                    if (constraintDate < minLateFinish) minLateFinish = constraintDate;
                });
                calculatedLateFinish = minLateFinish;
            } else {
                // No successors, constrained by project finish
                calculatedLateFinish = new Date(maxProjectFinish);
            }
            
            // Apply Late Finish
            if (Math.abs(calculatedLateFinish.getTime() - act.lateFinish.getTime()) > 1000) {
                 act.lateFinish = calculatedLateFinish;
                 act.lateStart = calculateStart(act.lateFinish, act.duration, calendar);
                 changed = true;
            }
        }
        if (!changed) break;
    }

    // --- 3. Finalize ---
    scheduledActivities.forEach(act => {
        // Total Float = Late Finish - Early Finish (or Late Start - Early Start)
        const floatMs = act.lateFinish.getTime() - act.earlyFinish.getTime();
        act.totalFloat = Math.round(floatMs / (1000 * 60 * 60 * 24));
        // Critical if float <= 0 (allowing for minor calc jitter)
        act.isCritical = act.totalFloat <= 0;
        
        act.startDate = act.earlyStart;
        act.endDate = act.earlyFinish;
    });

    // WBS Rollup Logic
    const wbsMap: Record<string, { startDate: Date; endDate: Date }> = {};
    const processWBS = (nodeId: string): { start: number | null, end: number | null } => {
        const childWBS = projectData.wbs.filter(w => w.parentId === nodeId);
        const childActs = scheduledActivities.filter(a => a.wbsId === nodeId);
        
        let startDates = childActs.map(a => a.startDate.getTime());
        let endDates = childActs.map(a => a.endDate.getTime());

        childWBS.forEach(child => {
            const childDates = processWBS(child.id);
            if(childDates.start) startDates.push(childDates.start);
            if(childDates.end) endDates.push(childDates.end);
        });

        const minStart = startDates.length ? new Date(Math.min(...startDates)) : null;
        const maxEnd = endDates.length ? new Date(Math.max(...endDates)) : null;
        
        if(minStart && maxEnd) {
            wbsMap[nodeId] = { startDate: minStart, endDate: maxEnd };
        }
        return { start: minStart?.getTime() || null, end: maxEnd?.getTime() || null };
    }
    
    projectData.wbs.filter(w => !w.parentId || w.parentId === 'null').forEach(r => processWBS(r.id));

    return { activities: activities.map(a => activityMap[a.id]), wbsMap };
}
