
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../utils/i18n';
import { useAppStore } from '../stores/useAppStore';

interface MenuBarProps {
    onAction: (action: string) => void;
}

const MenuBar: React.FC<MenuBarProps> = ({ onAction }) => {
    const { user, userSettings, data: projectData, schedule } = useAppStore();
    const lang = userSettings.language;
    const uiFontPx = userSettings.uiFontPx;

    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation(lang);

    const fontSize = uiFontPx || 13;

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setActiveMenu(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const cloudEnabled = import.meta.env.VITE_ENABLE_CLOUD_FEATURES === 'true';

    const menus: Record<string, any[]> = {
        [t('File')]: [
            { label: t('CreateNewProject'), action: 'new_project' },
            { label: t('OpenExistingProject'), action: 'open_project' },
            { type: 'separator' },
            ...(cloudEnabled ? [
                { label: t('SaveToCloud'), action: 'cloud_save' },
                { label: t('OpenFromCloud'), action: 'cloud_projects' },
                { type: 'separator' },
            ] : []),
            { label: t('ImportJSON'), action: 'import' },
            { label: t('ExportJSON'), action: 'export' },
            { label: t('Print'), action: 'print' },
        ],
        [t('Edit')]: [
            { label: t('Copy'), action: 'copy' },
            { label: t('Cut'), action: 'cut' },
            { label: t('Paste'), action: 'paste' },
            { type: 'separator' },
            { label: t('Filter') + '...', action: 'filter' },
            { label: t('ColumnsSetup'), action: 'columns' },
            { label: t('UserPreferences'), action: 'user_preferences' },
            { type: 'separator' },
            { label: t('ShowRowNumbers'), action: 'toggle_row_numbers', checked: userSettings.gridSettings.showRowNumbers ?? true },
        ],
        [t('Project')]: [
            { label: t('Activities'), action: 'view_activities' },
            { label: t('Resources'), action: 'view_resources' },
            { type: 'separator' },
            { label: t('ProjectInfo'), action: 'project_general' },
            { label: t('Calendars'), action: 'project_calendars' },
            { label: t('CustomFields'), action: 'project_custom_fields' },
            { label: t('DefaultValues'), action: 'project_defaults' },
        ],
        [t('Help')]: [
            { label: t('About'), action: 'about' },
            { label: t('UserManual'), action: 'help' },
        ],
    };

    if (user?.plannerRole === 'admin') {
        menus[t('System')] = [
            { label: t('Configuration'), action: 'admin' },
        ];
    }

    const handleMenuClick = (menuName: string) => {
        setActiveMenu(activeMenu === menuName ? null : menuName);
    };

    const handleItemClick = (action: string, disabled?: boolean) => {
        if (disabled) return;
        if (action === 'toggle_row_numbers') {
            const show = !(userSettings.gridSettings.showRowNumbers ?? true);
            useAppStore.getState().setUserSettings(s => ({ ...s, gridSettings: { ...s.gridSettings, showRowNumbers: show } }));
            return;
        }
        onAction(action);
        setActiveMenu(null);
    };

    return (
        <div className="bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-600 flex justify-between select-none h-8 items-center px-1 shadow-sm relative z-[60]" ref={menuRef} style={{ fontSize: `${fontSize}px` }}>
            <div className="flex h-full">
                {Object.entries(menus).map(([name, items]) => (
                    <div key={name} className="relative h-full flex items-center">
                        <div
                            className={`px-3 h-full flex items-center cursor-pointer transition-colors ${activeMenu === name ? 'bg-slate-100 dark:bg-slate-700 text-blue-600 dark:text-blue-400 font-medium' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'}`}
                            onClick={() => handleMenuClick(name)}
                        >
                            {name}
                        </div>
                        {activeMenu === name && (
                            <div className="absolute left-0 top-full bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border border-slate-200 dark:border-slate-600 shadow-xl min-w-[200px] z-[70] py-1.5 rounded-b-lg animate-fade-in">
                                {items.map((item, idx) => {
                                    if (item.type === 'separator') {
                                        return <div key={idx} className="h-px bg-slate-100 dark:bg-slate-700 my-1 mx-2" />;
                                    }
                                    return (
                                        <div
                                            key={idx}
                                            className={`px-4 py-2 flex justify-between group whitespace-nowrap transition-colors ${item.disabled ? 'text-slate-300 dark:text-slate-600 cursor-not-allowed' : 'hover:bg-blue-50 dark:hover:bg-blue-900 hover:text-blue-600 dark:hover:text-blue-400 cursor-pointer text-slate-700 dark:text-slate-300'}`}
                                            onClick={() => handleItemClick(item.action!, item.disabled)}
                                        >
                                            <span className="text-xs font-medium">{item.label}</span>
                                            {item.checked !== undefined && (
                                                <span className="ml-2 text-blue-600 dark:text-blue-400">{item.checked ? '✓' : ''}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Project Info Display */}
            {projectData && (
                <div className="absolute left-1/2 transform -translate-x-1/2 flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-md" title={projectData.meta?.title}>
                        {projectData.meta?.title || 'Untitled Project'}
                    </span>
                    <span className="text-slate-300 dark:text-slate-600">|</span>
                    <span className="whitespace-nowrap">
                        {t('Duration')}: {(() => {
                            if (!schedule?.activities?.length) return '0';
                            const startDates = schedule.activities.map(a => new Date(a.startDate).getTime());
                            const endDates = schedule.activities.map(a => new Date(a.endDate).getTime());
                            const projectStart = Math.min(...startDates);
                            const projectEnd = Math.max(...endDates);
                            const durationDays = Math.ceil((projectEnd - projectStart) / (1000 * 60 * 60 * 24)) + 1;
                            return durationDays;
                        })()} {t('day')}
                    </span>
                </div>
            )}
        </div>
    );
};

export default MenuBar;
