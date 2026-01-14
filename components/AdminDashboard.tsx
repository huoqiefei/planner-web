import React, { useState, useEffect, useCallback } from 'react';
import { AdminConfig } from '../types';
import { authService } from '../services/authService';
import { AlertModal, BaseModal, ConfirmModal } from './Modals';
import { useTranslation } from '../utils/i18n';
import { useAppStore } from '../stores/useAppStore';

interface AdminDashboardProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (config: AdminConfig) => void;
    adminConfig: AdminConfig;
}

interface UserRecord {
    uid: number;
    name?: string;
    screenName?: string;
    mail: string;
    group?: string;
    plannerRole?: string;
    planner_role?: string;
    meta?: { planner_role?: string };
    created?: string;
    logged?: string;
}

const DEFAULT_CONFIG: AdminConfig = {
    appName: 'Planner Web',
    copyrightText: 'Copyright © Planner.cn. All rights reserved.',
    enableWatermark: true,
    watermarkText: '',
    watermarkFontSize: 40,
    watermarkOpacity: 0.2,
    ganttBarRatio: 0.35
};

const ROLE_OPTIONS = [
    { value: 'trial', label: 'Trial', color: 'slate' },
    { value: 'licensed', label: 'Licensed', color: 'green' },
    { value: 'premium', label: 'Premium', color: 'amber' },
    { value: 'admin', label: 'Admin', color: 'purple' }
];

