import { create } from 'zustand';
import { ProjectData, ScheduleResult, UserSettings, AdminConfig, User } from '../types';

interface AppState {
    // User Session
    user: User | null;
    isLoginOpen: boolean;
    setUser: (user: User | null) => void;
    setIsLoginOpen: (isOpen: boolean) => void;

    // Project Data
    data: ProjectData | null;
    schedule: ScheduleResult;
    setData: (data: ProjectData | null | ((prev: ProjectData | null) => ProjectData | null)) => void;
    setSchedule: (schedule: ScheduleResult | ((prev: ScheduleResult) => ScheduleResult)) => void;
    
    // View State
    view: 'activities' | 'resources';
    setView: (view: 'activities' | 'resources') => void;
    ganttZoom: 'day' | 'week' | 'month' | 'quarter' | 'year';
    setGanttZoom: (zoom: 'day' | 'week' | 'month' | 'quarter' | 'year') => void;
    
    expandedWbsIds: Record<string, boolean>;
    setExpandedWbsIds: (ids: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
    
    // Visual Options
    showRelations: boolean;
    setShowRelations: (show: boolean) => void;
    showCritical: boolean;
    setShowCritical: (show: boolean) => void;
    showDetails: boolean;
    setShowDetails: (show: boolean) => void;
    
    // Selection & Clipboard
    selIds: string[];
    setSelIds: (ids: string[]) => void;
    clipboard: {ids: string[], type: 'Activities'|'WBS'|'Resources'} | null;
    setClipboard: (clipboard: {ids: string[], type: 'Activities'|'WBS'|'Resources'} | null) => void;
    
    // Modals
    activeModal: string | null;
    modalData: any;
    setActiveModal: (modal: string | null) => void;
    setModalData: (data: any) => void;
    settingsTab: 'profile' | 'preferences' | 'subscription' | 'security' | 'usage';
    setSettingsTab: (tab: 'profile' | 'preferences' | 'subscription' | 'security' | 'usage') => void;

    // System State
    isDirty: boolean;
    setIsDirty: (isDirty: boolean) => void;
    ctx: any;
    setCtx: (ctx: any) => void;
    
    // Configs
    adminConfig: AdminConfig;
    setAdminConfig: (config: AdminConfig | ((prev: AdminConfig) => AdminConfig)) => void;
    userSettings: UserSettings;
    setUserSettings: (settings: UserSettings | ((prev: UserSettings) => UserSettings)) => void;
}

export const useAppStore = create<AppState>((set) => ({
    // Initial Values
    user: null,
    isLoginOpen: false,
    data: null,
    schedule: { activities: [], wbsMap: {} },
    view: 'activities',
    ganttZoom: 'day',
    expandedWbsIds: {},
    showRelations: true,
    showCritical: false,
    showDetails: true,
    selIds: [],
    clipboard: null,
    activeModal: null,
    modalData: null,
    settingsTab: 'profile',
    isDirty: false,
    ctx: null,
    
    adminConfig: {
        appName: 'Planner Web',
        copyrightText: 'Copyright © Planner.cn. All rights reserved.',
        enableWatermark: true,
        watermarkText: '',
        watermarkFontSize: 40,
        watermarkOpacity: 0.2,
        ganttBarRatio: 0.35
    },
    
    userSettings: { 
        dateFormat: 'YYYY-MM-DD', 
        language: navigator.language.startsWith('zh') ? 'zh' : 'en',
        uiSize: 'small',
        uiFontPx: 13,
        gridSettings: { showVertical: true, verticalInterval: 'auto', showHorizontal: true, showWBSLines: true },
        visibleColumns: ['id', 'name', 'duration', 'start', 'finish', 'float', 'preds'] 
    },

    // Setters
    setUser: (user) => set({ user }),
    setIsLoginOpen: (isLoginOpen) => set({ isLoginOpen }),
    setData: (data) => set((state) => ({ 
        data: typeof data === 'function' ? (data as any)(state.data) : data 
    })),
    setSchedule: (schedule) => set((state) => ({ 
        schedule: typeof schedule === 'function' ? (schedule as any)(state.schedule) : schedule 
    })),
    setView: (view) => set({ view }),
    setGanttZoom: (ganttZoom) => set({ ganttZoom }),
    setExpandedWbsIds: (expandedWbsIds) => set((state) => ({
        expandedWbsIds: typeof expandedWbsIds === 'function' ? expandedWbsIds(state.expandedWbsIds) : expandedWbsIds
    })),
    setShowRelations: (showRelations) => set({ showRelations }),
    setShowCritical: (showCritical) => set({ showCritical }),
    setShowDetails: (showDetails) => set({ showDetails }),
    setSelIds: (selIds) => set({ selIds }),
    setClipboard: (clipboard) => set({ clipboard }),
    setActiveModal: (activeModal) => set({ activeModal }),
    setModalData: (modalData) => set({ modalData }),
    setSettingsTab: (settingsTab) => set({ settingsTab }),
    setIsDirty: (isDirty) => set({ isDirty }),
    setCtx: (ctx) => set({ ctx }),
    
    setAdminConfig: (config) => set((state) => ({
        adminConfig: typeof config === 'function' ? config(state.adminConfig) : config
    })),
    
    setUserSettings: (settings) => set((state) => ({
        userSettings: typeof settings === 'function' ? settings(state.userSettings) : settings
    }))
}));
