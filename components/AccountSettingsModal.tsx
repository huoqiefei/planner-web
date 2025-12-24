import React, { useState, useEffect, useRef } from 'react';
import { User, UserSettings } from '../types';
import { useTranslation } from '../utils/i18n';
import { BaseModal } from './Modals';
import { authService } from '../services/authService';

interface AccountSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: User | null;
    settings: UserSettings;
    onSaveSettings: (s: UserSettings) => void;
    onUpdateUser: (u: User) => void;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({ 
    isOpen, onClose, user, settings, onSaveSettings, onUpdateUser 
}) => {
    const { t } = useTranslation(settings.language);
    const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'subscription'>('profile');
    
    // Profile State
    const [nickname, setNickname] = useState('');
    const [avatarFile, setAvatarFile] = useState<File | null>(null);
    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Preferences State
    const [localSettings, setLocalSettings] = useState(settings);

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
            alert('Profile updated successfully!');
        } catch (error: any) {
            alert('Failed to update profile: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSavePreferences = () => {
        onSaveSettings(localSettings);
        alert('Preferences saved!');
    };

    return (
        <BaseModal isOpen={isOpen} title={t('AccountSettings')} onClose={onClose}>
            <div className="flex border-b mb-4">
                <button 
                    className={`px-4 py-2 ${activeTab === 'profile' ? 'border-b-2 border-blue-600 font-bold text-blue-600' : 'text-slate-600'}`}
                    onClick={() => setActiveTab('profile')}
                >
                    Profile
                </button>
                <button 
                    className={`px-4 py-2 ${activeTab === 'preferences' ? 'border-b-2 border-blue-600 font-bold text-blue-600' : 'text-slate-600'}`}
                    onClick={() => setActiveTab('preferences')}
                >
                    Preferences
                </button>
                <button 
                    className={`px-4 py-2 ${activeTab === 'subscription' ? 'border-b-2 border-blue-600 font-bold text-blue-600' : 'text-slate-600'}`}
                    onClick={() => setActiveTab('subscription')}
                >
                    Subscription
                </button>
            </div>

            <div className="min-h-[300px]">
                {activeTab === 'profile' && (
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div 
                                className="w-20 h-20 rounded-full bg-slate-200 flex items-center justify-center overflow-hidden cursor-pointer border hover:border-blue-500"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                {avatarPreview ? (
                                    <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-2xl font-bold text-slate-400">
                                        {user?.name?.charAt(0).toUpperCase()}
                                    </span>
                                )}
                            </div>
                            <div>
                                <button 
                                    className="text-sm text-blue-600 hover:underline"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    Change Avatar
                                </button>
                                <input 
                                    type="file" 
                                    ref={fileInputRef} 
                                    className="hidden" 
                                    accept="image/*"
                                    onChange={handleFileChange}
                                />
                                <p className="text-xs text-slate-500 mt-1">Click image to upload new avatar</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nickname</label>
                            <input 
                                type="text" 
                                className="w-full border rounded p-2"
                                value={nickname}
                                onChange={e => setNickname(e.target.value)}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                            <input 
                                type="text" 
                                className="w-full border rounded p-2 bg-slate-100 text-slate-500"
                                value={user?.mail || ''}
                                disabled
                            />
                        </div>

                        <div className="pt-4">
                            <button 
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                                onClick={handleSaveProfile}
                                disabled={loading}
                            >
                                {loading ? 'Saving...' : 'Save Profile'}
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'preferences' && (
                    <div className="space-y-4">
                        {/* Copy of UserSettings content */}
                        <div>
                            <h4 className="font-bold border-b mb-2 pb-1">{t('General')}</h4>
                            <div className="space-y-2">
                                <div>
                                    <label className="block mb-1">{t('DateFormat')}</label>
                                    <select className="w-full border p-1" value={localSettings.dateFormat} onChange={e => setLocalSettings({...localSettings, dateFormat: e.target.value as any})}>
                                        <option value="YYYY-MM-DD">YYYY-MM-DD (2023-10-30)</option>
                                        <option value="DD-MMM-YYYY">DD-MMM-YYYY (30-Oct-2023)</option>
                                        <option value="MM/DD/YYYY">MM/DD/YYYY (10/30/2023)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block mb-1">{t('Language')}</label>
                                    <select className="w-full border p-1" value={localSettings.language} onChange={e => setLocalSettings({...localSettings, language: e.target.value as any})}>
                                        <option value="en">English</option>
                                        <option value="zh">Chinese (Simplified)</option>
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block mb-1">{t('InterfaceSize')}</label>
                                        <select className="w-full border p-1" value={localSettings.uiSize} onChange={e => setLocalSettings({...localSettings, uiSize: e.target.value as any})}>
                                            <option value="small">{t('Small')}</option>
                                            <option value="medium">{t('Medium')}</option>
                                            <option value="large">{t('Large')}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block mb-1">{t('CustomFontSize')}</label>
                                        <input 
                                            type="number" 
                                            className="w-full border p-1" 
                                            value={localSettings.uiFontPx || 13} 
                                            onChange={e => setLocalSettings({...localSettings, uiFontPx: Number(e.target.value)})} 
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold border-b mb-2 pb-1">{t('GanttSettings')}</h4>
                            <div className="space-y-2">
                                 <div>
                                     <label className="block mb-1 font-bold">{t('VerticalInterval')}</label>
                                     <select 
                                         className="w-full border p-1"
                                         value={localSettings.gridSettings.verticalInterval || 'auto'}
                                         onChange={e => setLocalSettings({...localSettings, gridSettings: {...localSettings.gridSettings, verticalInterval: e.target.value as any}})}
                                     >
                                         <option value="auto">{t('Auto')}</option>
                                         <option value="month">{t('EveryMonth')}</option>
                                         <option value="quarter">{t('EveryQuarter')}</option>
                                         <option value="year">{t('EveryYear')}</option>
                                     </select>
                                 </div>

                                <label className="flex items-center gap-2">
                                    <input type="checkbox" checked={localSettings.gridSettings.showVertical} onChange={e => setLocalSettings({...localSettings, gridSettings: {...localSettings.gridSettings, showVertical: e.target.checked}})} />
                                    {t('ShowVertical')}
                                </label>
                                <label className="flex items-center gap-2">
                                    <input type="checkbox" checked={localSettings.gridSettings.showHorizontal} onChange={e => setLocalSettings({...localSettings, gridSettings: {...localSettings.gridSettings, showHorizontal: e.target.checked}})} />
                                    {t('ShowHorizontal')}
                                </label>
                                 <label className="flex items-center gap-2">
                                    <input type="checkbox" checked={localSettings.gridSettings.showWBSLines} onChange={e => setLocalSettings({...localSettings, gridSettings: {...localSettings.gridSettings, showWBSLines: e.target.checked}})} />
                                    {t('ShowWBS')}
                                </label>
                            </div>
                        </div>

                        <div className="pt-4">
                            <button 
                                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                                onClick={handleSavePreferences}
                            >
                                Save Preferences
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === 'subscription' && (
                    <div className="space-y-4">
                        <div className="bg-slate-50 p-4 rounded border">
                            <h3 className="font-bold text-lg mb-2">Current Plan</h3>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-bold uppercase">
                                    {user?.plannerRole || 'Trial'}
                                </span>
                            </div>
                            <p className="text-sm text-slate-600">
                                {user?.plannerRole === 'premium' ? 'You have access to all advanced features.' : 
                                 user?.plannerRole === 'licensed' ? 'You have access to standard features.' : 
                                 'You are using the trial version.'}
                            </p>
                        </div>
                        
                        {/* Mock Subscription Options */}
                        <div className="grid grid-cols-3 gap-4 mt-6">
                            <div className={`border p-4 rounded ${user?.plannerRole === 'trial' ? 'border-blue-500 ring-2 ring-blue-200' : ''}`}>
                                <h4 className="font-bold">Trial</h4>
                                <p className="text-xs text-slate-500">Basic features</p>
                            </div>
                            <div className={`border p-4 rounded ${user?.plannerRole === 'licensed' ? 'border-blue-500 ring-2 ring-blue-200' : ''}`}>
                                <h4 className="font-bold">Licensed</h4>
                                <p className="text-xs text-slate-500">Standard features</p>
                            </div>
                            <div className={`border p-4 rounded ${user?.plannerRole === 'premium' ? 'border-blue-500 ring-2 ring-blue-200' : ''}`}>
                                <h4 className="font-bold">Premium</h4>
                                <p className="text-xs text-slate-500">All features</p>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </BaseModal>
    );
};
