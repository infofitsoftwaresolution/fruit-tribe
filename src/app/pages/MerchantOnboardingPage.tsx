import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Briefcase, Building, CreditCard, MapPin, CheckCircle2, ChevronRight, ArrowLeft, ShieldCheck, Zap, Info, Binary } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useAuth } from '@/app/context/AuthContext';

export function MerchantOnboardingPage() {
    const navigate = useNavigate();
    const { user, updateUser } = useAuth();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        storeName: '',
        description: '',
        gstNumber: '',
        bankName: '',
        accountNumber: '',
        ifscCode: '',
        address: '',
        city: '',
        state: '',
        pincode: ''
    });

    const handleNext = () => setStep(prev => prev + 1);
    const handlePrev = () => setStep(prev => prev - 1);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const submissionData = {
            storeName: formData.storeName,
            description: formData.description,
            gstNumber: formData.gstNumber,
            bankDetails: {
                bankName: formData.bankName,
                accountNumber: formData.accountNumber,
                ifscCode: formData.ifscCode
            },
            address: {
                street: formData.address,
                city: formData.city,
                state: formData.state,
                pincode: formData.pincode
            }
        };

        toast.promise(
            new Promise((resolve) => setTimeout(resolve, 2000)),
            {
                loading: 'Saving your application...',
                success: () => {
                    updateUser({ role: 'seller' });
                    navigate('/admin/seller-dashboard');
                    return 'Seller account activated. Welcome to The Fruit Tribe.';
                },
                error: 'Something went wrong. Please try again.'
            }
        );
    };

    const steps = [
        { id: 1, title: 'Store details', icon: Building },
        { id: 2, title: 'Business info', icon: Briefcase },
        { id: 3, title: 'Bank account', icon: CreditCard },
        { id: 4, title: 'Address', icon: MapPin }
    ];

    return (
        <div className="pt-32 pb-32 min-h-screen bg-slate-50 selection:bg-emerald-500 selection:text-white relative overflow-hidden">
            {/* Background Manifold */}
            <div className="absolute top-0 right-0 h-[1000px] w-[1000px] bg-emerald-500/5 rounded-full blur-[200px]" />
            <div className="absolute bottom-0 left-0 h-[1000px] w-[1000px] bg-blue-500/5 rounded-full blur-[200px]" />

            <div className="relative z-10 max-w-4xl mx-auto px-6">
                {/* Header HUD */}
                <div className="mb-12 text-center space-y-4">
                    <div className="flex items-center justify-center gap-3">
                        <div className="p-3 bg-emerald-500 rounded-2xl shadow-2xl shadow-emerald-500/20">
                            <Zap className="h-6 w-6 text-white" />
                        </div>
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.5em]">Become a seller</span>
                    </div>
                    <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                        Merchant <br /> Onboarding
                    </h1>
                    <p className="text-slate-500 text-sm italic font-bold uppercase tracking-tight max-w-lg mx-auto">
                        Set up your seller account. We'll review your details within 24–48 hours.
                    </p>
                </div>

                {/* Progress HUD */}
                <div className="flex items-center justify-between mb-16 relative">
                    <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-200 -translate-y-1/2 rounded-full" />
                    <div
                        className="absolute top-1/2 left-0 h-1 bg-emerald-500 -translate-y-1/2 rounded-full transition-all duration-700"
                        style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}
                    />

                    {steps.map((s) => {
                        const Icon = s.icon;
                        const isActive = step >= s.id;
                        const isCurrent = step === s.id;
                        return (
                            <div key={s.id} className="relative z-10 flex flex-col items-center gap-3">
                                <div className={cn(
                                    "w-14 h-14 rounded-2xl border-2 flex items-center justify-center transition-all duration-500",
                                    isActive ? "bg-emerald-500 border-emerald-500 text-white shadow-xl shadow-emerald-500/20" : "bg-white border-slate-200 text-slate-300",
                                    isCurrent && "ring-8 ring-emerald-500/10 scale-110"
                                )}>
                                    <Icon className="h-6 w-6" />
                                </div>
                                <span className={cn(
                                    "text-[9px] font-black uppercase tracking-widest transition-colors",
                                    isActive ? "text-emerald-600" : "text-slate-400"
                                )}>{s.title}</span>
                            </div>
                        );
                    })}
                </div>

                {/* Form Matrix */}
                <motion.div
                    layout
                    className="bg-white rounded-[4rem] p-12 border border-slate-100 shadow-3xl"
                >
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                <div className="space-y-6">
                                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-4">
                                        <div className="h-8 w-1.5 bg-emerald-500 rounded-full" />
                                        Business details
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormInput
                                            label="Store name"
                                            value={formData.storeName}
                                            onChange={v => setFormData({ ...formData, storeName: v })}
                                            placeholder="e.g. Sahyadri Organic Orchards"
                                        />
                                        <FormInput
                                            label="GST number"
                                            value="PROPRIETORSHIP"
                                            readOnly
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Narrative Description</label>
                                        <textarea
                                            className="w-full h-32 px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 focus:bg-white outline-none transition-all resize-none"
                                            value={formData.description}
                                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="Document your node's biological specialization..."
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                <div className="space-y-6">
                                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-4">
                                        <div className="h-8 w-1.5 bg-blue-500 rounded-full" />
                                        Business info
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormInput
                                            label="GSTIN Identifier"
                                            value={formData.gstNumber}
                                            onChange={v => setFormData({ ...formData, gstNumber: v })}
                                            placeholder="22AAAAA0000A1Z5"
                                        />
                                        <FormInput
                                            label="PAN / Tax ID"
                                            placeholder="Enter 10-digit PAN"
                                        />
                                    </div>
                                    <div className="p-6 bg-blue-50 border border-blue-100 rounded-3xl flex gap-4">
                                        <Info className="h-6 w-6 text-blue-500 shrink-0" />
                                        <p className="text-[11px] font-bold text-blue-700 leading-relaxed uppercase tracking-tight italic">
                                            Regulatory synchronization requires verifiable GSTIN for multi-state commerce operations.
                                        </p>
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                <div className="space-y-6">
                                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-4">
                                        <div className="h-8 w-1.5 bg-purple-500 rounded-full" />
                                        Bank account
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <FormInput
                                            label="Bank name"
                                            value={formData.bankName}
                                            onChange={v => setFormData({ ...formData, bankName: v })}
                                            placeholder="e.g. HDFC Bank"
                                        />
                                        <FormInput
                                            label="Account Vector"
                                            value={formData.accountNumber}
                                            onChange={v => setFormData({ ...formData, accountNumber: v })}
                                            placeholder="Account Number"
                                        />
                                        <FormInput
                                            label="IFSC code"
                                            value={formData.ifscCode}
                                            onChange={v => setFormData({ ...formData, ifscCode: v })}
                                            placeholder="HDFC0001234"
                                        />
                                    </div>
                                </div>
                            </motion.div>
                        )}

                        {step === 4 && (
                            <motion.div
                                key="step4"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="space-y-8"
                            >
                                <div className="space-y-6">
                                    <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight flex items-center gap-4">
                                        <div className="h-8 w-1.5 bg-orange-500 rounded-full" />
                                        Address
                                    </h2>
                                    <div className="space-y-6">
                                        <FormInput
                                            label="Dispatch Address"
                                            value={formData.address}
                                            onChange={v => setFormData({ ...formData, address: v })}
                                            placeholder="Orchard Street, Plot 42"
                                        />
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                                            <FormInput
                                                label="City"
                                                value={formData.city}
                                                onChange={v => setFormData({ ...formData, city: v })}
                                            />
                                            <FormInput
                                                label="State"
                                                value={formData.state}
                                                onChange={v => setFormData({ ...formData, state: v })}
                                            />
                                            <FormInput
                                                label="Pin Identifier"
                                                value={formData.pincode}
                                                onChange={v => setFormData({ ...formData, pincode: v })}
                                            />
                                        </div>
                                    </div>
                                    <div className="p-8 bg-emerald-50 border border-emerald-100 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-8">
                                        <div className="space-y-2 text-center md:text-left">
                                            <h4 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Final Verification</h4>
                                            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Authorize network integration protocol.</p>
                                        </div>
                                        <ShieldCheck className="h-12 w-12 text-emerald-500" />
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Navigation HUD */}
                    <div className="mt-16 flex items-center justify-between gap-6 pt-10 border-t border-slate-50">
                        {step > 1 ? (
                            <button
                                type="button"
                                onClick={handlePrev}
                                className="h-16 px-10 rounded-[2rem] border border-slate-200 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all flex items-center gap-3"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Return
                            </button>
                        ) : (
                            <div />
                        )}

                        {step < 4 ? (
                            <button
                                type="button"
                                onClick={handleNext}
                                className="h-16 px-10 rounded-[2rem] bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-900/10 flex items-center gap-3"
                            >
                                Next step
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSubmit}
                                className="h-16 px-12 rounded-[2rem] bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 flex items-center gap-3"
                            >
                                Submit application
                                <Zap className="h-4 w-4" />
                            </button>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

function FormInput({ label, value, onChange, placeholder, readOnly }: {
    label: string;
    value?: string;
    onChange?: (v: string) => void;
    placeholder?: string;
    readOnly?: boolean;
}) {
    return (
        <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
            <input
                type="text"
                readOnly={readOnly}
                value={value}
                onChange={e => onChange?.(e.target.value)}
                className={cn(
                    "w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-medium focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 focus:bg-white outline-none transition-all shadow-sm",
                    readOnly && "opacity-50 cursor-not-allowed"
                )}
                placeholder={placeholder}
            />
        </div>
    );
}
