import React, { useState } from 'react';
import { authService } from '../services/authService';
import { User } from '../types';

interface LoginModalProps {
    isOpen: boolean;
    onLoginSuccess: (user: User) => void;
    onClose: () => void; // Optional if we want to force login
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onLoginSuccess, onClose }) => {
    const [isLoginMode, setIsLoginMode] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isLoginMode) {
                const user = await authService.login(username, password);
                onLoginSuccess(user);
            } else {
                await authService.register(username, password, email);
                setIsLoginMode(true);
                setError('Registration successful! Please login.');
                // Don't auto-login after register, let them login
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
                <div className="bg-slate-800 text-white p-4 text-center">
                    <h2 className="text-xl font-bold">{isLoginMode ? 'Login' : 'Register'}</h2>
                    <p className="text-xs text-slate-300">Planner Web</p>
                </div>
                
                <div className="p-6">
                    {error && (
                        <div className={`mb-4 p-2 text-sm rounded ${error.includes('successful') ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700">Username</label>
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
                                <label className="block text-sm font-medium text-slate-700">Email</label>
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
                            <label className="block text-sm font-medium text-slate-700">Password</label>
                            <input 
                                type="password" 
                                required
                                className="mt-1 block w-full rounded-md border-slate-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 border p-2"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                            />
                        </div>

                        <button 
                            type="submit" 
                            disabled={loading}
                            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                            {loading ? 'Processing...' : (isLoginMode ? 'Sign In' : 'Sign Up')}
                        </button>
                    </form>

                    <div className="mt-4 text-center">
                        <button 
                            type="button"
                            className="text-sm text-blue-600 hover:text-blue-500"
                            onClick={() => {
                                setIsLoginMode(!isLoginMode);
                                setError('');
                            }}
                        >
                            {isLoginMode ? "Don't have an account? Register" : "Already have an account? Login"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