const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose, onSave, adminConfig }) => {
    const { userSettings } = useAppStore();
    const { t } = useTranslation(userSettings.language);
    
    const [activeTab, setActiveTab] = useState<'config' | 'users' | 'plugins'>('config');
    const [alertMsg, setAlertMsg] = useState<string | null>(null);
    const [config, setConfig] = useState<AdminConfig>(adminConfig || DEFAULT_CONFIG);

    // User Management State
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [userLoading, setUserLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);
    const PAGE_SIZE = 15;
    
    // Search & Filter
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    
    // Batch Selection
    const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [batchRole, setBatchRole] = useState<string>('licensed');
    const [confirmDelete, setConfirmDelete] = useState(false);

    // Sort
    const [sortField, setSortField] = useState<'uid' | 'name' | 'mail' | 'created'>('uid');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    useEffect(() => {
        if (isOpen) {
            if (adminConfig) setConfig(adminConfig);
            if (activeTab === 'users') loadUsers(1);
        }
    }, [isOpen, adminConfig, activeTab]);

    const loadUsers = useCallback(async (pageNum: number = page) => {
        setUserLoading(true);
        try {
            const data = await authService.adminUserList(pageNum, PAGE_SIZE);
            if (data.users) {
                setUsers(data.users);
                setTotalUsers(data.total || 0);
                setTotalPages(Math.ceil((data.total || 0) / PAGE_SIZE));
                setPage(pageNum);
            }
        } catch (e) {
            console.error(e);
            setAlertMsg(t('FailedToLoadUsers'));
        } finally {
            setUserLoading(false);
        }
    }, [page, t]);

    // Filter users locally (for search/role filter)
    const filteredUsers = users.filter(u => {
        const name = u.screenName || u.name || '';
        const mail = u.mail || '';
        const role = u.plannerRole || u.planner_role || u.meta?.planner_role || 'trial';
        
        const matchesSearch = searchQuery === '' || 
            name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            mail.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.uid.toString().includes(searchQuery);
        
        const matchesRole = roleFilter === 'all' || role === roleFilter;
        
        return matchesSearch && matchesRole;
    });

    // Sort users
    const sortedUsers = [...filteredUsers].sort((a, b) => {
        let aVal: any, bVal: any;
        switch (sortField) {
            case 'uid': aVal = a.uid; bVal = b.uid; break;
            case 'name': aVal = a.screenName || a.name || ''; bVal = b.screenName || b.name || ''; break;
            case 'mail': aVal = a.mail || ''; bVal = b.mail || ''; break;
            case 'created': aVal = a.created || ''; bVal = b.created || ''; break;
            default: aVal = a.uid; bVal = b.uid;
        }
        if (typeof aVal === 'string') {
            return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
    });

    const handleUserRoleUpdate = async (uid: number, role: string) => {
        try {
            await authService.adminUserUpdate(uid, role as any);
            setUsers(users.map(u => u.uid === uid ? { 
                ...u, plannerRole: role, planner_role: role,
                meta: { ...u.meta, planner_role: role } 
            } : u));
        } catch (e) {
            setAlertMsg(t('FailedToUpdateRole'));
        }
    };

    const handleBatchRoleUpdate = async () => {
        if (selectedUserIds.size === 0) return;
        setUserLoading(true);
        try {
            for (const uid of selectedUserIds) {
                await authService.adminUserUpdate(uid, batchRole as any);
            }
            // Update local state
            setUsers(users.map(u => selectedUserIds.has(u.uid) ? {
                ...u, plannerRole: batchRole, planner_role: batchRole,
                meta: { ...u.meta, planner_role: batchRole }
            } : u));
            setSelectedUserIds(new Set());
            setShowBatchModal(false);
        } catch (e) {
            setAlertMsg(t('BatchUpdateFailed'));
        } finally {
            setUserLoading(false);
        }
    };

    const toggleUserSelection = (uid: number) => {
        const newSet = new Set(selectedUserIds);
        if (newSet.has(uid)) newSet.delete(uid);
        else newSet.add(uid);
        setSelectedUserIds(newSet);
    };

    const toggleSelectAll = () => {
        if (selectedUserIds.size === sortedUsers.length) {
            setSelectedUserIds(new Set());
        } else {
            setSelectedUserIds(new Set(sortedUsers.map(u => u.uid)));
        }
    };

    const handleSaveConfig = () => {
        try {
            onSave(config);
            onClose();
        } catch (e) {
            setAlertMsg(t('ErrorSavingSettings'));
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, field: 'watermarkImage' | 'appLogo') => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setConfig({ ...config, [field]: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    const clearImage = (field: 'watermarkImage' | 'appLogo') => {
        setConfig({ ...config, [field]: undefined });
    };

    const handleSort = (field: typeof sortField) => {
        if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'admin': return 'text-purple-700 bg-purple-50 border-purple-200';
            case 'premium': return 'text-amber-700 bg-amber-50 border-amber-200';
            case 'licensed': return 'text-green-700 bg-green-50 border-green-200';
            default: return 'text-slate-700 bg-slate-50 border-slate-200';
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <BaseModal
                isOpen={isOpen}
                onClose={onClose}
                title={t('SystemAdministration')}
                className="w-[800px] max-w-[95vw] h-[85vh] flex flex-col"
                footer={activeTab === 'config' ? (
                    <div className="flex justify-end gap-2 w-full">
                        <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:text-slate-800 text-sm">{t('Cancel')}</button>
                        <button onClick={handleSaveConfig} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm font-bold">{t('SaveConfiguration')}</button>
                    </div>
                ) : undefined}
            >
                {/* Tab Navigation */}
                <div className="flex border-b bg-slate-100 mb-4 -mx-4 -mt-2 px-4">
                    {(['config', 'users', 'plugins'] as const).map(tab => (
                        <button
                            key={tab}
                            className={`px-6 py-3 text-sm font-bold transition-colors ${
                                activeTab === tab 
                                    ? 'bg-white border-t-2 border-t-blue-600 text-blue-700 -mb-px' 
                                    : 'text-slate-500 hover:bg-slate-200'
                            }`}
                            onClick={() => setActiveTab(tab)}
                        >
                            {tab === 'config' ? t('SystemConfig') : tab === 'users' ? t('UserManagement') : t('Plugins')}
                        </button>
                    ))}
                </div>

                <div className="flex-grow overflow-y-auto custom-scrollbar pr-2">
                    {activeTab === 'config' && renderConfigTab()}
                    {activeTab === 'users' && renderUsersTab()}
                    {activeTab === 'plugins' && renderPluginsTab()}
                </div>
            </BaseModal>

            {/* Batch Edit Modal */}
            <BaseModal
                isOpen={showBatchModal}
                onClose={() => setShowBatchModal(false)}
                title={t('BatchEditUsers')}
                className="w-[400px]"
                footer={
                    <div className="flex justify-end gap-2 w-full">
                        <button onClick={() => setShowBatchModal(false)} className="px-4 py-2 text-slate-500 hover:text-slate-800 text-sm">{t('Cancel')}</button>
                        <button onClick={handleBatchRoleUpdate} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-bold">
                            {t('ApplyToSelected')} ({selectedUserIds.size})
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <p className="text-sm text-slate-600">{t('BatchEditDescription')}</p>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">{t('NewRole')}</label>
                        <select
                            className="w-full border p-2 rounded text-sm"
                            value={batchRole}
                            onChange={e => setBatchRole(e.target.value)}
                        >
                            {ROLE_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </BaseModal>

            <AlertModal isOpen={!!alertMsg} msg={alertMsg || ''} title="Error" onClose={() => setAlertMsg(null)} />
        </>
    );

    function renderConfigTab() {
        return (
            <div className="space-y-6">
                <div className="bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 rounded">
                    {t('SystemSettingsInfo')}
                </div>

                {/* General Info */}
                <section className="space-y-4 border-b pb-6">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        {t('GeneralInfo')}
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">{t('SoftwareName')}</label>
                            <input className="w-full border p-2 rounded text-sm" value={config.appName} onChange={e => setConfig({...config, appName: e.target.value})} />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">{t('CopyrightFooter')}</label>
                            <input className="w-full border p-2 rounded text-sm" value={config.copyrightText} onChange={e => setConfig({...config, copyrightText: e.target.value})} />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">{t('SystemLogo')}</label>
                        <div className="flex gap-2 items-center">
                            <input type="file" accept="image/*" className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" onChange={(e) => handleImageUpload(e, 'appLogo')} />
                            {config.appLogo && <button onClick={() => clearImage('appLogo')} className="text-red-500 text-xs underline">{t('Remove')}</button>}
                        </div>
                        {config.appLogo && <div className="mt-2 border p-1 bg-white inline-block"><img src={config.appLogo} alt="Logo" className="h-12 object-contain" /></div>}
                    </div>
                </section>

                {/* Gantt Settings */}
                <section className="space-y-4 border-b pb-6">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                        {t('GanttChart')}
                    </h4>
                    <div className="w-1/2">
                        <label className="block text-xs font-bold text-slate-500 mb-1">{t('GanttBarHeightRatio')}</label>
                        <input type="number" step="0.05" min="0.1" max="0.9" className="w-full border p-2 rounded text-sm" value={config.ganttBarRatio} onChange={e => setConfig({...config, ganttBarRatio: Number(e.target.value)})} />
                        <p className="text-[10px] text-slate-400 mt-1">{t('GanttBarRatioHint')}</p>
                    </div>
                </section>

                {/* Watermark Settings */}
                <section className="space-y-4">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                        {t('PrintWatermark')}
                    </h4>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={config.enableWatermark} onChange={e => setConfig({...config, enableWatermark: e.target.checked})} className="w-4 h-4" />
                        <span className="text-sm font-bold text-slate-700">{t('EnableWatermark')}</span>
                    </label>
                    {config.enableWatermark && (
                        <div className="space-y-4 p-4 bg-slate-50 rounded border">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">{t('Opacity')} ({config.watermarkOpacity})</label>
                                    <input type="range" min="0.05" max="1" step="0.05" className="w-full" value={config.watermarkOpacity || 0.2} onChange={e => setConfig({...config, watermarkOpacity: Number(e.target.value)})} />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">{t('TextFontSize')}</label>
                                    <input type="number" className="w-full border p-2 rounded text-sm" value={config.watermarkFontSize || 40} onChange={e => setConfig({...config, watermarkFontSize: Number(e.target.value)})} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">{t('WatermarkText')}</label>
                                <input className="w-full border p-2 rounded text-sm" value={config.watermarkText || ''} onChange={e => setConfig({...config, watermarkText: e.target.value})} placeholder="Default: Planner.cn" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">{t('WatermarkImage')}</label>
                                <div className="flex gap-2 items-center">
                                    <input type="file" accept="image/*" className="text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" onChange={(e) => handleImageUpload(e, 'watermarkImage')} />
                                    {config.watermarkImage && <button onClick={() => clearImage('watermarkImage')} className="text-red-500 text-xs underline">{t('Remove')}</button>}
                                </div>
                                {config.watermarkImage && <div className="mt-2 border p-1 bg-white inline-block"><img src={config.watermarkImage} alt="Preview" className="h-12 object-contain" /></div>}
                            </div>
                        </div>
                    )}
                </section>
            </div>
        );
    }

    function renderUsersTab() {
        return (
            <div className="space-y-4">
                {/* Toolbar */}
                <div className="flex flex-wrap gap-3 items-center justify-between bg-slate-50 p-3 rounded border">
                    <div className="flex gap-2 items-center">
                        {/* Search */}
                        <div className="relative">
                            <input
                                type="text"
                                placeholder={t('SearchUsers')}
                                className="pl-8 pr-3 py-1.5 border rounded text-sm w-48"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                            <svg className="w-4 h-4 absolute left-2 top-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        {/* Role Filter */}
                        <select
                            className="border rounded px-2 py-1.5 text-sm"
                            value={roleFilter}
                            onChange={e => setRoleFilter(e.target.value)}
                        >
                            <option value="all">{t('AllRoles')}</option>
                            {ROLE_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex gap-2 items-center">
                        {/* Batch Actions */}
                        {selectedUserIds.size > 0 && (
                            <button
                                onClick={() => setShowBatchModal(true)}
                                className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-bold hover:bg-blue-700 flex items-center gap-1"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                {t('BatchEdit')} ({selectedUserIds.size})
                            </button>
                        )}
                        <button onClick={() => loadUsers(page)} className="px-3 py-1.5 border rounded text-sm hover:bg-slate-100 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            {t('Refresh')}
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="flex gap-4 text-xs text-slate-500">
                    <span>{t('TotalUsers')}: <strong className="text-slate-700">{totalUsers}</strong></span>
                    <span>{t('Showing')}: <strong className="text-slate-700">{sortedUsers.length}</strong></span>
                    {selectedUserIds.size > 0 && <span>{t('Selected')}: <strong className="text-blue-600">{selectedUserIds.size}</strong></span>}
                </div>

                {/* Table */}
                {userLoading ? (
                    <div className="text-center py-12 text-slate-500">
                        <svg className="animate-spin h-8 w-8 mx-auto mb-2 text-blue-500" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        {t('LoadingUsers')}
                    </div>
                ) : (
                    <div className="border rounded overflow-hidden">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-100 text-slate-600 font-bold border-b">
                                <tr>
                                    <th className="p-2 w-8">
                                        <input
                                            type="checkbox"
                                            checked={selectedUserIds.size === sortedUsers.length && sortedUsers.length > 0}
                                            onChange={toggleSelectAll}
                                            className="w-4 h-4"
                                        />
                                    </th>
                                    <th className="p-2 cursor-pointer hover:bg-slate-200" onClick={() => handleSort('uid')}>
                                        UID {sortField === 'uid' && (sortDir === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="p-2 cursor-pointer hover:bg-slate-200" onClick={() => handleSort('name')}>
                                        {t('Name')} {sortField === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="p-2 cursor-pointer hover:bg-slate-200" onClick={() => handleSort('mail')}>
                                        {t('Email')} {sortField === 'mail' && (sortDir === 'asc' ? '↑' : '↓')}
                                    </th>
                                    <th className="p-2">{t('PlannerRole')}</th>
                                    <th className="p-2 cursor-pointer hover:bg-slate-200" onClick={() => handleSort('created')}>
                                        {t('Created')} {sortField === 'created' && (sortDir === 'asc' ? '↑' : '↓')}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {sortedUsers.map(u => {
                                    const currentRole = u.plannerRole || u.planner_role || u.meta?.planner_role || 'trial';
                                    const isSelected = selectedUserIds.has(u.uid);
                                    return (
                                        <tr key={u.uid} className={`hover:bg-slate-50 ${isSelected ? 'bg-blue-50' : ''}`}>
                                            <td className="p-2">
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => toggleUserSelection(u.uid)}
                                                    className="w-4 h-4"
                                                />
                                            </td>
                                            <td className="p-2 text-slate-500">{u.uid}</td>
                                            <td className="p-2 font-medium">{u.screenName || u.name || '-'}</td>
                                            <td className="p-2 text-slate-500">{u.mail}</td>
                                            <td className="p-2">
                                                <select
                                                    className={`border rounded p-1 text-xs font-bold ${getRoleColor(currentRole)}`}
                                                    value={currentRole}
                                                    onChange={(e) => handleUserRoleUpdate(u.uid, e.target.value)}
                                                    disabled={u.group === 'administrator' && currentRole === 'admin'}
                                                >
                                                    {ROLE_OPTIONS.map(opt => (
                                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="p-2 text-slate-400 text-xs">{u.created || '-'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                        {sortedUsers.length === 0 && (
                            <div className="p-8 text-center text-slate-500">{t('NoUsersFound')}</div>
                        )}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-center gap-2 items-center">
                        <button disabled={page === 1} onClick={() => loadUsers(1)} className="px-2 py-1 border rounded hover:bg-slate-100 disabled:opacity-50 text-sm">«</button>
                        <button disabled={page === 1} onClick={() => loadUsers(page - 1)} className="px-3 py-1 border rounded hover:bg-slate-100 disabled:opacity-50 text-sm">{t('Prev')}</button>
                        <span className="text-sm text-slate-600 px-2">{t('Page')} {page} / {totalPages}</span>
                        <button disabled={page === totalPages} onClick={() => loadUsers(page + 1)} className="px-3 py-1 border rounded hover:bg-slate-100 disabled:opacity-50 text-sm">{t('Next')}</button>
                        <button disabled={page === totalPages} onClick={() => loadUsers(totalPages)} className="px-2 py-1 border rounded hover:bg-slate-100 disabled:opacity-50 text-sm">»</button>
                    </div>
                )}
            </div>
        );
    }

    function renderPluginsTab() {
        return (
            <div className="space-y-6">
                <div className="bg-amber-50 border border-amber-200 p-4 rounded">
                    <h4 className="font-bold text-amber-800 mb-2 flex items-center gap-2">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        {t('PluginSystem')}
                    </h4>
                    <p className="text-sm text-amber-700">{t('PluginSystemDescription')}</p>
                </div>

                {/* Plugin Architecture Info */}
                <section className="space-y-4">
                    <h4 className="font-bold text-slate-700">{t('AvailableHooks')}</h4>
                    <div className="grid gap-3">
                        {[
                            { id: 'onDataImport', name: t('HookDataImport'), desc: t('HookDataImportDesc') },
                            { id: 'onDataExport', name: t('HookDataExport'), desc: t('HookDataExportDesc') },
                            { id: 'onActivityCreate', name: t('HookActivityCreate'), desc: t('HookActivityCreateDesc') },
                            { id: 'onScheduleCalculate', name: t('HookScheduleCalculate'), desc: t('HookScheduleCalculateDesc') },
                            { id: 'onToolbarRender', name: t('HookToolbarRender'), desc: t('HookToolbarRenderDesc') },
                            { id: 'onContextMenu', name: t('HookContextMenu'), desc: t('HookContextMenuDesc') },
                        ].map(hook => (
                            <div key={hook.id} className="p-3 border rounded bg-white hover:shadow-sm transition-shadow">
                                <div className="flex items-center gap-2">
                                    <code className="text-xs bg-slate-100 px-2 py-0.5 rounded text-blue-600">{hook.id}</code>
                                    <span className="font-medium text-sm">{hook.name}</span>
                                </div>
                                <p className="text-xs text-slate-500 mt-1">{hook.desc}</p>
                            </div>
                        ))}
                    </div>
                </section>

                {/* Example Plugin Code */}
                <section className="space-y-4">
                    <h4 className="font-bold text-slate-700">{t('PluginExample')}</h4>
                    <div className="bg-slate-900 text-slate-100 p-4 rounded text-xs font-mono overflow-x-auto">
                        <pre>{`// plugins/excel-import.ts
import { PluginAPI } from '@planner/plugin-api';

export default {
  id: 'excel-import',
  name: 'Excel Import',
  version: '1.0.0',
  
  activate(api: PluginAPI) {
    // Register toolbar button
    api.toolbar.addButton({
      id: 'import-excel',
      icon: 'table',
      tooltip: 'Import from Excel',
      onClick: () => this.showImportDialog(api)
    });
    
    // Register data import hook
    api.hooks.on('onDataImport', (data, format) => {
      if (format === 'xlsx') {
        return this.parseExcel(data);
      }
    });
  },
  
  async showImportDialog(api: PluginAPI) {
    const file = await api.ui.showFilePicker({
      accept: '.xlsx,.xls'
    });
    if (file) {
      const data = await this.parseExcel(file);
      api.project.importActivities(data);
    }
  },
  
  parseExcel(file: File) {
    // Use SheetJS or similar library
    // Return Activity[] format
  }
}`}</pre>
                    </div>
                </section>

                {/* XER Import Example */}
                <section className="space-y-4">
                    <h4 className="font-bold text-slate-700">{t('XERImportExample')}</h4>
                    <div className="bg-slate-900 text-slate-100 p-4 rounded text-xs font-mono overflow-x-auto">
                        <pre>{`// plugins/xer-import.ts
import { PluginAPI } from '@planner/plugin-api';

export default {
  id: 'xer-import',
  name: 'P6 XER Import',
  version: '1.0.0',
  
  activate(api: PluginAPI) {
    api.menu.addItem('file', {
      id: 'import-xer',
      label: 'Import P6 XER...',
      onClick: () => this.importXER(api)
    });
  },
  
  async importXER(api: PluginAPI) {
    const file = await api.ui.showFilePicker({
      accept: '.xer'
    });
    if (!file) return;
    
    const text = await file.text();
    const parsed = this.parseXER(text);
    
    // Map XER tables to Planner format
    const project = {
      meta: this.mapProjectMeta(parsed.PROJECT),
      wbs: this.mapWBS(parsed.PROJWBS),
      activities: this.mapActivities(parsed.TASK),
      calendars: this.mapCalendars(parsed.CALENDAR)
    };
    
    api.project.load(project);
  },
  
  parseXER(content: string) {
    // XER is tab-delimited with %T headers
    const tables: Record<string, any[]> = {};
    // ... parsing logic
    return tables;
  }
}`}</pre>
                    </div>
                </section>

                <div className="bg-blue-50 border border-blue-200 p-4 rounded">
                    <p className="text-sm text-blue-800">
                        <strong>{t('Note')}:</strong> {t('PluginDevelopmentNote')}
                    </p>
                </div>
            </div>
        );
    }
};

export default AdminDashboard;
