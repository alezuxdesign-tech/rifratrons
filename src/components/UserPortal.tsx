import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Ticket, Mail, Search, AlertCircle, Loader2, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function UserPortal() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [cedula, setCedula] = useState('');
    const [results, setResults] = useState<any[] | null>(null);
    const [error, setError] = useState('');
    const [raffle, setRaffle] = useState<any>(null);
    const [platformSettings, setPlatformSettings] = useState<any>(null);

    React.useEffect(() => {
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

        fetchSettings();

        // Escuchar cambios de configuración pública en tiempo real
        const settingsSubscription = supabase.channel('public:platform_settings_portal')
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

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        setResults(null);
        setRaffle(null);

        if (!email || !cedula) {
            setError('Por favor ingresa tu correo y cédula.');
            setLoading(false);
            return;
        }

        try {
            // Use RPC for secure lookup by email + cedula
            const { data: participants, error: rpcError } = await supabase.rpc('get_participant_tickets', {
                p_email: email.trim(),
                p_cedula: cedula.trim()
            });

            if (rpcError) throw rpcError;

            if (!participants || participants.length === 0) {
                setError('No se encontraron registros con esos datos. Verifica tu correo y cédula.');
                return;
            }

            setResults(participants);
            setRaffle({
                name: participants[0].raffle_name,
                winning_number: participants[1]?.winning_number || participants[0].winning_number,
                active: participants[0].raffle_active
            });
        } catch (err: any) {
            console.error('Portal error:', err);
            setError('Error al consultar: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0a0a0c] pt-16 md:pt-24 pb-12 px-4">
            <div className="container max-w-4xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-12"
                >
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-bold tracking-wider mb-6 uppercase">
                        <Trophy size={16} fill="currentColor" /> Portal de Participantes {platformSettings?.platform_name ? `- ${platformSettings.platform_name}` : ''}
                    </div>
                    {platformSettings?.logo_url && (
                        <div className="flex justify-center mb-6">
                            <img
                                src={platformSettings.logo_url}
                                alt="Logo"
                                className="h-12 md:h-16 w-auto object-contain drop-shadow-2xl"
                            />
                        </div>
                    )}
                    <h1 className="text-4xl md:text-5xl font-display font-black mb-4 text-gradient">Consulta tus Tickets</h1>
                    <p className="text-white/40 max-w-lg mx-auto">Ingresa tus credenciales para ver tus números asignados y el estado del sorteo.</p>
                </motion.div>

                <div className="grid md:grid-cols-[1fr,1.5fr] gap-8">
                    {/* Search Form */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="glass-panel p-6 md:p-8 h-fit lg:sticky lg:top-24"
                    >
                        <form onSubmit={handleSearch} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Email de Registro</label>
                                <div className="relative group">
                                    <Mail className="absolute left-4 top-4 text-white/20 group-focus-within:text-primary transition-colors" size={20} />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="tu@email.com"
                                        className="premium-input pl-12 w-full"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-white/60 mb-2 ml-1">Cédula</label>
                                <div className="relative group">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" size={20} />
                                    <input
                                        type="text"
                                        required
                                        value={cedula}
                                        onChange={(e) => setCedula(e.target.value)}
                                        className="premium-input w-full pl-12"
                                        placeholder="Tu número de identificación"
                                    />
                                </div>
                            </div>

                            {error && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl flex items-center gap-3 text-xs">
                                    <AlertCircle size={16} />
                                    <span>{error}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                className="glow-button w-full py-4 text-sm font-bold"
                                disabled={loading}
                            >
                                {loading ? <Loader2 className="animate-spin" /> : <><Search size={18} /> CONSULTAR</>}
                            </button>
                        </form>
                    </motion.div>

                    {/* Results Area */}
                    <div className="space-y-6">
                        <AnimatePresence mode="wait">
                            {results ? (() => {
                                const totalTickets = results.reduce((acc, curr) => acc + (curr.assigned_numbers?.length || 0), 0);
                                return (
                                    <motion.div
                                        key="results"
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="space-y-6"
                                    >
                                        {/* Raffle Header Info */}
                                        <div className="glass-panel p-6 border-primary/20 bg-primary/5">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="text-2xl font-bold text-white mb-1">{raffle?.name}</h3>
                                                    <p className="text-white/40 text-sm">Estado: <span className={raffle?.active ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>{raffle?.active ? 'ACTIVO' : 'FINALIZADO'}</span></p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] text-white/30 uppercase font-black mb-1">Total de Tickets</p>
                                                    <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-white font-bold text-sm">
                                                        {totalTickets} {totalTickets === 1 ? 'Número' : 'Números'}
                                                    </div>
                                                </div>
                                            </div>

                                            {!raffle?.active && raffle?.winning_number && (
                                                <div className="mt-6 p-6 bg-[#0f0f12] border-2 border-emerald-500/30 rounded-2xl relative overflow-hidden group">
                                                    <div className="absolute inset-0 bg-emerald-500/10 blur-xl opacity-50"></div>
                                                    <div className="relative z-10 flex flex-col items-center">
                                                        <Trophy className="text-emerald-500 mb-2" size={32} />
                                                        <p className="text-emerald-400 text-xs font-black uppercase tracking-widest mb-1">Número Ganador</p>
                                                        <span className="text-5xl sm:text-6xl font-black text-white tabular-nums">
                                                            #{raffle.winning_number.toString().padStart(6, '0')}
                                                        </span>

                                                        {results.some(p => p.assigned_numbers?.includes(raffle.winning_number)) ? (
                                                            <div className="mt-4 px-6 py-2 bg-emerald-500 text-black font-black rounded-full animate-bounce">
                                                                ¡ERES EL GANADOR! 🎉
                                                            </div>
                                                        ) : (
                                                            <p className="mt-4 text-white/30 text-[10px] uppercase font-bold italic">¡Sigue participando!</p>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Ticket List */}
                                        <div className="grid gap-3">
                                            {results.map((p, idx) => (
                                                <motion.div
                                                    key={p.id}
                                                    initial={{ opacity: 0, x: 20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: idx * 0.05 }}
                                                    className="glass-panel p-4 flex flex-col gap-4 group hover:border-primary/50 transition-colors"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-primary border border-white/5">
                                                                <Ticket size={20} />
                                                            </div>
                                                            <div>
                                                                <p className="text-white font-bold">{p.bundle_name || 'Ticket Digital'}</p>
                                                                <p className="text-[10px] text-white/30 uppercase tracking-widest">Registrado: {new Date(p.created_at).toLocaleDateString()}</p>
                                                            </div>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-xs font-bold text-primary/60 px-3 py-1 bg-primary/5 rounded-full border border-primary/10">
                                                                {p.assigned_numbers?.length || 0} Números
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-wrap gap-2 pt-4 border-t border-white/5">
                                                        {(p.assigned_numbers || []).map((num: number) => (
                                                            <span key={num} className="px-3 py-1.5 bg-white/5 text-white font-mono text-sm rounded-lg border border-white/10 group-hover:border-primary/30 transition-colors">
                                                                #{num.toString().padStart(6, '0')}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </motion.div>
                                );
                            })() : (
                                <motion.div
                                    key="empty"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="h-[400px] flex flex-col items-center justify-center text-center p-12 glass-panel border-dashed border-white/10"
                                >
                                    <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center text-white/10 mb-6 mb-4">
                                        <Search size={40} />
                                    </div>
                                    <h3 className="text-xl font-bold text-white/30">Esperando consulta...</h3>
                                    <p className="text-white/10 text-sm max-w-xs mt-2">Introduce tus datos a la izquierda para ver tus tickets asignados.</p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </div>
    );
}
