import { useState, useEffect, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { Ticket, Mail, Send, AlertCircle, CheckCircle, Search, Phone, CreditCard, X } from 'lucide-react';
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
    const [showRegistrationForm, setShowRegistrationForm] = useState(false);

    const formatCOP = (amount: number) => {
        return new Intl.NumberFormat('es-CO', {
            style: 'currency',
            currency: 'COP',
            maximumFractionDigits: 0
        }).format(amount);
    };

    const [formData, setFormData] = useState({
        name: '',
        last_name: '',
        email: '',
        whatsapp: '',
        cedula: ''
    });

    useEffect(() => {
        // Try to load cached settings first for instant branding
        const cached = localStorage.getItem('platform_settings');
        if (cached) {
            try {
                const data = JSON.parse(cached);
                setPlatformSettings(data);
                applyBranding(data);
            } catch (e) {
                console.error("Error parsing cached settings", e);
            }
        }

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

    const applyBranding = (data: any) => {
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
    };

    async function fetchSettings() {
        const { data } = await supabase.from('platform_settings').select('*').limit(1).single();
        if (data) {
            setPlatformSettings(data);
            localStorage.setItem('platform_settings', JSON.stringify(data));
            applyBranding(data);
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
            // Auto-select if it's a free raffle and has exactly one bundle
            if (!data.is_paid && data.ticket_bundles?.length === 1) {
                setSelectedBundle(data.ticket_bundles[0]);
            }
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
            if (raffle.is_paid) {
                // Generar Preferencia de MercadoPago
                const payload = {
                    raffle_id: raffle.id,
                    name: `${formData.name} ${formData.last_name}`,
                    email: formData.email,
                    whatsapp: formData.whatsapp,
                    cedula: formData.cedula,
                    bundle: selectedBundle || { name: 'Ticket Individual', tickets: 1, price: raffle.ticket_price }
                };

                const { data, error: mpError } = await supabase.functions.invoke('create-mp-preference', {
                    body: payload
                });

                if (mpError) throw mpError;
                if (!data?.init_point) throw new Error('No se pudo generar el enlace de pago. Intenta de nuevo.');

                window.location.href = data.init_point;
                return; // Redireccionado a MercadoPago, finalizamos función
            }

            // --- Flujo Gratuito (Existente) ---
            const generatedPassword = Math.random().toString(36).slice(-8);
            let isNewUser = false;

            const { error: signUpError } = await supabase.auth.signUp({
                email: formData.email,
                password: generatedPassword,
            });

            if (!signUpError) {
                isNewUser = true;
            } else if (signUpError.message && !signUpError.message.toLowerCase().includes('already registered')) {
                console.error("Auth Error:", signUpError);
            }

            const { data, error: rpcError } = await supabase.rpc('register_participant', {
                p_raffle_id: raffle.id,
                p_code: code,
                p_name: formData.name,
                p_last_name: formData.last_name,
                p_email: formData.email,
                p_whatsapp: formData.whatsapp,
                p_cedula: formData.cedula,
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

                // Trigger email notification
                supabase.functions.invoke('send-confirmation', {
                    body: {
                        name: formData.name,
                        email: formData.email,
                        assigned_numbers: result.assigned_numbers,
                        raffle_name: raffle.name,
                        password: isNewUser ? generatedPassword : null,
                        primary_color: platformSettings?.primary_color
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
        <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col">
            {/* Header */}
            <header className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0c]/80 backdrop-blur-xl border-b border-white/5">
                <div className="container max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
                    {platformSettings?.logo_url ? (
                        <img
                            src={platformSettings.logo_url}
                            alt="Logo"
                            className="h-10 w-auto object-contain"
                        />
                    ) : (
                        <h2 className="text-xl font-display font-black tracking-tighter text-gradient">
                            {platformSettings?.platform_name || 'RIFATRONS'}
                        </h2>
                    )}

                    <a
                        href="/mis-tickets"
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-primary hover:border-primary/30 transition-all text-xs font-bold"
                    >
                        <Search size={14} />
                        CONSULTAR TICKETS
                    </a>
                </div>
            </header>

            <main className="flex-grow pt-20">
                {/* Raffle Hero - Full Width with Info Overlay */}
                {raffle.image_url && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="relative w-full h-[60vh] md:h-[80vh] overflow-hidden"
                    >
                        <img
                            src={raffle.image_url}
                            alt="Portada"
                            className="w-full h-full object-cover"
                        />
                        {/* Shorter, darker gradient for better text contrast */}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0c] via-[#0a0a0c]/40 to-transparent"></div>

                        <div className="absolute inset-0 flex flex-col justify-end pb-12">
                            <div className="container max-w-6xl mx-auto px-4 text-center">
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    <span className="px-3 py-1 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-lg mb-6 inline-block">
                                        En curso
                                    </span>
                                    <h1 className="text-5xl md:text-8xl font-display font-black mb-6 leading-[1.1] text-white drop-shadow-2xl">
                                        {raffle.name}
                                    </h1>
                                    {raffle.description && (
                                        <p className="text-lg md:text-2xl text-white/80 leading-relaxed max-w-2xl mx-auto font-medium drop-shadow-md whitespace-pre-wrap">
                                            {raffle.description}
                                        </p>
                                    )}
                                </motion.div>
                            </div>
                        </div>
                    </motion.div>
                )}

                <div className="container max-w-4xl mx-auto px-4 py-16">
                    {/* Participation Section */}
                    <div className="max-w-4xl mx-auto">
                        <AnimatePresence mode="wait">
                            {success ? (
                                <motion.div
                                    key="success"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="glass-panel p-8 md:p-12 text-center border-emerald-500/20 max-w-2xl mx-auto"
                                >
                                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-500/10 text-emerald-500 mb-8 border border-emerald-500/20">
                                        <CheckCircle size={48} />
                                    </div>
                                    <h2 className="text-4xl font-display font-black mb-4">¡Estás dentro!</h2>
                                    <p className="text-white/40 mb-10 text-lg">{(success.assigned_numbers && success.assigned_numbers.length > 1) ? 'Tus números de la suerte han sido asignados:' : 'Tu número de la suerte ha sido asignado:'}</p>

                                    <div className="relative overflow-hidden group mb-10">
                                        <div className="absolute inset-0 bg-primary/20 blur-[50px] opacity-50"></div>
                                        <div className="bg-[#0f0f12] border-2 border-primary/30 rounded-[2.5rem] p-8 sm:p-12 relative z-10">
                                            {(success.assigned_numbers && success.assigned_numbers.length > 0) ? (
                                                <div className="flex flex-wrap items-center justify-center gap-4 max-h-[40vh] overflow-y-auto">
                                                    {success.assigned_numbers.map((num: any) => (
                                                        <span key={num} className="text-3xl font-black text-gradient tracking-tighter tabular-nums px-5 py-3 border border-primary/20 rounded-2xl bg-black/40 shadow-lg">
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

                                    <button
                                        onClick={() => window.location.reload()}
                                        className="glow-button w-full py-5 flex items-center justify-center gap-2 text-lg font-bold"
                                    >
                                        Volver al Inicio
                                    </button>
                                </motion.div>
                            ) : (raffle?.is_paid && !showRegistrationForm) ? (
                                <motion.div
                                    key="bundles"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="glass-panel p-6 sm:p-8 md:p-12 relative overflow-hidden"
                                >
                                    <div className="mb-10 text-center">
                                        <h2 className="text-3xl font-display font-bold mb-2 text-gradient">Elige tu Paquete</h2>
                                        <p className="text-white/40 text-sm">Selecciona cuántos tickets deseas para participar.</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
                                        {raffle.ticket_bundles && raffle.ticket_bundles.length > 0 ? (
                                            raffle.ticket_bundles.map((bundle: any) => (
                                                <button
                                                    key={bundle.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedBundle(bundle);
                                                        setError('');
                                                    }}
                                                    className={`w-full p-6 rounded-2xl border text-left flex flex-col justify-between group transition-all duration-300 ${selectedBundle?.id === bundle.id
                                                        ? 'bg-primary/20 border-primary shadow-[0_0_20px_rgba(37,99,235,0.2)]'
                                                        : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.08]'
                                                        }`}
                                                >
                                                    <div className="flex items-center gap-4 mb-4">
                                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${selectedBundle?.id === bundle.id ? 'bg-primary text-white' : 'bg-white/5 text-white/40 group-hover:text-white'}`}>
                                                            <Ticket size={20} />
                                                        </div>
                                                        <div>
                                                            <div className="font-black text-lg tracking-tight mb-0.5">{bundle.name}</div>
                                                            <div className="text-sm font-bold text-primary tracking-wide">
                                                                {bundle.tickets} TICKETS
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="mt-auto">
                                                        <div className="text-2xl font-mono font-black text-white">{formatCOP(bundle.price)}</div>
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="col-span-full p-8 bg-white/5 rounded-2xl border border-white/10 text-center">
                                                <p className="text-white/40">No hay paquetes configurados.</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="max-w-md mx-auto">
                                        <button
                                            onClick={() => {
                                                if (!selectedBundle && raffle.is_paid) {
                                                    setError('Selecciona un paquete para participar.');
                                                    return;
                                                }
                                                setShowRegistrationForm(true);
                                            }}
                                            className="glow-button w-full py-5 flex items-center justify-center gap-3 text-lg font-black"
                                        >
                                            Participar Ahora <Send size={20} />
                                        </button>

                                        {error && (
                                            <p className="mt-4 text-center text-red-400 text-sm font-bold">{error}</p>
                                        )}
                                    </div>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="registration"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="glass-panel p-6 sm:p-8 md:p-12 relative overflow-hidden max-w-2xl mx-auto"
                                >
                                    <div className="mb-8 relative">
                                        {raffle.is_paid && (
                                            <button
                                                onClick={() => setShowRegistrationForm(false)}
                                                className="mb-4 text-white/40 hover:text-white text-xs font-bold flex items-center gap-2 transition-colors group"
                                            >
                                                <X size={14} /> Volver a paquetes
                                            </button>
                                        )}
                                        <h2 className="text-3xl font-display font-bold mb-2">Registro de Entrada</h2>
                                        <p className="text-white/40 text-sm">Completa tus datos para {(raffle.is_paid) ? `comprar ${selectedBundle?.name}` : 'obtener tu ticket gratis'}.</p>
                                    </div>

                                    <form onSubmit={handleSubmit} className="space-y-5">
                                        {!raffle.is_paid && (
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">Código Promocional</label>
                                                <div className="relative group">
                                                    <Ticket className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={18} />
                                                    <input
                                                        type="text"
                                                        value={code}
                                                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                                                        placeholder="ABC-XYZ"
                                                        className="premium-input pl-12 w-full py-3"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">Nombre</label>
                                                <input
                                                    type="text"
                                                    value={formData.name}
                                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                    className="premium-input w-full py-3"
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">Apellido</label>
                                                <input
                                                    type="text"
                                                    value={formData.last_name}
                                                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                                    className="premium-input w-full py-3"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">Correo Electrónico</label>
                                            <div className="relative group">
                                                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={18} />
                                                <input
                                                    type="email"
                                                    value={formData.email}
                                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                                    placeholder="email@ejemplo.com"
                                                    className="premium-input pl-12 w-full py-3"
                                                    required
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">WhatsApp</label>
                                                <div className="relative group">
                                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={18} />
                                                    <input
                                                        type="tel"
                                                        value={formData.whatsapp}
                                                        onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                                                        placeholder="+57..."
                                                        className="premium-input pl-12 w-full py-3"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[10px] font-bold uppercase tracking-widest text-white/40 ml-1">Cédula / ID</label>
                                                <div className="relative group">
                                                    <CreditCard className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={18} />
                                                    <input
                                                        type="text"
                                                        value={formData.cedula}
                                                        onChange={(e) => setFormData({ ...formData, cedula: e.target.value })}
                                                        placeholder="Documento"
                                                        className="premium-input pl-12 w-full py-3 font-mono"
                                                        required
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {error && (
                                            <p className="text-xs text-red-500 font-bold bg-red-500/10 p-3 rounded-lg border border-red-500/20">{error}</p>
                                        )}

                                        <button
                                            type="submit"
                                            disabled={submitting}
                                            className="glow-button w-full py-4 flex items-center justify-center gap-3 text-lg font-black mt-4"
                                        >
                                            {submitting ? (
                                                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                            ) : (
                                                <>
                                                    {raffle.is_paid ? `Pagar ${formatCOP(selectedBundle?.price || 0)}` : 'Obtener Ticket Gratis'} <Send size={18} />
                                                </>
                                            )}
                                        </button>
                                    </form>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </main>

            <footer className="py-12 border-t border-white/5 bg-black/20">
                <div className="container max-w-6xl mx-auto px-4 text-center">
                    <div className="text-[10px] text-white/10 uppercase tracking-[0.5em] font-bold mb-4">
                        RIFATRONS &copy; 2026 • ADVANCED RAFFLE ARCHITECTURE
                    </div>
                    {platformSettings?.terms_and_conditions && (
                        <p className="text-[10px] text-white/30 max-w-md mx-auto leading-relaxed">
                            Al participar, aceptas nuestros <a href="#" className="underline hover:text-white transition-colors" title={platformSettings.terms_and_conditions}>términos y condiciones</a>.
                        </p>
                    )}
                </div>
            </footer>
        </div>
    );
}
