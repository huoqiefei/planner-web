/**
 * P6 XER Import Plugin for Planner Web
 * 
 * This plugin adds the ability to import projects from Primavera P6 XER files.
 * XER is a tab-delimited text format used by Oracle Primavera P6.
 */

import { Plugin, PluginAPI } from '../utils/pluginSystem';
import { Activity, WBSNode, Calendar, ProjectData } from '../types';

interface XERTable {
    name: string;
    columns: string[];
    rows: Record<string, string>[];
}

interface ParsedXER {
    tables: Map<string, XERTable>;
    version?: string;
}

// Helper functions
function parseP6Date(dateStr: string | undefined): Date {
    if (!dateStr) return new Date();
    const parts = dateStr.split(' ')[0].split('-');
    if (parts.length === 3) {
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return new Date();
}

function formatDate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function mapTaskType(type: string): 'Task' | 'Start Milestone' | 'Finish Milestone' {
    switch (type) {
        case 'TT_Mile': case 'TT_FinMile': return 'Finish Milestone';
        case 'TT_StartMile': return 'Start Milestone';
        default: return 'Task';
    }
}

function mapRelationType(type: string): 'FS' | 'SS' | 'FF' | 'SF' {
    switch (type) {
        case 'PR_SS': return 'SS';
        case 'PR_FF': return 'FF';
        case 'PR_SF': return 'SF';
        default: return 'FS';
    }
}

function parseXER(content: string): ParsedXER {
    const lines = content.split('\n');
    const tables = new Map<string, XERTable>();
    let currentTable: XERTable | null = null;
    let version: string | undefined;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith('ERMHDR')) {
            version = trimmed.split('\t')[1];
            continue;
        }
        if (trimmed.startsWith('%T')) {
            const tableName = trimmed.substring(2).trim();
            currentTable = { name: tableName, columns: [], rows: [] };
            tables.set(tableName, currentTable);
            continue;
        }
        if (trimmed.startsWith('%F') && currentTable) {
            currentTable.columns = trimmed.substring(2).trim().split('\t');
            continue;
        }
        if (trimmed.startsWith('%R') && currentTable) {
            const values = trimmed.substring(2).trim().split('\t');
            const row: Record<string, string> = {};
            currentTable.columns.forEach((col, i) => { row[col] = values[i] || ''; });
            currentTable.rows.push(row);
        }
    }
    return { tables, version };
}

function convertToProject(parsed: ParsedXER): ProjectData {
    const projectTable = parsed.tables.get('PROJECT');
    const wbsTable = parsed.tables.get('PROJWBS');
    const taskTable = parsed.tables.get('TASK');
    const taskPredTable = parsed.tables.get('TASKPRED');
    const calendarTable = parsed.tables.get('CALENDAR');

    const projectRow = projectTable?.rows[0];
    const projectId = projectRow?.proj_id || '1';
    const projectName = projectRow?.proj_short_name || 'Imported Project';

    // Map WBS
    const wbsMap = new Map<string, string>();
    const wbs: WBSNode[] = [];
    
    if (wbsTable) {
        const projectWbs = wbsTable.rows.filter(r => r.proj_id === projectId);
        projectWbs.sort((a, b) => parseInt(a.seq_num || '0') - parseInt(b.seq_num || '0'));
        
        projectWbs.forEach((row, index) => {
            const wbsId = row.wbs_short_name || `WBS.${index + 1}`;
            wbsMap.set(row.wbs_id, wbsId);
            const parentId = row.parent_wbs_id ? wbsMap.get(row.parent_wbs_id) || null : null;
            wbs.push({ id: wbsId, name: row.wbs_name || wbsId, parentId });
        });
    }
    if (wbs.length === 0) {
        wbs.push({ id: projectName, name: projectName, parentId: null });
    }

    // Map Activities
    const taskMap = new Map<string, string>();
    const activities: Activity[] = [];
    
    if (taskTable) {
        taskTable.rows.filter(r => r.proj_id === projectId).forEach(row => {
            const actId = row.task_code || row.task_id;
            taskMap.set(row.task_id, actId);
            const wbsId = wbsMap.get(row.wbs_id) || wbs[0]?.id || projectName;
            const duration = parseInt(row.target_drtn_hr_cnt || '0') / 8;
            const startDate = parseP6Date(row.target_start_date || row.early_start_date);
            const endDate = parseP6Date(row.target_end_date || row.early_end_date);
            
            activities.push({
                id: actId, name: row.task_name || actId, wbsId,
                activityType: mapTaskType(row.task_type),
                duration: duration || 1, startDate, endDate, predecessors: [],
                earlyStart: startDate, earlyFinish: endDate,
                lateStart: startDate, lateFinish: endDate,
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
                        type: mapRelationType(row.pred_type),
                        lag: parseInt(row.lag_hr_cnt || '0') / 8
                    });
                }
            }
        });
    }

    // Map Calendars
    const calendars: Calendar[] = [];
    if (calendarTable) {
        calendarTable.rows.forEach((row, index) => {
            calendars.push({
                id: `CAL${index + 1}`, name: row.clndr_name || `CAL${index + 1}`,
                isDefault: row.default_flag === 'Y',
                weekDays: [false, true, true, true, true, true, false],
                hoursPerDay: parseFloat(row.day_hr_cnt || '8'), exceptions: []
            });
        });
    }
    if (calendars.length === 0) {
        calendars.push({ id: 'DEFAULT', name: 'Standard', isDefault: true,
            weekDays: [false, true, true, true, true, true, false], hoursPerDay: 8, exceptions: [] });
    }

    return {
        meta: {
            title: projectName, projectCode: projectRow?.proj_short_name || 'PROJ',
            projectStartDate: formatDate(parseP6Date(projectRow?.plan_start_date)),
            defaultCalendarId: calendars.find(c => c.isDefault)?.id || calendars[0].id,
            activityIdPrefix: 'A', activityIdIncrement: 10,
            resourceIdPrefix: 'R', resourceIdIncrement: 10
        },
        wbs, activities, resources: [], assignments: [], calendars
    };
}

async function showImportDialog(api: PluginAPI) {
    const file = await api.ui.showFilePicker({ accept: '.xer' });
    if (!file || Array.isArray(file)) return;

    try {
        const text = await file.text();
        const parsed = parseXER(text);
        const project = convertToProject(parsed);
        
        const confirmed = await api.ui.showConfirm(
            `Found ${project.wbs.length} WBS nodes and ${project.activities.length} activities. Import?`
        );
        
        if (confirmed) {
            api.project.setData(project);
            api.project.recalculate();
            api.ui.showToast('XER import successful', 'success');
        }
    } catch (error) {
        api.ui.showAlert(`XER import failed: ${error}`, 'Error');
    }
}

const xerImportPlugin: Plugin = {
    id: 'xer-import',
    name: 'P6 XER Import',
    version: '1.0.0',
    description: 'Import projects from Primavera P6 XER files',
    author: 'Planner Web Team',

    activate(api: PluginAPI) {
        api.toolbar.addButton({
            id: 'import-xer',
            icon: '📁',
            tooltip: 'Import P6 XER',
            position: 'left',
            onClick: () => showImportDialog(api)
        });

        api.hooks.on('onDataImport', ({ data, format }) => {
            if (format === 'xer') {
                const text = typeof data === 'string' ? data : '';
                const parsed = parseXER(text);
                return convertToProject(parsed);
            }
        });

        console.log('XER Import plugin activated');
    },

    deactivate() {
        console.log('XER Import plugin deactivated');
    }
};

export default xerImportPlugin;
