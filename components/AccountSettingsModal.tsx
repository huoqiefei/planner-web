import React, { useState, useEffect, useRef } from 'react';
import { User, UserSettings } from '../types';
import { useTranslation } from '../utils/i18n';
import { BaseModal, AlertModal } from './Modals';
import { authService } from '../services/authService';
import { useAppStore } from '../stores/useAppStore';
import { getSubscriptionLimits, formatLimit, isOverLimit } from '../utils/subscriptionLimits';

interface AccountSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
    settings: UserSettings;
    onSaveSettings: (s: UserSettings) => void;
    onUpdateUser: (u: User) => void;
    initialTab?: 'profile' | 'preferences' | 'subscription' | 'security' | 'usage';
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
    isOpen, onClose, user, settings, onSaveSettings, onUpdateUser, initialTab = 'profile'
}) => {
    const { t } = useTranslation(settings.language);
    const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'subscription' | 'security' | 'usage'>(initialTab);

    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialTab);
        }
    }, [isOpen, initialTab]);

    // Profile State
    const [nickname, setNickname] = useState('');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Preferences State
    const [localSettings, setLocalSettings] = useState(settings);

    // Security State
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [passwordError, setPasswordError] = useState('');

    const [alertMsg, setAlertMsg] = useState<string | null>(null);
    const [alertTitle, setAlertTitle] = useState<string>('');


    useEffect(() => {
        if (isOpen && user) {
            setNickname(user.name);
            setAvatarPreview(user.avatar || null);
            setLocalSettings(settings);
            setAvatarFile(null);
        }
    }, [isOpen, user, settings]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setAvatarFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSaveProfile = async () => {
        setLoading(true);
        try {
            const result = await authService.updateProfile({
                nickname: nickname !== user?.name ? nickname : undefined,
                avatar: avatarFile || undefined
            });

            // Update local user object
            if (user) {
                const updatedUser = {
                    ...user,
                    name: nickname,
                    avatar: result.avatarUrl || user.avatar
                };
                onUpdateUser(updatedUser);
            }
            setAlertMsg(t('SaveSuccess'));
            setAlertTitle(`${t('Success') || 'Success'}`);
        } catch (error: any) {
            setAlertMsg(error.message);
            setAlertTitle('Error');
        } finally {
            setLoading(false);
        }
    };

    const handleSavePreferences = () => {
        onSaveSettings(localSettings);
        setAlertMsg(t('SaveSuccess'));
        setAlertTitle(`${t('Success') || 'Success'}`);
    };

    const handlePasswordChange = async () => {
        setPasswordError('');
        if (!oldPassword || !newPassword || !confirmPassword) {
            setPasswordError('All fields are required');
            return;
        }
        if (newPassword !== confirmPassword) {
            setPasswordError(t('PasswordsDoNotMatch'));
            return;
        }

        setLoading(true);
        try {
            await authService.changePassword(oldPassword, newPassword);
            setAlertMsg(t('PasswordChanged'));
            setAlertTitle(`${t('Success') || 'Success'}`);
            setOldPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            setPasswordError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const getPlanName = (role?: string) => {
        switch (role) {
            case 'trial': return t('Trial');
            case 'licensed': return t('Licensed');
            case 'premium': return t('Premium');
            case 'admin': return t('Admin');
            default: return t('Trial');
        }
    };

    // Get Title based on active tab
    const getTitle = () => {
        switch (activeTab) {
            case 'profile': return t('AccountSettings');
            case 'preferences': return t('UserPreferences');
            case 'subscription': return t('SubscriptionPlan');
            case 'usage': return t('UsageStatistics');
            case 'security': return t('ChangePassword');
            default: return t('AccountSettings');
        }
    };

    const tabs = [
        {
            id: 'profile',
            label: t('AccountSettings'),
            icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="5" r="2.5" /><path d="M3 14c0-2.5 2-4 5-4s5 1.5 5 4" /></svg>
        },
        {
            id: 'subscription',
            label: t('SubscriptionPlan'),
            icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 2l1.5 3 3.5.5-2.5 2.5.5 3.5L8 10l-3 1.5.5-3.5L3 5.5l3.5-.5L8 2z" /></svg>
        },
        {
            id: 'usage',
            label: t('UsageStatistics'),
            icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 13V9m4 4V6m4 7V3" /></svg>
        },
        {
            id: 'security',
            label: t('ChangePassword'),
            icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="7" width="8" height="6" rx="1" /><path d="M6 7V5c0-1.1.9-2 2-2s2 .9 2 2v2" /></svg>
        },
    ] as const;

    return (
        <>
            <BaseModal
                isOpen={isOpen}
                onClose={onClose}
                title=" "
                className="w-[900px] h-[600px] flex flex-col"
                bodyClassName="flex flex-1 flex-row overflow-hidden"
            >
                {/* Sidebar */}
                <div className="w-64 bg-slate-50 border-r border-slate-200 flex-shrink-0 flex flex-col py-4">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`w-full text-left px-6 py-3 flex items-center gap-3 transition-colors ${activeTab === tab.id
                                ? 'bg-white text-blue-600 border-r-2 border-blue-600 font-medium'
                                : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <span className="text-lg">{tab.icon}</span>
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 flex flex-col h-full overflow-hidden">
                    <div className="p-6 border-b border-slate-100 flex-shrink-0">
                        {/* <h2 className="text-xl font-bold text-slate-800">{getTitle()}</h2> */}
                    </div>

                    <div className="flex-1 p-8 overflow-y-auto bg-white">
                        {activeTab === 'profile' && (
                            <div className="space-y-6 max-w-lg">
                                <div className="flex items-center gap-6">
                                    <div
                                        className="w-24 h-24 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden cursor-pointer border-2 border-slate-100 hover:border-blue-500 transition-colors shadow-sm"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        {avatarPreview ? (
                                            <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-3xl font-bold text-slate-400">
                                                {user?.name?.charAt(0).toUpperCase()}
                                            </span>
                                        )}
                                    </div>
                                    <div>
                                        <button
                                            className="px-3 py-1.5 bg-white border border-slate-300 rounded text-sm font-medium text-slate-700 hover:bg-slate-50 mb-1"
                                            onClick={() => fileInputRef.current?.click()}
                                        >
                                            {t('EditAvatar')}
                                        </button>
                                        <p className="text-xs text-slate-500">{t('ClickToUpload')}</p>
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            className="hidden"
                                            accept="image/*"
                                            onChange={handleFileChange}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">{t('UserName')}</label>
                                        <input
                                            type="text"
                                            className="w-full border border-slate-300 rounded p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                            value={nickname}
                                            onChange={e => setNickname(e.target.value)}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">{t('Email')}</label>
                                        <input
                                            type="text"
                                            className="w-full border border-slate-300 rounded p-2 bg-slate-50 text-slate-500"
                                            value={user?.mail || ''}
                                            disabled
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">{t('UserID')}</label>
                                        <input
                                            type="text"
                                            className="w-full border border-slate-300 rounded p-2 bg-slate-50 text-slate-500"
                                            value={user?.uid || ''}
                                            disabled
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 border-t">
                                    <button
                                        className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 font-bold shadow-sm"
                                        onClick={handleSaveProfile}
                                        disabled={loading}
                                    >
                                        {loading ? t('Processing') : t('Save')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'preferences' && (
                            <div className="space-y-6 max-w-lg">
                                <div>
                                    <h4 className="font-bold text-lg text-slate-800 border-b pb-2 mb-4">{t('General')}</h4>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block mb-1 text-sm font-medium text-slate-700">{t('DateFormat')}</label>
                                            <select className="w-full border border-slate-300 rounded p-2" value={localSettings.dateFormat} onChange={e => setLocalSettings({ ...localSettings, dateFormat: e.target.value as any })}>
                                                <option value="YYYY-MM-DD">YYYY-MM-DD (2023-10-30)</option>
                                                <option value="DD-MMM-YYYY">DD-MMM-YYYY (30-Oct-2023)</option>
                                                <option value="MM/DD/YYYY">MM/DD/YYYY (10/30/2023)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block mb-1 text-sm font-medium text-slate-700">{t('Language')}</label>
                                            <select className="w-full border border-slate-300 rounded p-2" value={localSettings.language} onChange={e => setLocalSettings({ ...localSettings, language: e.target.value as any })}>
                                                <option value="en">English</option>
                                                <option value="zh">Chinese (Simplified)</option>
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block mb-1 text-sm font-medium text-slate-700">{t('InterfaceSize')}</label>
                                                <select className="w-full border border-slate-300 rounded p-2" value={localSettings.uiSize} onChange={e => setLocalSettings({ ...localSettings, uiSize: e.target.value as any })}>
                                                    <option value="small">{t('Small')}</option>
                                                    <option value="medium">{t('Medium')}</option>
                                                    <option value="large">{t('Large')}</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block mb-1 text-sm font-medium text-slate-700">{t('CustomFontSize')}</label>
                                                <input
                                                    type="number"
                                                    className="w-full border border-slate-300 rounded p-2"
                                                    value={localSettings.uiFontPx || 13}
                                                    onChange={e => setLocalSettings({ ...localSettings, uiFontPx: Number(e.target.value) })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-bold text-lg text-slate-800 border-b pb-2 mb-4">{t('GanttSettings')}</h4>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block mb-1 text-sm font-medium text-slate-700">{t('VerticalInterval')}</label>
                                            <select
                                                className="w-full border border-slate-300 rounded p-2"
                                                value={localSettings.gridSettings.verticalInterval || 'auto'}
                                                onChange={e => setLocalSettings({ ...localSettings, gridSettings: { ...localSettings.gridSettings, verticalInterval: e.target.value as any } })}
                                            >
                                                <option value="auto">{t('Auto')}</option>
                                                <option value="month">{t('EveryMonth')}</option>
                                                <option value="quarter">{t('EveryQuarter')}</option>
                                                <option value="year">{t('EveryYear')}</option>
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" checked={localSettings.gridSettings.showVertical} onChange={e => setLocalSettings({ ...localSettings, gridSettings: { ...localSettings.gridSettings, showVertical: e.target.checked } })} />
                                                <span className="text-sm text-slate-700">{t('ShowVertical')}</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" checked={localSettings.gridSettings.showHorizontal} onChange={e => setLocalSettings({ ...localSettings, gridSettings: { ...localSettings.gridSettings, showHorizontal: e.target.checked } })} />
                                                <span className="text-sm text-slate-700">{t('ShowHorizontal')}</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" checked={localSettings.gridSettings.showWBSLines} onChange={e => setLocalSettings({ ...localSettings, gridSettings: { ...localSettings.gridSettings, showWBSLines: e.target.checked } })} />
                                                <span className="text-sm text-slate-700">{t('ShowWBS')}</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4 border-t">
                                    <button
                                        className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold shadow-sm"
                                        onClick={handleSavePreferences}
                                    >
                                        {t('Save')}
                                    </button>
                                </div>
                            </div>
                        )}

                        {activeTab === 'subscription' && (
                            <div className="space-y-6">
                                {/* <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className={`px-3 py-1 rounded-full text-sm font-bold uppercase ${user?.plannerRole === 'admin' ? 'bg-purple-100 text-purple-800' :
                                            user?.plannerRole === 'premium' ? 'bg-amber-100 text-amber-800' :
                                                user?.plannerRole === 'licensed' ? 'bg-green-100 text-green-800' :
                                                    'bg-slate-200 text-slate-700'
                                            }`}>
                                            {getPlanName(user?.plannerRole)}
                                        </span>
                                    </div>
                                </div> */}

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Trial Plan */}
                                    <div className={`border p-4 rounded-lg transition-all ${user?.plannerRole === 'trial' ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50 shadow-md transform scale-105' : 'bg-white hover:border-slate-300'}`}>
                                        <h4 className="font-bold text-lg mb-2">{t('Trial')}</h4>
                                        <div className="text-sm text-slate-500 space-y-2">
                                            <p>• {formatLimit(getSubscriptionLimits('trial').activities)} {t('ActivitiesLimit')}</p>
                                            <p>• {formatLimit(getSubscriptionLimits('trial').resources)} {t('ResourcesLimit')}</p>
                                            <p>• {formatLimit(getSubscriptionLimits('trial').customFields)} {t('CustomFieldsLimit')}</p>
                                        </div>
                                    </div>
                                    {/* Licensed Plan */}
                                    <div className={`border p-4 rounded-lg transition-all ${user?.plannerRole === 'licensed' ? 'border-green-500 ring-2 ring-green-100 bg-green-50 shadow-md transform scale-105' : 'bg-white hover:border-slate-300'}`}>
                                        <h4 className="font-bold text-lg mb-2">{t('Licensed')}</h4>
                                        <div className="text-sm text-slate-500 space-y-2">
                                            <p>• {formatLimit(getSubscriptionLimits('licensed').activities)} {t('ActivitiesLimit')}</p>
                                            <p>• {formatLimit(getSubscriptionLimits('licensed').resources)} {t('ResourcesLimit')}</p>
                                            <p>• {formatLimit(getSubscriptionLimits('licensed').customFields)} {t('CustomFieldsLimit')}</p>
                                        </div>
                                    </div>
                                    {/* Premium Plan */}
                                    <div className={`border p-4 rounded-lg transition-all ${user?.plannerRole === 'premium' ? 'border-amber-500 ring-2 ring-amber-100 bg-amber-50 shadow-md transform scale-105' : 'bg-white hover:border-slate-300'}`}>
                                        <h4 className="font-bold text-lg mb-2">{t('Premium')}</h4>
                                        <div className="text-sm text-slate-500 space-y-2">
                                            <p>• {formatLimit(getSubscriptionLimits('premium').activities)} {t('ActivitiesLimit')}</p>
                                            <p>• {formatLimit(getSubscriptionLimits('premium').resources)} {t('ResourcesLimit')}</p>
                                            <p>• {formatLimit(getSubscriptionLimits('premium').customFields)} {t('CustomFieldsLimit')}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'usage' && (
                            <div className="space-y-6 max-w-2xl">
                                {/* Subscription Plan Info */}
                                {/* <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="font-bold text-lg text-slate-800">{t('SubscriptionPlan')}</h4>
                                        <span className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm font-semibold capitalize">
                                            {user?.plannerRole || 'trial'}
                                        </span>
                                    </div>
                                    <div className="text-sm text-slate-600">
                                        {user?.plannerRole === 'trial' && t('FreeTrial')}
                                        {user?.plannerRole === 'licensed' && t('StandardPlan')}
                                        {user?.plannerRole === 'premium' && t('ProPlan')}
                                        {user?.plannerRole === 'admin' && t('Administrator')}
                                    </div>
                                </div> */}

                                {/* Current Project Usage */}
                                <div className="bg-white border rounded-lg p-6 shadow-sm">
                                    <h4 className="font-bold text-lg mb-4 text-slate-700">{t('ProjectUsage')}</h4>

                                    {(() => {
                                        const role = user?.plannerRole || 'trial';
                                        const limitMap: Record<string, number> = {
                                            'trial': Number(import.meta.env.VITE_LIMIT_TRIAL) || 20,
                                            'licensed': Number(import.meta.env.VITE_LIMIT_LICENSED) || 100,
                                            'premium': Number(import.meta.env.VITE_LIMIT_PREMIUM) || 500,
                                            'admin': Number(import.meta.env.VITE_LIMIT_ADMIN) || 9999
                                        };
                                        const resourceLimitMap: Record<string, number> = {
                                            'trial': Number(import.meta.env.VITE_LIMIT_RESOURCE_TRIAL) || 10,
                                            'licensed': Number(import.meta.env.VITE_LIMIT_RESOURCE_LICENSED) || 50,
                                            'premium': Number(import.meta.env.VITE_LIMIT_RESOURCE_PREMIUM) || 200,
                                            'admin': Number(import.meta.env.VITE_LIMIT_RESOURCE_ADMIN) || 9999
                                        };
                                        const customFieldLimitMap: Record<string, number> = {
                                            'trial': 5,
                                            'licensed': 20,
                                            'premium': 50,
                                            'admin': 9999
                                        };

                                        const activityLimit = limitMap[role] || 20;
                                        const resourceLimit = resourceLimitMap[role] || 10;
                                        const customFieldLimit = customFieldLimitMap[role] || 5;

                                        // Get actual counts from useAppStore
                                        const { data } = useAppStore.getState();
                                        const activityCount = data?.activities?.length || 0;
                                        const resourceCount = data?.resources?.length || 0;
                                        const customFieldCount = (data?.meta?.customFieldDefinitions?.length || 0);

                                        const renderUsageBar = (label: string, used: number, limit: number) => {
                                            const percentage = Math.min(100, (used / (limit > 9000 ? 100 : limit)) * 100);
                                            const isOverLimit = used >= limit && limit <= 9000;

                                            return (
                                                <div className="mb-4">
                                                    <div className="flex justify-between items-end mb-2">
                                                        <span className="text-sm font-medium text-slate-600">{label}</span>
                                                        <span className={`text-lg font-bold ${isOverLimit ? 'text-red-600' : 'text-blue-600'}`}>
                                                            {used} <span className="text-sm text-slate-400 font-normal">/ {limit > 9000 ? '∞' : limit}</span>
                                                        </span>
                                                    </div>
                                                    <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all duration-500 ${isOverLimit ? 'bg-red-500' : 'bg-blue-500'}`}
                                                            style={{ width: `${percentage}%` }}
                                                        />
                                                    </div>
                                                    {limit <= 9000 && (
                                                        <p className="text-right text-xs text-slate-500 mt-1">
                                                            {t('Remaining')}: <span className={`font-semibold ${isOverLimit ? 'text-red-600' : 'text-green-600'}`}>{Math.max(0, limit - used)}</span>
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        };

                                        return (
                                            <div className="space-y-4">
                                                {renderUsageBar(t('Activities'), activityCount, activityLimit)}
                                                {renderUsageBar(t('Resources'), resourceCount, resourceLimit)}
                                                {renderUsageBar(t('CustomFields'), customFieldCount, customFieldLimit)}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        )}

                        {activeTab === 'security' && (
                            <div className="space-y-6 max-w-md">
                                {passwordError && (
                                    <div className="bg-red-50 text-red-600 p-3 rounded text-sm border border-red-200">
                                        {passwordError}
                                    </div>
                                )}
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">{t('OldPassword')}</label>
                                        <input
                                            type="password"
                                            className="w-full border border-slate-300 rounded p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                            value={oldPassword}
                                            onChange={e => setOldPassword(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">{t('NewPassword')}</label>
                                        <input
                                            type="password"
                                            className="w-full border border-slate-300 rounded p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-1">{t('ConfirmPassword')}</label>
                                        <input
                                            type="password"
                                            className="w-full border border-slate-300 rounded p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                            value={confirmPassword}
                                            onChange={e => setConfirmPassword(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="pt-4 border-t">
                                    <button
                                        className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-bold shadow-sm disabled:opacity-50"
                                        onClick={handlePasswordChange}
                                        disabled={loading}
                                    >
                                        {loading ? t('Processing') : t('Confirm')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </BaseModal>

            <AlertModal
                isOpen={!!alertMsg}
                msg={alertMsg || ''}
                title={alertTitle}
                onClose={() => setAlertMsg(null)}
            />
        </>
    );
};
