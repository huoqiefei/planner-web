
import React, { useEffect, useRef, useCallback } from 'react';
import { AdminConfig, User } from './types';
// // import { calculateSchedule } from './services/scheduler'; // Moved to worker // Moved to worker
import { authService } from './services/authService';
import { usePermissions } from './hooks/usePermissions';
import { useTranslation } from './utils/i18n';

import { useAppStore } from './stores/useAppStore';
import { useProjectOperations } from './hooks/useProjectOperations';
import { usePrint } from './hooks/usePrint';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { MainLayout } from './components/MainLayout';

// --- APP ---
const App: React.FC = () => {
    const {
        user, setUser,
        isLoginOpen, setIsLoginOpen,
        data, setData, setIsDirty,
        setSchedule,
        view, setView,
        ganttZoom,
        setActiveModal,
        setModalData,
        adminConfig, setAdminConfig,
        userSettings, setUserSettings // Restore userSettings usage as it is needed to pass safe defaults in self-healing
    } = useAppStore(); // Removed unused selectors to satisfy lint, but check logic

    const { t } = useTranslation(userSettings.language);
    // checkPermission is needed to be passed to Layout? Yes.
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
                    ...remote,
                    // Type conversions if needed, though usually handled by state setters if robust
                    watermarkFontSize: remote.watermarkFontSize ? parseInt(remote.watermarkFontSize as any) : prev.watermarkFontSize,
                    watermarkOpacity: remote.watermarkOpacity ? parseFloat(remote.watermarkOpacity as any) : prev.watermarkOpacity,
                    ganttBarRatio: remote.ganttBarRatio ? parseFloat(remote.ganttBarRatio as any) : prev.ganttBarRatio,
                    enableWatermark: remote.enableWatermark === 'true' || remote.enableWatermark === true
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

    // Browser close warning for unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (data && (useAppStore.getState().isDirty)) {
                e.preventDefault();
                e.returnValue = ''; // Modern browsers require this
                return ''; // For older browsers
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [data]); // Re-run when data changes to get latest isDirty state


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
        handleBatchAssign,
        addResource
    } = useProjectOperations({ fileInputRef });

    // Web Worker for Scheduler
    const workerRef = useRef<Worker | null>(null);

    useEffect(() => {
        // Initialize Worker
        workerRef.current = new Worker(new URL('./workers/scheduler.worker.ts', import.meta.url), { type: 'module' });
        workerRef.current.onmessage = (e: MessageEvent) => {
            setSchedule(e.data);
            setIsDirty(true);
        };

        // Initial calculation if data exists
        if (data) {
            workerRef.current.postMessage(data);
        }

        return () => {
            workerRef.current?.terminate();
        };
    }, []);

    useEffect(() => {
        if (data && workerRef.current) {
            workerRef.current.postMessage(data);
        }
    }, [data]);

    useEffect(() => {
        if (user && !data && !isLoginOpen) {
            createNew();
        }
    }, [user, data, isLoginOpen]);

    useEffect(() => {
        if (!userSettings.visibleColumns || userSettings.visibleColumns.length <= 2) {
            const defaults = ['id', 'name', 'duration', 'start', 'finish', 'float', 'preds'];
            const current = userSettings.visibleColumns || [];

            const isSuspicious = current.length === 0 ||
                (current.length <= 2 && current.includes('id') && current.includes('name'));

            if (isSuspicious) {
                setUserSettings(prev => ({
                    ...prev,
                    visibleColumns: defaults
                }));
            }
        }
    }, [userSettings.visibleColumns]);

    const handleOpen = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string);

                // Check if this is a file with embedded settings
                let projectData = json;
                let importedSettings = null;

                if (json.projectData && json.userSettings && json.exportVersion) {
                    // This is a file exported with settings
                    projectData = json.projectData;
                    importedSettings = json.userSettings;
                }

                // Validate project data
                if (projectData.activities && Array.isArray(projectData.activities)) {
                    const role = user?.plannerRole || 'trial';
                    const limitMap: Record<string, number> = { 'trial': 20, 'licensed': 100, 'premium': 500, 'admin': 9999 };
                    const limit = limitMap[role] || 20;

                    if (projectData.activities.length > limit) {
                        setModalData({ msg: `Cannot import project. Activity limit exceeded for ${role} user. Limit: ${limit}, Import Size: ${projectData.activities.length}`, title: "Limit Reached" });
                        setActiveModal('alert');
                        return;
                    }
                }

                // Import project data
                setData(projectData);
                setIsDirty(false);

                // If settings were found, ask user if they want to apply them
                if (importedSettings) {
                    setModalData({
                        msg: "This file contains user settings. Do you want to apply them?",
                        action: () => {
                            setUserSettings(importedSettings);
                            setActiveModal(null);
                        },
                        cancelAction: () => {
                            setActiveModal(null);
                        }
                    });
                    setActiveModal('confirm');
                }
            } catch (err) {
                setModalData({ msg: "Failed to parse file.", title: "Error" });
                setActiveModal('alert');
            }
        };
        reader.readAsText(file);
    };

    useKeyboardShortcuts(handleMenuAction);

    const { executePrint } = usePrint({
        data,
        schedule: useAppStore(s => s.schedule), // Select explicit
        view,
        setView,
        user,
        adminConfig,
        userSettings,
        ganttZoom,
        setActiveModal,
        setModalData
    });

    const handleCloudSaveSuccess = (cloudId: number, name: string) => {
        if (!data) return;
        const newData = {
            ...data,
            meta: {
                ...data.meta,
                cloudId,
                title: name
            }
        };
        setData(newData);
        setIsDirty(false);
    };

    return (
        <MainLayout
            handleMenuAction={handleMenuAction}
            handleRefreshUser={handleRefreshUser}
            handleNew={handleNew}
            handleOpen={handleOpen}
            handleSave={handleSave}
            handleProjectUpdate={handleProjectUpdate}
            handleCtxAction={handleCtxAction}
            handleBatchAssign={handleBatchAssign}
            handleAddResource={addResource}
            handleSaveAdminConfig={handleSaveAdminConfig}
            handleLoginSuccess={handleLoginSuccess}
            handleCloudSaveSuccess={handleCloudSaveSuccess}
            executePrint={executePrint}
            fileInputRef={fileInputRef}
            checkPermission={checkPermission}
            t={t}
        />
    );
};

export default App;
