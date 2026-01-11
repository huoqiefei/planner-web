import React, { useState, useEffect } from 'react';
import { UserSettings } from '../types';
import { useTranslation } from '../utils/i18n';
import { BaseModal } from './Modals';

interface UserPreferencesModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: UserSettings;
    onSaveSettings: (s: UserSettings) => void;
}

export const UserPreferencesModal: React.FC<UserPreferencesModalProps> = ({
    isOpen, onClose, settings, onSaveSettings
}) => {
    const { t } = useTranslation(settings.language);
    const [localSettings, setLocalSettings] = useState(settings);

    useEffect(() => {
        if (isOpen) {
            setLocalSettings(settings);
        }
    }, [isOpen, settings]);

    const handleSave = () => {
        onSaveSettings(localSettings);
        onClose();
    };

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            title=" "
            className="w-[700px]"
            footer={
                <>
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-slate-300 rounded hover:bg-slate-50">
                        {t('Cancel')}
                    </button>
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                        {t('Save')}
                    </button>
                </>
            }
        >
            <div className="space-y-6 p-6">
                {/* General Settings */}
                <div>
                    <h4 className="font-bold text-lg text-slate-800 border-b pb-2 mb-4">{t('General')}</h4>
                    <div className="space-y-4">
                        <div>
                            <label className="block mb-1 text-sm font-medium text-slate-700">{t('DateFormat')}</label>
                            <select
                                className="w-full border border-slate-300 rounded p-2"
                                value={localSettings.dateFormat}
                                onChange={e => setLocalSettings({ ...localSettings, dateFormat: e.target.value as any })}
                            >
                                <option value="YYYY-MM-DD">YYYY-MM-DD (2023-10-30)</option>
                                <option value="DD-MMM-YYYY">DD-MMM-YYYY (30-Oct-2023)</option>
                                <option value="MM/DD/YYYY">MM/DD/YYYY (10/30/2023)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium text-slate-700">{t('Language')}</label>
                            <select
                                className="w-full border border-slate-300 rounded p-2"
                                value={localSettings.language}
                                onChange={e => setLocalSettings({ ...localSettings, language: e.target.value as any })}
                            >
                                <option value="en">English</option>
                                <option value="zh">Chinese (Simplified)</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block mb-1 text-sm font-medium text-slate-700">{t('InterfaceSize')}</label>
                                <select
                                    className="w-full border border-slate-300 rounded p-2"
                                    value={localSettings.uiSize}
                                    onChange={e => setLocalSettings({ ...localSettings, uiSize: e.target.value as any })}
                                >
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

                {/* Gantt Settings */}
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
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-blue-600 rounded"
                                    checked={localSettings.gridSettings.showVertical}
                                    onChange={e => setLocalSettings({ ...localSettings, gridSettings: { ...localSettings.gridSettings, showVertical: e.target.checked } })}
                                />
                                <span className="text-sm text-slate-700">{t('ShowVerticalLines')}</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-blue-600 rounded"
                                    checked={localSettings.gridSettings.showHorizontal}
                                    onChange={e => setLocalSettings({ ...localSettings, gridSettings: { ...localSettings.gridSettings, showHorizontal: e.target.checked } })}
                                />
                                <span className="text-sm text-slate-700">{t('ShowHorizontalLines')}</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="w-4 h-4 text-blue-600 rounded"
                                    checked={localSettings.gridSettings.showWBSLines}
                                    onChange={e => setLocalSettings({ ...localSettings, gridSettings: { ...localSettings.gridSettings, showWBSLines: e.target.checked } })}
                                />
                                <span className="text-sm text-slate-700">{t('ShowWBSLines')}</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </BaseModal>
    );
};

export default UserPreferencesModal;
