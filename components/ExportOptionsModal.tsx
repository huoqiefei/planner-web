import React from 'react';
import { BaseModal } from './Modals';
import { useTranslation } from '../utils/i18n';

interface ExportOptionsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExportWithSettings: () => void;
    onExportWithoutSettings: () => void;
    lang?: 'en' | 'zh';
}

export const ExportOptionsModal: React.FC<ExportOptionsModalProps> = ({
    isOpen,
    onClose,
    onExportWithSettings,
    onExportWithoutSettings,
    lang = 'en'
}) => {
    const { t } = useTranslation(lang);

    return (
        <BaseModal
            isOpen={isOpen}
            title={t('ExportOptions')}
            onClose={onClose}
            className="w-[500px]"
        >
            <div className="space-y-4">
                <p className="text-slate-700">
                    {t('ExportOptionsDescription')}
                </p>

                <div className="space-y-3 pt-4">
                    <button
                        onClick={onExportWithSettings}
                        className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-left flex items-start gap-3"
                    >
                        <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <div className="font-semibold">{t('ExportWithSettings')}</div>
                            <div className="text-sm text-blue-100 mt-1">{t('ExportWithSettingsDesc')}</div>
                        </div>
                    </button>

                    <button
                        onClick={onExportWithoutSettings}
                        className="w-full px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors text-left flex items-start gap-3"
                    >
                        <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <div>
                            <div className="font-semibold">{t('ExportProjectOnly')}</div>
                            <div className="text-sm text-slate-500 mt-1">{t('ExportProjectOnlyDesc')}</div>
                        </div>
                    </button>
                </div>

                <div className="pt-4 border-t border-slate-200">
                    <button
                        onClick={onClose}
                        className="w-full px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
                    >
                        {t('Cancel')}
                    </button>
                </div>
            </div>
        </BaseModal>
    );
};

export default ExportOptionsModal;
