
import React, { useState, useEffect } from 'react';
import { AdminConfig } from '../types';
import { authService } from '../services/authService';
import { AlertModal } from './Modals';

interface AdminDashboardProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (config: AdminConfig) => void;
    adminConfig: AdminConfig;
}

const DEFAULT_CONFIG: AdminConfig = {
    appName: 'Planner Web',
    copyrightText: 'Copyright © Planner.cn. All rights reserved.',
    enableWatermark: true,
    watermarkText: '',
    watermarkFontSize: 40,
    watermarkOpacity: 0.2,
    ganttBarRatio: 0.35
};

const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose, onSave, adminConfig }) => {
    const [activeTab, setActiveTab] = useState<'config' | 'users'>('config');
    const [alertMsg, setAlertMsg] = useState<string | null>(null);

    const [config, setConfig] = useState<AdminConfig>(adminConfig || DEFAULT_CONFIG);
    
    // User Management State
    const [users, setUsers] = useState<any[]>([]);
    const [userLoading, setUserLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const PAGE_SIZE = 10;

    useEffect(() => {
        if (isOpen) {
            if (adminConfig) {
                setConfig(adminConfig);
            }
            if (activeTab === 'users') {
                loadUsers(1);
            }
        }
    }, [isOpen, adminConfig, activeTab]);

    const loadUsers = async (pageNum: number = page) => {
        setUserLoading(true);
        try {
            const data = await authService.adminUserList(pageNum, PAGE_SIZE);
            if (data.users) {
                setUsers(data.users);
                setTotalPages(Math.ceil((data.total || 0) / PAGE_SIZE));
                setPage(pageNum);
            }
        } catch (e) {
            console.error(e);
            setAlertMsg("Failed to load users. Ensure you are an administrator.");
        } finally {
            setUserLoading(false);
        }
    };

    const handleUserRoleUpdate = async (uid: number, role: string) => {
        try {
            await authService.adminUserUpdate(uid, role as any);
            setUsers(users.map(u => u.uid === uid ? { ...u, meta: { ...u.meta, planner_role: role } } : u));
        } catch (e) {
            setAlertMsg("Failed to update user role.");
        }
    };

    const handleSaveConfig = () => {
        try {
            onSave(config);
            onClose();
        } catch (e) {
            setAlertMsg("Error saving settings.");
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'watermarkImage' | 'appLogo') => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setConfig({ ...config, [field]: base64String });
            };
            reader.readAsDataURL(file);
        }
    };

    const clearImage = (field: 'watermarkImage' | 'appLogo') => {
        setConfig({ ...config, [field]: undefined });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-[100] backdrop-blur-sm">
            <div className="bg-slate-50 border border-slate-300 rounded-lg w-[600px] shadow-2xl overflow-hidden">
                <div className="bg-slate-800 text-white px-4 py-3 font-bold flex justify-between items-center">
                    <span>System Administration</span>
                    <button onClick={onClose} className="hover:text-red-300 text-lg">×</button>
                </div>

                <div className="flex border-b bg-slate-100">
                    <button 
                        className={`flex-1 py-3 text-sm font-bold ${activeTab === 'config' ? 'bg-white border-t-2 border-t-blue-600 text-blue-700' : 'text-slate-500 hover:bg-slate-200'}`}
                        onClick={() => setActiveTab('config')}
                    >
                        System Config
                    </button>
                    <button 
                        className={`flex-1 py-3 text-sm font-bold ${activeTab === 'users' ? 'bg-white border-t-2 border-t-blue-600 text-blue-700' : 'text-slate-500 hover:bg-slate-200'}`}
                        onClick={() => setActiveTab('users')}
                    >
                        User Management
                    </button>
                </div>

                <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                    {activeTab === 'config' ? (
                        <>
                            <div className="bg-blue-50 border border-blue-200 p-2 text-xs text-blue-800 rounded mb-4">
                                System Settings are saved to the backend server.
                            </div>

                    <div className="space-y-4 border-b pb-4">
                        <h4 className="font-bold text-slate-700">General Info</h4>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Software Name</label>
                                <input 
                                    className="w-full border p-2 rounded text-sm" 
                                    value={config.appName} 
                                    onChange={e => setConfig({...config, appName: e.target.value})}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Copyright Footer Info</label>
                                <input 
                                    className="w-full border p-2 rounded text-sm" 
                                    value={config.copyrightText} 
                                    onChange={e => setConfig({...config, copyrightText: e.target.value})}
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">System Logo (Landing Page)</label>
                                <div className="flex gap-2 items-center">
                                    <input 
                                        type="file" 
                                        accept="image/*"
                                        className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                        onChange={(e) => handleImageUpload(e, 'appLogo')}
                                    />
                                    {config.appLogo && (
                                        <button onClick={() => clearImage('appLogo')} className="text-red-500 text-xs underline">Remove</button>
                                    )}
                                </div>
                                {config.appLogo && (
                                    <div className="mt-2 border p-1 bg-white inline-block">
                                        <img src={config.appLogo} alt="Logo Preview" className="h-16 object-contain" />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4 border-b pb-4">
                             <h4 className="font-bold text-slate-700">Gantt Chart</h4>
                             <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">Gantt Bar Height Ratio</label>
                                <input 
                                    type="number" 
                                    step="0.05"
                                    min="0.1"
                                    max="0.9"
                                    className="w-full border p-2 rounded text-sm" 
                                    value={config.ganttBarRatio} 
                                    onChange={e => setConfig({...config, ganttBarRatio: Number(e.target.value)})}
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Relative to row height (0.1 - 0.9)</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <h4 className="font-bold text-slate-700">Print Watermark</h4>
                            <div className="flex items-center">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input 
                                        type="checkbox" 
                                        checked={config.enableWatermark} 
                                        onChange={e => setConfig({...config, enableWatermark: e.target.checked})}
                                        className="w-4 h-4"
                                    />
                                    <span className="text-sm font-bold text-slate-700">Enable Watermark</span>
                                </label>
                            </div>
                            
                            {config.enableWatermark && (
                                <div className="space-y-4 p-4 bg-slate-50 rounded border">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Opacity ({config.watermarkOpacity})</label>
                                            <input 
                                                type="range" 
                                                min="0.05"
                                                max="1"
                                                step="0.05"
                                                className="w-full"
                                                value={config.watermarkOpacity || 0.2} 
                                                onChange={e => setConfig({...config, watermarkOpacity: Number(e.target.value)})}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-500 mb-1">Text Font Size (px)</label>
                                            <input 
                                                type="number" 
                                                className="w-full border p-2 rounded text-sm" 
                                                value={config.watermarkFontSize || 40} 
                                                onChange={e => setConfig({...config, watermarkFontSize: Number(e.target.value)})}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Watermark Text</label>
                                        <input 
                                            className="w-full border p-2 rounded text-sm" 
                                            value={config.watermarkText || ''} 
                                            onChange={e => setConfig({...config, watermarkText: e.target.value})}
                                            placeholder="Default: Planner.cn (or from watermark.md)"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 mb-1">Watermark Image (Overrides Logo)</label>
                                        <div className="flex gap-2 items-center">
                                            <input 
                                                type="file" 
                                                accept="image/*"
                                                className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                                                onChange={(e) => handleImageUpload(e, 'watermarkImage')}
                                            />
                                            {config.watermarkImage && (
                                                <button onClick={() => clearImage('watermarkImage')} className="text-red-500 text-xs underline">Remove</button>
                                            )}
                                        </div>
                                        {config.watermarkImage && (
                                            <div className="mt-2 border p-1 bg-white inline-block">
                                                <img src={config.watermarkImage} alt="Preview" className="h-16 object-contain" />
                                            </div>
                                        )}
                                        <p className="text-[10px] text-slate-400">If no image is uploaded here, System Logo will be used.</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="pt-4 border-t mt-4 flex justify-end gap-2">
                            <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:text-slate-800 text-sm">Cancel</button>
                            <button onClick={handleSaveConfig} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-bold">Save Configuration</button>
                        </div>
                    </>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h4 className="font-bold text-slate-700">User List</h4>
                                <button onClick={() => loadUsers(page)} className="text-blue-600 text-xs hover:underline">Refresh</button>
                            </div>

                            {userLoading ? (
                                <div className="text-center py-8 text-slate-500">Loading users...</div>
                            ) : (
                                <>
                                <div className="border rounded overflow-hidden">
                                    <table className="w-full text-sm text-left">
                                        <thead className="bg-slate-100 text-slate-600 font-bold border-b">
                                            <tr>
                                                <th className="p-2">UID</th>
                                                <th className="p-2">Name</th>
                                                <th className="p-2">Email</th>
                                                <th className="p-2">Typecho Group</th>
                                                <th className="p-2">Planner Role</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                            {users.map(u => {
                                                const currentRole = u.meta?.planner_role || 'trial';
                                                return (
                                                    <tr key={u.uid} className="hover:bg-slate-50">
                                                        <td className="p-2">{u.uid}</td>
                                                        <td className="p-2 font-medium">{u.screenName || u.name}</td>
                                                        <td className="p-2 text-slate-500">{u.mail}</td>
                                                        <td className="p-2 capitalize text-slate-500">{u.group}</td>
                                                        <td className="p-2">
                                                            <select 
                                                                className={`border rounded p-1 text-xs font-bold ${
                                                                    currentRole === 'admin' ? 'text-purple-700 bg-purple-50 border-purple-200' :
                                                                    currentRole === 'premium' ? 'text-amber-700 bg-amber-50 border-amber-200' :
                                                                    currentRole === 'licensed' ? 'text-green-700 bg-green-50 border-green-200' :
                                                                    'text-slate-700 bg-slate-50'
                                                                }`}
                                                                value={currentRole}
                                                                onChange={(e) => handleUserRoleUpdate(u.uid, e.target.value)}
                                                                disabled={u.group === 'administrator' && currentRole === 'admin'} // Protect main admin
                                                            >
                                                                <option value="trial">Trial (Free)</option>
                                                                <option value="licensed">Licensed (Standard)</option>
                                                                <option value="premium">Premium (All Features)</option>
                                                                <option value="admin">Admin</option>
                                                            </select>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                    {users.length === 0 && <div className="p-4 text-center text-slate-500">No users found.</div>}
                                </div>
                                
                                {totalPages > 1 && (
                                    <div className="flex justify-center gap-2 mt-4 items-center">
                                        <button 
                                            disabled={page === 1}
                                            onClick={() => loadUsers(page - 1)}
                                            className="px-3 py-1 border rounded hover:bg-slate-100 disabled:opacity-50 text-sm"
                                        >
                                            Prev
                                        </button>
                                        <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
                                        <button 
                                            disabled={page === totalPages}
                                            onClick={() => loadUsers(page + 1)}
                                            className="px-3 py-1 border rounded hover:bg-slate-100 disabled:opacity-50 text-sm"
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </>
                            )}
                        </div>
                    )}
                </div>
            <AlertModal 
                isOpen={!!alertMsg} 
                msg={alertMsg || ''} 
                title="Error"
                onClose={() => setAlertMsg(null)} 
            />
            </div>
        </div>
    );
};

export default AdminDashboard;
