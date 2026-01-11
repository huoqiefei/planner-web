
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../utils/i18n';
import { useAppStore } from '../stores/useAppStore';

interface MenuBarProps {
    onAction: (action: string) => void;
    onRefreshUser?: () => void;
}

const MenuBar: React.FC<MenuBarProps> = ({ onAction, onRefreshUser }) => {
    const { user, userSettings, data: projectData, schedule } = useAppStore();
    const lang = userSettings.language;
    const uiSize = userSettings.uiSize;
    const uiFontPx = userSettings.uiFontPx;

    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation(lang);

    const fontSize = uiFontPx || 13;

    // Refresh user data when menu opens
    useEffect(() => {
        if (showUserMenu && onRefreshUser) {
            onRefreshUser();
        }
    }, [showUserMenu]);

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setActiveMenu(null);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false);
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

    const getRoleDisplayName = (role: string) => {
        const map: Record<string, string> = {
            'trial': t('FreeTrial') || 'Free Trial',
            'licensed': t('StandardPlan') || 'Standard Plan',
            'premium': t('ProPlan') || 'Pro Plan',
            'admin': t('Administrator') || 'Administrator'
        };
        return map[role] || role;
    };

    return (
        <div className="bg-slate-100 border-b border-slate-300 flex justify-between select-none h-8 items-center px-1 shadow-sm relative z-[60]" ref={menuRef} style={{ fontSize: `${fontSize}px` }}>
            <div className="flex h-full">
                {Object.entries(menus).map(([name, items]) => (
                    <div key={name} className="relative h-full flex items-center">
                        <div
                            className={`px-3 h-full flex items-center cursor-pointer transition-colors ${activeMenu === name ? 'bg-slate-100 text-blue-600 font-medium' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                            onClick={() => handleMenuClick(name)}
                        >
                            {name}
                        </div>
                        {activeMenu === name && (
                            <div className="absolute left-0 top-full bg-white/95 backdrop-blur-md border border-slate-200 shadow-xl min-w-[200px] z-[70] py-1.5 rounded-b-lg animate-fade-in">
                                {items.map((item, idx) => {
                                    if (item.type === 'separator') {
                                        return <div key={idx} className="h-px bg-slate-100 my-1 mx-2" />;
                                    }
                                    return (
                                        <div
                                            key={idx}
                                            className={`px-4 py-2 flex justify-between group whitespace-nowrap transition-colors ${item.disabled ? 'text-slate-300 cursor-not-allowed' : 'hover:bg-blue-50 hover:text-blue-600 cursor-pointer text-slate-700'}`}
                                            onClick={() => handleItemClick(item.action!, item.disabled)}
                                        >
                                            <span className="text-xs font-medium">{item.label}</span>
                                            {item.checked !== undefined && (
                                                <span className="ml-2 text-blue-600">{item.checked ? '✓' : ''}</span>
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
                <div className="flex-1 flex items-center justify-center gap-3 text-xs text-slate-600 px-4">
                    <span className="font-semibold text-slate-800 truncate max-w-md" title={projectData.meta?.title}>
                        {projectData.meta?.title || 'Untitled Project'}
                    </span>
                    <span className="text-slate-300">|</span>
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

            {user && (
                <div className="relative h-full flex items-center pr-2" ref={userMenuRef}>
                    <div
                        className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 px-2 py-0.5 rounded-full border border-transparent hover:border-slate-200 transition-all"
                        onClick={() => setShowUserMenu(!showUserMenu)}
                    >
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold overflow-hidden">
                            {user.avatar ? (
                                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                                user.name.charAt(0).toUpperCase()
                            )}
                        </div>
                        <span className="text-xs font-semibold text-slate-700">{user.name}</span>
                    </div>

                    {showUserMenu && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-400 shadow-lg min-w-[240px] z-50 py-1 rounded-sm">
                            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
                                <div className="font-bold text-slate-800 text-base">{user.name}</div>
                                <div className="text-xs text-slate-500 capitalize mt-0.5">{getRoleDisplayName(user.plannerRole || 'trial')}</div>
                            </div>

                            {[
                                {
                                    label: t('Profile'),
                                    action: 'settings_profile',
                                    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="5" r="2.5" /><path d="M3 14c0-2.5 2-4 5-4s5 1.5 5 4" /></svg>
                                },
                                {
                                    label: t('SubscriptionPlan'),
                                    action: 'settings_subscription',
                                    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2l1.5 3 3.5.5-2.5 2.5.5 3.5L8 10l-3 1.5.5-3.5L3 5.5l3.5-.5L8 2z" /></svg>
                                },
                                {
                                    label: t('UsageStatistics'),
                                    action: 'settings_usage',
                                    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 13V9m4 4V6m4 7V3" /></svg>
                                },
                                {
                                    label: t('ChangePassword'),
                                    action: 'settings_security',
                                    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="7" width="8" height="6" rx="1" /><path d="M6 7V5c0-1.1.9-2 2-2s2 .9 2 2v2" /></svg>
                                },
                                { type: 'separator' },
                                {
                                    label: t('Logout'),
                                    action: 'logout',
                                    danger: true,
                                    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 14H3V2h3M11 11l3-3-3-3M14 8H6" /></svg>
                                }
                            ].map((item, idx) => (
                                item.type === 'separator' ? (
                                    <div key={idx} className="h-px bg-slate-200 my-1 mx-2" />
                                ) : (
                                    <div
                                        key={idx}
                                        className={`px-4 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-slate-100 ${item.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700'}`}
                                        onClick={() => { onAction(item.action!); setShowUserMenu(false); }}
                                    >
                                        {item.icon && <span className="text-base w-5 text-center">{item.icon}</span>}
                                        <span className="text-sm">{item.label}</span>
                                    </div>
                                )
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default MenuBar;
