/**
 * Planner Web Plugin System
 * 
 * This module provides a plugin architecture for extending Planner Web functionality.
 * Plugins can hook into various parts of the application to add features like:
 * - Custom import/export formats (Excel, XER, MPP, etc.)
 * - Additional toolbar buttons
 * - Context menu items
 * - Custom calculations
 * - Data transformations
 */

import { Activity, WBSNode, Resource, ProjectData, Calendar } from '../types';

// Plugin Hook Types
export type HookName = 
    | 'onDataImport'
    | 'onDataExport'
    | 'onActivityCreate'
    | 'onActivityUpdate'
    | 'onActivityDelete'
    | 'onScheduleCalculate'
    | 'onToolbarRender'
    | 'onContextMenu'
    | 'onProjectLoad'
    | 'onProjectSave'
    | 'onPaste';

export interface HookPayload {
    onDataImport: { data: any; format: string };
    onDataExport: { data: ProjectData; format: string };
    onActivityCreate: { activity: Activity };
    onActivityUpdate: { activity: Activity; field: string; oldValue: any; newValue: any };
    onActivityDelete: { activityIds: string[] };
    onScheduleCalculate: { activities: Activity[]; calendars: Calendar[] };
    onToolbarRender: { position: 'left' | 'center' | 'right' };
    onContextMenu: { type: 'activity' | 'wbs' | 'resource'; ids: string[]; x: number; y: number };
    onProjectLoad: { project: ProjectData };
    onProjectSave: { project: ProjectData };
    onPaste: { text: string; target: 'activity' | 'resource' };
}

export type HookCallback<T extends HookName> = (payload: HookPayload[T]) => any;

// Toolbar Button Definition
export interface ToolbarButton {
    id: string;
    icon: string | React.ReactNode;
    label?: string;
    tooltip?: string;
    position?: 'left' | 'center' | 'right';
    onClick: () => void;
    isActive?: () => boolean;
    isDisabled?: () => boolean;
}

// Menu Item Definition
export interface MenuItem {
    id: string;
    label: string;
    icon?: string;
    shortcut?: string;
    onClick: () => void;
    isDisabled?: () => boolean;
    children?: MenuItem[];
}

// Context Menu Item
export interface ContextMenuItem {
    id: string;
    label: string;
    icon?: string;
    onClick: (ids: string[]) => void;
    isVisible?: (type: string, ids: string[]) => boolean;
    isDisabled?: (type: string, ids: string[]) => boolean;
}

// UI API for plugins
export interface UIApi {
    showFilePicker: (options: { accept?: string; multiple?: boolean }) => Promise<File | File[] | null>;
    showSaveDialog: (options: { defaultName?: string; accept?: string }) => Promise<string | null>;
    showAlert: (message: string, title?: string) => Promise<void>;
    showConfirm: (message: string, title?: string) => Promise<boolean>;
    showPrompt: (message: string, defaultValue?: string) => Promise<string | null>;
    showToast: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
    showModal: (component: React.ReactNode) => Promise<any>;
}

// Project API for plugins
export interface ProjectApi {
    getData: () => ProjectData | null;
    setData: (data: ProjectData) => void;
    importActivities: (activities: Partial<Activity>[]) => void;
    importResources: (resources: Partial<Resource>[]) => void;
    getSelectedIds: () => string[];
    selectIds: (ids: string[]) => void;
    recalculate: () => void;
}

// Toolbar API
export interface ToolbarApi {
    addButton: (button: ToolbarButton) => void;
    removeButton: (id: string) => void;
    updateButton: (id: string, updates: Partial<ToolbarButton>) => void;
}

// Menu API
export interface MenuApi {
    addItem: (menuId: string, item: MenuItem) => void;
    removeItem: (menuId: string, itemId: string) => void;
}

// Context Menu API
export interface ContextMenuApi {
    addItem: (item: ContextMenuItem) => void;
    removeItem: (id: string) => void;
}

// Hooks API
export interface HooksApi {
    on: <T extends HookName>(hook: T, callback: HookCallback<T>) => void;
    off: <T extends HookName>(hook: T, callback: HookCallback<T>) => void;
    emit: <T extends HookName>(hook: T, payload: HookPayload[T]) => any[];
}

// Complete Plugin API
export interface PluginAPI {
    ui: UIApi;
    project: ProjectApi;
    toolbar: ToolbarApi;
    menu: MenuApi;
    contextMenu: ContextMenuApi;
    hooks: HooksApi;
    storage: {
        get: (key: string) => any;
        set: (key: string, value: any) => void;
        remove: (key: string) => void;
    };
}

// Plugin Definition
export interface Plugin {
    id: string;
    name: string;
    version: string;
    description?: string;
    author?: string;
    activate: (api: PluginAPI) => void | Promise<void>;
    deactivate?: () => void | Promise<void>;
}

