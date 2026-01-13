import React, { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../stores/useAppStore';
import { useTranslation } from '../utils/i18n';
import CombinedView from './CombinedView';

interface PrintPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    lang?: 'en' | 'zh';
}

export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({ isOpen, onClose, lang = 'en' }) => {
    const { t } = useTranslation(lang as 'en' | 'zh');
    const { data, showRelations, showCritical } = useAppStore();
    const printRef = useRef<HTMLDivElement>(null);
    
    const [settings, setSettings] = useState({
        headerText: '',
        footerText: '',
        showPageNumber: true,
        showDate: true,
        showLegend: true,
        showBorder: true
    });

    useEffect(() => {
        if (isOpen && data?.meta?.title) {
            setSettings(s => ({ ...s, headerText: data.meta.title }));
        }
    }, [isOpen, data?.meta?.title]);

    if (!isOpen || !data) return null;

    const currentDate = new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US');

    const handlePrint = () => {
        window.print();
    };

    return (
        <>
            {/* Print Styles - injected when modal is open */}
            <style>{`
                @media print {
                    /* Hide everything except print content */
                    body > *:not(.print-preview-modal) {
                        display: none !important;
                    }
                    
                    .print-preview-modal {
                        position: fixed !important;
                        inset: 0 !important;
                        z-index: 99999 !important;
                        background: white !important;
                    }
                    
                    .print-preview-modal .modal-backdrop,
                    .print-preview-modal .modal-header,
                    .print-preview-modal .modal-settings,
                    .print-preview-modal .modal-footer {
                        display: none !important;
                    }
                    
                    .print-preview-modal .preview-scroll-area {
                        overflow: visible !important;
                        padding: 0 !important;
                        background: white !important;
                    }
                    
                    .print-preview-modal .print-content-wrapper {
                        box-shadow: none !important;
                        margin: 0 !important;
                        width: 100% !important;
                        max-width: none !important;
                    }
                    
                    .print-preview-modal .print-view-container {
                        height: auto !important;
                        overflow: visible !important;
                    }
                    
                    .print-preview-modal .print-view-container > div {
                        height: auto !important;
                        overflow: visible !important;
                    }
                    
                    /* Make all scrollable areas visible */
                    .print-preview-modal [style*="overflow"] {
                        overflow: visible !important;
                        max-height: none !important;
                    }
                    
                    /* Hide bottom padding */
                    .print-preview-modal .print\\:hidden {
                        display: none !important;
                    }
                    
                    @page {
                        size: landscape;
                        margin: 8mm;
                    }
                    
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                }
            `}</style>

            <div className="print-preview-modal fixed inset-0 z-[100] flex flex-col">
                {/* Backdrop */}
                <div className="modal-backdrop absolute inset-0 bg-black/50" onClick={onClose} />
                
                {/* Modal Content */}
                <div className="relative z-10 flex flex-col h-full m-4 bg-white rounded-lg shadow-2xl">
                    {/* Modal Header */}
                    <div className="modal-header flex items-center justify-between px-4 py-3 border-b bg-slate-50 rounded-t-lg shrink-0">
                        <h2 className="font-bold text-slate-700">{lang === 'zh' ? '打印预览' : 'Print Preview'}</h2>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    {/* Settings Bar */}
                    <div className="modal-settings flex items-center gap-4 px-4 py-2 border-b bg-slate-50 text-sm shrink-0 flex-wrap">
                        <div className="flex items-center gap-2">
                            <label className="text-slate-600">{lang === 'zh' ? '页眉' : 'Header'}:</label>
                            <input
                                type="text"
                                className="border rounded px-2 py-1 w-40"
                                value={settings.headerText}
                                onChange={e => setSettings({ ...settings, headerText: e.target.value })}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-slate-600">{lang === 'zh' ? '页脚' : 'Footer'}:</label>
                            <input
                                type="text"
                                className="border rounded px-2 py-1 w-40"
                                value={settings.footerText}
                                onChange={e => setSettings({ ...settings, footerText: e.target.value })}
                            />
                        </div>
                        <label className="flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" checked={settings.showPageNumber} onChange={e => setSettings({ ...settings, showPageNumber: e.target.checked })} />
                            <span className="text-slate-600">{lang === 'zh' ? '页码' : 'Page #'}</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" checked={settings.showDate} onChange={e => setSettings({ ...settings, showDate: e.target.checked })} />
                            <span className="text-slate-600">{lang === 'zh' ? '日期' : 'Date'}</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" checked={settings.showLegend} onChange={e => setSettings({ ...settings, showLegend: e.target.checked })} />
                            <span className="text-slate-600">{lang === 'zh' ? '图例' : 'Legend'}</span>
                        </label>
                        <label className="flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" checked={settings.showBorder} onChange={e => setSettings({ ...settings, showBorder: e.target.checked })} />
                            <span className="text-slate-600">{lang === 'zh' ? '边框' : 'Border'}</span>
                        </label>
                    </div>

                    {/* Preview Area - scrollable */}
                    <div className="preview-scroll-area flex-1 overflow-auto p-6 bg-slate-200">
                        <div ref={printRef} className="print-content-wrapper bg-white shadow-lg mx-auto">
                            {/* Print Container with optional border */}
                            <div className={settings.showBorder ? 'border border-slate-400' : ''}>
                                {/* Header */}
                                {(settings.headerText || settings.showDate) && (
                                    <div className="print-header flex justify-between items-center px-4 py-2 border-b bg-slate-50">
                                        <div className="font-semibold text-slate-800 text-sm">{settings.headerText}</div>
                                        <div className="text-xs text-slate-500">
                                            {settings.showDate && <span>{currentDate}</span>}
                                        </div>
                                    </div>
                                )}

                                {/* Main Content - reuse CombinedView */}
                                <div className="print-view-container" style={{ height: 'calc(100vh - 300px)', minHeight: '400px' }}>
                                    <CombinedView />
                                </div>

                                {/* Legend */}
                                {settings.showLegend && (
                                    <div className="print-legend flex gap-6 px-4 py-2 border-t bg-slate-50 text-xs text-slate-600">
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-2 rounded" style={{ background: '#3b82f6' }}></div>
                                            <span>{lang === 'zh' ? '普通作业' : 'Normal Task'}</span>
                                        </div>
                                        {showCritical && (
                                            <div className="flex items-center gap-2">
                                                <div className="w-5 h-2 rounded" style={{ background: '#ef4444' }}></div>
                                                <span>{lang === 'zh' ? '关键作业' : 'Critical Task'}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-[3px]" style={{ background: '#cccccc' }}></div>
                                            <span>{lang === 'zh' ? 'WBS 汇总' : 'WBS Summary'}</span>
                                        </div>
                                        {showRelations && (
                                            <div className="flex items-center gap-2">
                                                <svg width="24" height="10">
                                                    <path d="M0,5 L18,5" stroke="#94a3b8" strokeWidth="1" fill="none" />
                                                    <polygon points="18,2 24,5 18,8" fill="#94a3b8" />
                                                </svg>
                                                <span>{lang === 'zh' ? '逻辑关系' : 'Relationship'}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Footer */}
                                {(settings.footerText || settings.showPageNumber || settings.showDate) && (
                                    <div className="print-footer flex justify-between items-center px-4 py-2 border-t bg-slate-50 text-xs text-slate-500">
                                        <div>{settings.footerText}</div>
                                        <div className="flex gap-4">
                                            {settings.showPageNumber && <span>{lang === 'zh' ? '第 1 页' : 'Page 1'}</span>}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="modal-footer flex justify-between items-center gap-2 px-4 py-3 border-t bg-slate-50 rounded-b-lg shrink-0">
                        <p className="text-xs text-slate-500">
                            {lang === 'zh' ? '提示：请先在屏幕上调整好缩放级别，打印将按照当前显示效果输出' : 'Tip: Adjust zoom level on screen first, print will match current display'}
                        </p>
                        <div className="flex gap-2">
                            <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded hover:bg-slate-100">
                                {t('Cancel')}
                            </button>
                            <button onClick={handlePrint} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                                {t('Print')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default PrintPreviewModal;
