import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from '../utils/i18n';
import { authService } from '../services/authService';
import { AlertModal } from './Modals';

interface SystemSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    lang: 'en' | 'zh';
}

export const SystemSettingsModal: React.FC<SystemSettingsModalProps> = ({ isOpen, onClose, lang }) => {
    const { t } = useTranslation(lang);
    const [activeTab, setActiveTab] = useState<'config' | 'users'>('config');
    
    // Config State
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);

    // File Inputs
    const logoInputRef = useRef<HTMLInputElement>(null);
    const watermarkInputRef = useRef<HTMLInputElement>(null);

    // User Management State
    const [users, setUsers] = useState<any[]>([]);
    const [userLoading, setUserLoading] = useState(false);
    const [userPage, setUserPage] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);
    const pageSize = 20;

    const [alertMsg, setAlertMsg] = useState<string | null>(null);
    const [alertTitle, setAlertTitle] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            loadSettings();
            if (activeTab === 'users') loadUsers();
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && activeTab === 'users') {
            loadUsers();
        }
    }, [activeTab, userPage]);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const data = await authService.getSystemConfig();
            if (data.config) {
                setSettings(data.config);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const loadUsers = async () => {
        setUserLoading(true);
        try {
            const data = await authService.adminUserList(userPage, pageSize);
            if (data.users) {
                setUsers(data.users);
                setTotalUsers(data.total || 0);
            }
        } catch (error) {
            console.error(error);
            setAlertMsg('Failed to load users');
            setAlertTitle('Error');
        } finally {
            setUserLoading(false);
        }
    };

    const handleSaveConfig = async () => {
        setLoading(true);
        try {
            await authService.saveSystemConfig(settings);
            setAlertMsg(t('SystemConfigSaved'));
            setAlertTitle('Success');
        } catch (error) {
            console.error(error);
            setAlertMsg('Failed to save settings');
            setAlertTitle('Error');
        } finally {
            setLoading(false);
        }
    };

    const handleUserRoleUpdate = async (uid: number, role: 'trial' | 'licensed' | 'premium') => {
        try {
            await authService.adminUserUpdate(uid, role);
            setUsers(users.map(u => u.uid === uid ? { ...u, planner_role: role } : u));
        } catch (error) {
            console.error(error);
            setAlertMsg('Failed to update user role');
            setAlertTitle('Error');
        }
    };

    const updateSetting = (key: string, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, key: string) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                updateSetting(key, reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    if (!isOpen) return null;

    const totalPages = Math.ceil(totalUsers / pageSize);

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow-lg w-[900px] h-[700px] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-slate-100">
                    <h2 className="font-bold text-lg">{t('AdminConsole')}</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700">✕</button>
                </div>

                <div className="flex border-b bg-white">
                    <button 
                        className={`px-4 py-3 font-medium ${activeTab === 'config' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
                        onClick={() => setActiveTab('config')}
                    >
                        {t('SystemSettings')}
                    </button>
                    <button 
                        className={`px-4 py-3 font-medium ${activeTab === 'users' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-600 hover:bg-slate-50'}`}
                        onClick={() => setActiveTab('users')}
                    >
                        {t('UserManagement')}
                    </button>
                </div>
                
                <div className="flex-1 overflow-hidden flex flex-col">
                    {activeTab === 'config' && (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                {/* Basic Info */}
                                <section className="space-y-4">
                                    <h3 className="font-bold text-lg border-b pb-2">{t('General')}</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">{t('AppName')}</label>
                                            <input 
                                                type="text" 
                                                className="w-full border rounded p-2"
                                                value={settings.appName || ''}
                                                onChange={e => updateSetting('appName', e.target.value)}
                                                placeholder="Planner Web"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">{t('CopyrightText')}</label>
                                            <input 
                                                type="text" 
                                                className="w-full border rounded p-2"
                                                value={settings.copyrightText || ''}
                                                onChange={e => updateSetting('copyrightText', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium mb-1">{t('AppLogo')}</label>
                                        <div className="flex items-center gap-4">
                                            {settings.appLogo && (
                                                <img src={settings.appLogo} alt="Logo" className="h-12 w-auto border rounded p-1" />
                                            )}
                                            <button 
                                                onClick={() => logoInputRef.current?.click()}
                                                className="px-3 py-1 border rounded hover:bg-slate-50 text-sm"
                                            >
                                                Upload Logo
                                            </button>
                                            <input 
                                                type="file" 
                                                ref={logoInputRef}
                                                className="hidden"
                                                accept="image/*"
                                                onChange={e => handleImageUpload(e, 'appLogo')}
                                            />
                                            {settings.appLogo && (
                                                <button 
                                                    onClick={() => updateSetting('appLogo', '')}
                                                    className="text-red-500 text-sm hover:underline"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </section>

                                {/* Watermark Settings */}
                                <section className="space-y-4">
                                    <h3 className="font-bold text-lg border-b pb-2 flex items-center gap-2">
                                        {t('WatermarkText')}
                                        <label className="flex items-center gap-2 text-sm font-normal ml-4">
                                            <input 
                                                type="checkbox" 
                                                checked={settings.enableWatermark === 'true'}
                                                onChange={e => updateSetting('enableWatermark', String(e.target.checked))}
                                            />
                                            {t('EnableWatermark')}
                                        </label>
                                    </h3>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-1">{t('WatermarkText')}</label>
                                            <input 
                                                type="text" 
                                                className="w-full border rounded p-2"
                                                value={settings.watermarkText || ''}
                                                onChange={e => updateSetting('watermarkText', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">{t('WatermarkFontSize')}</label>
                                            <input 
                                                type="number" 
                                                className="w-full border rounded p-2"
                                                value={settings.watermarkFontSize || '20'}
                                                onChange={e => updateSetting('watermarkFontSize', e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-1">{t('WatermarkOpacity')} (0.1 - 1.0)</label>
                                            <input 
                                                type="number" 
                                                step="0.1"
                                                min="0.1"
                                                max="1.0"
                                                className="w-full border rounded p-2"
                                                value={settings.watermarkOpacity || '0.2'}
                                                onChange={e => updateSetting('watermarkOpacity', e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-1">{t('WatermarkImage')}</label>
                                        <div className="flex items-center gap-4">
                                            {settings.watermarkImage && (
                                                <img src={settings.watermarkImage} alt="Watermark" className="h-12 w-auto border rounded p-1" />
                                            )}
                                            <button 
                                                onClick={() => watermarkInputRef.current?.click()}
                                                className="px-3 py-1 border rounded hover:bg-slate-50 text-sm"
                                            >
                                                Upload Image
                                            </button>
                                            <input 
                                                type="file" 
                                                ref={watermarkInputRef}
                                                className="hidden"
                                                accept="image/*"
                                                onChange={e => handleImageUpload(e, 'watermarkImage')}
                                            />
                                            {settings.watermarkImage && (
                                                <button 
                                                    onClick={() => updateSetting('watermarkImage', '')}
                                                    className="text-red-500 text-sm hover:underline"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-1">If set, image will be used instead of text.</p>
                                    </div>
                                </section>

                                {/* Other Settings */}
                                <section className="space-y-4">
                                    <h3 className="font-bold text-lg border-b pb-2">{t('GanttSettings')}</h3>
                                    <div>
                                        <label className="block text-sm font-medium mb-1">{t('GanttBarRatio')} (0.1 - 0.8)</label>
                                        <input 
                                            type="number" 
                                            step="0.1"
                                            min="0.1"
                                            max="0.8"
                                            className="w-full border rounded p-2"
                                            value={settings.ganttBarRatio || '0.5'}
                                            onChange={e => updateSetting('ganttBarRatio', e.target.value)}
                                        />
                                    </div>
                                </section>
                            </div>

                            <div className="p-4 border-t flex justify-end gap-2 bg-slate-50">
                                <button 
                                    onClick={handleSaveConfig} 
                                    disabled={loading}
                                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                >
                                    {loading ? t('Saving') : t('SaveConfig')}
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="flex-1 overflow-y-auto p-4">
                                {userLoading ? (
                                    <div className="text-center py-8 text-slate-500">{t('Loading')}</div>
                                ) : (
                                    <table className="w-full text-sm border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 text-left">
                                                <th className="p-2 border">{t('UserID')}</th>
                                                <th className="p-2 border">{t('Username')}</th>
                                                <th className="p-2 border">{t('Email')}</th>
                                                <th className="p-2 border">{t('TypechoGroup')}</th>
                                                <th className="p-2 border">{t('Authorization')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {users.map(u => (
                                                <tr key={u.uid} className="hover:bg-slate-50">
                                                    <td className="p-2 border">{u.uid}</td>
                                                    <td className="p-2 border font-medium">{u.name || u.screenName}</td>
                                                    <td className="p-2 border">{u.mail}</td>
                                                    <td className="p-2 border text-slate-500">{u.group}</td>
                                                    <td className="p-2 border">
                                                        <select 
                                                            value={u.planner_role || 'trial'}
                                                            onChange={(e) => handleUserRoleUpdate(u.uid, e.target.value as any)}
                                                            className={`w-full p-1 rounded border ${
                                                                u.planner_role === 'premium' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                                u.planner_role === 'licensed' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                                'bg-slate-50 text-slate-600'
                                                            }`}
                                                        >
                                                            <option value="trial">{t('Trial')}</option>
                                                            <option value="licensed">{t('Licensed')}</option>
                                                            <option value="premium">{t('Premium')}</option>
                                                        </select>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            <div className="p-4 border-t flex justify-between items-center bg-slate-50">
                                <span className="text-sm text-slate-500">Total: {totalUsers}</span>
                                <div className="flex gap-2 items-center">
                                    <button 
                                        disabled={userPage <= 1}
                                        onClick={() => setUserPage(p => p - 1)}
                                        className="px-3 py-1 border rounded hover:bg-white disabled:opacity-50"
                                    >
                                        Prev
                                    </button>
                                    <span className="px-2 py-1 text-sm">
                                        {userPage} / {totalPages || 1}
                                    </span>
                                    <button 
                                        disabled={userPage >= totalPages}
                                        onClick={() => setUserPage(p => p + 1)}
                                        className="px-3 py-1 border rounded hover:bg-white disabled:opacity-50"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
            <AlertModal 
                isOpen={!!alertMsg} 
                msg={alertMsg || ''} 
                title={alertTitle}
                onClose={() => setAlertMsg(null)} 
            />
        </div>
    );
};