// Plugin Manager
class PluginManager {
    private plugins: Map<string, Plugin> = new Map();
    private hooks: Map<HookName, Set<HookCallback<any>>> = new Map();
    private toolbarButtons: Map<string, ToolbarButton> = new Map();
    private menuItems: Map<string, MenuItem[]> = new Map();
    private contextMenuItems: Map<string, ContextMenuItem> = new Map();
    
    // Callbacks for UI updates
    private onToolbarUpdate?: () => void;
    private onMenuUpdate?: () => void;
    private onContextMenuUpdate?: () => void;
    
    // Project data accessor
    private projectAccessor?: {
        getData: () => ProjectData | null;
        setData: (data: ProjectData) => void;
        getSelectedIds: () => string[];
        selectIds: (ids: string[]) => void;
        recalculate: () => void;
    };

    setProjectAccessor(accessor: typeof this.projectAccessor) {
        this.projectAccessor = accessor;
    }

    setUpdateCallbacks(callbacks: {
        onToolbarUpdate?: () => void;
        onMenuUpdate?: () => void;
        onContextMenuUpdate?: () => void;
    }) {
        this.onToolbarUpdate = callbacks.onToolbarUpdate;
        this.onMenuUpdate = callbacks.onMenuUpdate;
        this.onContextMenuUpdate = callbacks.onContextMenuUpdate;
    }

    private createAPI(pluginId: string): PluginAPI {
        return {
            ui: this.createUIApi(),
            project: this.createProjectApi(),
            toolbar: this.createToolbarApi(pluginId),
            menu: this.createMenuApi(pluginId),
            contextMenu: this.createContextMenuApi(pluginId),
            hooks: this.createHooksApi(),
            storage: this.createStorageApi(pluginId)
        };
    }

