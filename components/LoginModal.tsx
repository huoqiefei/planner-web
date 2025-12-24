import React, { useState } from 'react';
import { authService } from '../services/authService';
import { User, AdminConfig } from '../types';
import { useTranslation } from '../utils/i18n';

interface LoginModalProps {
    isOpen: boolean;
    onLoginSuccess: (user: User) => void;
    onClose: () => void;
    lang?: 'en' | 'zh';
    adminConfig?: AdminConfig;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onLoginSuccess, onClose, lang = 'en', adminConfig }) => {
    const { t } = useTranslation(lang);
    const [isLoginMode, setIsLoginMode] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!isLoginMode) {
            if (password !== confirmPassword) {
                setError(t('PasswordsDoNotMatch'));
                return;
            }
        }

        setLoading(true);

        try {
            if (isLoginMode) {
                const user = await authService.login(username, password);
                onLoginSuccess(user);
            } else {
                await authService.register(username, password, email);
                setIsLoginMode(true);
                setError(t('Register') + ' ' + t('SaveSuccess') + '! ' + t('LoginToContinue'));
            }
        } catch (err: any) {
            setError(err.message || 'An error occurred');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-96 overflow-hidden">
                <div className="bg-slate-800 text-white p-6 text-center">
                    {adminConfig?.appLogo ? (
                        <div className="flex justify-center mb-3">
                            <img src={adminConfig.appLogo} alt="Logo" className="h-12 w-auto object-contain" />
                        </div>
                    ) : (
                        <h2 className="text-2xl font-bold mb-1">{adminConfig?.appName || 'Planner Web'}</h2>
                    )}
                    <h3 className="text-lg font-medium opacity-90">{isLoginMode ? t('LoginTitle') : t('RegisterTitle')}</h3>
                </div>
                
                <div className="p-6">
                    {error && (
                        <div className={`mb-4 p-2 text-sm rounded ${error.includes('Success') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">{t('Username')}</label>
                            <input 
                                type="text" 
                                required
                                className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                            />
                        </div>

                        {!isLoginMode && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700">{t('Email')}</label>
                                <input 
                                    type="email" 
                                    required
                                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-slate-700">{t('Password')}</label>
                            <input 
                                type="password" 
                                required
                                className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        </div>

                        {!isLoginMode && (
                            <div>
                                <label className="block text-sm font-medium text-slate-700">{t('ConfirmPassword')}</label>
                                <input 
                                    type="password" 
                                    required
                                    className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                />
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                            {loading ? t('Processing') : (isLoginMode ? t('SignIn') : t('SignUp'))}
                        </button>
                    </form>

                    <div className="mt-4 text-center">
                        <button 
                            type="button"
                            className="text-sm text-blue-600 hover:text-blue-500"
                            onClick={() => {
                                setIsLoginMode(!isLoginMode);
                                setError('');
                                setUsername('');
                                setPassword('');
                                setConfirmPassword('');
                                setEmail('');
                            }}
                        >
                            {isLoginMode ? t('NoAccount') : t('HaveAccount')}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
