
import React from 'react';
import { useAppStore } from '../stores/useAppStore';
import Toolbar from './Toolbar';
import MenuBar from './MenuBar';
import CombinedView from './CombinedView';
import DetailsPanel from './DetailsPanel';
import ResourcesPanel from './ResourcesPanel';
import ProjectSettingsModal from './ProjectSettingsModal';
import { AlertModal, ConfirmModal, AboutModal, HelpModal, ColumnSetupModal, AdminModal } from './Modals';
import { AccountSettingsModal } from './AccountSettingsModal';
import { UserPreferencesModal } from './UserPreferencesModal';
import { LoginModal } from './LoginModal';
import { BatchAssignModal } from './BatchAssignModal';
import { CloudLoadModal, CloudSaveModal } from './CloudModals';
import { ExportOptionsModal } from './ExportOptionsModal';
import { FilterModal } from './FilterModal';
import { PrintPreviewModal } from './PrintPreviewModal';
import ResourceUsagePanel from './ResourceUsagePanel';
import { AdminConfig, User } from '../types';

interface MainLayoutProps {
    // Actions & Handlers
    handleMenuAction: (action: string) => void;
    handleRefreshUser: () => void;
    handleNew: () => void;
    handleOpen: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleSave: () => void;
    handleProjectUpdate: (meta: any, calendars: any) => void;
    handleCtxAction: (action: string) => void;
    handleBatchAssign: (resourceIds: string[], units: number) => void;
    handleAddResource: () => void; // Added prop
    getAllResources?: () => any[];
    handleSaveAdminConfig: (c: AdminConfig) => void;
    handleLoginSuccess: (u: User) => void;
    handleCloudSaveSuccess: (id: number, name: string) => void;

    // Print
    executePrint: (settings: any) => Promise<void>;

    // Refs
    fileInputRef: React.RefObject<HTMLInputElement>;

