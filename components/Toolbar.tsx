import React, { useRef } from 'react';
import { useAppStore } from '../stores/useAppStore';

import { ToolbarCustomButton } from '../types';

interface ToolbarProps {
    onNew: () => void;
    onOpen: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSave: () => void;
    onCloudSave?: () => void;
    onPrint: () => void;
    onSettings: () => void;
    onAddResource?: () => void;
    onUserMenuAction?: (action: string) => void;
    onRefreshUser?: () => void;
}

const Icons = {
    New: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>,
    Open: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" /></svg>,
    Save: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" /></svg>,
    CloudSave: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>,
    Print: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>,
    Settings: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
    Link: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>,
    Critical: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>,
    Undo: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>,
    Redo: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" /></svg>,
    AddResource: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" /></svg>,
    RowNumbers: <svg className="w-full h-full" viewBox="0 0 24 24"><text x="12" y="17" textAnchor="middle" fontSize="16" fontWeight="bold" fill="currentColor">#</text></svg>,
    Sun: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
    Moon: <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg>
};

const Toolbar: React.FC<ToolbarProps> = ({
    onNew, onOpen, onSave, onCloudSave, onPrint, onSettings, onAddResource, onUserMenuAction, onRefreshUser
}) => {
    const {
        data, isDirty, userSettings, setUserSettings,
        showRelations, setShowRelations,
        showCritical, setShowCritical,
        adminConfig,
        theme, setTheme,
        user
    } = useAppStore();

    const [showUserMenu, setShowUserMenu] = React.useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);

    const title = data?.meta.title;
    const uiFontPx = userSettings.uiFontPx;
    const customButtons = adminConfig?.customToolbar || [];
    const lang = userSettings.language;

    const fileRef = useRef<HTMLInputElement>(null);
    const fontSize = uiFontPx || 13;
    const btnSize = Math.max(30, fontSize * 2.2);
    const iconSize = Math.max(16, fontSize * 1.2);

    // Close user menu when clicking outside
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
                setShowUserMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Refresh user data when menu opens
    React.useEffect(() => {
        if (showUserMenu && onRefreshUser) {
            onRefreshUser();
        }
    }, [showUserMenu, onRefreshUser]);

    const getRoleDisplayName = (role: string) => {
        const map: Record<string, string> = {
            'trial': lang === 'zh' ? '试用版' : 'Free Trial',
            'licensed': lang === 'zh' ? '标准版' : 'Standard Plan',
            'premium': lang === 'zh' ? '专业版' : 'Pro Plan',
            'admin': lang === 'zh' ? '管理员' : 'Administrator'
        };
        return map[role] || role;
    };

    const getMenuLabel = (key: string) => {
        const labels: Record<string, { en: string; zh: string }> = {
            'Profile': { en: 'Profile', zh: '个人资料' },
            'SubscriptionPlan': { en: 'Subscription Plan', zh: '订阅计划' },
            'UsageStatistics': { en: 'Usage Statistics', zh: '使用统计' },
            'ChangePassword': { en: 'Change Password', zh: '修改密码' },
            'Logout': { en: 'Logout', zh: '退出登录' }
        };
        return labels[key]?.[lang] || key;
    };

    const executeCustomAction = (btn: ToolbarCustomButton) => {
        if (btn.action === 'link') {
            window.open(btn.target, '_blank');
        } else if (btn.action === 'script') {
            try {
                // eslint-disable-next-line no-new-func
                new Function(btn.target)();
            } catch (e) {
                console.error("Custom Script Error:", e);
                alert("Script failed: " + e);
            }
        }
    };

    const renderCustomBtn = (btn: ToolbarCustomButton) => (
        <button key={btn.id} onClick={() => executeCustomAction(btn)} style={{ width: btnSize, height: btnSize }} className="flex flex-col items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300" title={btn.tooltip || btn.label}>
            <div style={{ width: iconSize, height: iconSize }}>
                {(Icons as any)[btn.icon as any] || (btn.icon?.startsWith('M') ? <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={btn.icon} /></svg> : <span className="text-xs font-bold">{btn.label?.substring(0, 2) || '?'}</span>)}
            </div>
        </button>
    );

    return (
        <div className="toolbar-container bg-white/80 dark:bg-slate-800/90 backdrop-blur-md p-1 border-b border-slate-200 dark:border-slate-700 flex items-center gap-1 shadow-sm flex-shrink-0 select-none z-50 relative justify-between" style={{ height: `${btnSize + 8}px` }}>
            <div className="flex items-center gap-1">{/* 左侧按钮组 */}
            <div className="flex items-center gap-1">{/* 左侧按钮组 */}
            <button onClick={onNew} style={{ width: btnSize, height: btnSize }} className="flex flex-col items-center justify-center hover:bg-blue-50 dark:hover:bg-blue-900 hover:text-blue-600 dark:hover:text-blue-400 rounded-md text-slate-600 dark:text-slate-300 transition-colors" title="New">
                <div style={{ width: iconSize, height: iconSize }}>{Icons.New}</div>
            </button>
            <button onClick={() => fileRef.current?.click()} style={{ width: btnSize, height: btnSize }} className="flex flex-col items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300" title="Open">
                <div style={{ width: iconSize, height: iconSize }}>{Icons.Open}</div>
            </button>
            <input type="file" ref={fileRef} onChange={onOpen} className="hidden" accept=".json" />
            {title && (
                <>
                    <button onClick={onSave} style={{ width: btnSize, height: btnSize }} className="flex flex-col items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300" title="Save JSON">
                        <div style={{ width: iconSize, height: iconSize }}>{Icons.Save}</div>
                    </button>
                    {onCloudSave && import.meta.env.VITE_ENABLE_CLOUD_FEATURES === 'true' && (
                        <button onClick={onCloudSave} style={{ width: btnSize, height: btnSize }} className="flex flex-col items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300" title="Save to Cloud">
                            <div style={{ width: iconSize, height: iconSize }}>{Icons.CloudSave}</div>
                        </button>
                    )}
                    <div className="w-px bg-slate-300 dark:bg-slate-600 mx-1" style={{ height: btnSize }}></div>



                    {/* Undo / Redo */}
                    <button onClick={() => (useAppStore as any).temporal.getState().undo()} style={{ width: btnSize, height: btnSize }} className="flex flex-col items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300" title="Undo (Ctrl+Z)">
                        <div style={{ width: iconSize, height: iconSize }}>{Icons.Undo}</div>
                    </button>
                    <button onClick={() => (useAppStore as any).temporal.getState().redo()} style={{ width: btnSize, height: btnSize }} className="flex flex-col items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300" title="Redo (Ctrl+Y)">
                        <div style={{ width: iconSize, height: iconSize }}>{Icons.Redo}</div>
                    </button>
                    <div className="w-px bg-slate-300 dark:bg-slate-600 mx-1" style={{ height: btnSize }}></div>

                    {/* Relations Toggle */}
                    <button onClick={() => setShowRelations(!showRelations)} style={{ width: btnSize, height: btnSize }} className={`flex flex-col items-center justify-center rounded transition-colors ${showRelations ? 'bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-300' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`} title="Toggle Relationships">
                        <div style={{ width: iconSize, height: iconSize }}>{Icons.Link}</div>
                    </button>

                    {/* Critical Path Toggle */}
                    <button onClick={() => setShowCritical(!showCritical)} style={{ width: btnSize, height: btnSize }} className={`flex flex-col items-center justify-center rounded transition-colors ${showCritical ? 'bg-red-200 dark:bg-red-900 text-red-800 dark:text-red-300' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`} title="Show Critical Path">
                        <div style={{ width: iconSize, height: iconSize }}>{Icons.Critical}</div>
                    </button>

                    {/* Row Numbers Toggle */}
                    <button onClick={() => {
                        const show = !(userSettings.gridSettings.showRowNumbers ?? true);
                        setUserSettings(s => ({ ...s, gridSettings: { ...s.gridSettings, showRowNumbers: show } }));
                    }} style={{ width: btnSize, height: btnSize }} className={`flex flex-col items-center justify-center rounded transition-colors ${userSettings.gridSettings.showRowNumbers ?? true ? 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`} title="Toggle Row Numbers">
                        <div style={{ width: iconSize, height: iconSize }}>{Icons.RowNumbers}</div>
                    </button>

                    {onAddResource && (
                        <>
                            <div className="w-px bg-slate-300 dark:bg-slate-600 mx-1" style={{ height: btnSize }}></div>
                            <button onClick={onAddResource} style={{ width: btnSize, height: btnSize }} className="flex flex-col items-center justify-center hover:bg-blue-50 dark:hover:bg-blue-900 hover:text-blue-600 dark:hover:text-blue-400 rounded-md text-slate-600 dark:text-slate-300 transition-colors" title="Add Resource">
                                <div style={{ width: iconSize, height: iconSize }}>{Icons.AddResource}</div>
                            </button>
                        </>
                    )}

                    <div className="w-px bg-slate-300 dark:bg-slate-600 mx-1" style={{ height: btnSize }}></div>

                    {/* Custom Buttons Left/Default */}
                    {customButtons.filter(b => b.position !== 'right').map(renderCustomBtn)}
                    {customButtons.filter(b => b.position !== 'right').length > 0 && <div className="w-px bg-slate-300 dark:bg-slate-600 mx-1" style={{ height: btnSize }}></div>}

                    <button onClick={onSettings} style={{ width: btnSize, height: btnSize }} className="flex flex-col items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300" title="Settings">
                        <div style={{ width: iconSize, height: iconSize }}>{Icons.Settings}</div>
                    </button>
                    <button onClick={onPrint} style={{ width: btnSize, height: btnSize }} className="flex flex-col items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-700 dark:text-slate-300" title="Print">
                        <div style={{ width: iconSize, height: iconSize }}>{Icons.Print}</div>
                    </button>

                    {/* Theme Toggle */}
                    <button 
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} 
                        style={{ width: btnSize, height: btnSize }} 
                        className={`flex flex-col items-center justify-center rounded transition-colors ${theme === 'dark' ? 'bg-indigo-200 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-300' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'}`} 
                        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    >
                        <div style={{ width: iconSize, height: iconSize }}>{theme === 'dark' ? Icons.Sun : Icons.Moon}</div>
                    </button>

                    {/* Custom Buttons Right */}
                    {customButtons.filter(b => b.position === 'right').length > 0 && <div className="w-px bg-slate-300 dark:bg-slate-600 mx-1" style={{ height: btnSize }}></div>}
                    {customButtons.filter(b => b.position === 'right').map(renderCustomBtn)}
                </>
            )}
            </div>{/* 结束左侧按钮组 */}
            </div>

            {/* 用户菜单 - 右侧 */}
            {user && (
                <div className="relative flex items-center pr-2" ref={userMenuRef}>
                    <div
                        className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 px-3 py-1 rounded-lg border border-transparent hover:border-slate-300 dark:hover:border-slate-600 transition-all"
                        onClick={() => setShowUserMenu(!showUserMenu)}
                        style={{ height: btnSize }}
                    >
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold overflow-hidden shadow-sm">
                            {user.avatar ? (
                                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                                user.name.charAt(0).toUpperCase()
                            )}
                        </div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{user.name}</span>
                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>

                    {showUserMenu && (
                        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 shadow-xl min-w-[240px] z-[100] py-1 rounded-lg">
                            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                                <div className="font-bold text-slate-800 dark:text-slate-200 text-base">{user.name}</div>
                                <div className="text-xs text-slate-500 dark:text-slate-400 capitalize mt-0.5">{getRoleDisplayName(user.plannerRole || 'trial')}</div>
                            </div>

                            {[
                                {
                                    label: getMenuLabel('Profile'),
                                    action: 'settings_profile',
                                    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="5" r="2.5" /><path d="M3 14c0-2.5 2-4 5-4s5 1.5 5 4" /></svg>
                                },
                                {
                                    label: getMenuLabel('SubscriptionPlan'),
                                    action: 'settings_subscription',
                                    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2l1.5 3 3.5.5-2.5 2.5.5 3.5L8 10l-3 1.5.5-3.5L3 5.5l3.5-.5L8 2z" /></svg>
                                },
                                {
                                    label: getMenuLabel('UsageStatistics'),
                                    action: 'settings_usage',
                                    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 13V9m4 4V6m4 7V3" /></svg>
                                },
                                {
                                    label: getMenuLabel('ChangePassword'),
                                    action: 'settings_security',
                                    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="7" width="8" height="6" rx="1" /><path d="M6 7V5c0-1.1.9-2 2-2s2 .9 2 2v2" /></svg>
                                },
                                { type: 'separator' },
                                {
                                    label: getMenuLabel('Logout'),
                                    action: 'logout',
                                    danger: true,
                                    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M6 14H3V2h3M11 11l3-3-3-3M14 8H6" /></svg>
                                }
                            ].map((item, idx) => (
                                item.type === 'separator' ? (
                                    <div key={idx} className="h-px bg-slate-200 dark:bg-slate-700 my-1 mx-2" />
                                ) : (
                                    <div
                                        key={idx}
                                        className={`px-4 py-2 flex items-center gap-2 cursor-pointer transition-colors ${
                                            item.danger 
                                                ? 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20' 
                                                : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                                        }`}
                                        onClick={() => { 
                                            onUserMenuAction?.(item.action!); 
                                            setShowUserMenu(false); 
                                        }}
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

export default Toolbar;
