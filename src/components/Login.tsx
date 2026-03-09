import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Lock, Mail, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import BrandedModal from './BrandedModal';

export default function Login({ onLogin }: { onLogin: () => void }) {
    const [loading, setLoading] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [brandedModal, setBrandedModal] = useState({
        isOpen: false,
        title: '',
        message: '',
        type: 'info' as 'info' | 'success' | 'warning' | 'error' | 'confirm'
    });

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (isSignUp) {
            const { error: signUpError } = await supabase.auth.signUp({
                email,
                password,
            });
            if (signUpError) {
                setError(signUpError.message);
                setLoading(false);
            } else {
                setBrandedModal({
                    isOpen: true,
                    title: '¡Cuenta Creada!',
                    message: 'Tu cuenta de administrador ha sido configurada correctamente. Ahora puedes iniciar sesión.',
                    type: 'success'
                });
                setIsSignUp(false);
                setLoading(false);
            }
            return;
        }

        const { error: authError } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (authError) {
            setError(authError.message);
            setLoading(false);
        } else {
            onLogin();
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#0a0a0c]">
            <div className="absolute inset-0 bg-primary/5 blur-[120px] -z-10"></div>

            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-panel p-10 w-full max-w-md relative overflow-hidden"
            >
                <div className="text-center mb-10">
                    <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-primary/20">
                        <Lock className="text-primary" size={32} />
                    </div>
                    <h1 className="text-3xl font-display font-black text-gradient">
                        {isSignUp ? 'Crear Administrador' : 'Admin Access'}
                    </h1>
                    <p className="text-white/40 mt-2">
                        {isSignUp ? 'Configura tu cuenta de admin para el MVP.' : 'Ingresa tus credenciales para administrar RIFATRONS.'}
                    </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Email</label>
                        <div className="relative group">
                            <Mail className="absolute left-5 top-5 text-white/20 group-focus-within:text-primary transition-colors" size={20} />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="admin@rifatrons.com"
                                className="premium-input pl-14 w-full"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Contraseña</label>
                        <div className="relative group">
                            <Lock className="absolute left-5 top-5 text-white/20 group-focus-within:text-primary transition-colors" size={20} />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="premium-input pl-14 w-full"
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center gap-3 text-sm">
                            <AlertCircle size={20} />
                            <span className="font-medium">{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="glow-button w-full text-lg mt-4"
                        disabled={loading}
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <>{isSignUp ? 'CREAR CUENTA' : 'ENTRAR AL PANEL'} <Sparkles size={20} /></>}
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="w-full text-xs text-white/20 hover:text-primary transition-colors mt-4 uppercase tracking-widest font-bold"
                    >
                        {isSignUp ? '¿Ya tienes cuenta? Inicia Sesión' : '¿Primer inicio? Crea tu Admin'}
                    </button>
                </form>

                <div className="mt-10 text-center text-[10px] text-white/10 uppercase tracking-[0.4em] font-bold">
                    RIFATRONS SECURE ARCHITECTURE
                </div>
            </motion.div>

            <BrandedModal
                isOpen={brandedModal.isOpen}
                onClose={() => setBrandedModal({ ...brandedModal, isOpen: false })}
                title={brandedModal.title}
                message={brandedModal.message}
                type={brandedModal.type}
            />
        </div>
    );
}
