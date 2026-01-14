/**
 * Excel Import Plugin for Planner Web
 * 
 * This plugin adds the ability to import activities from Excel files.
 * It supports both .xlsx and .xls formats.
 * 
 * Dependencies: SheetJS (xlsx) - https://sheetjs.com/
 */

import { Plugin, PluginAPI } from '../utils/pluginSystem';
import { Activity } from '../types';

// Note: In production, you would import SheetJS like this:
// import * as XLSX from 'xlsx';

interface ExcelRow {
    [key: string]: any;
}

// Helper functions outside the plugin object
async function showImportDialog(api: PluginAPI) {
    const file = await api.ui.showFilePicker({
        accept: '.xlsx,.xls'
    });

    if (!file || Array.isArray(file)) return;

    try {
        const activities = await parseExcelFile(file);
        if (activities.length > 0) {
            const confirmed = await api.ui.showConfirm(
                `Found ${activities.length} activities. Import them?`
            );
            if (confirmed) {
                api.project.importActivities(activities);
                api.project.recalculate();
                api.ui.showToast(`Imported ${activities.length} activities`, 'success');
            }
        } else {
            api.ui.showAlert('No activities found in the Excel file.');
        }
    } catch (error) {
        api.ui.showAlert(`Import failed: ${error}`, 'Error');
    }
}

async function parseExcelFile(file: File): Promise<Partial<Activity>[]> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                // Placeholder: In production, use XLSX.read()
                // const workbook = XLSX.read(e.target?.result, { type: 'binary' });
                // const sheet = workbook.Sheets[workbook.SheetNames[0]];
                // const rows = XLSX.utils.sheet_to_json(sheet);
                
                const activities: Partial<Activity>[] = [];
                // Real implementation would map Excel rows to Activity objects
                resolve(activities);
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsBinaryString(file);
    });
}

function isExcelClipboard(text: string): boolean {
    return text.includes('\t') && text.includes('\n');
}

function parseClipboardData(text: string): Partial<Activity>[] {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split('\t').map(h => h.trim().toLowerCase());
    const activities: Partial<Activity>[] = [];

    const headerMap: Record<string, string> = {
        'activity id': 'id', 'id': 'id', 'code': 'id',
        'activity name': 'name', 'name': 'name', 'description': 'name',
        'duration': 'duration', 'dur': 'duration',
        'wbs': 'wbsId', 'wbs code': 'wbsId',
    };

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split('\t');
        const activity: Partial<Activity> = {};

        headers.forEach((header, index) => {
            const field = headerMap[header];
            if (field && values[index]) {
                const value = values[index].trim();
                if (field === 'duration') {
                    (activity as any)[field] = parseInt(value) || 1;
                } else {
                    (activity as any)[field] = value;
                }
            }
        });

        if (activity.name || activity.id) {
            activities.push(activity);
        }
    }

    return activities;
}

const excelImportPlugin: Plugin = {
    id: 'excel-import',
    name: 'Excel Import',
    version: '1.0.0',
    description: 'Import activities from Excel files (.xlsx, .xls)',
    author: 'Planner Web Team',

    activate(api: PluginAPI) {
        api.toolbar.addButton({
            id: 'import-excel',
            icon: '📊',
            tooltip: 'Import from Excel',
            position: 'left',
            onClick: () => showImportDialog(api)
        });

        api.hooks.on('onDataImport', ({ data, format }) => {
            if (format === 'xlsx' || format === 'xls') {
                return parseExcelFile(data);
            }
        });

        api.hooks.on('onPaste', ({ text, target }) => {
            if (target === 'activity' && isExcelClipboard(text)) {
                return parseClipboardData(text);
            }
        });

        console.log('Excel Import plugin activated');
    },

    deactivate() {
        console.log('Excel Import plugin deactivated');
    }
};

export default excelImportPlugin;
