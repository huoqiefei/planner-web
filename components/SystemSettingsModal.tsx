
import React, { useState, useEffect } from 'react';
import { useTranslation } from '../utils/i18n';
import { authService } from '../services/authService';

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
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');

    // User Management State
    const [users, setUsers] = useState<any[]>([]);
    const [userLoading, setUserLoading] = useState(false);
    const [userPage, setUserPage] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);

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
            // alert('Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const loadUsers = async () => {
        setUserLoading(true);
        try {
            const data = await authService.adminUserList(userPage);
            if (data.users) {
                setUsers(data.users);
                setTotalUsers(data.total || 0);
            }
        } catch (error) {
            console.error(error);
            alert('Failed to load users');
        } finally {
            setUserLoading(false);
        }
    };

    const handleSaveConfig = async () => {
        setLoading(true);
        try {
            await authService.saveSystemConfig(settings);
            alert(t('SystemConfigSaved'));
            // onClose(); // Don't close, maybe they want to edit more
        } catch (error) {
            console.error(error);
            alert('Failed to save settings');
        } finally {
            setLoading(false);
        }
    };

    const handleUserRoleUpdate = async (uid: number, role: 'trial' | 'licensed' | 'premium') => {
        try {
            await authService.adminUserUpdate(uid, role);
            // Update local state
            setUsers(users.map(u => u.uid === uid ? { ...u, planner_role: role } : u));
        } catch (error) {
            console.error(error);
            alert('Failed to update user role');
        }
    };

    const addSetting = () => {
        if (newKey && !settings[newKey]) {
            setSettings({ ...settings, [newKey]: newValue });
            setNewKey('');
            setNewValue('');
        }
    };

    const removeSetting = (key: string) => {
        const newSettings = { ...settings };
        delete newSettings[key];
        setSettings(newSettings);
    };

    const updateSetting = (key: string, value: string) => {
        setSettings({ ...settings, [key]: value });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow-lg w-[800px] h-[600px] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-slate-100">
                    <h2 className="font-bold text-lg">{t('AdminConsole')}</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700">✕</button>
                </div>

                {/* Tabs */}
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
                        User Management
                    </button>
                </div>
                
                <div className="flex-1 overflow-hidden flex flex-col">
                    {activeTab === 'config' && (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            <div className="flex-1 overflow-y-auto p-4">
                                <div className="space-y-4">
                                    <table className="w-full text-sm border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 text-left">
                                                <th className="p-2 border">Key</th>
                                                <th className="p-2 border">Value</th>
                                                <th className="p-2 border w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(settings).map(([key, value]) => (
                                                <tr key={key}>
                                                    <td className="p-2 border font-medium bg-slate-50">{key}</td>
                                                    <td className="p-2 border">
                                                        <input 
                                                            type="text" 
                                                            value={value} 
                                                            onChange={(e) => updateSetting(key, e.target.value)}
                                                            className="w-full outline-none bg-transparent"
                                                        />
                                                    </td>
                                                    <td className="p-2 border text-center">
                                                        <button 
                                                            onClick={() => removeSetting(key)}
                                                            className="text-red-500 hover:text-red-700"
                                                        >
                                                            ✕
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                            <tr className="bg-blue-50">
                                                <td className="p-2 border">
                                                    <input 
                                                        type="text" 
                                                        placeholder="New Key"
                                                        value={newKey}
                                                        onChange={(e) => setNewKey(e.target.value)}
                                                        className="w-full outline-none bg-transparent"
                                                    />
                                                </td>
                                                <td className="p-2 border">
                                                    <input 
                                                        type="text" 
                                                        placeholder="Value"
                                                        value={newValue}
                                                        onChange={(e) => setNewValue(e.target.value)}
                                                        className="w-full outline-none bg-transparent"
                                                    />
                                                </td>
                                                <td className="p-2 border text-center">
                                                    <button 
                                                        onClick={addSetting}
                                                        className="text-blue-600 hover:text-blue-800 font-bold"
                                                        disabled={!newKey}
                                                    >
                                                        +
                                                    </button>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
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
                                    <div className="text-center py-8 text-slate-500">Loading users...</div>
                                ) : (
                                    <table className="w-full text-sm border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50 text-left">
                                                <th className="p-2 border">ID</th>
                                                <th className="p-2 border">Username</th>
                                                <th className="p-2 border">Email</th>
                                                <th className="p-2 border">Typecho Group</th>
                                                <th className="p-2 border">Authorization</th>
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
                                                            <option value="trial">Trial</option>
                                                            <option value="licensed">Licensed</option>
                                                            <option value="premium">Premium</option>
                                                        </select>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                            <div className="p-4 border-t flex justify-between items-center bg-slate-50">
                                <span className="text-sm text-slate-500">Total Users: {totalUsers}</span>
                                <div className="flex gap-2">
                                    <button 
                                        disabled={userPage <= 1}
                                        onClick={() => setUserPage(p => p - 1)}
                                        className="px-3 py-1 border rounded hover:bg-white disabled:opacity-50"
                                    >
                                        Prev
                                    </button>
                                    <span className="px-2 py-1">{userPage}</span>
                                    <button 
                                        disabled={users.length < 20} // Simple check, ideally check against total
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
        </div>
    );
};
