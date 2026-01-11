import React, { useState } from 'react';
import { authService } from '../services/authService';
import { User, AdminConfig } from '../types';
import { useTranslation } from '../utils/i18n';
import { BaseModal } from './Modals';

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
        <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-hidden bg-[#020617]">
            {/* Global Connections Background */}
            <div className="absolute inset-0 z-0">
                {/* Subtle World Map SVG Mesh */}
                <svg className="absolute inset-0 w-full h-full opacity-[0.08]" preserveAspectRatio="xMidYMid slice" viewBox="0 0 800 400" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M150 100h20v20h-20zM250 150h15v15h-15zM450 120h25v25h-25zM600 180h20v20h-20zM350 250h30v30h-30zM100 280h10v10h-10zM700 80h15v15h-15z" fill="white" />
                    <circle cx="200" cy="150" r="1.5" fill="white" />
                    <circle cx="480" cy="180" r="1.5" fill="white" />
                    <circle cx="320" cy="220" r="1.5" fill="white" />
                    <circle cx="560" cy="280" r="1.5" fill="white" />
                    <circle cx="120" cy="120" r="1.5" fill="white" />
                    <circle cx="650" cy="110" r="1.5" fill="white" />
                    <circle cx="380" cy="80" r="1.5" fill="white" />
                </svg>

                {/* Pulsing Nodes (Project Hubs) */}
                <div className="absolute top-[20%] left-[15%] w-2 h-2 bg-blue-500 rounded-full shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-pulse"></div>
                <div className="absolute top-[35%] left-[28%] w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.8)] animate-pulse" style={{ animationDelay: '1s' }}></div>
                <div className="absolute top-[25%] left-[55%] w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.8)] animate-pulse" style={{ animationDelay: '2s' }}></div>
                <div className="absolute top-[45%] left-[45%] w-2 h-2 bg-sky-500 rounded-full shadow-[0_0_15px_rgba(14,165,233,0.8)] animate-pulse" style={{ animationDelay: '1.5s' }}></div>
                <div className="absolute top-[15%] left-[80%] w-2 h-2 bg-blue-400 rounded-full shadow-[0_0_15px_rgba(96,165,250,0.8)] animate-pulse" style={{ animationDelay: '0.5s' }}></div>
                <div className="absolute top-[65%] left-[75%] w-2 h-2 bg-violet-500 rounded-full shadow-[0_0_15px_rgba(139,92,246,0.8)] animate-pulse" style={{ animationDelay: '2.5s' }}></div>
                <div className="absolute top-[55%] left-[15%] w-2 h-2 bg-blue-600 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.8)] animate-pulse" style={{ animationDelay: '3s' }}></div>

                {/* Animated Connection Lines */}
                <div className="absolute top-[20%] left-[15%] w-[13%] h-[1px] bg-gradient-to-r from-blue-500/50 to-transparent origin-left rotate-[45deg] animate-[ping_4s_infinite]"></div>
                <div className="absolute top-[25%] left-[55%] w-[10%] h-[1px] bg-gradient-to-r from-emerald-500/50 to-transparent origin-left rotate-[-30deg] animate-[ping_6s_infinite] delay-1000"></div>

                {/* Global Glow */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(circle_at_center,rgba(30,58,138,0.15)_0%,transparent_70%)]"></div>
            </div>

            <BaseModal
                isOpen={isOpen}
                title={isLoginMode ? t('LoginTitle') : t('RegisterTitle')}
                onClose={onClose}
                className="w-96 relative z-10 !bg-white/95 !backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.5)] border border-slate-200"
            >
                <div className="space-y-4">
                    {adminConfig?.appLogo ? (
                        <div className="flex justify-center mb-4">
                            <img src={adminConfig.appLogo} alt="Logo" className="h-12 w-auto object-contain" />
                        </div>
                    ) : (
                        <h2 className="text-xl font-bold text-center text-slate-800 mb-4">{adminConfig?.appName || 'Planner Web'}</h2>
                    )}

                    {error && (
                        <div className={`p-3 text-sm font-medium rounded-lg flex items-center gap-2 ${error.includes('Success') ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${error.includes('Success') ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">{t('Username')}</label>
                            <input
                                type="text"
                                required
                                className="block w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                            />
                        </div>

                        {!isLoginMode && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">{t('Email')}</label>
                                <input
                                    type="email"
                                    required
                                    className="block w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">{t('Password')}</label>
                            <input
                                type="password"
                                required
                                className="block w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        </div>

                        {!isLoginMode && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">{t('ConfirmPassword')}</label>
                                <input
                                    type="password"
                                    required
                                    className="block w-full bg-slate-50 border border-slate-200 rounded-xl py-2.5 px-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                />
                            </div>
                        )}

                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-50"
                            >
                                {loading ? t('Processing') : (isLoginMode ? t('SignIn') : t('SignUp'))}
                            </button>
                        </div>

                        <div className="text-center mt-4">
                            <button
                                type="button"
                                className="text-sm font-bold text-blue-600 hover:text-blue-500 transition-colors"
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
                    </form>
                </div>
            </BaseModal>
        </div>
    );
};
