
import React, { useState, useEffect } from 'react';
import { AdminConfig } from '../types';

interface AdminDashboardProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (config: AdminConfig) => void;
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

const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose, onSave }) => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [username, setUsername] = useState('admin');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const [config, setConfig] = useState<AdminConfig>(DEFAULT_CONFIG);

    useEffect(() => {
        if (isOpen) {
            // Load from localStorage
            const saved = localStorage.getItem('planner_admin_config');
            if (saved) {
                try {
                    setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(saved) });
                } catch (e) {
                    setConfig(DEFAULT_CONFIG);
                }
            }
            // Reset Login on open
            setIsLoggedIn(false);
            setPassword('');
            setError('');
        }
    }, [isOpen]);

    const handleLogin = () => {
        if (username === 'admin' && password === 'zzpoikdfa40') {
            setIsLoggedIn(true);
            setError('');
        } else {
            setError('Invalid credentials');
        }
    };

    const handleSaveConfig = () => {
        try {
            localStorage.setItem('planner_admin_config', JSON.stringify(config));
            onSave(config);
            onClose();
        } catch (e) {
            alert("Error saving settings. Image might be too large.");
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

                {!isLoggedIn ? (
                    <div className="p-8 flex flex-col gap-4">
                        <div className="text-center mb-4">
                            <h3 className="text-slate-700 font-bold text-lg">Login Required</h3>
                            <p className="text-slate-500 text-sm">Please enter administrator credentials.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Username</label>
                            <input 
                                className="w-full border p-2 rounded" 
                                value={username} 
                                onChange={e => setUsername(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Password</label>
                            <input 
                                type="password" 
                                className="w-full border p-2 rounded" 
                                value={password} 
                                onChange={e => setPassword(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                            />
                        </div>
                        {error && <div className="text-red-600 text-xs font-bold text-center">{error}</div>}
                        <button onClick={handleLogin} className="mt-2 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 font-bold">Access Dashboard</button>
                    </div>
                ) : (
                    <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
                        <div className="bg-blue-50 border border-blue-200 p-2 text-xs text-blue-800 rounded mb-4">
                            System Settings are saved locally to this browser.
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
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;
