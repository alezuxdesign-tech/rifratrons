import { useState, useEffect, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { Ticket, User, Mail, Send, AlertCircle, CheckCircle, ExternalLink, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function RafflePage() {
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [raffle, setRaffle] = useState<any>(null);
    const [code, setCode] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState<any>(null);
    const [selectedBundle, setSelectedBundle] = useState<any>(null);
    const [platformSettings, setPlatformSettings] = useState<any>(null);

    const [formData, setFormData] = useState({
        name: '',
        email: ''
    });

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const codeParam = params.get('code');
        const raffleParam = params.get('raffle');

        if (codeParam) setCode(codeParam);

        fetchInitialRaffle(raffleParam);
        fetchSettings();

        // Escuchar cambios de configuración pública en tiempo real
        const settingsSubscription = supabase.channel('public:platform_settings_raffle')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'platform_settings' }, () => {
                fetchSettings();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(settingsSubscription);
        };
    }, []);

    async function fetchSettings() {
        const { data } = await supabase.from('platform_settings').select('*').limit(1).single();
        if (data) {
            setPlatformSettings(data);
            if (data.primary_color) {
                document.documentElement.style.setProperty('--color-primary', data.primary_color);
                const hex = data.primary_color.replace('#', '');
                if (hex.length === 6) {
                    const r = parseInt(hex.substring(0, 2), 16);
                    const g = parseInt(hex.substring(2, 4), 16);
                    const b = parseInt(hex.substring(4, 6), 16);
                    document.documentElement.style.setProperty('--color-primary-glow', `rgba(${r}, ${g}, ${b}, 0.5)`);
                }
            }
        }
    }

    async function fetchInitialRaffle(raffleId?: string | null) {
        let query = supabase.from('raffles').select('*');

        if (raffleId) {
            query = query.eq('id', raffleId);
        } else {
            query = query.eq('active', true).limit(1);
        }

        const { data, error } = await query.single();

        if (data) {
            setRaffle(data);
        } else if (error && raffleId) {
            // If raffleId was provided but not found, try to fallback to any active raffle
            const { data: fallbackData } = await supabase
                .from('raffles')
                .select('*')
                .eq('active', true)
                .limit(1)
                .single();
            if (fallbackData) setRaffle(fallbackData);
        }

        setLoading(false);
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (raffle?.ticket_bundles?.length > 0 && !selectedBundle) {
            setError('Por favor selecciona un paquete de tickets antes de participar.');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            // Generate a random password for the user
            const generatedPassword = Math.random().toString(36).slice(-8);
            let isNewUser = false;

            // Attempt to create the user account
            const { error: signUpError } = await supabase.auth.signUp({
                email: formData.email,
                password: generatedPassword,
            });

            // If there's no error, or the error says the user already exists, we can proceed
            // Note: In Supabase, if confirming email is enabled, it might require extra steps, but we assume it's disabled or auto-confirmed in this context
            if (!signUpError) {
                isNewUser = true;
            } else if (signUpError.message && !signUpError.message.toLowerCase().includes('already registered')) {
                // If it's an error OTHER than "User already exists", we should probably stop
                console.error("Auth Error:", signUpError);
                // We don't throw here to allow them to still get the ticket even if auth fails, but warn in console.
            }

            const { data, error: rpcError } = await supabase.rpc('register_participant', {
                p_raffle_id: raffle.id,
                p_code: code,
                p_name: formData.name,
                p_email: formData.email,
                p_tickets_count: selectedBundle ? selectedBundle.tickets : 1,
                p_bundle_name: selectedBundle ? selectedBundle.name : 'Ticket Individual (Gratis)',
                p_amount_paid: selectedBundle ? selectedBundle.price : 0
            });

            if (rpcError) throw rpcError;

            const result = data[0];
            if (!result.success) {
                setError(result.message);
            } else {
                setSuccess(result);

                // Trigger email notification (don't block UI if it fails)
                supabase.functions.invoke('send-confirmation', {
                    body: {
                        name: formData.name,
                        email: formData.email,
                        assigned_number: result.assigned_number,
                        raffle_name: raffle.name,
                        password: isNewUser ? generatedPassword : null
                    }
                }).catch(err => console.error('Error triggering email confirmation:', err));
            }
        } catch (err: any) {
            setError(err.message || 'Error al registrarse');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <Send className="absolute inset-0 m-auto text-primary animate-pulse" size={24} />
                </div>
            </div>
        );
    }

    if (!raffle) {
        return (
            <div className="min-h-screen flex items-center justify-center p-6 bg-[#0a0a0c]">
                <div className="glass-panel p-10 max-w-md text-center">
                    <AlertCircle className="mx-auto mb-6 text-red-500" size={64} />
                    <h1 className="text-3xl font-display font-bold mb-4">No hay rifas activas</h1>
                    <p className="text-white/60 mb-8">Por favor, vuelve más tarde o contacta al administrador.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen pt-12 md:pt-20 pb-12 px-4 container max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Side: Branding & Info */}
            <motion.div
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.6 }}
            >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-bold tracking-wider mb-8 uppercase">
                    <ExternalLink size={16} fill="currentColor" /> {platformSettings?.platform_name ? `${platformSettings.platform_name} EXCLUSIVE` : 'RIFATRONS EXCLUSIVE'}
                </div>

                {platformSettings?.logo_url && (
                    <img
                        src={platformSettings.logo_url}
                        alt="Logo de plataforma"
                        className="h-16 md:h-20 lg:h-24 w-auto object-contain mb-8 drop-shadow-2xl"
                    />
                )}

                <h1 className="text-5xl sm:text-6xl md:text-7xl font-display font-black mb-6 leading-[1.1] text-gradient">
                    {raffle.name}
                </h1>

                <p className="text-xl text-white/50 mb-10 leading-relaxed max-w-lg">
                    Participa en la plataforma de rifas más segura y moderna.
                    Validación inmediata, asignación transparente y premios reales.
                </p>

                <div className="grid sm:grid-cols-2 gap-6 mb-12">
                    <FeatureItem icon={<CheckCircle className="text-emerald-500" />} title="Transparencia" desc="Algoritmo de asignación verificable" />
                    <FeatureItem icon={<Send className="text-amber-500" />} title="Instantáneo" desc="Recibe tu número al momento" />
                    <FeatureItem icon={<Ticket className="text-primary" />} title="100.000 Tickets" desc="Amplias posibilidades de ganar" />
                    <FeatureItem icon={<User className="text-indigo-400" />} title="Soporte VIP" desc="Atención personalizada 24/7" />
                </div>
            </motion.div>

            {/* Right Side: Registration Card */}
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="relative"
            >
                {/* Decorative Blobs */}
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/20 rounded-full blur-[100px] -z-10 animate-pulse"></div>
                <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] -z-10"></div>

                <AnimatePresence mode="wait">
                    {!success ? (
                        <motion.div
                            key="form"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="glass-panel p-6 sm:p-8 md:p-12 relative overflow-hidden"
                        >
                            <div className="mb-10">
                                <h2 className="text-3xl font-display font-bold mb-2">Registro de Entrada</h2>
                                <p className="text-white/40">Ingresa tus datos para reclamar tu ticket gratuito.</p>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                {raffle?.ticket_bundles && raffle.ticket_bundles.length > 0 && (
                                    <div className="space-y-3 mb-8">
                                        <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1 block">Selecciona tu Paquete</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {raffle.ticket_bundles.map((bundle: any) => (
                                                <button
                                                    key={bundle.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedBundle(bundle);
                                                        setError('');
                                                    }}
                                                    className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${selectedBundle?.id === bundle.id
                                                        ? 'bg-primary/20 border-primary shadow-[0_0_15px_rgba(37,99,235,0.3)]'
                                                        : 'bg-white/5 border-white/10 hover:border-white/30'
                                                        }`}
                                                >
                                                    <div className="font-bold text-lg mb-1">{bundle.name}</div>
                                                    <div className="flex justify-between items-end">
                                                        <span className="text-sm text-white/60">{bundle.tickets} Tickets</span>
                                                        <span className="font-mono text-primary font-bold">${bundle.price}</span>
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}


                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Código Promocional</label>
                                    <div className="relative group">
                                        <Ticket className="absolute left-5 top-5 text-white/20 group-focus-within:text-primary transition-colors" size={20} />
                                        <input
                                            type="text"
                                            value={code}
                                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                                            placeholder="ABC-XYZ-123"
                                            className="premium-input pl-14 w-full"
                                            required
                                            disabled={submitting}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Nombre Completo</label>
                                    <div className="relative group">
                                        <User className="absolute left-5 top-5 text-white/20 group-focus-within:text-primary transition-colors" size={20} />
                                        <input
                                            type="text"
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            placeholder="Alejandro Suárez"
                                            className="premium-input pl-14 w-full"
                                            required
                                            disabled={submitting}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Correo Electrónico</label>
                                    <div className="relative group">
                                        <Mail className="absolute left-5 top-5 text-white/20 group-focus-within:text-primary transition-colors" size={20} />
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                            placeholder="hola@rifatrons.com"
                                            className="premium-input pl-14 w-full"
                                            required
                                            disabled={submitting}
                                        />
                                    </div>
                                </div>

                                {error && (
                                    <motion.div
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl flex items-center gap-3 text-sm"
                                    >
                                        <AlertCircle size={20} />
                                        <span className="font-medium">{error}</span>
                                    </motion.div>
                                )}

                                <button
                                    type="submit"
                                    disabled={submitting || !raffle?.active}
                                    className={`w-full relative group overflow-hidden rounded-2xl p-[2px] mt-2 ${(!raffle?.active) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    {raffle?.active && <div className="absolute inset-0 bg-gradient-to-r from-primary via-indigo-500 to-primary opacity-70 group-hover:opacity-100 transition-opacity duration-500 bg-[length:200%_auto] animate-gradient"></div>}
                                    <div className={`relative px-8 py-5 rounded-xl transition-all duration-300 flex items-center justify-center gap-3 ${raffle?.active ? 'bg-[#0f0f12] group-hover:bg-opacity-0' : 'bg-white/10'}`}>
                                        {submitting ? (
                                            <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                        ) : (
                                            <span className="font-bold text-lg tracking-wide group-hover:text-white transition-colors flex items-center gap-2">
                                                {raffle?.active ? 'PARTICIPAR AHORA' : 'RIFA FINALIZADA'} {raffle?.active && <ExternalLink size={18} />}
                                            </span>
                                        )}
                                    </div>
                                </button>

                                {platformSettings?.terms_and_conditions && (
                                    <p className="text-center text-[10px] text-white/40 mt-6 leading-relaxed max-w-sm mx-auto">
                                        Al participar, confirmas haber leído y estar de acuerdo con nuestros{' '}
                                        <a href="#" className="underline hover:text-white transition-colors font-bold" title={platformSettings.terms_and_conditions}>términos y condiciones</a>.
                                    </p>
                                )}
                            </form>

                            <div className="mt-8 pt-8 border-t border-white/5 text-center">
                                <p className="text-white/20 text-xs mb-4 uppercase tracking-[0.2em] font-bold">¿Ya tienes tickets?</p>
                                <a
                                    href="/mis-tickets"
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-primary hover:border-primary/30 transition-all text-sm font-bold group"
                                >
                                    <Search size={16} className="group-hover:scale-110 transition-transform" />
                                    CONSULTAR MIS TICKETS
                                </a>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="success"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="glass-panel p-8 md:p-12 text-center border-emerald-500/20"
                        >
                            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-500/10 text-emerald-500 mb-8 border border-emerald-500/20">
                                <CheckCircle size={48} />
                            </div>
                            <h2 className="text-4xl font-display font-black mb-4">¡Estás dentro!</h2>
                            <p className="text-white/40 mb-10 text-lg">{(success.assigned_numbers && success.assigned_numbers.length > 1) ? 'Tus números de la suerte han sido asignados:' : 'Tu número de la suerte ha sido asignado:'}</p>

                            <div className="relative overflow-hidden group">
                                <div className="absolute inset-0 bg-primary/20 blur-[50px] opacity-50 group-hover:opacity-100 transition-opacity"></div>
                                <div className="bg-[#0f0f12] border-2 border-primary/30 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-12 relative z-10 transition-transform group-hover:scale-[1.02] duration-500">
                                    {(success.assigned_numbers && success.assigned_numbers.length > 1) ? (
                                        <div className="flex flex-wrap items-center justify-center gap-4 max-h-[40vh] overflow-y-auto">
                                            {success.assigned_numbers.map((num: number) => (
                                                <span key={num} className="text-3xl sm:text-4xl font-black text-gradient tracking-tighter tabular-nums px-5 py-3 border border-primary/20 rounded-2xl bg-black/40 shadow-lg">
                                                    #{num.toString().padStart(6, '0')}
                                                </span>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-6xl sm:text-8xl font-black text-gradient tracking-tighter tabular-nums drop-shadow-2xl">
                                            #{success.assigned_number?.toString().padStart(6, '0')}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <p className="mt-10 text-white/30 text-sm leading-relaxed">
                                Hemos enviado los detalles a tu email.<br />
                                ¡Sigue nuestras redes para el sorteo en vivo!
                            </p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            <div className="lg:col-span-2 text-center text-[10px] text-white/10 uppercase tracking-[0.5em] mt-8 font-bold">
                RIFATRONS &copy; 2026 • ADVANCED RAFFLE ARCHITECTURE
            </div>
        </div>
    );
}

function FeatureItem({ icon, title, desc }: { icon: any, title: string, desc: string }) {
    return (
        <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 shrink-0 mt-1">
                {icon}
            </div>
            <div>
                <h4 className="font-bold text-white mb-0.5">{title}</h4>
                <p className="text-xs text-white/30">{desc}</p>
            </div>
        </div>
    );
}
