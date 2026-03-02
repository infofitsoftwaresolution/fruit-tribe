import { useState } from 'react';
import { useStore, StorePreferences } from '@/app/context/StoreContext';
import { Save, Globe, Info, Image as ImageIcon, MessageSquare, Code, Activity, Terminal, ShieldCheck, Zap, X, Search, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function AdminPreferencesPage() {
    const { preferences, updatePreferences } = useStore();
    const [formData, setFormData] = useState<StorePreferences>(preferences);
    const [isDirty, setIsDirty] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setIsDirty(true);
    };

    const handleSave = () => {
        updatePreferences(formData);
        setIsDirty(false);
        toast.success('Global meta-preferences synchronized');
    };

    return (
        <div className="space-y-10 pb-20 max-w-7xl mx-auto">
            {/* Command Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 sticky top-0 bg-slate-50/80 backdrop-blur-xl z-[100] py-8 border-b border-slate-100 -mx-4 px-4 lg:-mx-8 lg:px-8">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Terminal className="w-5 h-5 text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Global Meta</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Environment Config</h1>
                    <p className="text-slate-500 text-sm mt-1 max-w-lg italic">Strategic orchestration of SEO architectures, marketing pixels, and brand signals.</p>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => { setFormData(preferences); setIsDirty(false); }}
                        disabled={!isDirty}
                        className="h-12 px-6 text-[10px] font-black uppercase tracking-widest text-slate-400 bg-white border border-slate-200 rounded-2xl hover:text-slate-900 hover:shadow-lg disabled:opacity-20 transition-all"
                    >
                        Rollback Flux
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!isDirty}
                        className="flex items-center gap-3 h-12 px-8 text-[10px] font-black uppercase tracking-widest text-white bg-slate-900 rounded-2xl hover:bg-black disabled:opacity-50 shadow-xl shadow-slate-900/20 transition-all active:scale-95"
                    >
                        <Zap className="h-4 w-4 text-emerald-400" />
                        Synchronize
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Left Column: Form Controls */}
                <div className="lg:col-span-2 space-y-10">
                    {/* SEO Architecture */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-[3rem] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden"
                    >
                        <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-50/20">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 bg-slate-900 rounded-2xl flex items-center justify-center">
                                    <Globe className="h-5 w-5 text-emerald-400" />
                                </div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">SEO Discovery Protocols</h3>
                            </div>
                            <Activity className="h-5 w-5 text-emerald-500 animate-pulse" />
                        </div>
                        <div className="p-10 space-y-8">
                            <div className="p-6 bg-slate-900 rounded-3xl border-4 border-slate-50 text-[10px] font-bold text-white/60 leading-relaxed uppercase tracking-widest italic flex gap-4 items-center">
                                <Info className="h-5 w-5 text-emerald-400 shrink-0" />
                                These parameters define the Store's digital footprint across global search indices. Sub-optimal configuration may impact market penetration.
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Master Identity (Title Tag)</label>
                                    <span className={cn(
                                        "text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border",
                                        formData.homepageTitle.length > 70 ? 'bg-red-50 text-red-600 border-red-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                    )}>
                                        {formData.homepageTitle.length} / 70 CRITICAL
                                    </span>
                                </div>
                                <input
                                    name="homepageTitle"
                                    value={formData.homepageTitle || ''}
                                    onChange={handleChange}
                                    className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-slate-900 focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-300"
                                />
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Meta Manifest (Description)</label>
                                    <span className={cn(
                                        "text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg border",
                                        formData.homepageMetaDescription.length > 160 ? 'bg-amber-50 text-amber-600 border-amber-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                    )}>
                                        {formData.homepageMetaDescription.length} / 320 NODES
                                    </span>
                                </div>
                                <textarea
                                    name="homepageMetaDescription"
                                    rows={5}
                                    value={formData.homepageMetaDescription || ''}
                                    onChange={handleChange}
                                    className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[2.5rem] text-sm font-black text-slate-900 focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all resize-none placeholder:text-slate-300"
                                />
                            </div>
                        </div>
                    </motion.div>

                    {/* Social Logic */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white rounded-[3rem] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden"
                    >
                        <div className="p-8 border-b border-slate-50 flex items-center gap-4 bg-slate-50/20">
                            <div className="h-10 w-10 bg-slate-900 rounded-2xl flex items-center justify-center">
                                <MessageSquare className="h-5 w-5 text-emerald-400" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Social Propagation Asset</h3>
                        </div>
                        <div className="p-10 flex flex-col md:flex-row gap-10 items-center">
                            <div className="w-full md:w-80 h-48 bg-slate-900 rounded-[2.5rem] border-4 border-slate-50 flex items-center justify-center overflow-hidden shadow-2xl relative group">
                                {formData.socialShareImage ? (
                                    <img src={formData.socialShareImage} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-[2s]" alt="Social share" />
                                ) : (
                                    <ImageIcon className="h-12 w-12 text-slate-700" />
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
                                <div className="absolute bottom-4 left-6 flex items-center gap-2">
                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[8px] font-black text-white uppercase tracking-widest">Live Asset Stream</span>
                                </div>
                            </div>
                            <div className="flex-1 space-y-6">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide leading-relaxed">
                                    Recommended resolution: <span className="text-slate-900">1200 x 628 XPX</span>. <br />
                                    This asset is cached across global social nodes upon shared interaction.
                                </p>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Asset Uplink URL</label>
                                    <input
                                        name="socialShareImage"
                                        value={formData.socialShareImage || ''}
                                        onChange={handleChange}
                                        placeholder="Deploy visual asset URL here..."
                                        className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-slate-900 focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all"
                                    />
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Tracking IDs */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white rounded-[3rem] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden"
                    >
                        <div className="p-8 border-b border-slate-50 flex items-center gap-4 bg-slate-50/20">
                            <div className="h-10 w-10 bg-slate-900 rounded-2xl flex items-center justify-center">
                                <Code className="h-5 w-5 text-emerald-400" />
                            </div>
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Pixel Sync & Telemetry</h3>
                        </div>
                        <div className="p-10 grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Google Analytics G-Node</label>
                                <input
                                    name="googleAnalyticsId"
                                    value={formData.googleAnalyticsId || ''}
                                    onChange={handleChange}
                                    placeholder="G-UPLINK-SYNC"
                                    className="w-full h-14 px-6 bg-slate-900 text-emerald-500 border border-slate-700 rounded-2xl text-sm font-black focus:ring-8 focus:ring-emerald-500/5 outline-none transition-all placeholder:text-slate-700 font-mono"
                                />
                            </div>
                            <div className="space-y-4">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Facebook Meta Pixel</label>
                                <input
                                    name="facebookPixelId"
                                    value={formData.facebookPixelId || ''}
                                    onChange={handleChange}
                                    placeholder="NODE-PX-7741"
                                    className="w-full h-14 px-6 bg-slate-900 text-blue-400 border border-slate-700 rounded-2xl text-sm font-black focus:ring-8 focus:ring-blue-500/5 outline-none transition-all placeholder:text-slate-700 font-mono"
                                />
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Right Column: Visualization HUD */}
                <div className="space-y-8">
                    {/* Google Search Simulation */}
                    <div className="sticky top-40 space-y-8">
                        <div className="p-10 bg-slate-900 rounded-[3.5rem] border border-white/10 shadow-2xl relative overflow-hidden group">
                            <div className="flex items-center justify-between mb-8 relative z-10">
                                <div className="flex items-center gap-3">
                                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <h4 className="text-[10px] font-black text-white/40 uppercase tracking-widest">Global SERP Preview</h4>
                                </div>
                                <Search className="h-4 w-4 text-emerald-500" />
                            </div>

                            <div className="space-y-3 relative z-10">
                                <div className="flex items-center gap-2">
                                    <div className="h-5 w-5 rounded-full bg-white/10 border border-white/10 flex items-center justify-center">
                                        <Globe className="h-2.5 w-2.5 text-white/40" />
                                    </div>
                                    <span className="text-[11px] text-white/50 font-bold tracking-tight">https://thefruittribe.com</span>
                                </div>
                                <h3 className="text-2xl font-black text-emerald-400 leading-none tracking-tight group-hover:underline cursor-pointer">
                                    {formData.homepageTitle || 'The Fruit Tribe'}
                                </h3>
                                <p className="text-xs font-medium text-white/40 leading-relaxed line-clamp-3">
                                    {formData.homepageMetaDescription || 'Configuration pending... Primary meta-description required for optimal ecosystem surfacing.'}
                                </p>
                            </div>

                            {/* Decorative Grid Background */}
                            <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
                            <div className="absolute -right-20 -bottom-20 h-64 w-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none" />
                        </div>

                        {/* Ecology Sync Guard */}
                        <div className="p-8 bg-emerald-50 rounded-[2.5rem] border border-emerald-100 flex items-start gap-4">
                            <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm border border-emerald-100">
                                <ShieldCheck className="h-6 w-6" />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-[10px] font-black text-emerald-900 uppercase tracking-widest mb-1">Ecology Protocol</h4>
                                <p className="text-[11px] font-bold text-emerald-700/70 leading-relaxed uppercase">All global meta-signals are currently synchronized with the regional CDN. Performance optimal.</p>
                            </div>
                        </div>

                        {/* System Telemetry (Secondary UI) */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-6 bg-slate-100/50 rounded-3xl border border-slate-100">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Index Latency</p>
                                <p className="text-xl font-black text-slate-900 tracking-tighter uppercase">0.42ms</p>
                            </div>
                            <div className="p-6 bg-slate-100/50 rounded-3xl border border-slate-100">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">UX Health</p>
                                <p className="text-xl font-black text-slate-900 tracking-tighter uppercase">99.2%</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
