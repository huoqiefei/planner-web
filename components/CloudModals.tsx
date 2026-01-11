
import React, { useState, useEffect } from 'react';
import { useTranslation } from '../utils/i18n';
import { authService } from '../services/authService';
import { useAppStore } from '../stores/useAppStore';
import { AlertModal, ConfirmModal, BaseModal } from './Modals';

interface CloudLoadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLoad: (projectData: any) => void;
    lang: 'en' | 'zh';
}

export const CloudLoadModal: React.FC<CloudLoadModalProps> = ({ isOpen, onClose, onLoad, lang }) => {
    const { t } = useTranslation(lang);
    const [projects, setProjects] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [alertMsg, setAlertMsg] = useState<string | null>(null);
    const [alertTitle, setAlertTitle] = useState<string>('');
    const [confirmMsg, setConfirmMsg] = useState<string | null>(null);
    const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null);

    useEffect(() => {
        if (isOpen) {
            loadProjects();
        }
    }, [isOpen]);

    const loadProjects = async () => {
        setLoading(true);
        try {
            const list = await authService.getProjects();
            setProjects(list);
        } catch (error) {
            console.error(error);
            setAlertMsg('Failed to load projects'); setAlertTitle('Error');
        } finally {
            setLoading(false);
        }
    };

    const handleLoad = async () => {
        if (!selectedId) return;
        setLoading(true);
        try {
            const response = await authService.getProject(selectedId);

            // Handle various response structures
            let content = response.content || response.data;
            if (!content && response.meta) content = response; // Direct project object

            if (typeof content === 'string') {
                try { content = JSON.parse(content); } catch (e) { console.error("Parse error", e); }
            }

            if (content && content.meta) {
                // Inject Cloud ID into meta for future updates
                const projectContent = {
                    ...content,
                    meta: {
                        ...content.meta,
                        cloudId: selectedId
                    }
                };
                onLoad(projectContent);
                onClose();
            } else {
                setAlertMsg('Invalid project file format');
                setAlertTitle('Error');
            }
        } catch (error) {
            console.error(error);
            setAlertMsg('Failed to load project');
            setAlertTitle('Error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        setConfirmMsg(t('ConfirmDeleteProject'));
        setConfirmAction(() => async () => {
            try {
                await authService.deleteProject(id);
                loadProjects();
                if (selectedId === id) setSelectedId(null);
            } catch (error) {
                console.error(error);
                setAlertMsg('Failed to delete project'); setAlertTitle('Error');
            }
        });
    };

    return (
        <>
            <BaseModal
                isOpen={isOpen}
                title={t('CloudProjects')}
                onClose={onClose}
                className="w-[600px] h-[600px] flex flex-col"
                footer={
                    <>
                        <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-slate-100 text-sm">
                            {t('Cancel')}
                        </button>
                        <button
                            onClick={handleLoad}
                            disabled={!selectedId || loading}
                            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                        >
                            {loading ? t('Loading') : t('Load')}
                        </button>
                    </>
                }
            >
                <div className="flex-1 min-h-[400px]">
                    {loading && projects.length === 0 ? (
                        <div className="flex justify-center items-center h-full text-slate-500">{t('Loading')}</div>
                    ) : projects.length === 0 ? (
                        <div className="flex justify-center items-center h-full text-slate-500">{t('NoProjects')}</div>
                    ) : (
                        <div className="space-y-2">
                            {projects.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => setSelectedId(p.id)}
                                    className={`p-3 border rounded cursor-pointer flex justify-between items-center transition-colors ${selectedId === p.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-slate-50'}`}
                                >
                                    <div>
                                        <div className="font-medium text-slate-800">{p.name || 'Untitled'}</div>
                                        <div className="text-xs text-slate-500">{new Date(p.created * 1000).toLocaleString()}</div>
                                        {p.description && <div className="text-xs text-slate-500 mt-1">{p.description}</div>}
                                    </div>
                                    <button
                                        onClick={(e) => handleDelete(e, p.id)}
                                        className="text-red-500 hover:text-red-700 px-2 py-1 text-sm ml-2 transition-colors"
                                        title={t('Delete')}
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </BaseModal>

            <AlertModal isOpen={!!alertMsg} msg={alertMsg || ''} title={alertTitle} onClose={() => setAlertMsg(null)} />
            <ConfirmModal
                isOpen={!!confirmMsg}
                msg={confirmMsg || ''}
                onConfirm={() => { confirmAction?.(); setConfirmMsg(null); }}
                onCancel={() => setConfirmMsg(null)}
                lang={lang}
            />
        </>
    );
};

interface CloudSaveModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectData: any;
    lang: 'en' | 'zh';
    onSaveSuccess?: (cloudId: number, name: string) => void;
}

export const CloudSaveModal: React.FC<CloudSaveModalProps> = ({ isOpen, onClose, projectData, lang, onSaveSuccess }) => {
    const { t } = useTranslation(lang);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);
    const { user } = useAppStore();
    const [alertMsg, setAlertMsg] = useState<string | null>(null);
    const [alertTitle, setAlertTitle] = useState<string>('');
    const [alertOnClose, setAlertOnClose] = useState<(() => void) | null>(null);

    useEffect(() => {
        if (isOpen && projectData) {
            setName(projectData.meta?.title || projectData.meta?.name || 'New Project');
            setDescription('');
        }
    }, [isOpen, projectData]);

    const handleSave = async () => {
        if (!name.trim()) return;
        setLoading(true);

        // Check Limits for NEW projects
        if (!projectData.meta?.cloudId) {
            try {
                const list = await authService.getProjects();
                const role = user?.plannerRole || 'trial';
                const limitMap: Record<string, number> = {
                    'trial': Number(import.meta.env.VITE_LIMIT_CLOUD_TRIAL) || 1,
                    'licensed': Number(import.meta.env.VITE_LIMIT_CLOUD_LICENSED) || 10,
                    'premium': Number(import.meta.env.VITE_LIMIT_CLOUD_PREMIUM) || 100,
                    'admin': Number(import.meta.env.VITE_LIMIT_CLOUD_ADMIN) || 9999
                };
                const limit = limitMap[role] || 1;

                if (list.length >= limit) {
                    setAlertMsg(`Cloud project limit reached for ${role} user (${list.length}/${limit}). Please delete old projects or upgrade.`);
                    setAlertTitle('Limit Reached');
                    setAlertOnClose(null);
                    setLoading(false);
                    return;
                }
            } catch (error) {
                console.error("Limit check failed", error);
                // Proceed or fail? Let's proceed to avoid blocking if just listing fails but save might work
            }
        }

        try {
            const result = await authService.saveProject({
                id: projectData.meta?.cloudId, // Pass ID if exists to update
                name,
                description,
                content: projectData
            });

            setAlertMsg(t('SaveSuccess'));
            setAlertTitle('Success');
            setAlertOnClose(() => () => {
                // If the server returns the saved project info (id), we should update local state
                // Typically result might contain { id: 123, status: 'success' }
                if (result && result.id && onSaveSuccess) {
                    onSaveSuccess(result.id, name);
                }
                onClose();
            });
        } catch (error) {
            console.error(error);
            setAlertMsg('Failed to save project');
            setAlertTitle('Error');
            setAlertOnClose(null);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <BaseModal
                isOpen={isOpen}
                title={t('SaveProjectToCloud')}
                onClose={onClose}
                className="w-[500px]"
                footer={
                    <button
                        onClick={handleSave}
                        disabled={loading || !name.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm"
                    >
                        {loading ? t('Saving') : t('Save')}
                    </button>
                }
            >
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700">{t('ProjectName')}</label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700">{t('ProjectDescription')}</label>
                        <textarea
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full p-2 border border-slate-300 rounded h-24 focus:ring-2 focus:ring-blue-500 outline-none resize-none text-sm"
                        />
                    </div>
                </div>
            </BaseModal>

            <AlertModal
                isOpen={!!alertMsg}
                msg={alertMsg || ''}
                title={alertTitle}
                onClose={() => {
                    setAlertMsg(null);
                    if (alertOnClose) alertOnClose();
                }}
            />
        </>
    );
};