    private createUIApi(): UIApi {
        return {
            showFilePicker: async (options) => {
                return new Promise((resolve) => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    if (options.accept) input.accept = options.accept;
                    if (options.multiple) input.multiple = true;
                    input.onchange = () => {
                        const files = input.files;
                        if (!files || files.length === 0) resolve(null);
                        else if (options.multiple) resolve(Array.from(files));
                        else resolve(files[0]);
                    };
                    input.click();
                });
            },
            showSaveDialog: async (options) => {
                return options.defaultName || 'download';
            },
            showAlert: async (message, title) => {
                alert(title ? `${title}\n\n${message}` : message);
            },
            showConfirm: async (message, title) => {
                return confirm(title ? `${title}\n\n${message}` : message);
            },
            showPrompt: async (message, defaultValue) => {
                return prompt(message, defaultValue);
            },
            showToast: (message, type = 'info') => {
                console.log(`[${type.toUpperCase()}] ${message}`);
                // TODO: Integrate with app toast system
            },
            showModal: async (component) => {
                // TODO: Integrate with app modal system
                return null;
            }
        };
    }

    private createProjectApi(): ProjectApi {
        return {
            getData: () => this.projectAccessor?.getData() || null,
            setData: (data) => this.projectAccessor?.setData(data),
            importActivities: (activities) => {
                const current = this.projectAccessor?.getData();
                if (current) {
                    // Merge activities
                    const newActivities = [...current.activities];
                    activities.forEach(act => {
                        const existing = newActivities.findIndex(a => a.id === act.id);
                        if (existing >= 0) {
                            newActivities[existing] = { ...newActivities[existing], ...act } as Activity;
                        } else {
                            newActivities.push(act as Activity);
                        }
                    });
                    this.projectAccessor?.setData({ ...current, activities: newActivities });
                }
            },
            importResources: (resources) => {
                const current = this.projectAccessor?.getData();
                if (current) {
                    const newResources = [...current.resources];
                    resources.forEach(res => {
                        const existing = newResources.findIndex(r => r.id === res.id);
                        if (existing >= 0) {
                            newResources[existing] = { ...newResources[existing], ...res } as Resource;
                        } else {
                            newResources.push(res as Resource);
                        }
                    });
                    this.projectAccessor?.setData({ ...current, resources: newResources });
                }
            },
            getSelectedIds: () => this.projectAccessor?.getSelectedIds() || [],
            selectIds: (ids) => this.projectAccessor?.selectIds(ids),
            recalculate: () => this.projectAccessor?.recalculate()
        };
    }

    private createToolbarApi(pluginId: string): ToolbarApi {
        return {
            addButton: (button) => {
                const id = `${pluginId}:${button.id}`;
                this.toolbarButtons.set(id, { ...button, id });
                this.onToolbarUpdate?.();
            },
            removeButton: (id) => {
                this.toolbarButtons.delete(`${pluginId}:${id}`);
                this.onToolbarUpdate?.();
            },
            updateButton: (id, updates) => {
                const fullId = `${pluginId}:${id}`;
                const existing = this.toolbarButtons.get(fullId);
                if (existing) {
                    this.toolbarButtons.set(fullId, { ...existing, ...updates });
                    this.onToolbarUpdate?.();
                }
            }
        };
    }

    private createMenuApi(pluginId: string): MenuApi {
        return {
            addItem: (menuId, item) => {
                const items = this.menuItems.get(menuId) || [];
                items.push({ ...item, id: `${pluginId}:${item.id}` });
                this.menuItems.set(menuId, items);
                this.onMenuUpdate?.();
            },
            removeItem: (menuId, itemId) => {
                const items = this.menuItems.get(menuId);
                if (items) {
                    const idx = items.findIndex(i => i.id === `${pluginId}:${itemId}`);
                    if (idx >= 0) {
                        items.splice(idx, 1);
                        this.onMenuUpdate?.();
                    }
                }
            }
        };
    }

    private createContextMenuApi(pluginId: string): ContextMenuApi {
        return {
            addItem: (item) => {
                const id = `${pluginId}:${item.id}`;
                this.contextMenuItems.set(id, { ...item, id });
                this.onContextMenuUpdate?.();
            },
            removeItem: (id) => {
                this.contextMenuItems.delete(`${pluginId}:${id}`);
                this.onContextMenuUpdate?.();
            }
        };
    }

    private createHooksApi(): HooksApi {
        return {
            on: (hook, callback) => {
                if (!this.hooks.has(hook)) {
                    this.hooks.set(hook, new Set());
                }
                this.hooks.get(hook)!.add(callback);
            },
            off: (hook, callback) => {
                this.hooks.get(hook)?.delete(callback);
            },
            emit: (hook, payload) => {
                const callbacks = this.hooks.get(hook);
                if (!callbacks) return [];
                return Array.from(callbacks).map(cb => cb(payload));
            }
        };
    }

    private createStorageApi(pluginId: string) {
        const prefix = `plugin:${pluginId}:`;
        return {
            get: (key: string) => {
                const val = localStorage.getItem(prefix + key);
                return val ? JSON.parse(val) : null;
            },
            set: (key: string, value: any) => {
                localStorage.setItem(prefix + key, JSON.stringify(value));
            },
            remove: (key: string) => {
                localStorage.removeItem(prefix + key);
            }
        };
    }

    // Public methods
    async register(plugin: Plugin): Promise<void> {
        if (this.plugins.has(plugin.id)) {
            console.warn(`Plugin ${plugin.id} is already registered`);
            return;
        }
        
        this.plugins.set(plugin.id, plugin);
        const api = this.createAPI(plugin.id);
        
        try {
            await plugin.activate(api);
            console.log(`Plugin ${plugin.name} (${plugin.id}) activated`);
        } catch (error) {
            console.error(`Failed to activate plugin ${plugin.id}:`, error);
            this.plugins.delete(plugin.id);
        }
    }

    async unregister(pluginId: string): Promise<void> {
        const plugin = this.plugins.get(pluginId);
        if (!plugin) return;
        
        try {
            await plugin.deactivate?.();
        } catch (error) {
            console.error(`Error deactivating plugin ${pluginId}:`, error);
        }
        
        // Clean up plugin resources
        this.toolbarButtons.forEach((_, key) => {
            if (key.startsWith(`${pluginId}:`)) {
                this.toolbarButtons.delete(key);
            }
        });
        
        this.contextMenuItems.forEach((_, key) => {
            if (key.startsWith(`${pluginId}:`)) {
                this.contextMenuItems.delete(key);
            }
        });
        
        this.plugins.delete(pluginId);
        console.log(`Plugin ${pluginId} unregistered`);
    }

    getPlugin(id: string): Plugin | undefined {
        return this.plugins.get(id);
    }

    getAllPlugins(): Plugin[] {
        return Array.from(this.plugins.values());
    }

    getToolbarButtons(): ToolbarButton[] {
        return Array.from(this.toolbarButtons.values());
    }

    getMenuItems(menuId: string): MenuItem[] {
        return this.menuItems.get(menuId) || [];
    }

    getContextMenuItems(): ContextMenuItem[] {
        return Array.from(this.contextMenuItems.values());
    }

    // Emit hook to all registered handlers
    emitHook<T extends HookName>(hook: T, payload: HookPayload[T]): any[] {
        const callbacks = this.hooks.get(hook);
        if (!callbacks) return [];
        return Array.from(callbacks).map(cb => {
            try {
                return cb(payload);
            } catch (error) {
                console.error(`Error in hook ${hook}:`, error);
                return null;
            }
        });
    }
}

// Singleton instance
export const pluginManager = new PluginManager();

// Export for use in components
export default pluginManager;
