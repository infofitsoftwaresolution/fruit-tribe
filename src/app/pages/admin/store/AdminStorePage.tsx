import { motion } from 'framer-motion';
import { Globe, Eye, Palette, Settings, Layout, ExternalLink, Zap, Shield, Sparkles, Command } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useStore } from '@/app/context/StoreContext';
import { cn } from '@/lib/utils';

export function AdminStorePage() {
    const { theme } = useStore();

    const sections = [
        {
            title: 'Visual Identity',
            description: 'Strategic orchestration of themes, palettes, and brand aesthetics.',
            icon: Palette,
            href: '/admin/themes',
            color: 'emerald',
            badge: 'Active'
        },
        {
            title: 'Content Nodes',
            description: 'Management of high-fidelity informational pages and legal manifests.',
            icon: Layout,
            href: '/admin/pages',
            color: 'blue',
            badge: '4 Nodes'
        },
        {
            title: 'Global Meta',
            description: 'Advanced store preferences, SEO optimization, and territorial specs.',
            icon: Sparkles,
            href: '/admin/preferences',
            color: 'purple',
            badge: 'Verified'
        }
    ];

    return (
        <div className="space-y-10 pb-20">
            {/* Ultra-Premium Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Globe className="w-5 h-5 text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Curation Space</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Online Presence</h1>
                    <p className="text-slate-500 text-sm mt-1 max-w-lg italic">Strategic management of the digital storefront and brand ecosystem.</p>
                </div>
                <a
                    href="#/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-6 h-12 bg-white border border-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:shadow-xl transition-all shadow-sm"
                >
                    <Eye className="h-4 w-4" />
                    Live Preview
                    <ExternalLink className="h-3 w-3 opacity-40" />
                </a>
            </div>

            {/* Hub Sections Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {sections.map((section, index) => (
                    <motion.div
                        key={section.title}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="h-full"
                    >
                        <Link
                            to={section.href}
                            className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-[0_10px_40px_rgba(0,0,0,0.02)] hover:shadow-2xl hover:shadow-slate-200/40 transition-all h-full flex flex-col group relative overflow-hidden"
                        >
                            <div className="relative z-10 flex flex-col h-full">
                                <div className="flex items-center justify-between mb-8">
                                    <div className={cn("p-5 rounded-[1.75rem] transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 shadow-sm", `bg-${section.color}-50 text-${section.color}-600`)}>
                                        <section.icon className="h-7 w-7" />
                                    </div>
                                    <span className={cn(
                                        "px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest border shadow-sm transition-colors",
                                        `bg-${section.color}-50/50 border-${section.color}-100 text-${section.color}-700`
                                    )}>
                                        {section.badge}
                                    </span>
                                </div>
                                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2 group-hover:text-emerald-600 transition-colors">{section.title}</h3>
                                <p className="text-[11px] text-slate-400 font-bold leading-relaxed uppercase tracking-tight mb-8">{section.description}</p>

                                <div className="mt-auto flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase tracking-widest group-hover:translate-x-2 transition-transform">
                                    Access Protocol <Zap className="h-3 w-3" />
                                </div>
                            </div>

                            {/* Ambient Glow */}
                            <div className={cn("absolute -right-10 -bottom-10 w-32 h-32 blur-[40px] opacity-10 transition-all duration-700 group-hover:opacity-20 group-hover:scale-150", `bg-${section.color}-400`)} />
                        </Link>
                    </motion.div>
                ))}
            </div>

            {/* Strategic Preview HUD */}
            <div className="bg-slate-900 rounded-[3.5rem] border border-white/10 shadow-2xl shadow-slate-900/40 overflow-hidden relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/20 via-transparent to-blue-600/10 pointer-events-none" />
                <div className="p-10 border-b border-white/10 flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 flex items-center justify-center">
                            <Command className="h-6 w-6 text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-xl font-black text-white uppercase tracking-tighter">Current Deployment</h3>
                            <p className="text-[10px] font-black text-emerald-400/60 uppercase tracking-widest italic">Live Curation Stream v2.4</p>
                        </div>
                    </div>
                    <div className="hidden md:flex gap-8">
                        <div className="text-right">
                            <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Theme Identity</p>
                            <p className="text-xs font-black text-white uppercase tracking-tight">Fruit Tribe Prime</p>
                        </div>
                        <div className="text-right border-l border-white/10 pl-8">
                            <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Last Update</p>
                            <p className="text-xs font-black text-emerald-400 uppercase tracking-tight">Recently Synced</p>
                        </div>
                    </div>
                </div>

                <div className="relative h-96 w-full group-hover:scale-105 transition-transform duration-[2000ms]">
                    <img
                        src={theme.heroImage}
                        alt="Store Hero Preview"
                        className="w-full h-full object-cover opacity-30 grayscale group-hover:grayscale-0 transition-all duration-1000"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />

                    <div className="absolute inset-0 flex items-center justify-center flex-col p-12 text-center relative z-10">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="space-y-4"
                        >
                            <h2 className="text-5xl md:text-6xl font-black text-white tracking-tighter uppercase leading-none">{theme.storeName}</h2>
                            <p className="text-emerald-400/80 text-sm md:text-base font-bold max-w-xl mx-auto uppercase tracking-wide italic">{theme.heroTitle}</p>
                            <div className="pt-8">
                                <Link
                                    to="/admin/themes"
                                    className="px-10 h-14 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white hover:text-slate-900 transition-all shadow-2xl flex items-center gap-3 mx-auto w-fit active:scale-95"
                                >
                                    Refine Architecture <Zap className="h-4 w-4" />
                                </Link>
                            </div>
                        </motion.div>
                    </div>

                    {/* Hud Markers */}
                    <div className="absolute bottom-10 left-10 p-4 border border-white/10 rounded-2xl bg-white/5 backdrop-blur-md hidden xl:block">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                            <p className="text-[9px] font-black text-white uppercase tracking-widest">Global CDN Active</p>
                        </div>
                        <p className="text-[10px] text-white/30 font-mono">HASH: 0x82...EE74</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
