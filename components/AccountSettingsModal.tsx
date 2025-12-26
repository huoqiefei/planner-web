import React, { useState, useEffect, useRef } from 'react';
import { User, UserSettings } from '../types';
import { useTranslation } from '../utils/i18n';
import { AlertModal } from './Modals';
import { authService } from '../services/authService';

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
        switch(role) {
            case 'trial': return t('Trial');
            case 'licensed': return t('Licensed');
            case 'premium': return t('Premium');
            case 'admin': return t('Admin');
            default: return t('Trial');
        }
    };

    // Get Title based on active tab
    const getTitle = () => {
        switch(activeTab) {
            case 'profile': return t('AccountSettings');
            case 'preferences': return t('UserPreferences');
            case 'subscription': return t('SubscriptionPlan');
            case 'usage': return t('UsageStatistics');
            case 'security': return t('ChangePassword');
            default: return t('AccountSettings');
        }
    };

    return (
        <div className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[100] backdrop-blur-sm ${!isOpen ? 'hidden' : ''}`} onClick={onClose}>
            <div className="bg-white rounded-lg shadow-2xl w-[800px] max-w-[95vw] overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="bg-slate-800 text-white px-6 py-4 font-bold flex justify-between items-center shrink-0">
                    <span className="text-lg">{getTitle()}</span>
                    <button onClick={onClose} className="hover:text-red-300 text-2xl leading-none">&times;</button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Content Area - Full Width (No Sidebar) */}
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
                                            {t('Edit')} Avatar
                                        </button>
                                        <p className="text-xs text-slate-500">Click to upload new image</p>
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
                                        <label className="block text-sm font-bold text-slate-700 mb-1">{t('Name')}</label>
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
                                            <select className="w-full border border-slate-300 rounded p-2" value={localSettings.dateFormat} onChange={e => setLocalSettings({...localSettings, dateFormat: e.target.value as any})}>
                                                <option value="YYYY-MM-DD">YYYY-MM-DD (2023-10-30)</option>
                                                <option value="DD-MMM-YYYY">DD-MMM-YYYY (30-Oct-2023)</option>
                                                <option value="MM/DD/YYYY">MM/DD/YYYY (10/30/2023)</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block mb-1 text-sm font-medium text-slate-700">{t('Language')}</label>
                                            <select className="w-full border border-slate-300 rounded p-2" value={localSettings.language} onChange={e => setLocalSettings({...localSettings, language: e.target.value as any})}>
                                                <option value="en">English</option>
                                                <option value="zh">Chinese (Simplified)</option>
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block mb-1 text-sm font-medium text-slate-700">{t('InterfaceSize')}</label>
                                                <select className="w-full border border-slate-300 rounded p-2" value={localSettings.uiSize} onChange={e => setLocalSettings({...localSettings, uiSize: e.target.value as any})}>
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
                                                    onChange={e => setLocalSettings({...localSettings, uiFontPx: Number(e.target.value)})} 
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
                                                 onChange={e => setLocalSettings({...localSettings, gridSettings: {...localSettings.gridSettings, verticalInterval: e.target.value as any}})}
                                             >
                                                 <option value="auto">{t('Auto')}</option>
                                                 <option value="month">{t('EveryMonth')}</option>
                                                 <option value="quarter">{t('EveryQuarter')}</option>
                                                 <option value="year">{t('EveryYear')}</option>
                                             </select>
                                         </div>

                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" checked={localSettings.gridSettings.showVertical} onChange={e => setLocalSettings({...localSettings, gridSettings: {...localSettings.gridSettings, showVertical: e.target.checked}})} />
                                                <span className="text-sm text-slate-700">{t('ShowVertical')}</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" checked={localSettings.gridSettings.showHorizontal} onChange={e => setLocalSettings({...localSettings, gridSettings: {...localSettings.gridSettings, showHorizontal: e.target.checked}})} />
                                                <span className="text-sm text-slate-700">{t('ShowHorizontal')}</span>
                                            </label>
                                             <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" className="w-4 h-4 text-blue-600 rounded" checked={localSettings.gridSettings.showWBSLines} onChange={e => setLocalSettings({...localSettings, gridSettings: {...localSettings.gridSettings, showWBSLines: e.target.checked}})} />
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
                                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                                    <h3 className="font-bold text-xl mb-3 text-slate-800">{t('SubscriptionPlan')}</h3>
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className={`px-3 py-1 rounded-full text-sm font-bold uppercase ${
                                            user?.plannerRole === 'admin' ? 'bg-purple-100 text-purple-800' :
                                            user?.plannerRole === 'premium' ? 'bg-amber-100 text-amber-800' :
                                            user?.plannerRole === 'licensed' ? 'bg-green-100 text-green-800' :
                                            'bg-slate-200 text-slate-700'
                                        }`}>
                                            {getPlanName(user?.plannerRole)}
                                        </span>
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className={`border p-4 rounded-lg transition-all ${user?.plannerRole === 'trial' ? 'border-blue-500 ring-2 ring-blue-100 bg-blue-50 shadow-md transform scale-105' : 'bg-white hover:border-slate-300'}`}>
                                        <h4 className="font-bold text-lg mb-2">{t('Trial')}</h4>
                                        <div className="text-sm text-slate-500 space-y-2">
                                            <p>• 20 {t('ActivitiesLimit')}</p>
                                            <p>• 1 {t('CloudProjectsLimit')}</p>
                                            <p>• {t('WatermarkStatus')}: {t('Yes')}</p>
                                        </div>
                                    </div>
                                    <div className={`border p-4 rounded-lg transition-all ${user?.plannerRole === 'licensed' ? 'border-green-500 ring-2 ring-green-100 bg-green-50 shadow-md transform scale-105' : 'bg-white hover:border-slate-300'}`}>
                                        <h4 className="font-bold text-lg mb-2">{t('Licensed')}</h4>
                                        <div className="text-sm text-slate-500 space-y-2">
                                            <p>• 100 {t('ActivitiesLimit')}</p>
                                            <p>• 3 {t('CloudProjectsLimit')}</p>
                                            <p>• {t('WatermarkStatus')}: {t('No')}</p>
                                        </div>
                                    </div>
                                    <div className={`border p-4 rounded-lg transition-all ${user?.plannerRole === 'premium' ? 'border-amber-500 ring-2 ring-amber-100 bg-amber-50 shadow-md transform scale-105' : 'bg-white hover:border-slate-300'}`}>
                                        <h4 className="font-bold text-lg mb-2">{t('Premium')}</h4>
                                        <div className="text-sm text-slate-500 space-y-2">
                                            <p>• 500 {t('ActivitiesLimit')}</p>
                                            <p>• 20 {t('CloudProjectsLimit')}</p>
                                            <p>• {t('WatermarkStatus')}: {t('No')}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'usage' && (
                            <div className="space-y-6">
                                <h3 className="font-bold text-xl mb-3 text-slate-800">{t('UsageStatistics')}</h3>
                                {user?.usage ? (
                                    <div className="space-y-6">
                                        <div className="bg-white border rounded-lg p-6 shadow-sm">
                                            <h4 className="font-bold text-lg mb-4 text-slate-700">{t('ProjectUsage')}</h4>
                                            
                                            <div className="mb-2 flex justify-between items-end">
                                                <span className="text-sm text-slate-500">{t('Used')} / {t('Limit')}</span>
                                                <span className="text-2xl font-bold text-blue-600">
                                                    {user.usage.project_count} <span className="text-sm text-slate-400 font-normal">/ {user.usage.project_limit > 9000 ? '∞' : user.usage.project_limit}</span>
                                                </span>
                                            </div>
                                            
                                            <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden mb-2">
                                                <div 
                                                    className={`h-full rounded-full transition-all duration-500 ${user.usage.project_count >= user.usage.project_limit ? 'bg-red-500' : 'bg-blue-500'}`} 
                                                    style={{ width: `${Math.min(100, (user.usage.project_count / (user.usage.project_limit > 9000 ? 100 : user.usage.project_limit)) * 100)}%` }}
                                                />
                                            </div>
                                            
                                            {user.usage.project_limit <= 9000 && (
                                                <p className="text-right text-sm text-slate-500">
                                                    {t('Remaining' as any)}: <span className="font-bold text-green-600">{Math.max(0, user.usage.project_limit - user.usage.project_count)}</span>
                                                </p>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-slate-50 border rounded-lg p-4 text-center">
                                                <div className="text-sm text-slate-500 mb-1">{t('Activities' as any)}</div>
                                                <div className="text-2xl font-bold text-slate-700">{user.usage.activity_count}</div>
                                            </div>
                                            <div className="bg-slate-50 border rounded-lg p-4 text-center">
                                                <div className="text-sm text-slate-500 mb-1">{t('Resources' as any)}</div>
                                                <div className="text-2xl font-bold text-slate-700">{user.usage.resource_count}</div>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-10 text-slate-500">
                                        {t('NoDataAvailable' as any)}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'security' && (
                            <div className="space-y-6 max-w-md">
                                <h4 className="font-bold text-lg text-slate-800 border-b pb-2">{t('ChangePassword')}</h4>
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

                <AlertModal 
                    isOpen={!!alertMsg} 
                    msg={alertMsg || ''} 
                    title={alertTitle}
                    onClose={() => setAlertMsg(null)} 
                />
            </div>
        </div>
    );
};