    // Helpers
    checkPermission: (perm: string) => boolean;
    t: (key: string) => string;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
    handleMenuAction,
    handleRefreshUser,
    handleNew,
    handleOpen,
    handleSave,
    handleProjectUpdate,
    handleCtxAction,
    handleBatchAssign,
    handleAddResource,
    handleSaveAdminConfig,
    handleLoginSuccess,
    handleCloudSaveSuccess,
    executePrint,
    fileInputRef,
    checkPermission,
    t
}) => {
    const {
        user, setUser,
        isLoginOpen,
        data, setData, setIsDirty,
        view, setView,
        ganttZoom, setGanttZoom,
        activeModal, setActiveModal,
        modalData, setModalData,
        selIds, setSelIds,
        ctx, setCtx,
        adminConfig,
        userSettings, setUserSettings,
        settingsTab,
        activitySort, setActivitySort
    } = useAppStore();
    const [sortModalOpen, setSortModalOpen] = React.useState(false);

    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
                const tag = document.activeElement?.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA') return;

                switch (e.key.toLowerCase()) {
                    case 'c':
                        e.preventDefault();
                        handleMenuAction('copy');
                        break;
                    case 'x':
                        e.preventDefault();
                        handleMenuAction('cut');
                        break;
                    case 'v':
                        e.preventDefault();
                        handleMenuAction('paste');
                        break;
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleMenuAction]);

    // Sort Modal Component
    const SortModal = () => {
        if (!sortModalOpen) return null;
        
        const sortOptions: { field: 'wbs' | 'activity' | 'wbs-activity' | 'activity-wbs'; label: string }[] = [
            { field: 'wbs', label: t('SortByWBS' as any) },
            { field: 'activity', label: t('SortByActivity' as any) },
            { field: 'wbs-activity', label: t('SortByWBSThenActivity' as any) },
            { field: 'activity-wbs', label: t('SortByActivityThenWBS' as any) },
        ];
        
        return (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[100]" onClick={() => setSortModalOpen(false)}>
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-4 min-w-[280px]" onClick={e => e.stopPropagation()} style={{ fontSize: `${userSettings.uiFontPx || 13}px` }}>
                    <div className="font-bold text-slate-700 dark:text-slate-200 mb-3 pb-2 border-b dark:border-slate-600">{t('Sort' as any)}</div>
                    <div className="space-y-1">
                        {sortOptions.map(opt => (
                            <div key={opt.field} className="flex items-center gap-2">
                                <button
                                    onClick={() => { setActivitySort({ field: opt.field, direction: 'asc' }); setSortModalOpen(false); }}
                                    className={`flex-1 text-left px-3 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 ${activitySort.field === opt.field && activitySort.direction === 'asc' ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}
                                >
                                    {activitySort.field === opt.field && activitySort.direction === 'asc' && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>}
                                    <span className={activitySort.field === opt.field && activitySort.direction === 'asc' ? '' : 'ml-5'}>{opt.label} ↑</span>
                                </button>
                                <button
                                    onClick={() => { setActivitySort({ field: opt.field, direction: 'desc' }); setSortModalOpen(false); }}
                                    className={`flex-1 text-left px-3 py-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 ${activitySort.field === opt.field && activitySort.direction === 'desc' ? 'bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'text-slate-700 dark:text-slate-300'}`}
                                >
                                    {activitySort.field === opt.field && activitySort.direction === 'desc' && <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>}
                                    <span className={activitySort.field === opt.field && activitySort.direction === 'desc' ? '' : 'ml-5'}>{opt.label} ↓</span>
                                </button>
                            </div>
                        ))}
                    </div>
                    {activitySort.field && (
                        <div className="mt-3 pt-2 border-t dark:border-slate-600">
                            <button
                                onClick={() => { setActivitySort({ field: null, direction: 'asc' }); setSortModalOpen(false); }}
                                className="w-full text-left px-3 py-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                            >
                                {t('ClearSort' as any)}
                            </button>
                        </div>
                    )}
                    <div className="mt-3 pt-2 border-t dark:border-slate-600 flex justify-end">
                        <button onClick={() => setSortModalOpen(false)} className="px-4 py-1.5 rounded bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300">
                            {t('Close')}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const ContextMenu = ({ data, onAction }: any) => {
        if (!data) return null;
        const { x, y, type } = data;
        const style = { top: Math.min(y, window.innerHeight - 150), left: Math.min(x, window.innerWidth - 180) };
        const Icons = {
            Task: <svg className="w-3 h-3 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" /><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" /></svg>,
            WBS: <svg className="w-3 h-3 text-yellow-600 dark:text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" /></svg>,
            User: <svg className="w-3 h-3 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>,
            Delete: <svg className="w-3 h-3 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>,
            Number: <svg className="w-3 h-3 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>,
            Sort: <svg className="w-3 h-3 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" /></svg>
        };

        const handleOpenSort = () => {
            setCtx(null);
            setSortModalOpen(true);
        };

        return (
            <div className="ctx-menu dark:bg-slate-800 dark:border-slate-600" style={{ ...style, fontSize: `${userSettings.uiFontPx || 13}px` }} onClick={e => e.stopPropagation()}>
                <div className="bg-slate-100 dark:bg-slate-700 px-3 py-1 font-bold border-b dark:border-slate-600 text-slate-500 dark:text-slate-300">{type} {t('Actions')}</div>
                {type === 'Resource' && (
                    <>
                        <div className="ctx-item" onClick={() => onAction('addRes')}>{Icons.User} {t('AddResource')}</div>
                        <div className="ctx-sep"></div>
                        <div className="ctx-item" onClick={() => onAction('renumberRes')}>{Icons.Number} {t('RenumberResources')}</div>
                        <div className="ctx-sep"></div>
                        <div className="ctx-item text-red-600" onClick={() => onAction('delRes')}>{Icons.Delete} {t('DeleteResource')}</div>
                    </>
                )}
                {type === 'WBS' && (
                    <>
                        <div className="ctx-item" onClick={() => onAction('addAct')}>{Icons.Task} {t('AddActivity')}</div>
                        <div className="ctx-item" onClick={() => onAction('addWBS')}>{Icons.WBS} {t('AddChildWBS')}</div>
                        <div className="ctx-sep"></div>
                        <div className="ctx-item" onClick={handleOpenSort}>{Icons.Sort} {t('Sort' as any)}...</div>
                        <div className="ctx-sep"></div>
                        <div className="ctx-item" onClick={() => onAction('renumber')}>{Icons.Number} {t('RenumberActivities')}</div>
                        <div className="ctx-sep"></div>
                        <div className="ctx-item text-red-600" onClick={() => onAction('delWBS')}>{Icons.Delete} {t('DeleteWBS')}</div>
                    </>
                )}
                {type === 'Activity' && (
                    <>
                        <div className="ctx-item" onClick={() => onAction('addActSame')}>{Icons.Task} {t('AddActivity')}</div>
                        <div className="ctx-item" onClick={() => onAction('assignRes')}>{Icons.User} {t('AssignResource')}</div>
                        <div className="ctx-sep"></div>
                        <div className="ctx-item" onClick={handleOpenSort}>{Icons.Sort} {t('Sort' as any)}...</div>
                        <div className="ctx-sep"></div>
                        <div className="ctx-item" onClick={() => onAction('renumber')}>{Icons.Number} {t('RenumberActivities')}</div>
                        <div className="ctx-sep"></div>
                        <div className="ctx-item text-red-600" onClick={() => onAction('delAct')}>{Icons.Delete} {t('DeleteActivity')}</div>
                    </>
                )}
                {type === 'Assignment' && (
                    <>
                        <div className="ctx-item text-red-600" onClick={() => onAction('delAssignment')}>{Icons.Delete} {t('DeleteAssignment')}</div>
                    </>
                )}
            </div>
        );
    };

    if (!data) {
        return (
            <div className="flex flex-col h-full bg-slate-100 items-center justify-center">
                <div className="animate-pulse text-slate-500 font-bold">Loading Interface...</div>
                <LoginModal isOpen={isLoginOpen} onLoginSuccess={handleLoginSuccess} onClose={() => { }} lang={userSettings.language} adminConfig={adminConfig} />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full dark:bg-slate-900" onClick={() => setCtx(null)}>
            <style>{`
                @media print {
                    @page {
                        size: auto;
                        margin: 10mm;
                    }
                    
                    * {
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }

                    .toolbar-container,
                    .view-tabs-container,
                    .details-panel,
                    .resources-panel,
                    .ctx-menu,
                    .modal-overlay {
                        display: none !important;
                    }
                    
                    /* Table and Row printing */
                    table {
                        page-break-inside: auto;
                    }
                    tr {
                        page-break-inside: avoid !important;
                        page-break-after: auto;
                    }
                    thead {
                        display: table-header-group !important;
                    }
                    tfoot {
                        display: table-footer-group !important;
                    }

                    /* MenuBar Container */
                    .h-8.flex-shrink-0.relative.z-50 {
                        display: none !important;
                    }
                    
                    /* Reset Layout */
                    .flex.flex-col.h-full {
                        display: block !important;
                        height: auto !important;
                        overflow: visible !important;
                    }
                    
                    .flex-grow.overflow-hidden {
                        display: block !important;
                        height: auto !important;
                        overflow: visible !important;
                    }
                    
                    .combined-view-container {
                        position: static !important;
                        height: auto !important;
                        width: 100% !important;
                        display: flex !important;
                        flex-direction: row !important;
                        overflow: visible !important;
                        border: none !important;
                    }
                    
                    /* Expand Body */
                    body, html, #root {
                        height: auto !important;
                        overflow: visible !important;
                        background-color: white !important;
                    }
                    
                    /* Expand P6 View */
                    .p6-body, .p6-header {
                        width: 100% !important;
                        overflow: visible !important;
                        max-height: none !important;
                    }
                    
                    ::-webkit-scrollbar {
                        display: none;
                    }
                }
            `}</style>
            <div className="h-8 flex-shrink-0 relative z-[60]">
                <MenuBar
                    onAction={handleMenuAction}
                />
            </div>

            <Toolbar
                onNew={() => { if (checkPermission('new_project')) handleNew(); }}
                onOpen={(e) => { if (checkPermission('open_project')) handleOpen(e); }}
                onSave={() => { if (checkPermission('export')) handleSave(); }}
                onCloudSave={() => { if (checkPermission('cloud_save')) setActiveModal('cloud_save'); }}
                onPrint={() => { if (checkPermission('print')) setActiveModal('print'); }}
                onSettings={() => { if (checkPermission('project_info')) setActiveModal('project_settings'); }}
                onAddResource={view === 'resources' ? handleAddResource : undefined}
                onUserMenuAction={handleMenuAction}
                onRefreshUser={handleRefreshUser}
            />
            <input type="file" ref={fileInputRef} onChange={handleOpen} className="hidden" accept=".json" />
            <div className="flex-grow flex flex-col overflow-hidden">
                <div className="view-tabs-container bg-slate-100 dark:bg-slate-800 border-b border-slate-300 dark:border-slate-700 flex px-2 pt-1 gap-1 shrink-0" style={{ fontSize: `${userSettings.uiFontPx || 13}px` }}>
                    {['Activities', 'Resources', 'ResourceAllocation'].map(v => {
                        const viewVal = v === 'ResourceAllocation' ? 'usage' : v.toLowerCase() as any;
                        return (
                            <button
                                key={v}
                                onClick={() => {
                                    if (view !== viewVal) setSelIds([]);
                                    setView(viewVal);
                                }}
                                className={`px-4 py-1 font-bold rounded-t ${view === viewVal ? 'bg-white dark:bg-slate-700 text-blue-900 dark:text-blue-300 border-t border-x border-slate-300 dark:border-slate-600 -mb-[1px]' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                            >
                                {t(v as any)}
                            </button>
                        );
                    })}

                    {/* Zoom or Export Controls */}
                    {(view === 'activities' || view === 'usage') && (
                        <div className="ml-auto flex items-center pr-2 pb-1">
                            {view === 'usage' ? (
                                <button
                                    onClick={() => window.dispatchEvent(new CustomEvent('export-allocation-csv'))}
                                    className="px-4 py-0.5 text-[11px] font-bold border rounded bg-white dark:bg-slate-700 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700 transition-colors flex items-center gap-1.5 shadow-sm"
                                >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                    {t('ExportCSV')}
                                </button>
                            ) : (
                                <div className="flex items-center gap-1">
                                    {(['day', 'week', 'month', 'quarter', 'year'] as const).map(z => (
                                        <button
                                            key={z}
                                            onClick={() => setGanttZoom(z)}
                                            className={`px-2 py-0.5 text-[10px] uppercase font-bold border rounded ${ganttZoom === z ? 'bg-blue-600 text-white border-blue-700' : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 border-slate-300 dark:border-slate-600'}`}
                                        >
                                            {t(z as any)}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {view === 'activities' && (
                    <>
                        <div className="flex-grow overflow-hidden bg-white dark:bg-slate-800 relative flex flex-col combined-view-container">
                            <CombinedView />
                        </div>
                        <DetailsPanel />
                    </>
                )}
                {view === 'resources' && (
                    <ResourcesPanel />
                )}
                {view === 'usage' && (
                    <ResourceUsagePanel onCtxAction={handleCtxAction} />
                )}
            </div>

            <ContextMenu data={ctx} onClose={() => setCtx(null)} onAction={handleCtxAction} />
            <SortModal />
            <AlertModal isOpen={activeModal === 'alert'} msg={modalData?.msg} title={modalData?.title} onClose={() => setActiveModal(null)} />
            <ConfirmModal
                isOpen={activeModal === 'confirm'}
                msg={modalData?.msg}
                onConfirm={() => { modalData?.action?.(); setActiveModal(null); }}
                onCancel={() => setActiveModal(null)}
                lang={userSettings.language}
            />
            <AboutModal isOpen={activeModal === 'about'} onClose={() => setActiveModal(null)} customCopyright={adminConfig.copyrightText} />
            <HelpModal isOpen={activeModal === 'help'} onClose={() => setActiveModal(null)} />
            <AdminModal isOpen={activeModal === 'admin'} onClose={() => setActiveModal(null)} onSave={handleSaveAdminConfig} adminConfig={adminConfig} />
            <AccountSettingsModal
                isOpen={activeModal === 'user_settings'}
                user={user}
                settings={userSettings}
                onSaveSettings={setUserSettings}
                onUpdateUser={setUser}
                onClose={() => setActiveModal(null)}
                initialTab={settingsTab}
            />
            <UserPreferencesModal
                isOpen={activeModal === 'user_preferences'}
                settings={userSettings}
                onSaveSettings={setUserSettings}
                onClose={() => setActiveModal(null)}
            />
            <PrintPreviewModal
                isOpen={activeModal === 'print'}
                onClose={() => setActiveModal(null)}
                lang={userSettings.language}
            />
            <ColumnSetupModal
                isOpen={activeModal === 'columns'}
                onClose={() => setActiveModal(null)}
                visibleColumns={view === 'resources' ? (userSettings.resourceVisibleColumns || ['id', 'name', 'type', 'unit', 'maxUnits', 'unitPrice']) : userSettings.visibleColumns}
                onSave={(cols) => {
                    if (view === 'resources') {
                        setUserSettings({ ...userSettings, resourceVisibleColumns: cols });
                    } else {
                        setUserSettings({ ...userSettings, visibleColumns: cols });
                    }
                }}
                lang={userSettings.language}
                scope={view === 'resources' ? 'resource' : 'activity'}
                customFields={data?.meta?.customFieldDefinitions || []}
            />
            <ProjectSettingsModal isOpen={activeModal === 'project_settings'} onClose={() => setActiveModal(null)} projectData={data} onUpdateProject={handleProjectUpdate} initialTab={modalData?.initialTab} lang={userSettings.language} />
            <FilterModal isOpen={activeModal === 'filter'} onClose={() => setActiveModal(null)} lang={userSettings.language} />
            <BatchAssignModal isOpen={activeModal === 'batchRes'} onClose={() => setActiveModal(null)} resources={data.resources} onAssign={handleBatchAssign} lang={userSettings.language} />
            <CloudLoadModal
                isOpen={activeModal === 'cloud_load'}
                onClose={() => setActiveModal(null)}
                onLoad={(c) => {
                    try {
                        setData(typeof c === 'string' ? JSON.parse(c) : c);
                        setIsDirty(false);
                    } catch (e) {
                        setModalData({ msg: 'Failed to parse project', title: 'Error' });
                        setActiveModal('alert');
                    }
                }}
                lang={userSettings.language}
            />
            <CloudSaveModal
                isOpen={activeModal === 'cloud_save'}
                onClose={() => setActiveModal(null)}
                projectData={data}
                lang={userSettings.language}
                onSaveSuccess={handleCloudSaveSuccess}
            />
            <ExportOptionsModal
                isOpen={activeModal === 'export_options'}
                onClose={() => setActiveModal(null)}
                onExportWithSettings={() => modalData?.action?.()}
                onExportWithoutSettings={() => modalData?.cancelAction?.()}
                lang={userSettings.language}
            />
        </div >
    );
};
