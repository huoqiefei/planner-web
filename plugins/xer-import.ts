/**
 * P6 XER Import Plugin for Planner Web
 * 
 * This plugin adds the ability to import projects from Primavera P6 XER files.
 * XER is a tab-delimited text format used by Oracle Primavera P6.
 */

import { Plugin, PluginAPI } from '../utils/pluginSystem';
import { Activity, WBSNode, Calendar, ProjectData, CalendarException } from '../types';

interface XERTable {
    name: string;
    columns: string[];
    rows: Record<string, string>[];
}

interface ParsedXER {
    tables: Map<string, XERTable>;
    version?: string;
}

const xerImportPlugin: Plugin = {
    id: 'xer-import',
    name: 'P6 XER Import',
    version: '1.0.0',
    description: 'Import projects from Primavera P6 XER files',
    author: 'Planner Web Team',

    activate(api: PluginAPI) {
        // Add toolbar button
        api.toolbar.addButton({
            id: 'import-xer',
            icon: '📁',
            tooltip: 'Import P6 XER',
            position: 'left',
            onClick: () => this.showImportDialog(api)
        });

        // Register import hook
        api.hooks.on('onDataImport', ({ data, format }) => {
            if (format === 'xer') {
                return this.parseXERFile(data);
            }
        });

        console.log('XER Import plugin activated');
    },

    deactivate() {
        console.log('XER Import plugin deactivated');
    },

    async showImportDialog(api: PluginAPI) {
        const file = await api.ui.showFilePicker({ accept: '.xer' });
        if (!file || Array.isArray(file)) return;

        try {
            const text = await file.text();
            const parsed = this.parseXER(text);
            const project = this.convertToProject(parsed);
            
            const actCount = project.activities.length;
            const wbsCount = project.wbs.length;
            
            const confirmed = await api.ui.showConfirm(
                `Found ${wbsCount} WBS nodes and ${actCount} activities. Import?`
            );
            
            if (confirmed) {
                api.project.setData(project);
                api.project.recalculate();
                api.ui.showToast('XER import successful', 'success');
            }
        } catch (error) {
            api.ui.showAlert(`XER import failed: ${error}`, 'Error');
        }
    },

    async parseXERFile(file: File): Promise<ProjectData | null> {
        const text = await file.text();
        const parsed = this.parseXER(text);
        return this.convertToProject(parsed);
    },

    parseXER(content: string): ParsedXER {
        const lines = content.split('\n');
        const tables = new Map<string, XERTable>();
        let currentTable: XERTable | null = null;
        let version: string | undefined;

        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            // Check for ERMHDR (version info)
            if (trimmed.startsWith('ERMHDR')) {
                const parts = trimmed.split('\t');
                version = parts[1];
                continue;
            }

            // Table definition: %T TableName
            if (trimmed.startsWith('%T')) {
                const tableName = trimmed.substring(2).trim();
                currentTable = { name: tableName, columns: [], rows: [] };
                tables.set(tableName, currentTable);
                continue;
            }

            // Column definition: %F col1 col2 col3...
            if (trimmed.startsWith('%F') && currentTable) {
                currentTable.columns = trimmed.substring(2).trim().split('\t');
                continue;
            }

            // Data row: %R value1 value2 value3...
            if (trimmed.startsWith('%R') && currentTable) {
                const values = trimmed.substring(2).trim().split('\t');
                const row: Record<string, string> = {};
                currentTable.columns.forEach((col, i) => {
                    row[col] = values[i] || '';
                });
                currentTable.rows.push(row);
            }
        }

        return { tables, version };
    },

    convertToProject(parsed: ParsedXER): ProjectData {
        const projectTable = parsed.tables.get('PROJECT');
        const wbsTable = parsed.tables.get('PROJWBS');
        const taskTable = parsed.tables.get('TASK');
        const taskPredTable = parsed.tables.get('TASKPRED');
        const calendarTable = parsed.tables.get('CALENDAR');
        const exceptionTable = parsed.tables.get('EXCEPTION');

        // Get first project
        const projectRow = projectTable?.rows[0];
        const projectId = projectRow?.proj_id || '1';
        const projectName = projectRow?.proj_short_name || 'Imported Project';

        // Map WBS
        const wbsMap = new Map<string, string>(); // wbs_id -> our id
        const wbs: WBSNode[] = [];
        
        if (wbsTable) {
            // Filter WBS for this project
            const projectWbs = wbsTable.rows.filter(r => r.proj_id === projectId);
            
            // Sort by seq_num to maintain order
            projectWbs.sort((a, b) => parseInt(a.seq_num || '0') - parseInt(b.seq_num || '0'));
            
            projectWbs.forEach((row, index) => {
                const wbsId = row.wbs_short_name || `WBS.${index + 1}`;
                wbsMap.set(row.wbs_id, wbsId);
                
                const parentWbsId = row.parent_wbs_id;
                const parentId = parentWbsId ? wbsMap.get(parentWbsId) || null : null;
                
                wbs.push({
                    id: wbsId,
                    name: row.wbs_name || wbsId,
                    parentId
                });
            });
        }

        // Ensure root WBS exists
        if (wbs.length === 0) {
            wbs.push({ id: projectName, name: projectName, parentId: null });
        }

        // Map Activities
        const taskMap = new Map<string, string>(); // task_id -> our id
        const activities: Activity[] = [];
        
        if (taskTable) {
            const projectTasks = taskTable.rows.filter(r => r.proj_id === projectId);
            
            projectTasks.forEach(row => {
                const actId = row.task_code || row.task_id;
                taskMap.set(row.task_id, actId);
                
                const wbsId = wbsMap.get(row.wbs_id) || wbs[0]?.id || projectName;
                const duration = parseInt(row.target_drtn_hr_cnt || '0') / 8; // Convert hours to days
                
                const startDate = this.parseP6Date(row.target_start_date || row.early_start_date);
                const endDate = this.parseP6Date(row.target_end_date || row.early_end_date);
                
                activities.push({
                    id: actId,
                    name: row.task_name || actId,
                    wbsId,
                    activityType: this.mapTaskType(row.task_type),
                    duration: duration || 1,
                    startDate,
                    endDate,
                    predecessors: [],
                    earlyStart: startDate,
                    earlyFinish: endDate,
                    lateStart: startDate,
                    lateFinish: endDate,
                    totalFloat: parseInt(row.total_float_hr_cnt || '0') / 8,
                    budgetedCost: parseFloat(row.target_cost || '0'),
                });
            });
        }

        // Map Predecessors
        if (taskPredTable) {
            taskPredTable.rows.forEach(row => {
                const taskId = taskMap.get(row.task_id);
                const predTaskId = taskMap.get(row.pred_task_id);
                
                if (taskId && predTaskId) {
                    const activity = activities.find(a => a.id === taskId);
                    if (activity) {
                        activity.predecessors.push({
                            activityId: predTaskId,
                            type: this.mapRelationType(row.pred_type),
                            lag: parseInt(row.lag_hr_cnt || '0') / 8
                        });
                    }
                }
            });
        }

        // Map Calendars
        const calendars: Calendar[] = [];
        const calMap = new Map<string, string>();
        
        if (calendarTable) {
            calendarTable.rows.forEach((row, index) => {
                const calId = `CAL${index + 1}`;
                calMap.set(row.clndr_id, calId);
                
                calendars.push({
                    id: calId,
                    name: row.clndr_name || calId,
                    isDefault: row.default_flag === 'Y',
                    weekDays: this.parseWorkWeek(row),
                    hoursPerDay: parseFloat(row.day_hr_cnt || '8'),
                    exceptions: []
                });
            });
        }

        // Add default calendar if none
        if (calendars.length === 0) {
            calendars.push({
                id: 'DEFAULT',
                name: 'Standard',
                isDefault: true,
                weekDays: [false, true, true, true, true, true, false],
                hoursPerDay: 8,
                exceptions: []
            });
        }

        return {
            meta: {
                title: projectName,
                projectCode: projectRow?.proj_short_name || 'PROJ',
                projectStartDate: this.formatDate(this.parseP6Date(projectRow?.plan_start_date)),
                defaultCalendarId: calendars.find(c => c.isDefault)?.id || calendars[0].id,
                activityIdPrefix: 'A',
                activityIdIncrement: 10,
                resourceIdPrefix: 'R',
                resourceIdIncrement: 10
            },
            wbs,
            activities,
            resources: [],
            assignments: [],
            calendars
        };
    },

    parseP6Date(dateStr: string | undefined): Date {
        if (!dateStr) return new Date();
        // P6 date format: YYYY-MM-DD or YYYY-MM-DD HH:MM
        const parts = dateStr.split(' ')[0].split('-');
        if (parts.length === 3) {
            return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
        return new Date();
    },

    formatDate(date: Date): string {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    mapTaskType(type: string): 'Task' | 'Start Milestone' | 'Finish Milestone' {
        switch (type) {
            case 'TT_Mile': return 'Finish Milestone';
            case 'TT_FinMile': return 'Finish Milestone';
            case 'TT_StartMile': return 'Start Milestone';
            default: return 'Task';
        }
    },

    mapRelationType(type: string): 'FS' | 'SS' | 'FF' | 'SF' {
        switch (type) {
            case 'PR_FS': return 'FS';
            case 'PR_SS': return 'SS';
            case 'PR_FF': return 'FF';
            case 'PR_SF': return 'SF';
            default: return 'FS';
        }
    },

    parseWorkWeek(row: Record<string, string>): boolean[] {
        // Default: Mon-Fri working
        return [
            false, // Sunday
            true,  // Monday
            true,  // Tuesday
            true,  // Wednesday
            true,  // Thursday
            true,  // Friday
            false  // Saturday
        ];
    }
};

export default xerImportPlugin;
