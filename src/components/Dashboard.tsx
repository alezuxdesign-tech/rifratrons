import { useState, useEffect, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import {
    Users,
    Ticket,
    Activity,
    Plus,
    Settings,
    LogOut,
    BarChart3,
    TrendingUp,
    Clock,
    ExternalLink,
    X,
    Sparkles,
    Zap,
    Trophy,
    Menu,
    Package,
    DollarSign,
    Crown,
    Star,
    Palette,
    Link as LinkIcon,
    FileText,
    Save,
    Upload
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Dashboard() {
    const [raffles, setRaffles] = useState<any[]>([]);
    const [stats, setStats] = useState({ totalParticipants: 0, activeRaffles: 0 });
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [newRaffle, setNewRaffle] = useState<{ name: string, total_numbers: number, reserved_numbers: string, ticket_bundles: any[] }>({ name: '', total_numbers: 100000, reserved_numbers: '', ticket_bundles: [] });
    const [editingRaffle, setEditingRaffle] = useState<any>(null);
    const [deleting, setDeleting] = useState(false);
    const [creating, setCreating] = useState(false);
    const [selectedRaffle, setSelectedRaffle] = useState<any>(null);
    const [participants, setParticipants] = useState<any[]>([]);
    const [activeTab, setActiveTab] = useState('Resumen');
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [analyticsData, setAnalyticsData] = useState<any[]>([]);
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);

    const [settings, setSettings] = useState<any>({
        platform_name: 'Rifatrons',
        primary_color: '#3b82f6',
        logo_url: '',
        manychat_webhook_url: '',
        terms_and_conditions: ''
    });
    const [savingSettings, setSavingSettings] = useState(false);
    const [settingsSuccess, setSettingsSuccess] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [settingsError, setSettingsError] = useState('');

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        if (activeTab === 'Analíticas' && analyticsData.length === 0) {
            fetchAnalytics();
        }
        if (activeTab === 'Configuración') {
            fetchSettings();
        }
    }, [activeTab]);

    async function fetchSettings() {
        const { data } = await supabase.from('platform_settings').select('*').limit(1).single();
        if (data) setSettings(data);
    }

    async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadingLogo(true);
        try {
            const fileExt = file.name.split('.').pop();
            const fileName = `logo-${Date.now()}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
                .from('brand_assets')
                .upload(fileName, file, { cacheControl: '3600', upsert: false });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('brand_assets').getPublicUrl(fileName);

            setSettings({ ...settings, logo_url: data.publicUrl });
        } catch (err: any) {
            console.error('Upload error:', err);
            setSettingsError(err.message || 'Error al subir la imagen. Verifica el formato y peso.');
            setTimeout(() => setSettingsError(''), 4000);
        } finally {
            setUploadingLogo(false);
        }
    }

    async function handleSaveSettings(e: FormEvent) {
        e.preventDefault();
        setSavingSettings(true);
        try {
            const { data: existing } = await supabase.from('platform_settings').select('id').limit(1).single();
            if (existing) {
                await supabase.from('platform_settings').update(settings).eq('id', existing.id);
            } else {
                await supabase.from('platform_settings').insert([settings]);
            }

            if (settings.primary_color) {
                document.documentElement.style.setProperty('--color-primary', settings.primary_color);
                const hex = settings.primary_color.replace('#', '');
                if (hex.length === 6) {
                    const r = parseInt(hex.substring(0, 2), 16);
                    const g = parseInt(hex.substring(2, 4), 16);
                    const b = parseInt(hex.substring(4, 6), 16);
                    document.documentElement.style.setProperty('--color-primary-glow', `rgba(${r}, ${g}, ${b}, 0.5)`);
                }
            }

            setSettingsSuccess(true);
            setTimeout(() => setSettingsSuccess(false), 3000);
        } catch (err) {
            console.error(err);
        } finally {
            setSavingSettings(false);
        }
    }

    async function fetchAnalytics() {
        setLoadingAnalytics(true);
        const { data } = await supabase.from('participants').select('created_at, bundle_name, amount_paid, email');
        if (data) setAnalyticsData(data);
        setLoadingAnalytics(false);
    }

    async function fetchData() {
        const { data: rafflesData } = await supabase
            .from('raffles')
            .select('*, participants(count)')
            .order('created_at', { ascending: false });

        const { count: participantsCount } = await supabase.from('participants').select('*', { count: 'exact', head: true });

        if (rafflesData) {
            // Flatten the count from participants join
            const rafflesWithCounts = rafflesData.map(r => ({
                ...r,
                participants_count: r.participants[0]?.count || 0
            }));

            setRaffles(rafflesWithCounts);
            setStats({
                totalParticipants: participantsCount || 0,
                activeRaffles: rafflesData.filter(r => r.active).length
            });
        }
        setLoading(false);
    }

    const handleDeleteRaffle = async (id: string) => {
        if (!confirm('¿Estás seguro de eliminar esta rifa? Se borrarán todos los códigos y participantes asociados.')) return;
        setDeleting(true);
        try {
            const { error } = await supabase.from('raffles').delete().eq('id', id);

            if (error) {
                alert('Error al eliminar: ' + error.message);
            } else {
                fetchData();
            }
        } catch (err) {
            alert('Error de conexión al eliminar: ' + err);
        } finally {
            setDeleting(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    const handleGenerateTestLink = async (raffleId: string) => {
        try {
            const { data, error } = await supabase.functions.invoke('manychat-webhook', {
                body: { raffle_id: raffleId }
            });

            if (error) throw error;

            if (data?.raffle_url) {
                navigator.clipboard.writeText(data.raffle_url);
                alert('¡Link Único generado y copiado!\n\nEste link es para un solo uso y simula lo que ManyChat enviaría al usuario:\n' + data.raffle_url);
            }
        } catch (err) {
            console.error('Test link error:', err);
            alert('Error generando link: ' + (err instanceof Error ? err.message : JSON.stringify(err)));
        }
    };

    const handleCreateRaffle = async (e: FormEvent) => {
        e.preventDefault();
        if (!newRaffle.name) return;
        setCreating(true);

        const reservedNumbersArray = newRaffle.reserved_numbers
            ? newRaffle.reserved_numbers.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n))
            : [];

        const { error } = await supabase.from('raffles').insert([
            { ...newRaffle, reserved_numbers: reservedNumbersArray, active: true }
        ]);

        if (error) {
            alert('Error al crear la rifa: ' + error.message);
        } else {
            setIsModalOpen(false);
            setNewRaffle({ name: '', total_numbers: 100000, reserved_numbers: '', ticket_bundles: [] });
            fetchData();
        }
        setCreating(false);
    };

    const handleUpdateRaffle = async (e: FormEvent) => {
        e.preventDefault();
        if (!editingRaffle.name) return;
        setCreating(true);

        let reservedNumbersArray = editingRaffle.reserved_numbers;
        if (typeof reservedNumbersArray === 'string') {
            reservedNumbersArray = reservedNumbersArray.split(',').map((n: string) => parseInt(n.trim())).filter((n: number) => !isNaN(n));
        } else if (!Array.isArray(reservedNumbersArray)) {
            reservedNumbersArray = [];
        }

        const { error } = await supabase
            .from('raffles')
            .update({
                name: editingRaffle.name,
                active: editingRaffle.active,
                total_numbers: editingRaffle.total_numbers,
                reserved_numbers: reservedNumbersArray,
                ticket_bundles: editingRaffle.ticket_bundles || []
            })
            .eq('id', editingRaffle.id);

        if (error) {
            alert('Error al actualizar: ' + error.message);
        } else {
            setEditModalOpen(false);
            fetchData();
        }
        setCreating(false);
    };

    const fetchParticipants = async (raffleId: string) => {
        const { data } = await supabase
            .from('participants')
            .select('*')
            .eq('raffle_id', raffleId)
            .order('created_at', { ascending: false });
        if (data) setParticipants(data);
    };

    const handleSelectRaffle = (raffle: any) => {
        setSelectedRaffle(raffle);
        fetchParticipants(raffle.id);
    };

    const handlePickWinner = async (raffleId: string) => {
        if (!confirm('¿Estás seguro de finalizar esta rifa y sortear un ganador ahora?')) return;

        try {
            // 1. Get all assigned numbers for this raffle
            const { data: participants, error: pError } = await supabase
                .from('participants')
                .select('assigned_number')
                .eq('raffle_id', raffleId);

            if (pError) throw pError;
            if (!participants || participants.length === 0) {
                alert('No hay participantes registrados para esta rifa todavía.');
                return;
            }

            // 2. Pick a random number from the existing ones
            const randomIndex = Math.floor(Math.random() * participants.length);
            const winnerNumber = participants[randomIndex].assigned_number;

            // 3. Update raffle status and winning number
            const { error: uError } = await supabase
                .from('raffles')
                .update({
                    active: false,
                    winning_number: winnerNumber
                })
                .eq('id', raffleId);

            if (uError) throw uError;

            alert('¡Rifa Finalizada!\n\nEl número ganador es: #' + winnerNumber.toString().padStart(6, '0'));
            fetchData();
        } catch (err: any) {
            console.error('Pick winner error:', err);
            alert('Error al sortear: ' + err.message);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0a0a0c]">
                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0a0c] text-white flex font-sans overflow-hidden">
            {/* Mobile Header (Visible only on small screens) */}
            <div className="lg:hidden fixed top-0 left-0 right-0 h-20 bg-[#0d0d0f]/90 backdrop-blur-xl border-b border-white/5 z-40 flex items-center justify-between px-6">
                <div className="flex items-center gap-3">
                    {settings?.logo_url ? (
                        <>
                            <img src={settings.logo_url} alt="Logo" className="h-8 w-auto object-contain" />
                            <h1 className="font-display font-black tracking-tight text-xl text-gradient">{settings?.platform_name || 'RIFATRONS'}</h1>
                        </>
                    ) : (
                        <>
                            <div className="w-8 h-8 bg-gradient-to-br from-primary to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                                <Activity className="text-white" size={16} />
                            </div>
                            <h1 className="font-display font-black tracking-tight text-xl text-gradient">{settings?.platform_name || 'RIFATRONS'}</h1>
                        </>
                    )}
                </div>
                <button
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    className="p-2 text-white/60 hover:text-white"
                >
                    {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Sidebar - Premium Design */}
            <aside className={`fixed lg:static inset-y-0 left-0 z-30 w-72 border-r border-white/5 bg-[#0d0d0f]/95 lg:bg-[#0d0d0f]/80 backdrop-blur-xl p-8 flex flex-col items-center transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
                <div className="hidden lg:flex items-center gap-4 mb-16 w-full">
                    {settings?.logo_url ? (
                        <>
                            <div className="w-12 h-12 flex items-center justify-center shrink-0">
                                <img src={settings.logo_url} alt="Logo" className="max-h-full max-w-full object-contain drop-shadow-lg" />
                            </div>
                            <div>
                                <h1 className="font-display font-black tracking-tight text-xl text-gradient truncate">{settings?.platform_name || 'RIFATRONS'}</h1>
                                <p className="text-[10px] font-bold text-primary tracking-[0.2em] uppercase">Panel de Control</p>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="w-12 h-12 bg-gradient-to-br from-primary to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
                                <Activity className="text-white" size={24} />
                            </div>
                            <div>
                                <h1 className="font-display font-black tracking-tight text-xl text-gradient truncate">{settings?.platform_name || 'RIFATRONS'}</h1>
                                <p className="text-[10px] font-bold text-primary tracking-[0.2em] uppercase">Panel de Control</p>
                            </div>
                        </>
                    )}
                </div>

                <nav className="space-y-3 w-full flex-1 pt-8 lg:pt-0">
                    <NavItem icon={<BarChart3 size={20} />} label="Resumen" active={activeTab === 'Resumen'} onClick={() => { setActiveTab('Resumen'); setIsMobileMenuOpen(false); }} />
                    <NavItem icon={<Ticket size={20} />} label="Mis Rifas" active={activeTab === 'Mis Rifas'} onClick={() => { setActiveTab('Mis Rifas'); setIsMobileMenuOpen(false); }} />
                    <NavItem icon={<Users size={20} />} label="Participantes" active={activeTab === 'Participantes'} onClick={() => { setActiveTab('Participantes'); setIsMobileMenuOpen(false); }} />
                    <NavItem icon={<TrendingUp size={20} />} label="Analíticas" active={activeTab === 'Analíticas'} onClick={() => { setActiveTab('Analíticas'); setIsMobileMenuOpen(false); }} />
                    <div className="pt-8 mb-4 border-t border-white/5">
                        <NavItem icon={<Settings size={20} />} label="Configuración" active={activeTab === 'Configuración'} onClick={() => { setActiveTab('Configuración'); setIsMobileMenuOpen(false); }} />
                    </div>
                </nav>

                <div className="w-full mt-auto">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-6 py-4 w-full rounded-2xl text-white/40 hover:text-red-400 hover:bg-red-500/5 transition-all duration-300"
                    >
                        <LogOut size={20} />
                        <span className="font-semibold">Cerrar Sesión</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6 pt-28 md:p-8 lg:p-12 overflow-y-auto overflow-x-hidden relative w-full hide-scrollbar">
                {/* Background Accents */}
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] -z-10"></div>

                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 sm:gap-0 mb-8 lg:mb-12">
                    <div>
                        <div className="flex items-center gap-2 text-primary text-sm font-bold tracking-widest uppercase mb-1">
                            <Clock size={14} /> {new Date().toLocaleDateString()}
                        </div>
                        <h1 className="text-3xl sm:text-4xl font-display font-black text-gradient">Panel de Control</h1>
                    </div>

                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="glow-button px-5 py-4 w-full sm:w-auto text-sm"
                    >
                        <Plus size={18} strokeWidth={3} /> <span className="mr-2">NUEVA RIFA</span>
                    </button>
                </header>

                {activeTab === 'Resumen' && (
                    <>
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                            <StatCard title="Participantes" value={stats.totalParticipants.toLocaleString()} sub="Registros hoy" icon={<Users className="text-primary" />} gradient="from-blue-500/20 to-transparent" />
                            <StatCard title="Tickets" value={stats.totalParticipants.toLocaleString()} sub="Asignados" icon={<Ticket className="text-emerald-500" />} gradient="from-emerald-500/20 to-transparent" />
                            <StatCard title="Ingresos" value="$0.00" sub="Fase MVP Gratis" icon={<TrendingUp className="text-amber-500" />} gradient="from-amber-500/20 to-transparent" />
                        </div>

                        {/* Recent Raffles Grid - Simple List */}
                        <div className="grid grid-cols-1 gap-8">
                            <section className="glass-panel p-8">
                                <div className="flex items-center justify-between mb-8">
                                    <div>
                                        <h3 className="text-2xl font-display font-bold">Resumen de Actividad</h3>
                                        <p className="text-white/30 text-sm">Dashboard general de tus sorteos más recientes.</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    {raffles.slice(0, 3).map((raffle) => (
                                        <div className="flex-1">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                                                        <Ticket size={20} />
                                                    </div>
                                                    <span className="font-bold">{raffle.name}</span>
                                                </div>
                                                <span className={`text-[10px] font-bold uppercase py-1 px-3 rounded-full ${raffle.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-500'}`}>
                                                    {raffle.active ? 'Activa' : 'Finalizada'}
                                                </span>
                                            </div>
                                            <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${(raffle.participants_count / raffle.total_numbers) * 100}%` }}
                                                    className="h-full bg-primary"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        </div>
                    </>
                )}

                {activeTab === 'Mis Rifas' && (
                    <div className="grid grid-cols-1 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <section className="glass-panel p-8 text-[#f8fafc]">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h2 className="text-3xl font-display font-black text-gradient">Mis Sorteos</h2>
                                    <p className="text-white/40">Gestiona tus rifas y obtén los enlaces para ManyChat.</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                {raffles.map((raffle) => (
                                    <div key={raffle.id} className="p-8 rounded-[2.5rem] bg-white/[0.02] border border-white/[0.08] hover:border-primary/20 transition-all group">
                                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                                            <div className="flex items-start gap-6">
                                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-indigo-500/10 flex items-center justify-center text-primary border border-primary/20">
                                                    <Ticket size={28} />
                                                </div>
                                                <div>
                                                    <h3 className="text-2xl font-display font-black mb-1">{raffle.name}</h3>
                                                    <div className="flex flex-wrap gap-4 text-xs font-bold text-white/20 uppercase tracking-widest mt-2">
                                                        <span className="flex items-center gap-2"><div className={`w-2 h-2 rounded-full ${raffle.active ? 'bg-emerald-500 shadow-[0_0_8px_bg-emerald-500]' : 'bg-red-500 shadow-[0_0_8px_bg-red-500]'}`}></div> {raffle.active ? 'Activa' : 'Finalizada / Pausada'}</span>
                                                        <span>•</span>
                                                        <span>ID: {raffle.id.substring(0, 8)}...</span>
                                                        <span>•</span>
                                                        <span>{raffle.total_numbers.toLocaleString()} Tickets</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-4">
                                                <button
                                                    onClick={() => handleDeleteRaffle(raffle.id)}
                                                    className="px-6 py-3 rounded-xl bg-red-500/5 border border-red-500/10 text-red-500 text-sm font-bold hover:bg-red-500/10 transition-colors"
                                                    disabled={deleting}
                                                >
                                                    Eliminar
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setEditingRaffle(raffle);
                                                        setEditModalOpen(true);
                                                    }}
                                                    className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-sm font-bold hover:bg-white/10 transition-colors"
                                                >
                                                    Editar
                                                </button>
                                                <div className="flex gap-2">
                                                    <button
                                                        className="py-3 px-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold hover:bg-indigo-500/20 transition-colors flex items-center justify-center gap-2"
                                                        onClick={() => handleGenerateTestLink(raffle.id)}
                                                    >
                                                        <Zap size={14} /> Link de Prueba
                                                    </button>
                                                    <button
                                                        className="py-3 px-4 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold hover:bg-primary/20 transition-colors flex items-center justify-center gap-2"
                                                        onClick={() => {
                                                            const url = `https://eruiyauxaftxrvwkoigi.supabase.co/functions/v1/manychat-webhook?raffle_id=${raffle.id}`;
                                                            navigator.clipboard.writeText(url);
                                                            alert('URL Webhook copiada para ManyChat');
                                                        }}
                                                    >
                                                        <ExternalLink size={14} /> Webhook
                                                    </button>
                                                    {raffle.active && (
                                                        <button
                                                            className="py-3 px-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-colors flex items-center justify-center gap-2"
                                                            onClick={() => handlePickWinner(raffle.id)}
                                                        >
                                                            <Trophy size={14} /> Sortear
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Progress Section */}
                                        <div className="mt-8">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs font-bold uppercase tracking-widest text-white/40">Progreso de Ventas</span>
                                                    <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-black">
                                                        {Math.round((raffle.participants_count / raffle.total_numbers) * 100)}%
                                                    </span>
                                                </div>
                                                <span className="text-xs font-mono text-white/20">
                                                    {raffle.participants_count.toLocaleString()} / {raffle.total_numbers.toLocaleString()} Tickets
                                                </span>
                                            </div>
                                            <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${(raffle.participants_count / raffle.total_numbers) * 100}%` }}
                                                    className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]"
                                                />
                                            </div>
                                        </div>

                                        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20 relative group/link">
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
                                                    <ExternalLink size={12} /> Link Público (Redes Sociales)
                                                </p>
                                                <div className="flex items-center gap-3 font-mono text-[10px] text-white/60 break-all bg-black/40 p-4 rounded-xl border border-white/5">
                                                    {window.location.origin}/?raffle={raffle.id}
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(`${window.location.origin}/?raffle=${raffle.id}`);
                                                        alert('Link Público copiado. Úsalo en Instagram, Facebook o WhatsApp.');
                                                    }}
                                                    className="absolute right-8 top-[3.2rem] p-2 rounded-lg bg-white/10 hover:bg-primary/20 text-white opacity-0 group-hover/link:opacity-100 transition-opacity backdrop-blur-md"
                                                    title="Copiar Link"
                                                >
                                                    <ExternalLink size={14} />
                                                </button>
                                                <p className="mt-3 text-[9px] text-white/40 italic">Comparte este link para que los usuarios entren directo a esta rifa.</p>
                                            </div>

                                            <div className="p-6 rounded-2xl bg-black/40 border border-white/5 relative group/link">
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-[#a855f7] mb-3 flex items-center gap-2">
                                                    <Sparkles size={12} /> Link Mágico (ManyChat)
                                                </p>
                                                <div className="flex items-center gap-3 font-mono text-[10px] text-white/40 break-all bg-black/20 p-4 rounded-xl border border-white/5">
                                                    https://eruiyauxaftxrvwkoigi.supabase.co/functions/v1/manychat-webhook?raffle_id={raffle.id}&redirect=true
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(`https://eruiyauxaftxrvwkoigi.supabase.co/functions/v1/manychat-webhook?raffle_id=${raffle.id}&redirect=true`);
                                                            alert('Link Mágico copiado');
                                                        }}
                                                        className="absolute right-8 top-[3.2rem] p-2 rounded-lg bg-white/10 hover:bg-white/20 opacity-0 group-hover/link:opacity-100 transition-opacity"
                                                    >
                                                        <ExternalLink size={12} />
                                                    </button>
                                                </div>
                                                <p className="mt-3 text-[9px] text-white/30 italic">Pega este link en botones de ManyChat. Genera ticket automático.</p>
                                            </div>

                                            <div className="p-6 rounded-2xl bg-black/40 border border-white/5 relative group/link">
                                                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-3 flex items-center gap-2">
                                                    <Zap size={12} /> ManyChat POST (Avanzado)
                                                </p>
                                                <div className="flex items-center gap-3 font-mono text-[10px] text-white/40 break-all bg-black/20 p-4 rounded-xl border border-white/5">
                                                    {`{ "raffle_id": "${raffle.id}" }`}
                                                    <button
                                                        onClick={() => {
                                                            navigator.clipboard.writeText(`{ "raffle_id": "${raffle.id}" }`);
                                                            alert('JSON copiado');
                                                        }}
                                                        className="absolute right-8 top-[3.2rem] p-2 rounded-lg bg-white/10 hover:bg-white/20 opacity-0 group-hover/link:opacity-100 transition-opacity"
                                                    >
                                                        <ExternalLink size={12} />
                                                    </button>
                                                </div>
                                                <p className="mt-3 text-[9px] text-white/30 italic">Para usar con 'External Request' y guardar la URL.</p>
                                            </div>
                                        </div>
                                        {!raffle.active && raffle.winning_number && (
                                            <div className="mt-8 p-6 bg-emerald-500/5 border border-emerald-500/20 rounded-3xl flex items-center justify-between relative overflow-hidden group/winner">
                                                <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-transparent via-emerald-500 to-transparent opacity-50"></div>
                                                <div className="flex items-center gap-6">
                                                    <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-500/10">
                                                        <Trophy size={32} />
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-1">¡Sorteo Finalizado!</p>
                                                        <h4 className="text-xl font-display font-black text-white">Número Ganador</h4>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-5xl font-black text-white tabular-nums drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                                                        #{raffle.winning_number.toString().padStart(6, '0')}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    </div>
                )}

                {activeTab === 'Participantes' && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <section className="glass-panel p-8">
                            <div className="flex items-center justify-between mb-8">
                                <div>
                                    <h2 className="text-3xl font-display font-black text-gradient">Participantes Globales</h2>
                                    <p className="text-white/40">Todas las personas que han participado en tus sorteos.</p>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {raffles.map(r => (
                                    <button
                                        key={r.id}
                                        onClick={() => handleSelectRaffle(r)}
                                        className={`px-6 py-3 rounded-xl border text-sm font-bold transition-all mr-3 mb-3
                                        ${selectedRaffle?.id === r.id ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}
                                    >
                                        {r.name}
                                    </button>
                                ))}
                            </div>

                            {selectedRaffle ? (
                                <div className="mt-12 overflow-x-auto">
                                    <table className="w-full text-left">
                                        <thead>
                                            <tr className="text-[10px] font-bold uppercase tracking-widest text-white/20 border-b border-white/5">
                                                <th className="pb-4 pl-4">Nombre</th>
                                                <th className="pb-4">Email</th>
                                                <th className="pb-4">Ticket</th>
                                                <th className="pb-4 text-right pr-4">Fecha</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-white/5">
                                            {participants.map((p) => (
                                                <tr key={p.id} className="group hover:bg-white/[0.02] transition-colors">
                                                    <td className="py-4 pl-4 font-semibold">{p.name}</td>
                                                    <td className="py-4 text-white/40">{p.email}</td>
                                                    <td className="py-4">
                                                        <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-bold font-mono">
                                                            #{p.assigned_number.toString().padStart(6, '0')}
                                                        </span>
                                                    </td>
                                                    <td className="py-4 text-right pr-4 text-white/20 text-xs tabular-nums">
                                                        {new Date(p.created_at).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            ))}
                                            {participants.length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="py-20 text-center text-white/20 italic">No hay registros aún.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="py-20 text-center text-white/20 bg-white/[0.01] rounded-3xl border border-dashed border-white/10">
                                    <Users size={48} className="mx-auto mb-4 opacity-20" />
                                    Selecciona una rifa para ver sus participantes.
                                </div>
                            )}
                        </section>
                    </div>
                )}

                {activeTab === 'Analíticas' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        {loadingAnalytics ? (
                            <div className="flex items-center justify-center py-20">
                                <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                            </div>
                        ) : (
                            <>
                                {/* Resumen Financiero Top */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="glass-panel p-6 border-emerald-500/20">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
                                                <DollarSign size={24} />
                                            </div>
                                            <div>
                                                <p className="text-white/40 text-sm font-bold uppercase tracking-widest">Ingresos Totales Brutos</p>
                                                <h3 className="text-3xl font-display font-black">${analyticsData.reduce((sum, item) => sum + (Number(item.amount_paid) || 0), 0).toFixed(2)}</h3>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="glass-panel p-6 border-indigo-500/20">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
                                                <Ticket size={24} />
                                            </div>
                                            <div>
                                                <p className="text-white/40 text-sm font-bold uppercase tracking-widest">Tickets Emitidos</p>
                                                <h3 className="text-3xl font-display font-black">{analyticsData.length}</h3>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="glass-panel p-6 border-amber-500/20">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
                                                <TrendingUp size={24} />
                                            </div>
                                            <div>
                                                <p className="text-white/40 text-sm font-bold uppercase tracking-widest">Promedio por Ticket</p>
                                                <h3 className="text-3xl font-display font-black">
                                                    ${analyticsData.length > 0 ? (analyticsData.reduce((sum, item) => sum + (Number(item.amount_paid) || 0), 0) / analyticsData.length).toFixed(2) : '0.00'}
                                                </h3>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="glass-panel p-6 border-yellow-500/20">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-12 h-12 rounded-xl bg-yellow-500/10 text-yellow-500 flex items-center justify-center border border-yellow-500/20">
                                                <Star size={24} />
                                            </div>
                                            <div>
                                                <p className="text-white/40 text-sm font-bold uppercase tracking-widest">Mejor Día</p>
                                                <h3 className="text-3xl font-display font-black">
                                                    {(() => {
                                                        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                                                        const daySpending = analyticsData.reduce((acc: any, item) => {
                                                            const dayName = days[new Date(item.created_at).getDay()];
                                                            acc[dayName] = (acc[dayName] || 0) + (Number(item.amount_paid) || 0);
                                                            return acc;
                                                        }, {});
                                                        const best = Object.entries(daySpending).sort((a: any, b: any) => b[1] - a[1])[0];
                                                        return best ? best[0] : 'N/A';
                                                    })()}
                                                </h3>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Gráfico de Tendencias */}
                                <div className="glass-panel p-8">
                                    <h3 className="text-xl font-display font-black mb-6 flex items-center gap-2">
                                        <Activity className="text-primary" /> Tendencia de Ingresos (Últimos 7 Días)
                                    </h3>
                                    <div className="h-[300px] w-full">
                                        {analyticsData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={
                                                    Array.from({ length: 7 }, (_, i) => {
                                                        const d = new Date();
                                                        d.setDate(d.getDate() - i);
                                                        return d.toISOString().split('T')[0];
                                                    }).reverse().map(date => {
                                                        const dayData = analyticsData.filter(item => item.created_at.startsWith(date));
                                                        return {
                                                            name: new Date(date).toLocaleDateString('es-ES', { weekday: 'short' }),
                                                            Ingresos: dayData.reduce((sum, item) => sum + (Number(item.amount_paid) || 0), 0)
                                                        };
                                                    })
                                                }>
                                                    <XAxis dataKey="name" stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} />
                                                    <YAxis stroke="#ffffff40" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val}`} />
                                                    <RechartsTooltip
                                                        contentStyle={{ backgroundColor: '#0f0f12', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem' }}
                                                        itemStyle={{ color: '#3b82f6', fontWeight: 'bold' }}
                                                    />
                                                    <Line type="monotone" dataKey="Ingresos" stroke="#3b82f6" strokeWidth={4} dot={{ r: 4, strokeWidth: 2, fill: '#0f0f12' }} activeDot={{ r: 8, stroke: '#3b82f6', strokeWidth: 2, fill: '#0f0f12' }} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-white/20 italic text-sm">No hay datos suficientes para el gráfico.</div>
                                        )}
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    {/* Top Bundles */}
                                    <div className="glass-panel p-8">
                                        <h3 className="text-xl font-display font-black mb-6 flex items-center gap-2">
                                            <Package className="text-primary" /> Paquetes Más Populares
                                        </h3>
                                        <div className="space-y-4">
                                            {Object.entries(analyticsData.reduce((acc: any, item) => {
                                                const name = item.bundle_name || 'Ticket Individual Libre';
                                                if (!acc[name]) acc[name] = { count: 0, revenue: 0 };
                                                acc[name].count += 1;
                                                acc[name].revenue += (Number(item.amount_paid) || 0);
                                                return acc;
                                            }, {})).sort((a: any, b: any) => b[1].count - a[1].count).slice(0, 5).map(([name, stats]: any, index) => (
                                                <div key={name} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center font-black text-xs">
                                                            #{index + 1}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-sm">{name}</div>
                                                            <div className="text-xs text-white/40">{stats.count} vendidos</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-mono text-primary font-bold">${stats.revenue.toFixed(2)}</div>
                                                        <div className="text-[10px] text-white/30 uppercase">Ingresos</div>
                                                    </div>
                                                </div>
                                            ))}
                                            {analyticsData.length === 0 && <p className="text-white/20 italic text-sm py-4 text-center">No hay datos de paquetes aún.</p>}
                                        </div>
                                    </div>

                                    {/* Peak Hours */}
                                    <div className="glass-panel p-8">
                                        <h3 className="text-xl font-display font-black mb-6 flex items-center gap-2">
                                            <Clock className="text-indigo-400" /> Horas Pico de Actividad
                                        </h3>
                                        <div className="space-y-4">
                                            {Object.entries(analyticsData.reduce((acc: any, item) => {
                                                const hour = new Date(item.created_at).getHours();
                                                acc[hour] = (acc[hour] || 0) + 1;
                                                return acc;
                                            }, {})).sort((a: any, b: any) => b[1] - a[1]).slice(0, 5).map(([hour, count]: any) => {
                                                const formattedHour = `${hour.toString().padStart(2, '0')}:00`;
                                                const maxCount = Math.max(...Object.values(analyticsData.reduce((acc: any, item) => {
                                                    const h = new Date(item.created_at).getHours();
                                                    acc[h] = (acc[h] || 0) + 1;
                                                    return acc;
                                                }, {})) as number[]);
                                                const percentage = Math.round((count / maxCount) * 100);

                                                return (
                                                    <div key={hour} className="space-y-2">
                                                        <div className="flex justify-between text-xs font-bold text-white/60">
                                                            <span>{formattedHour} - {parseInt(hour) + 1}:00</span>
                                                            <span className="text-indigo-400">{count} compras</span>
                                                        </div>
                                                        <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                                            <motion.div
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${percentage}%` }}
                                                                className="h-full bg-indigo-500 rounded-full"
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {analyticsData.length === 0 && <p className="text-white/20 italic text-sm py-4 text-center">No hay actividad registrada aún.</p>}
                                        </div>
                                    </div>

                                    {/* Top VIP Users */}
                                    <div className="glass-panel p-8">
                                        <h3 className="text-xl font-display font-black mb-6 flex items-center gap-2">
                                            <Crown className="text-yellow-500" /> Top VIP Usuarios
                                        </h3>
                                        <div className="space-y-4">
                                            {Object.entries(analyticsData.reduce((acc: any, item) => {
                                                if (!item.email) return acc;
                                                const email = item.email;
                                                if (!acc[email]) acc[email] = { count: 0, spent: 0 };
                                                acc[email].count += 1;
                                                acc[email].spent += (Number(item.amount_paid) || 0);
                                                return acc;
                                            }, {})).sort((a: any, b: any) => b[1].spent - a[1].spent).slice(0, 5).map(([email, stats]: any, listIndex: number) => (
                                                <div key={email} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-8 h-8 rounded-full bg-yellow-500/10 text-yellow-500 flex items-center justify-center font-black text-xs border border-yellow-500/20">
                                                            #{listIndex + 1}
                                                        </div>
                                                        <div className="overflow-hidden">
                                                            <div className="font-bold text-sm truncate max-w-[120px] sm:max-w-[200px]" title={email}>{email}</div>
                                                            <div className="text-xs text-white/40">{stats.count} {stats.count === 1 ? 'ticket' : 'tickets'} comprados</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-mono text-yellow-500 font-bold">${stats.spent.toFixed(2)}</div>
                                                        <div className="text-[10px] text-white/30 uppercase">Inversión Total</div>
                                                    </div>
                                                </div>
                                            ))}
                                            {analyticsData.length === 0 && <p className="text-white/20 italic text-sm py-4 text-center">No hay clientes vip aún.</p>}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {activeTab === 'Configuración' && (
                    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
                        <div className="mb-10">
                            <h2 className="text-3xl font-display font-black mb-2 flex items-center gap-3">
                                <Settings className="text-primary" /> Ajustes Globales
                            </h2>
                            <p className="text-white/40">Personaliza la apariencia y el comportamiento de tu plataforma de rifas.</p>
                        </div>

                        <form onSubmit={handleSaveSettings} className="space-y-8">
                            {/* Branding Section */}
                            <div className="glass-panel p-8">
                                <h3 className="text-xl font-display font-bold mb-6 flex items-center gap-2 border-b border-white/10 pb-4">
                                    <Palette className="text-primary" size={20} /> Apariencia y Marca
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Nombre de Plataforma</label>
                                        <input
                                            type="text"
                                            value={settings.platform_name || ''}
                                            onChange={(e) => setSettings({ ...settings, platform_name: e.target.value })}
                                            placeholder="Rifatrons"
                                            className="premium-input w-full"
                                            required
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Color Principal (Hex)</label>
                                        <div className="flex gap-3">
                                            <input
                                                type="color"
                                                value={settings.primary_color || '#3b82f6'}
                                                onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                                                className="h-12 w-12 rounded-xl cursor-pointer border-0 bg-transparent p-0"
                                            />
                                            <input
                                                type="text"
                                                value={settings.primary_color || ''}
                                                onChange={(e) => setSettings({ ...settings, primary_color: e.target.value })}
                                                placeholder="#3b82f6"
                                                className="premium-input w-full font-mono uppercase"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-4 md:col-span-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Logo de la Plataforma (Opcional)</label>
                                        <div className="flex items-center gap-6">
                                            {settings.logo_url ? (
                                                <div className="relative group w-24 h-24 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden">
                                                    <img src={settings.logo_url} alt="Logo" className="max-w-full max-h-full object-contain p-2" />
                                                    <button
                                                        type="button"
                                                        onClick={() => setSettings({ ...settings, logo_url: '' })}
                                                        className="absolute inset-0 bg-red-500/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                                        title="Eliminar logo"
                                                    >
                                                        <X className="text-white" />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="w-24 h-24 rounded-2xl bg-white/5 border border-white/10 border-dashed flex items-center justify-center text-white/20">
                                                    <Palette size={32} />
                                                </div>
                                            )}

                                            <div className="flex-1">
                                                <div className="relative inline-block">
                                                    <button
                                                        type="button"
                                                        disabled={uploadingLogo}
                                                        className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-colors text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {uploadingLogo ? (
                                                            <div className="w-5 h-5 border-2 border-primary/50 border-t-primary rounded-full animate-spin"></div>
                                                        ) : (
                                                            <>
                                                                <Upload size={18} className="text-primary" /> Subir Imagen
                                                            </>
                                                        )}
                                                    </button>
                                                    <input
                                                        type="file"
                                                        accept="image/png, image/jpeg, image/svg+xml"
                                                        onChange={handleLogoUpload}
                                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                                        disabled={uploadingLogo}
                                                    />
                                                </div>
                                                <p className="text-[10px] text-white/30 italic mt-3 max-w-sm">Recomendamos: Imagen cuadrada (512x512px) o rectangular (400x150px). Formato PNG con fondo transparente o SVG. Peso menor a 1MB.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Integrations */}
                            <div className="glass-panel p-8">
                                <h3 className="text-xl font-display font-bold mb-6 flex items-center gap-2 border-b border-white/10 pb-4">
                                    <LinkIcon className="text-emerald-500" size={20} /> Integraciones Avanzadas
                                </h3>
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">ManyChat Webhook Global (Opcional)</label>
                                        <input
                                            type="url"
                                            value={settings.manychat_webhook_url || ''}
                                            onChange={(e) => setSettings({ ...settings, manychat_webhook_url: e.target.value })}
                                            placeholder="https://api.manychat.com/..."
                                            className="premium-input w-full"
                                        />
                                        <p className="text-[10px] text-white/30 italic">Utiliza esta URL si cuentas con un flujo genérico centralizado en ManyChat para todas tus rifas.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Textos y Legales */}
                            <div className="glass-panel p-8">
                                <h3 className="text-xl font-display font-bold mb-6 flex items-center gap-2 border-b border-white/10 pb-4">
                                    <FileText className="text-amber-500" size={20} /> Textos y Políticas Generales
                                </h3>
                                <div className="space-y-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Términos y Condiciones / Reglas de la Rifa</label>
                                        <textarea
                                            value={settings.terms_and_conditions || ''}
                                            onChange={(e) => setSettings({ ...settings, terms_and_conditions: e.target.value })}
                                            placeholder="Las reglas aplicables a los sorteos organizados en esta plataforma..."
                                            className="premium-input w-full min-h-[150px] resize-y py-4 leading-relaxed"
                                        ></textarea>
                                        <p className="text-[10px] text-white/30 italic">Este texto se asocia de forma común y podrá mostrarse en las ventanas de cobro e información.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Guardar */}
                            <div className="flex justify-end pt-4">
                                <button
                                    type="submit"
                                    disabled={savingSettings}
                                    className="glow-button px-8 py-4 flex items-center gap-2"
                                >
                                    {savingSettings ? (
                                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                    ) : (
                                        <>
                                            <Save size={18} /> Guardar Configuración
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>

                        {/* Modal de éxito de Settings */}
                        <AnimatePresence>
                            {settingsSuccess && (
                                <motion.div
                                    initial={{ opacity: 0, y: 50 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 50 }}
                                    className="fixed bottom-6 right-6 glass-panel py-4 px-6 border-emerald-500/30 flex items-center gap-4 z-50 pointer-events-none"
                                >
                                    <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                                        ✓
                                    </div>
                                    <div>
                                        <h4 className="font-bold">¡Guardado Exitoso!</h4>
                                        <p className="text-white/40 text-sm">Tus ajustes se han aplicado a la plataforma.</p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Modal de error de Settings */}
                        <AnimatePresence>
                            {settingsError && (
                                <motion.div
                                    initial={{ opacity: 0, y: 50 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 50 }}
                                    className="fixed bottom-6 right-6 glass-panel py-4 px-6 border-red-500/30 flex items-center gap-4 z-50 pointer-events-none"
                                >
                                    <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center font-bold">
                                        !
                                    </div>
                                    <div>
                                        <h4 className="font-bold">Error</h4>
                                        <p className="text-white/40 text-sm">{settingsError}</p>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                )}
            </main>

            {/* Modal - Create Raffle */}
            <AnimatePresence>
                {isModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsModalOpen(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        ></motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="glass-panel p-6 sm:p-10 w-full max-w-lg relative z-10 border-primary/20 max-h-[90vh] overflow-y-auto scrollbar-hide"
                        >
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="absolute top-4 right-4 sm:top-6 sm:right-6 text-white/20 hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>

                            <div className="mb-6 sm:mb-8 mt-2 sm:mt-0">
                                <h2 className="text-2xl sm:text-3xl font-display font-black text-gradient mb-2">Nueva Rifa</h2>
                                <p className="text-white/40">Configura los parámetros iniciales de tu sorteo.</p>
                            </div>

                            <form onSubmit={handleCreateRaffle} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Nombre de la Rifa</label>
                                    <input
                                        type="text"
                                        value={newRaffle.name}
                                        onChange={(e) => setNewRaffle({ ...newRaffle, name: e.target.value })}
                                        placeholder="Ej: Sorteo de Verano 2026"
                                        className="premium-input w-full"
                                        required
                                        autoFocus
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Total de Números</label>
                                    <input
                                        type="number"
                                        value={newRaffle.total_numbers}
                                        onChange={(e) => setNewRaffle({ ...newRaffle, total_numbers: parseInt(e.target.value) })}
                                        className="premium-input w-full"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Números Reservados (Separados por coma)</label>
                                    <input
                                        type="text"
                                        value={newRaffle.reserved_numbers}
                                        onChange={(e) => setNewRaffle({ ...newRaffle, reserved_numbers: e.target.value })}
                                        placeholder="Ej: 0, 1, 2, 777"
                                        className="premium-input w-full"
                                    />
                                    <p className="text-[10px] text-white/30 ml-1">Estos números no se entregarán al azar. Ideal si no quieres que la rifa empiece desde el 0.</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Paquetes de Tickets (Opcional)</label>
                                        <button
                                            type="button"
                                            onClick={() => setNewRaffle({ ...newRaffle, ticket_bundles: [...(newRaffle.ticket_bundles || []), { id: crypto.randomUUID(), name: '', tickets: 1, price: 0 }] })}
                                            className="text-xs text-primary font-bold px-3 py-1 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
                                        >
                                            + Añadir Paquete
                                        </button>
                                    </div>
                                    {(newRaffle.ticket_bundles || []).map((bundle: any, index: number) => (
                                        <div key={bundle.id} className="flex gap-2 items-center bg-white/5 p-3 rounded-xl border border-white/10">
                                            <input type="text" placeholder="Nombre (ej: Combo x5)" value={bundle.name} onChange={(e) => {
                                                const newB = [...newRaffle.ticket_bundles];
                                                newB[index].name = e.target.value;
                                                setNewRaffle({ ...newRaffle, ticket_bundles: newB });
                                            }} className="premium-input w-[40%] text-sm py-2" required />
                                            <input type="number" placeholder="Tickets" min="1" value={bundle.tickets || ''} onChange={(e) => {
                                                const newB = [...newRaffle.ticket_bundles];
                                                newB[index].tickets = parseInt(e.target.value) || 0;
                                                setNewRaffle({ ...newRaffle, ticket_bundles: newB });
                                            }} className="premium-input w-[25%] text-sm py-2" required />
                                            <div className="relative w-[25%]">
                                                <span className="absolute left-3 top-2 text-white/40 font-mono">$</span>
                                                <input type="number" placeholder="Precio" min="0" step="0.01" value={bundle.price} onChange={(e) => {
                                                    const newB = [...newRaffle.ticket_bundles];
                                                    newB[index].price = parseFloat(e.target.value) || 0;
                                                    setNewRaffle({ ...newRaffle, ticket_bundles: newB });
                                                }} className="premium-input w-full pl-6 text-sm py-2 font-mono" required />
                                            </div>
                                            <button type="button" onClick={() => {
                                                const newB = newRaffle.ticket_bundles.filter((_, i) => i !== index);
                                                setNewRaffle({ ...newRaffle, ticket_bundles: newB });
                                            }} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg ml-auto shrink-0 transition-colors">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    {(newRaffle.ticket_bundles?.length === 0) && (
                                        <p className="text-[10px] text-white/30 ml-1 italic">Si no añades paquetes, se habilitará únicamente la participación de 1 en 1 de forma gratuita.</p>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    className="glow-button w-full mt-4"
                                    disabled={creating}
                                >
                                    {creating ? <Activity className="animate-spin" /> : <>CREAR SORTEO <Sparkles size={20} /></>}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Modal - Edit Raffle */}
            <AnimatePresence>
                {editModalOpen && editingRaffle && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setEditModalOpen(false)}
                            className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        ></motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 20 }}
                            className="glass-panel p-6 sm:p-10 w-full max-w-lg relative z-10 border-primary/20 max-h-[90vh] overflow-y-auto scrollbar-hide"
                        >
                            <button
                                onClick={() => setEditModalOpen(false)}
                                className="absolute top-4 right-4 sm:top-6 sm:right-6 text-white/20 hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>

                            <div className="mb-6 sm:mb-8 mt-2 sm:mt-0">
                                <h2 className="text-2xl sm:text-3xl font-display font-black text-gradient mb-2">Editar Rifa</h2>
                                <p className="text-white/40">ID de Rifa: {editingRaffle.id}</p>
                            </div>

                            <form onSubmit={handleUpdateRaffle} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Nombre</label>
                                    <input
                                        type="text"
                                        value={editingRaffle.name}
                                        onChange={(e) => setEditingRaffle({ ...editingRaffle, name: e.target.value })}
                                        className="premium-input w-full"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Total Tickets</label>
                                    <input
                                        type="number"
                                        value={editingRaffle.total_numbers}
                                        onChange={(e) => setEditingRaffle({ ...editingRaffle, total_numbers: parseInt(e.target.value) })}
                                        className="premium-input w-full"
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Números Reservados (Separados por coma)</label>
                                    <input
                                        type="text"
                                        value={Array.isArray(editingRaffle.reserved_numbers) ? editingRaffle.reserved_numbers.join(', ') : editingRaffle.reserved_numbers || ''}
                                        onChange={(e) => setEditingRaffle({ ...editingRaffle, reserved_numbers: e.target.value })}
                                        placeholder="Ej: 0, 1, 2, 777"
                                        className="premium-input w-full"
                                    />
                                    <p className="text-[10px] text-white/30 ml-1">Estos números no se entregarán al azar.</p>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-bold uppercase tracking-widest text-white/40 ml-1">Paquetes de Tickets</label>
                                        <button
                                            type="button"
                                            onClick={() => setEditingRaffle({ ...editingRaffle, ticket_bundles: [...(editingRaffle.ticket_bundles || []), { id: crypto.randomUUID(), name: '', tickets: 1, price: 0 }] })}
                                            className="text-xs text-primary font-bold px-3 py-1 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors"
                                        >
                                            + Añadir Paquete
                                        </button>
                                    </div>
                                    {(editingRaffle.ticket_bundles || []).map((bundle: any, index: number) => (
                                        <div key={bundle.id || index} className="flex gap-2 items-center bg-white/5 p-3 rounded-xl border border-white/10">
                                            <input type="text" placeholder="Nombre (ej: Combo)" value={bundle.name} onChange={(e) => {
                                                const newB = [...editingRaffle.ticket_bundles];
                                                newB[index].name = e.target.value;
                                                setEditingRaffle({ ...editingRaffle, ticket_bundles: newB });
                                            }} className="premium-input w-[40%] text-sm py-2" required />
                                            <input type="number" placeholder="Tickets" min="1" value={bundle.tickets || ''} onChange={(e) => {
                                                const newB = [...editingRaffle.ticket_bundles];
                                                newB[index].tickets = parseInt(e.target.value) || 0;
                                                setEditingRaffle({ ...editingRaffle, ticket_bundles: newB });
                                            }} className="premium-input w-[25%] text-sm py-2" required />
                                            <div className="relative w-[25%]">
                                                <span className="absolute left-3 top-2 text-white/40 font-mono">$</span>
                                                <input type="number" placeholder="Precio" min="0" step="0.01" value={bundle.price} onChange={(e) => {
                                                    const newB = [...editingRaffle.ticket_bundles];
                                                    newB[index].price = parseFloat(e.target.value) || 0;
                                                    setEditingRaffle({ ...editingRaffle, ticket_bundles: newB });
                                                }} className="premium-input w-full pl-6 text-sm py-2 font-mono" required />
                                            </div>
                                            <button type="button" onClick={() => {
                                                const newB = editingRaffle.ticket_bundles.filter((_: any, i: number) => i !== index);
                                                setEditingRaffle({ ...editingRaffle, ticket_bundles: newB });
                                            }} className="p-2 text-red-400 hover:bg-red-400/10 rounded-lg ml-auto shrink-0 transition-colors">
                                                <X size={16} />
                                            </button>
                                        </div>
                                    ))}
                                    {(editingRaffle.ticket_bundles?.length === 0 || !editingRaffle.ticket_bundles) && (
                                        <p className="text-[10px] text-white/30 ml-1 italic">Sin paquetes configurados.</p>
                                    )}
                                </div>

                                <div className="flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/10">
                                    <input
                                        type="checkbox"
                                        checked={editingRaffle.active}
                                        onChange={(e) => setEditingRaffle({ ...editingRaffle, active: e.target.checked })}
                                        className="w-5 h-5 rounded border-white/20 bg-black/40 text-primary"
                                    />
                                    <label className="font-bold text-sm">Rifa Activa / En Curso</label>
                                </div>
                                <p className="text-[10px] text-white/20 px-4">Desactiva esta opción si quieres marcar la rifa como Completada o Pausada.</p>

                                <button
                                    type="submit"
                                    className="glow-button w-full mt-4"
                                    disabled={creating}
                                >
                                    {creating ? <Activity className="animate-spin" /> : <>GUARDAR CAMBIOS <Sparkles size={20} /></>}
                                </button>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

function NavItem({ icon, label, active = false, onClick }: { icon: any, label: string, active?: boolean, onClick?: () => void }) {
    return (
        <motion.div
            whileHover={{ x: 4 }}
            onClick={onClick}
            className={`flex items-center gap-4 px-6 py-4 rounded-2xl cursor-pointer transition-all duration-300 group
      ${active
                    ? 'bg-primary text-white shadow-xl shadow-primary/30 font-bold'
                    : 'text-white/40 hover:bg-white/[0.03] hover:text-white'}`}
        >
            <div className={`${active ? 'text-white' : 'text-white/20 group-hover:text-primary'}`}>
                {icon}
            </div>
            <span className="tracking-tight">{label}</span>
            {active && <motion.div layoutId="nav-glow" className="ml-auto w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_10px_white]" />}
        </motion.div>
    );
}

function StatCard({ title, value, sub, icon, gradient }: { title: string, value: string, sub: string, icon: any, gradient: string }) {
    return (
        <div className={`glass-panel p-8 relative overflow-hidden group`}>
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}></div>
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                    <p className="text-white/40 text-[10px] font-black uppercase tracking-[0.2em]">{title}</p>
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5 shadow-sm">
                        {icon}
                    </div>
                </div>
                <h3 className="text-4xl font-display font-black mb-1 tabular-nums transition-transform group-hover:scale-105 duration-300">{value}</h3>
                <p className="text-xs text-white/20 font-medium">{sub}</p>
            </div>
        </div>
    );
}
