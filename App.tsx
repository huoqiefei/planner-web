
import React, { useEffect, useRef, useCallback } from 'react';
import { AdminConfig, User } from './types';
import { calculateSchedule } from './services/scheduler';
import { authService } from './services/authService';
import Toolbar from './components/Toolbar';
import MenuBar from './components/MenuBar';
import CombinedView from './components/CombinedView';
import DetailsPanel from './components/DetailsPanel';
import ResourcesPanel from './components/ResourcesPanel';
import ProjectSettingsModal from './components/ProjectSettingsModal';
import { AlertModal, ConfirmModal, AboutModal, PrintSettingsModal, BatchAssignModal, HelpModal, ColumnSetupModal, AdminModal } from './components/Modals';
import { AccountSettingsModal } from './components/AccountSettingsModal';
import { LoginModal } from './components/LoginModal';
import { CloudLoadModal, CloudSaveModal } from './components/CloudModals';
import { usePermissions } from './hooks/usePermissions';
import { useTranslation } from './utils/i18n';

import { useAppStore } from './stores/useAppStore';
import { useProjectOperations } from './hooks/useProjectOperations';
import { usePrint } from './hooks/usePrint';

// --- APP ---
const App: React.FC = () => {
    const {
        user, setUser,
        isLoginOpen, setIsLoginOpen,
        data, setData,
        schedule, setSchedule,
        view, setView,
        ganttZoom, setGanttZoom,
        activeModal, setActiveModal,
        modalData, setModalData,
        ctx, setCtx,
        setIsDirty,
        adminConfig, setAdminConfig,
        userSettings, setUserSettings,
        settingsTab
    } = useAppStore();

    const { t } = useTranslation(userSettings.language);
    const { checkPermission } = usePermissions(user, userSettings.language, setModalData, setActiveModal);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Load User Session & Admin Config
    useEffect(() => {
        const currentUser = authService.getCurrentUser();
        if (currentUser) {
            setUser(currentUser);
        } else {
            setIsLoginOpen(true);
        }
    }, []);

    const handleRefreshUser = async () => {
        try {
            const updatedUser = await authService.refreshUser();
            setUser(updatedUser);
        } catch (error) {
            console.error("Failed to refresh user:", error);
            // If session expired, user will be logged out by authService, but we need to update state
            if ((error as Error).message === 'Session expired') {
                setUser(null);
                setIsLoginOpen(true);
            }
        }
    };

    const loadSystemConfig = useCallback(async () => {
        try {
            const res = await authService.getPublicConfig();
            if (res.config) {
                 const remote = res.config;
                 setAdminConfig(prev => ({
                     ...prev,
                     appName: remote.appName || prev.appName,
                     copyrightText: remote.copyrightText || prev.copyrightText,
                     enableWatermark: remote.enableWatermark === 'true' || remote.enableWatermark === true,
                     watermarkText: remote.watermarkText || prev.watermarkText,
                     watermarkFontSize: remote.watermarkFontSize ? parseInt(remote.watermarkFontSize) : prev.watermarkFontSize,
                     watermarkOpacity: remote.watermarkOpacity ? parseFloat(remote.watermarkOpacity) : prev.watermarkOpacity,
                     ganttBarRatio: remote.ganttBarRatio ? parseFloat(remote.ganttBarRatio) : prev.ganttBarRatio,
                     appLogo: remote.appLogo || prev.appLogo,
                     watermarkImage: remote.watermarkImage || prev.watermarkImage,
                     aiSettings: remote.aiSettings || prev.aiSettings
                 }));
            }
        } catch (e) { console.error("Failed to load system config", e); }
    }, []);

    useEffect(() => {
        loadSystemConfig();
    }, [loadSystemConfig]);

    useEffect(() => {
        if (user?.group === 'admin') {
             authService.getSystemConfig().then(res => {
                 if (res.config) {
                     setAdminConfig(prev => ({
                         ...prev,
                         ...res.config
                     }));
                 }
             }).catch(e => console.error("Failed to load admin config", e));
        }
    }, [user]);

    const handleSaveAdminConfig = async (newConfig: AdminConfig) => {
        setAdminConfig(newConfig);
        try {
            await authService.saveSystemConfig(newConfig);
            setModalData({ msg: t('SystemConfigSaved') || "System configuration saved.", title: t('Success') || "Success" });
            setActiveModal('alert');
        } catch (e) {
            console.error("Failed to save config remote", e);
             setModalData({ msg: "Failed to save to backend. Changes applied locally.", title: "Error" });
             setActiveModal('alert');
        }
    };

    const handleLoginSuccess = (user: User) => {
        setUser(user);
        setIsLoginOpen(false);
    };

    const { 
        handleMenuAction, 
        handleProjectUpdate,
        handleSave,
        handleNew,
        createNew,
        handleCtxAction,
        handleBatchAssign
    } = useProjectOperations({ fileInputRef });

    useEffect(() => { 
        if(data) { 
            const res = calculateSchedule(data);
            setSchedule(res); 
            setIsDirty(true); 
        } 
    }, [data]);

    // Auto-initialize project on login if none exists
    useEffect(() => {
        if (user && !data && !isLoginOpen) {
            createNew();
        }
    }, [user, data, isLoginOpen]);

    const handleOpen = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);
                
                // Activity Limit Check for Import
                if (json.activities && Array.isArray(json.activities)) {
                    const role = user?.plannerRole || 'trial';
                    const limitMap: Record<string, number> = { 'trial': 20, 'licensed': 100, 'premium': 500, 'admin': 9999 };
                    const limit = limitMap[role] || 20;
                    
                    if (json.activities.length > limit) {
                        setModalData({ msg: `Cannot import project. Activity limit exceeded for ${role} user. Limit: ${limit}, Import Size: ${json.activities.length}`, title: "Limit Reached" });
                        setActiveModal('alert');
                        return;
                    }
                }

                setData(json); setIsDirty(false);
            } catch (err) { setModalData({ msg: "Failed to parse file.", title: "Error" }); setActiveModal('alert'); }
        };
        reader.readAsText(file);
    };

    // Global Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement;
            // Allow copy/paste in inputs, but block for the app level if not in input
            const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
            
            if (!isInput && (e.ctrlKey || e.metaKey)) {
                if (e.key === 'c') { e.preventDefault(); handleMenuAction('copy'); }
                if (e.key === 'x') { e.preventDefault(); handleMenuAction('cut'); }
                if (e.key === 'v') { e.preventDefault(); handleMenuAction('paste'); }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleMenuAction]);

    // --- ENHANCED PRINT LOGIC ---
    const { executePrint } = usePrint({
        data,
        schedule,
        view,
        setView,
        user,
        adminConfig,
        userSettings,
        ganttZoom,
        setActiveModal,
        setModalData
    });

    const ContextMenu = ({ data, onAction }: any) => {
        if (!data) return null;
        const { x, y, type } = data;
        const style = { top: Math.min(y, window.innerHeight - 150), left: Math.min(x, window.innerWidth - 180) };
        const Icons = {
            Task: <svg className="w-3 h-3 text-green-600" fill="currentColor" viewBox="0 0 20 20"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/></svg>,
            WBS: <svg className="w-3 h-3 text-yellow-600" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"/></svg>,
            User: <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/></svg>,
            Delete: <svg className="w-3 h-3 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>,
            Number: <svg className="w-3 h-3 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg>
        };
        
        return (
            <div className="ctx-menu" style={{ ...style, fontSize: `${userSettings.uiFontPx || 13}px` }} onClick={e => e.stopPropagation()}>
                <div className="bg-slate-100 px-3 py-1 font-bold border-b text-slate-500">{type} {t('Actions')}</div>
                {type === 'WBS' && (
                    <>
                        <div className="ctx-item" onClick={() => onAction('addAct')}>{Icons.Task} {t('AddActivity')}</div>
                        <div className="ctx-item" onClick={() => onAction('addWBS')}>{Icons.WBS} {t('AddChildWBS')}</div>
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
                        <div className="ctx-item" onClick={() => onAction('renumber')}>{Icons.Number} {t('RenumberActivities')}</div>
                        <div className="ctx-sep"></div>
                        <div className="ctx-item text-red-600" onClick={() => onAction('delAct')}>{Icons.Delete} {t('DeleteActivity')}</div>
                    </>
                )}
            </div>
        );
    };

    if (!data) {
        return (
            <div className="flex flex-col h-full bg-slate-100 items-center justify-center">
                 <div className="animate-pulse text-slate-500 font-bold">Loading Interface...</div>
                 <LoginModal isOpen={isLoginOpen} onLoginSuccess={handleLoginSuccess} onClose={() => {}} lang={userSettings.language} adminConfig={adminConfig} />
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full" onClick={() => setCtx(null)}>
            <style>{`
                @media print {
                    .toolbar-container,
                    .view-tabs-container,
                    .details-panel,
                    .resources-panel,
                    .ctx-menu,
                    .modal-overlay {
                        display: none !important;
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
            <div className="h-8 flex-shrink-0 relative z-50">
                <MenuBar 
                    onAction={handleMenuAction} 
                    onRefreshUser={handleRefreshUser}
                />
            </div>
            
            <Toolbar 
                onNew={() => { if(checkPermission('new_project')) handleNew(); }} 
                onOpen={(e) => { if(checkPermission('open_project')) handleOpen(e); }}
                onSave={() => { if(checkPermission('export')) handleSave(); }}
                onCloudSave={() => { if(checkPermission('cloud_save')) setActiveModal('cloud_save'); }}
                onPrint={() => { if(checkPermission('print')) setActiveModal('print'); }} 
                onSettings={() => { if(checkPermission('project_info')) setActiveModal('project_settings'); }} 
            />
            <input type="file" ref={fileInputRef} onChange={handleOpen} className="hidden" accept=".json" />

            <div className="flex-grow flex flex-col overflow-hidden">
                <div className="view-tabs-container bg-slate-300 border-b flex px-2 pt-1 gap-1 shrink-0" style={{ fontSize: `${userSettings.uiFontPx || 13}px` }}>
                    {['Activities', 'Resources'].map(v => (
                        <button key={v} onClick={() => setView(v.toLowerCase() as any)} className={`px-4 py-1 font-bold rounded-t ${view === v.toLowerCase() ? 'bg-white text-blue-900' : 'text-slate-600 hover:bg-slate-200'}`}>
                            {t(v as any)}
                        </button>
                    ))}

                    {/* Zoom Controls */}
                    {view === 'activities' && (
                        <div className="ml-auto flex items-center gap-1 pr-2 pb-1">
                            {(['day', 'week', 'month', 'quarter', 'year'] as const).map(z => (
                                <button 
                                    key={z} 
                                    onClick={() => setGanttZoom(z)}
                                    className={`px-2 py-0.5 text-[10px] uppercase font-bold border rounded ${ganttZoom === z ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                                >
                                    {t(z as any)}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {view === 'activities' && (
                    <>
                        <div className="flex-grow overflow-hidden bg-white relative flex flex-col combined-view-container">
                            <CombinedView />
                        </div>
                        <DetailsPanel />
                    </>
                )}
                {view === 'resources' && (
                    <ResourcesPanel />
                )}
            </div>

            <ContextMenu data={ctx} onClose={() => setCtx(null)} onAction={handleCtxAction} />
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
            <PrintSettingsModal 
                isOpen={activeModal === 'print'} 
                onClose={() => setActiveModal(null)} 
                onPrint={executePrint} 
                onSystemPrint={() => window.print()}
                lang={userSettings.language} 
            />
            <ColumnSetupModal isOpen={activeModal === 'columns'} onClose={() => setActiveModal(null)} visibleColumns={userSettings.visibleColumns} onSave={(cols) => setUserSettings({...userSettings, visibleColumns: cols})} lang={userSettings.language} />
            <ProjectSettingsModal isOpen={activeModal === 'project_settings'} onClose={() => setActiveModal(null)} projectData={data} onUpdateProject={handleProjectUpdate} />
            <BatchAssignModal isOpen={activeModal === 'batchRes'} onClose={() => setActiveModal(null)} resources={data.resources} onAssign={handleBatchAssign} lang={userSettings.language} />
            <CloudLoadModal 
                 isOpen={activeModal === 'cloud_load'} 
                 onClose={() => setActiveModal(null)} 
                 onLoad={(c) => { 
                     try { 
                         setData(typeof c === 'string' ? JSON.parse(c) : c); 
                         setIsDirty(false); 
                     } catch(e) { 
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
             />
        </div>
    );
};

export default App;
