
import React, { useState, useEffect } from 'react';
import { useTranslation } from '../utils/i18n';
import { authService } from '../services/authService';

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
            alert('Failed to load projects');
        } finally {
            setLoading(false);
        }
    };

    const handleLoad = async () => {
        if (!selectedId) return;
        setLoading(true);
        try {
            const response = await authService.getProject(selectedId);
            if (response.content) {
                onLoad(response.content);
                onClose();
            } else {
                alert('Project file content missing');
            }
        } catch (error) {
            console.error(error);
            alert('Failed to load project');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (!confirm(t('ConfirmDeleteProject'))) return;
        
        try {
            await authService.deleteProject(id);
            loadProjects();
            if (selectedId === id) setSelectedId(null);
        } catch (error) {
            console.error(error);
            alert('Failed to delete project');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow-lg w-[600px] max-h-[80vh] flex flex-col">
                <div className="p-4 border-b flex justify-between items-center bg-slate-100">
                    <h2 className="font-bold text-lg">{t('CloudProjects')}</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700">✕</button>
                </div>
                
                <div className="p-4 flex-1 overflow-y-auto min-h-[300px]">
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
                                    className={`p-3 border rounded cursor-pointer flex justify-between items-center ${selectedId === p.id ? 'border-blue-500 bg-blue-50' : 'hover:bg-slate-50'}`}
                                >
                                    <div>
                                        <div className="font-medium">{p.name}</div>
                                        <div className="text-sm text-slate-500">{p.description || '-'}</div>
                                        <div className="text-xs text-slate-400 mt-1">
                                            {new Date(p.updated_at * 1000).toLocaleString()}
                                        </div>
                                    </div>
                                    <button 
                                        onClick={(e) => handleDelete(e, p.id)}
                                        className="text-red-500 hover:text-red-700 px-2 py-1 text-sm"
                                    >
                                        {t('Delete')}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-4 border-t flex justify-end gap-2 bg-slate-50">
                    <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-slate-100">
                        {t('Cancel')}
                    </button>
                    <button 
                        onClick={handleLoad} 
                        disabled={!selectedId || loading}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? t('Loading') : t('Load')}
                    </button>
                </div>
            </div>
        </div>
    );
};

interface CloudSaveModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectData: any;
    lang: 'en' | 'zh';
}

export const CloudSaveModal: React.FC<CloudSaveModalProps> = ({ isOpen, onClose, projectData, lang }) => {
    const { t } = useTranslation(lang);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen && projectData) {
            setName(projectData.meta?.title || projectData.meta?.name || 'New Project');
            setDescription('');
        }
    }, [isOpen, projectData]);

    const handleSave = async () => {
        if (!name.trim()) return;
        setLoading(true);
        try {
            await authService.saveProject({
                name, 
                description, 
                content: JSON.stringify(projectData)
            });
            alert(t('SaveSuccess'));
            onClose();
        } catch (error) {
            console.error(error);
            alert('Failed to save project');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow-lg w-[500px]">
                <div className="p-4 border-b flex justify-between items-center bg-slate-100">
                    <h2 className="font-bold text-lg">{t('SaveProjectToCloud')}</h2>
                    <button onClick={onClose} className="text-slate-500 hover:text-slate-700">✕</button>
                </div>
                
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">{t('ProjectName')}</label>
                        <input 
                            type="text" 
                            value={name} 
                            onChange={e => setName(e.target.value)}
                            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500 outline-none"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">{t('ProjectDescription')}</label>
                        <textarea 
                            value={description} 
                            onChange={e => setDescription(e.target.value)}
                            className="w-full p-2 border rounded h-24 focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                </div>

                <div className="p-4 border-t flex justify-end gap-2 bg-slate-50">
                    <button onClick={onClose} className="px-4 py-2 border rounded hover:bg-slate-100">
                        {t('Cancel')}
                    </button>
                    <button 
                        onClick={handleSave} 
                        disabled={loading || !name.trim()}
                        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? t('Saving') : t('Save')}
                    </button>
                </div>
            </div>
        </div>
    );
};
