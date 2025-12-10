
import React, { useState, useEffect } from 'react';
import { AISettings, AIProvider } from '../types';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (settings: AISettings) => void;
    currentSettings: AISettings;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, onSave, currentSettings }) => {
    const [provider, setProvider] = useState<AIProvider>('google');
    const [apiKey, setApiKey] = useState('');
    const [model, setModel] = useState('');
    const [baseUrl, setBaseUrl] = useState('');

    useEffect(() => {
        if (isOpen) {
            setProvider(currentSettings.provider);
            setApiKey(currentSettings.apiKey);
            setModel(currentSettings.model);
            setBaseUrl(currentSettings.baseUrl || '');
        }
    }, [isOpen, currentSettings]);

    const handleSave = () => {
        onSave({ provider, apiKey, model, baseUrl });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-gray-800 border border-gray-600 rounded-lg p-6 w-96 shadow-2xl">
                <h2 className="text-xl font-bold text-white mb-6 border-b border-gray-700 pb-2">Configuration</h2>
                
                <div className="mb-4">
                    <label className="block text-gray-400 text-xs font-bold mb-1 uppercase">AI Provider</label>
                    <select 
                        value={provider} 
                        onChange={(e) => {
                            const p = e.target.value as AIProvider;
                            setProvider(p);
                            if (p === 'google') setModel('gemini-2.5-flash');
                            if (p === 'openai') setModel('gpt-4o');
                            if (p === 'deepseek') setModel('deepseek-chat');
                        }}
                        className="w-full bg-gray-700 text-white rounded p-2 text-sm border border-gray-600 focus:border-blue-500 outline-none"
                    >
                        <option value="google">Google Gemini</option>
                        <option value="openai">OpenAI (GPT)</option>
                        <option value="deepseek">DeepSeek</option>
                    </select>
                </div>

                <div className="mb-4">
                    <label className="block text-gray-400 text-xs font-bold mb-1 uppercase">API Key</label>
                    <input 
                        type="password" 
                        value={apiKey} 
                        onChange={(e) => setApiKey(e.target.value)}
                        placeholder="sk-..."
                        className="w-full bg-gray-700 text-white rounded p-2 text-sm border border-gray-600 focus:border-blue-500 outline-none"
                    />
                </div>

                <div className="mb-4">
                    <label className="block text-gray-400 text-xs font-bold mb-1 uppercase">Model Name</label>
                    <input 
                        type="text" 
                        value={model} 
                        onChange={(e) => setModel(e.target.value)}
                        className="w-full bg-gray-700 text-white rounded p-2 text-sm border border-gray-600 focus:border-blue-500 outline-none"
                    />
                </div>

                {(provider === 'openai' || provider === 'deepseek') && (
                    <div className="mb-6">
                        <label className="block text-gray-400 text-xs font-bold mb-1 uppercase">Base URL (Optional)</label>
                        <input 
                            type="text" 
                            value={baseUrl} 
                            onChange={(e) => setBaseUrl(e.target.value)}
                            placeholder="https://api..."
                            className="w-full bg-gray-700 text-white rounded p-2 text-sm border border-gray-600 focus:border-blue-500 outline-none"
                        />
                    </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors">Cancel</button>
                    <button onClick={handleSave} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded text-sm font-semibold transition-colors shadow-lg">Save Configuration</button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
