import { describe, it, expect } from 'vitest';
import { calculateSchedule, addWorkingDays, findNextWorkingDay, calculateStart, calculateFinish, getCalendar } from './scheduler';
import { ProjectData, Activity, Calendar } from '../types';

const defaultCalendar: Calendar = {
    id: 'default',
    name: 'Standard',
    isDefault: true,
    weekDays: [false, true, true, true, true, true, false], // Sun, Sat off
    hoursPerDay: 8,
    exceptions: []
};

const mockProject: ProjectData = {
    activities: [],
    resources: [],
    calendars: [defaultCalendar],
    wbs: [],
    assignments: [],
    meta: {
        title: 'Mock Project',
        projectCode: 'MOCK',
        projectStartDate: '2024-01-01', // Monday
        defaultCalendarId: 'default',
        activityIdPrefix: 'A',
        activityIdIncrement: 10,
        resourceIdPrefix: 'R',
        resourceIdIncrement: 1
    }
};

describe('Scheduler Service', () => {
    describe('Date Helpers', () => {
        it('should identify working days correctly', () => {
            // 2024-01-01 is Monday (Working)
            // 2024-01-06 is Saturday (Non-working)
            const mon = new Date('2024-01-01T12:00:00');
            const sat = new Date('2024-01-06T12:00:00');
            expect(defaultCalendar.weekDays[mon.getDay()]).toBe(true);
            expect(defaultCalendar.weekDays[sat.getDay()]).toBe(false);
        });

        it('should add working days correctly (Forward)', () => {
            // Mon Jan 1 + 2 days -> Wed Jan 3
            const start = new Date('2024-01-01T12:00:00');
            const res = addWorkingDays(start, 2, defaultCalendar);
            expect(res.toISOString().split('T')[0]).toBe('2024-01-03');
        });

        it('should skip weekends (Forward)', () => {
            // Fri Jan 5 + 1 day -> Mon Jan 8 (Sat/Sun skipped)
            const start = new Date('2024-01-05T12:00:00');
            const res = addWorkingDays(start, 1, defaultCalendar);
            expect(res.toISOString().split('T')[0]).toBe('2024-01-08');
        });

        it('should calculate finish date correctly (Duration logic)', () => {
            // 1 day duration: Start == Finish
            const start = new Date('2024-01-01T12:00:00');
            const res = calculateFinish(start, 1, defaultCalendar);
            expect(res.toISOString().split('T')[0]).toBe('2024-01-01');

            // 2 day duration: Jan 1 -> Jan 2
            const res2 = calculateFinish(start, 2, defaultCalendar);
            expect(res2.toISOString().split('T')[0]).toBe('2024-01-02');
        });
    });

    describe('CPM Scheduling', () => {
        it('should schedule a single task from project start', () => {
            const data: ProjectData = {
                ...mockProject,
                activities: [
                    { id: '1', name: 'A', duration: 5, predecessors: [] } as Activity
                ]
            };
            const res = calculateSchedule(data);
            const act = res.activities[0];

            // Jan 1 (Mon) + 5 days -> Jan 1, 2, 3, 4, 5 (Fri)
            expect(act.startDate.toISOString().split('T')[0]).toBe('2024-01-01');
            expect(act.endDate.toISOString().split('T')[0]).toBe('2024-01-05');
            // Critical
            expect(act.isCritical).toBe(true);
            expect(act.totalFloat).toBe(0);
        });

        it('should handle FS relationships', () => {
            const data: ProjectData = {
                ...mockProject,
                activities: [
                    { id: '1', name: 'A', duration: 2, predecessors: [] } as Activity, // Jan 1-2
                    { id: '2', name: 'B', duration: 2, predecessors: [{ activityId: '1', type: 'FS', lag: 0 }] } as Activity
                ]
            };
            const res = calculateSchedule(data);
            const a = res.activities.find(x => x.id === '1')!;
            const b = res.activities.find(x => x.id === '2')!;

            expect(a.endDate.toISOString().split('T')[0]).toBe('2024-01-02');
            // B starts after A finishes (Jan 2) -> Start Jan 3
            expect(b.startDate.toISOString().split('T')[0]).toBe('2024-01-03');
            expect(b.endDate.toISOString().split('T')[0]).toBe('2024-01-04');
        });

        it('should calculate float correctly', () => {
            // A (2d) -> B (2d)
            // C (1d) -> B
            // C has float because it only needs 1 day but has 2 days available (parallel to A)
            const data: ProjectData = {
                ...mockProject,
                activities: [
                    { id: '1', name: 'A', duration: 2, predecessors: [] } as Activity,
                    { id: '2', name: 'B', duration: 2, predecessors: [{ activityId: '1', type: 'FS' }, { activityId: '3', type: 'FS' }] } as Activity,
                    { id: '3', name: 'C', duration: 1, predecessors: [] } as Activity
                ]
            };
            const res = calculateSchedule(data);
            const c = res.activities.find(x => x.id === '3')!;

            // B starts at Jan 3 (Driven by A: Jan 1-2)
            // C takes 1 day (Jan 1). 
            // C late finish is Jan 2 (must finish before B starts).
            // C Float = Late Finish (Jan 2) - Early Finish (Jan 1) = 1 day.

            expect(c.startDate.toISOString().split('T')[0]).toBe('2024-01-01');
            expect(c.totalFloat).toBeGreaterThan(0);
            expect(c.isCritical).toBe(false);
        });
    });
});
