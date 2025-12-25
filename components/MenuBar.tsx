
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from '../utils/i18n';
import { UISize, User } from '../types';

interface MenuBarProps {
    onAction: (action: string) => void;
    lang: 'en' | 'zh';
    uiSize: UISize;
    uiFontPx?: number;
    user: User | null;
}

const MenuBar: React.FC<MenuBarProps> = ({ onAction, lang, uiSize, uiFontPx, user }) => {
    const [activeMenu, setActiveMenu] = useState<string | null>(null);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const userMenuRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation(lang);

    const fontSize = uiFontPx || 13;

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

    const menus: Record<string, any[]> = {
        [t('File')]: [
            { label: t('CreateNewProject'), action: 'new_project' },
            { label: t('OpenExistingProject'), action: 'open_project' },
            { type: 'separator' },
            { label: t('SaveToCloud'), action: 'cloud_save' },
            { label: t('OpenFromCloud'), action: 'cloud_projects' },
            { type: 'separator' },
            { label: t('ImportJSON'), action: 'import' },
            { label: t('ExportJSON'), action: 'export' },
            { label: t('Print'), action: 'print' },
        ],
        [t('Edit')]: [
            { label: t('Copy'), action: 'copy' },
            { label: t('Cut'), action: 'cut' },
            { label: t('Paste'), action: 'paste' },
            { type: 'separator' },
            { label: t('ColumnsSetup'), action: 'columns' },
            { label: t('UserPreferences'), action: 'settings' },
        ],
        [t('Project')]: [
            { label: t('Activities'), action: 'view_activities' },
            { label: t('Resources'), action: 'view_resources' },
            { type: 'separator' },
            { label: t('ProjectInfo'), action: 'project_info' },
        ],
        [t('Help')]: [
            { label: t('About'), action: 'about' },
            { label: 'User Manual', action: 'help' },
        ],
        [t('System')]: [
            { label: t('Configuration'), action: 'admin' },
            { label: t('AIConfiguration'), action: 'ai_settings' },
        ]
    };

    const handleMenuClick = (menuName: string) => {
        setActiveMenu(activeMenu === menuName ? null : menuName);
    };

    const handleItemClick = (action: string, disabled?: boolean) => {
        if (disabled) return;
        onAction(action);
        setActiveMenu(null);
    };

    return (
        <div className="bg-slate-200 border-b border-slate-300 flex justify-between select-none h-8 items-center px-1" ref={menuRef} style={{ fontSize: `${fontSize}px` }}>
            <div className="flex h-full">
                {Object.entries(menus).map(([name, items]) => (
                    <div key={name} className="relative h-full flex items-center">
                        <div 
                            className={`px-3 h-full flex items-center cursor-pointer hover:bg-slate-300 ${activeMenu === name ? 'bg-slate-300 text-blue-800 font-medium' : 'text-slate-800'}`}
                            onClick={() => handleMenuClick(name)}
                        >
                            {name}
                        </div>
                        {activeMenu === name && (
                            <div className="absolute left-0 top-full bg-white border border-slate-400 shadow-lg min-w-[180px] z-50 py-1">
                                {items.map((item, idx) => {
                                    if (item.type === 'separator') {
                                        return <div key={idx} className="h-px bg-slate-200 my-1 mx-2" />;
                                    }
                                    return (
                                        <div 
                                            key={idx} 
                                            className={`px-4 py-1.5 flex justify-between group whitespace-nowrap ${item.disabled ? 'text-slate-300 cursor-not-allowed' : 'hover:bg-blue-600 hover:text-white cursor-pointer text-slate-800'}`}
                                            onClick={() => handleItemClick(item.action!, item.disabled)}
                                        >
                                            <span>{item.label}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                ))}
            </div>
            
            {user && (
                <div className="relative h-full flex items-center pr-2" ref={userMenuRef}>
                    <div 
                        className="flex items-center gap-2 cursor-pointer hover:bg-slate-300 px-2 py-1 rounded transition-colors"
                        onClick={() => setShowUserMenu(!showUserMenu)}
                    >
                        <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                            {user.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold text-slate-700">{user.name}</span>
                    </div>

                    {showUserMenu && (
                        <div className="absolute right-0 top-full mt-1 bg-white border border-slate-400 shadow-lg min-w-[180px] z-50 py-1 rounded-sm">
                            <div className="px-4 py-2 border-b border-slate-200 mb-1">
                                <div className="font-bold text-slate-800">{user.name}</div>
                                <div className="text-xs text-slate-500 capitalize">{user.group}</div>
                            </div>
                            
                            {[
                                { label: t('AccountSettings'), action: 'settings' },
                                { label: 'License Info', action: 'license' },
                                { label: 'Usage Statistics', action: 'usage' },
                                { type: 'separator' },
                                { label: 'Logout', action: 'logout', danger: true }
                            ].map((item, idx) => (
                                item.type === 'separator' ? (
                                    <div key={idx} className="h-px bg-slate-200 my-1 mx-2" />
                                ) : (
                                    <div 
                                        key={idx}
                                        className={`px-4 py-1.5 flex items-center gap-2 cursor-pointer hover:bg-slate-100 ${item.danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700'}`}
                                        onClick={() => { onAction(item.action!); setShowUserMenu(false); }}
                                    >
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
