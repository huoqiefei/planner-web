
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

    const menus: Record<string, any[]> = {
        [t('File')]: [
            { label: t('Import'), action: 'import', disabled: user?.group === 'viewer' },
            { label: t('Export'), action: 'export' }, // Viewers can export
            { type: 'separator' },
            { label: t('Load'), action: 'cloud_load' },
            { label: t('SaveProjectToCloud'), action: 'cloud_save', disabled: user?.group === 'viewer' },
            { type: 'separator' },
            { label: t('PrintPreview'), action: 'print', disabled: user?.group === 'viewer' },
        ],
        [t('Edit')]: [
            { label: t('Copy'), action: 'copy' },
            { label: t('Cut'), action: 'cut', disabled: user?.group === 'viewer' },
            { label: t('Paste'), action: 'paste', disabled: user?.group === 'viewer' },
            { type: 'separator' },
            { label: t('ColumnsSetup'), action: 'columns' },
            { label: t('UserPreferences'), action: 'settings' },
        ],
        [t('Project')]: [
            { label: t('Activities'), action: 'view_activities' },
            { label: t('Resources'), action: 'view_resources' },
            { type: 'separator' },
            { label: t('ProjectInfo'), action: 'project_info', disabled: user?.group === 'viewer' },
        ],
        [t('Help')]: [
            { label: t('About'), action: 'about' },
            { label: 'User Manual', action: 'help' },
        ]
    };

    if (user?.group === 'admin') {
        menus[t('System')] = [
            { label: t('Configuration'), action: 'admin' },
        ];
    }

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
                <div className="flex items-center gap-3 pr-2">
                    <span className="text-xs text-slate-500 font-semibold">{user.name} ({user.group})</span>
                    <button onClick={() => onAction('logout')} className="text-xs text-red-600 hover:text-red-800 font-bold hover:underline">
                        Logout
                    </button>
                </div>
            )}
        </div>
    );
};

export default MenuBar;
