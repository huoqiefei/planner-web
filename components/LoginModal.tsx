import React, { useState, useEffect, useMemo } from 'react';
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

// 城市天际线背景组件 - 精致版
const CitySkylineBackground: React.FC = () => {
    // 生成固定的星星位置（减少数量，更精致）
    const stars = useMemo(() => {
        const result = [];
        for (let i = 0; i < 35; i++) {
            result.push({
                x: Math.random() * 100,
                y: Math.random() * 50, // 只在天空上半部分
                size: Math.random() * 1.5 + 0.5,
                delay: Math.random() * 4,
                duration: 3 + Math.random() * 2,
            });
        }
        return result;
    }, []);

    return (
        <div className="absolute inset-0 overflow-hidden">
            {/* 渐变天空背景 - 深邃夜空 */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#0a0e1a] via-[#111827] to-[#1e293b]" />
            
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice">
                <defs>
                    {/* 星星发光 */}
                    <filter id="starGlow" x="-100%" y="-100%" width="300%" height="300%">
                        <feGaussianBlur stdDeviation="1.5" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    {/* 建筑发光 */}
                    <filter id="buildingGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    {/* 窗户发光 */}
                    <filter id="windowGlow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="1" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                    {/* 渐变 */}
                    <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#1e3a5f" stopOpacity="0" />
                        <stop offset="100%" stopColor="#1e3a5f" stopOpacity="0.3" />
                    </linearGradient>
                </defs>

                {/* 星星 */}
                {stars.map((star, i) => (
                    <circle
                        key={i}
                        cx={`${star.x}%`}
                        cy={`${star.y}%`}
                        r={star.size}
                        fill="#e0f2fe"
                        filter="url(#starGlow)"
                        opacity="0.8"
                    >
                        <animate
                            attributeName="opacity"
                            values="0.3;0.9;0.3"
                            dur={`${star.duration}s`}
                            begin={`${star.delay}s`}
                            repeatCount="indefinite"
                        />
                    </circle>
                ))}

                {/* 远景城市剪影 - 最远层 */}
                <g opacity="0.15">
                    <rect x="0" y="750" width="1920" height="330" fill="#1e293b" />
                    {/* 远景建筑轮廓 */}
                    <path d="M0,780 L0,750 L60,750 L60,760 L120,760 L120,740 L180,740 L180,780 L240,780 L240,730 L280,730 L280,720 L320,720 L320,750 L380,750 L380,770 L440,770 L440,745 L500,745 L500,760 L560,760 L560,735 L620,735 L620,755 L680,755 L680,740 L740,740 L740,765 L800,765 L800,750 L860,750 L860,730 L920,730 L920,760 L980,760 L980,745 L1040,745 L1040,770 L1100,770 L1100,740 L1160,740 L1160,755 L1220,755 L1220,735 L1280,735 L1280,760 L1340,760 L1340,745 L1400,745 L1400,770 L1460,770 L1460,750 L1520,750 L1520,730 L1580,730 L1580,755 L1640,755 L1640,740 L1700,740 L1700,765 L1760,765 L1760,750 L1820,750 L1820,770 L1880,770 L1880,755 L1920,755 L1920,780" fill="#1e293b" />
                </g>

                {/* 中景城市 */}
                <g opacity="0.3">
                    <path d="M0,850 L0,800 L80,800 L80,780 L140,780 L140,810 L200,810 L200,770 L240,770 L240,760 L280,760 L280,790 L340,790 L340,820 L400,820 L400,785 L460,785 L460,800 L520,800 L520,765 L580,765 L580,795 L640,795 L640,775 L700,775 L700,810 L760,760 L820,810 L820,830 L880,830 L880,790 L940,790 L940,810 L1000,810 L1000,780 L1060,780 L1060,800 L1120,800 L1120,770 L1180,770 L1180,795 L1240,795 L1240,815 L1300,815 L1300,785 L1360,785 L1360,805 L1420,805 L1420,775 L1480,775 L1480,800 L1540,800 L1540,820 L1600,820 L1600,790 L1660,790 L1660,810 L1720,810 L1720,785 L1780,785 L1780,805 L1840,805 L1840,825 L1920,825 L1920,850" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                </g>

                {/* 主要天际线 - 精致线条风格 */}
                <g fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    {/* 左侧建筑群 */}
                    <path d="M0,920 L0,870 L50,870 L50,850 L90,850 L90,870 L130,870 L130,920" />
                    <path d="M150,920 L150,840 L180,840 L180,820 L210,820 L210,840 L240,840 L240,920" />
                    <path d="M260,920 L260,810 L290,810 L290,790 L310,780 L330,790 L330,810 L360,810 L360,920" />
                    <path d="M380,920 L380,850 L440,850 L440,920" />
                    
                    {/* 左侧高楼 */}
                    <path d="M460,920 L460,720 L490,720 L490,700 L520,700 L520,680 L550,680 L550,700 L580,700 L580,720 L610,720 L610,920" />
                    <path d="M505,680 L535,620 L565,680" />
                    <line x1="535" y1="620" x2="535" y2="580" />
                    
                    {/* 中央超高层 */}
                    <path d="M680,920 L680,600 L720,600 L720,560 L760,560 L760,520 L800,520 L800,480 L840,480 L840,440 L880,440 L880,400 L920,400 L920,360 L960,360 L960,400 L1000,400 L1000,440 L1040,440 L1040,480 L1080,480 L1080,520 L1120,520 L1120,560 L1160,560 L1160,600 L1200,600 L1200,920" />
                    {/* 尖顶 */}
                    <path d="M900,360 L940,280 L980,360" />
                    <line x1="940" y1="280" x2="940" y2="220" />
                    <circle cx="940" cy="210" r="8" fill="none" />
                    
                    {/* 右侧建筑群 */}
                    <path d="M1240,920 L1240,780 L1280,780 L1280,760 L1320,760 L1320,780 L1360,780 L1360,920" />
                    <path d="M1380,920 L1380,820 L1420,820 L1420,800 L1460,800 L1460,820 L1500,820 L1500,920" />
                    <path d="M1520,920 L1520,750 L1560,750 L1560,730 L1580,720 L1600,730 L1600,750 L1640,750 L1640,920" />
                    <path d="M1660,920 L1660,840 L1720,840 L1720,920" />
                    <path d="M1740,920 L1740,800 L1780,800 L1780,780 L1820,780 L1820,800 L1860,800 L1860,920" />
                    <path d="M1880,920 L1880,860 L1920,860 L1920,920" />
                </g>

                {/* 建筑窗户灯光 */}
                <g fill="#fef3c7" filter="url(#windowGlow)">
                    {/* 中央高楼窗户 - 随机亮灯 */}
                    {[420, 460, 500, 540, 580, 620, 660, 700, 740, 780, 820, 860].map((y) => {
                        const baseX = 720;
                        const width = Math.min(440, 440 - (y - 420) * 0.8);
                        const startX = 940 - width / 2;
                        return Array.from({ length: Math.floor(width / 50) }, (_, i) => {
                            const x = startX + i * 50 + 15;
                            if (Math.random() > 0.4) {
                                return <rect key={`cw-${y}-${i}`} x={x} y={y} width="20" height="12" rx="1" opacity={0.5 + Math.random() * 0.5} />;
                            }
                            return null;
                        });
                    })}
                    
                    {/* 左侧高楼窗户 */}
                    {[740, 780, 820, 860].map((y) => (
                        [480, 520, 560].map((x, i) => (
                            Math.random() > 0.4 ? <rect key={`lw-${y}-${i}`} x={x} y={y} width="15" height="10" rx="1" opacity={0.4 + Math.random() * 0.4} /> : null
                        ))
                    ))}
                    
                    {/* 其他建筑窗户 */}
                    {[850, 870, 890].map((y) => (
                        [170, 200, 280, 310, 400, 1260, 1300, 1400, 1440, 1540, 1580, 1680, 1760, 1800].map((x, i) => (
                            Math.random() > 0.5 ? <rect key={`ow-${y}-${i}`} x={x} y={y} width="12" height="8" rx="1" opacity={0.3 + Math.random() * 0.4} /> : null
                        ))
                    ))}
                </g>

                {/* 地平线反光 */}
                <rect x="0" y="920" width="1920" height="2" fill="url(#skyGradient)" opacity="0.5" />
                
                {/* 底部渐变 */}
                <rect x="0" y="920" width="1920" height="160" fill="#0f172a" />
            </svg>

            {/* CSS动画样式 */}
            <style>{`
                @keyframes twinkle {
                    0%, 100% { opacity: 0.3; }
                    50% { opacity: 1; }
                }
            `}</style>

            {/* 边缘渐变遮罩 */}
            <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-[#0a0e1a] to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-[#0f172a] to-transparent" />
            <div className="absolute top-0 bottom-0 left-0 w-12 bg-gradient-to-r from-[#0a0e1a] to-transparent" />
            <div className="absolute top-0 bottom-0 right-0 w-12 bg-gradient-to-l from-[#0a0e1a] to-transparent" />
        </div>
    );
};


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

        if (!isLoginMode && password !== confirmPassword) {
            setError(t('PasswordsDoNotMatch'));
            return;
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
        <div className="fixed inset-0 z-[110] flex items-center justify-center overflow-hidden">
            <CitySkylineBackground />

            <div className="relative z-10 w-full max-w-md mx-4">
                <div className="bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-slate-700/50 overflow-hidden">
                    <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500" />
                    
                    <div className="p-8">
                        {adminConfig?.appLogo ? (
                            <div className="flex justify-center mb-6">
                                <img src={adminConfig.appLogo} alt="Logo" className="h-12 w-auto object-contain" />
                            </div>
                        ) : (
                            <div className="text-center mb-6">
                                <h1 className="text-2xl font-bold text-white">{adminConfig?.appName || 'Planner Web'}</h1>
                                <p className="text-slate-400 text-sm mt-1">{isLoginMode ? t('LoginTitle') : t('RegisterTitle')}</p>
                            </div>
                        )}

                        {error && (
                            <div className={`mb-4 p-3 text-sm font-medium rounded-lg flex items-center gap-2 ${error.includes('Success') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                                <div className={`w-1.5 h-1.5 rounded-full ${error.includes('Success') ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('Username')}</label>
                                <input
                                    type="text"
                                    required
                                    className="block w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                                    placeholder={lang === 'zh' ? '请输入用户名' : 'Enter username'}
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                />
                            </div>

                            {!isLoginMode && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('Email')}</label>
                                    <input
                                        type="email"
                                        required
                                        className="block w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                                        placeholder={lang === 'zh' ? '请输入邮箱' : 'Enter email'}
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('Password')}</label>
                                <input
                                    type="password"
                                    required
                                    className="block w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                                    placeholder={lang === 'zh' ? '请输入密码' : 'Enter password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                            </div>

                            {!isLoginMode && (
                                <div>
                                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">{t('ConfirmPassword')}</label>
                                    <input
                                        type="password"
                                        required
                                        className="block w-full bg-slate-800/50 border border-slate-700 rounded-xl py-3 px-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition-all"
                                        placeholder={lang === 'zh' ? '请确认密码' : 'Confirm password'}
                                        value={confirmPassword}
                                        onChange={e => setConfirmPassword(e.target.value)}
                                    />
                                </div>
                            )}

                            <div className="pt-2">
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full py-3 px-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-slate-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-500/25"
                                >
                                    {loading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            {t('Processing')}
                                        </span>
                                    ) : (
                                        isLoginMode ? t('SignIn') : t('SignUp')
                                    )}
                                </button>
                            </div>
                        </form>

                        <div className="mt-6 text-center">
                            <button
                                type="button"
                                className="text-sm text-slate-400 hover:text-blue-400 transition-colors"
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

                <p className="text-center text-slate-600 text-xs mt-4">
                    © {new Date().getFullYear()} {adminConfig?.appName || 'Planner Web'}. All rights reserved.
                </p>
            </div>
        </div>
    );
};
