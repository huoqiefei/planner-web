import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { temporal } from 'zundo';
import { ProjectData, ScheduleResult, UserSettings, AdminConfig, User, FilterCondition } from '../types';

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
    view: 'activities' | 'resources' | 'usage';
    setView: (view: 'activities' | 'resources' | 'usage') => void;
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
    clipboard: { type: 'Activities' | 'WBS' | 'Resources', data: any } | null;
    setClipboard: (clipboard: { type: 'Activities' | 'WBS' | 'Resources', data: any } | null) => void;

    // Filters
    activityFilters: FilterCondition[];
    resourceFilters: FilterCondition[];
    setActivityFilters: (filters: FilterCondition[] | ((prev: FilterCondition[]) => FilterCondition[])) => void;
    setResourceFilters: (filters: FilterCondition[] | ((prev: FilterCondition[]) => FilterCondition[])) => void;

    // Sorting
    activitySort: { field: 'wbs' | 'activity' | 'wbs-activity' | 'activity-wbs' | null; direction: 'asc' | 'desc' };
    setActivitySort: (sort: { field: 'wbs' | 'activity' | 'wbs-activity' | 'activity-wbs' | null; direction: 'asc' | 'desc' }) => void;


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

export const useAppStore = create<AppState>()(
    temporal(
        persist(
            (set) => ({
                // ... (keep existing content logic, we are just wrapping)
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
                activityFilters: [],
                resourceFilters: [],
                activitySort: { field: null, direction: 'asc' },
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
                    gridSettings: { showVertical: true, verticalInterval: 'auto', showHorizontal: true, showWBSLines: true, showRowNumbers: true },
                    visibleColumns: ['id', 'name', 'duration', 'start', 'finish', 'float', 'preds'],
                    columnWidths: { id: 180, name: 250, duration: 60, start: 90, finish: 90, float: 50, preds: 150 },
                    ganttZoom: 'day'
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
                setGanttZoom: (ganttZoom) => set((state) => ({
                    ganttZoom,
                    userSettings: { ...state.userSettings, ganttZoom }
                })),
                setExpandedWbsIds: (expandedWbsIds) => set((state) => ({
                    expandedWbsIds: typeof expandedWbsIds === 'function' ? expandedWbsIds(state.expandedWbsIds) : expandedWbsIds
                })),
                setShowRelations: (showRelations) => set({ showRelations }),
                setShowCritical: (showCritical) => set({ showCritical }),
                setShowDetails: (showDetails) => set({ showDetails }),
                setSelIds: (selIds) => set({ selIds }),
                setClipboard: (clipboard) => set({ clipboard }),
                setActivityFilters: (filters) => set((state) => ({ activityFilters: typeof filters === 'function' ? filters(state.activityFilters) : filters })),
                setResourceFilters: (filters) => set((state) => ({ resourceFilters: typeof filters === 'function' ? filters(state.resourceFilters) : filters })),
                setActivitySort: (sort) => set({ activitySort: sort }),
                setActiveModal: (activeModal) => set({ activeModal }),
                setModalData: (modalData) => set({ modalData }),
                setSettingsTab: (settingsTab) => set({ settingsTab }),
                setIsDirty: (isDirty) => set({ isDirty }),
                setCtx: (ctx) => set({ ctx }),

                setAdminConfig: (config) => set((state) => ({
                    adminConfig: typeof config === 'function' ? config(state.adminConfig) : config
                })),

                setUserSettings: (settings) => set((state) => {
                    const newSettings = typeof settings === 'function' ? settings(state.userSettings) : settings;
                    // Sync top-level state if present in settings
                    const updates: any = { userSettings: newSettings };
                    if (newSettings.ganttZoom) updates.ganttZoom = newSettings.ganttZoom;
                    return updates;
                })
            }),
            {
                name: 'planner-storage',
                storage: createJSONStorage(() => localStorage),
                partialize: (state) => ({
                    data: state.data, // Persist project data
                    userSettings: state.userSettings,
                    adminConfig: state.adminConfig,
                    ganttZoom: state.ganttZoom,
                    view: state.view,
                    showDetails: state.showDetails,
                    showRelations: state.showRelations,
                    expandedWbsIds: state.expandedWbsIds // Also persist expanded state
                }),
            }
        ), {
        partialize: (state) => ({ data: state.data }),
        limit: 50,
        equality: (a, b) => JSON.stringify(a) === JSON.stringify(b) // Deep compare for data
    }
    ));
