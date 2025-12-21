
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
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [newKey, setNewKey] = useState('');
    const [newValue, setNewValue] = useState('');

    useEffect(() => {
        if (isOpen) {
            loadSettings();
        }
    }, [isOpen]);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const data = await authService.getSystemConfig();
            if (data.config) {
                setSettings(data.config);
            }
        } catch (error) {
            console.error(error);
            alert('Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            await authService.saveSystemConfig(settings);
            alert(t('SystemConfigSaved'));
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to save settings');
        } finally {
            setLoading(false);
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
            <div className="bg-white rounded shadow-lg w-[600px] max-h-[80vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-slate-100">
                    <h2 className="font-bold text-lg">{t('SystemSettings')}</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700">✕</button>
                </div>
                
                <div className="p-4 flex-1 overflow-y-auto">
                    <div className="space-y-4">
                        <table className="w-full text-sm">
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
                    <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-slate-100">
                        {t('Cancel')}
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? t('Saving') : t('Save')}
                    </button>
                </div>
            </div>
        </div>
    );
};
