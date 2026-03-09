import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, AlertTriangle, Info, HelpCircle } from 'lucide-react';

interface BrandedModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm?: () => void;
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error' | 'confirm';
    confirmText?: string;
    cancelText?: string;
}

export default function BrandedModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    type = 'info',
    confirmText = 'Aceptar',
    cancelText = 'Cancelar'
}: BrandedModalProps) {

    const getTypeIcon = () => {
        switch (type) {
            case 'success': return <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-4 border border-emerald-500/20"><Check size={24} /></div>;
            case 'warning': return <div className="w-12 h-12 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4 border border-amber-500/20"><AlertTriangle size={24} /></div>;
            case 'error': return <div className="w-12 h-12 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mb-4 border border-red-500/20"><X size={24} /></div>;
            case 'confirm': return <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center mb-4 border border-primary/20"><HelpCircle size={24} /></div>;
            default: return <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center mb-4 border border-primary/20"><Info size={24} /></div>;
        }
    };

    const isConfirmType = type === 'confirm';

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                    ></motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="glass-panel p-8 w-full max-w-md relative z-10 border-white/10 flex flex-col items-center text-center"
                    >
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 text-white/20 hover:text-white transition-colors"
                        >
                            <X size={20} />
                        </button>

                        {getTypeIcon()}

                        <h3 className="text-2xl font-display font-black text-gradient mb-3">{title}</h3>
                        <p className="text-white/60 mb-8 whitespace-pre-wrap leading-relaxed">{message}</p>

                        <div className="flex gap-4 w-full">
                            {isConfirmType && (
                                <button
                                    onClick={onClose}
                                    className="flex-1 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all active:scale-[0.98]"
                                >
                                    {cancelText}
                                </button>
                            )}
                            <button
                                onClick={() => {
                                    if (onConfirm) onConfirm();
                                    onClose();
                                }}
                                className={`flex-1 px-6 py-4 rounded-2xl font-bold transition-all active:scale-[0.98] shadow-lg ${type === 'error' ? 'bg-red-500 shadow-red-500/20' :
                                        type === 'warning' ? 'bg-amber-500 shadow-amber-500/20' :
                                            'bg-primary shadow-primary/20'
                                    } text-white`}
                            >
                                {confirmText}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
