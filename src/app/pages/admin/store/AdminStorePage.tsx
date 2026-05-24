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
            description: 'Manage store theme, colors, and branding.',
            icon: Palette,
            href: '/admin/themes',
            color: 'emerald',
            badge: 'Active'
        },
        {
            title: 'Pages',
            description: 'Manage pages like About, Contact, and policies.',
            icon: Layout,
            href: '/admin/pages',
            color: 'blue',
            badge: '4 Pages'
        },
        {
            title: 'Preferences',
            description: 'Manage SEO, analytics, and store-level settings.',
            icon: Sparkles,
            href: '/admin/preferences',
            color: 'purple',
            badge: 'Verified'
        }
    ];

    return (
        <div className="space-y-6 pb-20">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Globe className="w-4 h-4 text-emerald-600" />
                        <span className="admin-section-label">Storefront Configuration</span>
                    </div>
                    <h1 className="admin-page-title">Store Setup</h1>
                    <p className="admin-page-subtitle">Configure your public storefront branding, customize layout pages, and manage search engine properties.</p>
                </div>
                <a
                    href="#/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="admin-btn-secondary"
                >
                    <Eye className="h-4 w-4" />
                    Live Preview
                    <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                </a>
            </div>

            {/* Hub Sections Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {sections.map((section, index) => (
                    <motion.div
                        key={section.title}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="h-full"
                    >
                        <Link
                            to={section.href}
                            className="admin-card p-6 hover:shadow-md transition-all h-full flex flex-col justify-between group"
                        >
                            <div>
                                <div className="flex items-center justify-between mb-6">
                                    <div className={cn("p-2 rounded-lg bg-slate-50 text-slate-600 transition-all duration-300 group-hover:bg-emerald-50 group-hover:text-emerald-600")}>
                                        <section.icon className="h-5 w-5" />
                                    </div>
                                    <span className={cn(
                                        "px-2 py-0.5 rounded-full text-[10px] font-medium border",
                                        section.color === 'emerald' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' :
                                        section.color === 'blue' ? 'bg-blue-50 border-blue-100 text-blue-700' :
                                        'bg-purple-50 border-purple-100 text-purple-700'
                                    )}>
                                        {section.badge}
                                    </span>
                                </div>
                                <h3 className="text-sm font-semibold text-slate-900 mb-1 group-hover:text-emerald-600 transition-colors">{section.title}</h3>
                                <p className="text-xs text-slate-400 leading-normal mb-4">{section.description}</p>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 group-hover:translate-x-1 transition-transform">
                                Open Section <Zap className="h-3 w-3" />
                            </div>
                        </Link>
                    </motion.div>
                ))}
            </div>

            {/* Store Preview HUD */}
            <div className="admin-card overflow-hidden">
                <div className="admin-card-header bg-slate-50">
                    <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded bg-slate-100 text-slate-700">
                            <Command className="h-4.5 w-4.5" />
                        </div>
                        <div>
                            <h3 className="text-xs font-semibold text-slate-900">Current Theme Preview</h3>
                            <p className="text-[10px] text-slate-400 mt-0.5">Live configuration snapshot</p>
                        </div>
                    </div>
                    <div className="flex gap-6">
                        <div className="text-right">
                            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Active Layout</p>
                            <p className="text-xs font-semibold text-slate-700">Fruit Tribe Prime</p>
                        </div>
                        <div className="text-right border-l border-slate-200 pl-6">
                            <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Status</p>
                            <p className="text-xs font-semibold text-emerald-600">Synced &amp; Live</p>
                        </div>
                    </div>
                </div>

                <div className="relative h-80 w-full overflow-hidden">
                    <img
                        src={theme.heroImage}
                        alt="Store Hero Preview"
                        className="w-full h-full object-cover opacity-20"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/60 to-transparent" />

                    <div className="absolute inset-0 flex items-center justify-center flex-col p-6 text-center z-10">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="space-y-3"
                        >
                            <h2 className="text-3xl font-bold text-white tracking-tight leading-none">{theme.storeName}</h2>
                            <p className="text-emerald-400 text-xs font-medium max-w-md mx-auto italic">{theme.heroTitle}</p>
                            <div className="pt-4">
                                <Link
                                    to="/admin/themes"
                                    className="admin-btn-primary h-10 px-6"
                                >
                                    Customize Theme <Zap className="h-4 w-4" />
                                </Link>
                            </div>
                        </motion.div>
                    </div>

                    {/* Hud Markers */}
                    <div className="absolute bottom-6 left-6 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-white/10 backdrop-blur-md hidden sm:block">
                        <div className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <p className="text-[10px] text-white/95 font-medium">Production Environment Online</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
