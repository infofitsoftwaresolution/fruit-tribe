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
        toast.success('Store preferences saved');
    };

    return (
        <div className="space-y-6 pb-20 max-w-5xl">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Terminal className="w-4 h-4 text-emerald-600" />
                        <span className="admin-section-label">Preferences</span>
                    </div>
                    <h1 className="admin-page-title">Preferences</h1>
                    <p className="admin-page-subtitle">Configure search engine settings (SEO), social media sharing images, and analytics integrations.</p>
                </div>
                <div className="flex gap-2.5">
                    <button
                        onClick={() => { setFormData(preferences); setIsDirty(false); }}
                        disabled={!isDirty}
                        className="admin-btn-secondary"
                    >
                        Reset Changes
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!isDirty}
                        className="admin-btn-primary"
                    >
                        <Zap className="h-4 w-4" />
                        Save Preferences
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column: Form Controls */}
                <div className="lg:col-span-2 space-y-6">
                    {/* SEO Card */}
                    <div className="admin-card">
                        <div className="admin-card-header bg-slate-50">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 rounded bg-slate-100 text-slate-700">
                                    <Globe className="h-4.5 w-4.5" />
                                </div>
                                <h3 className="text-xs font-semibold text-slate-900">Search Engine Optimization (SEO)</h3>
                            </div>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-medium text-slate-600">Homepage Title</label>
                                    <span className={cn(
                                        "text-[10px] font-semibold px-2 py-0.5 rounded border",
                                        formData.homepageTitle.length > 70 ? 'bg-red-50 text-red-700 border-red-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                    )}>
                                        {formData.homepageTitle.length} / 70 characters
                                    </span>
                                </div>
                                <input
                                    name="homepageTitle"
                                    value={formData.homepageTitle || ''}
                                    onChange={handleChange}
                                    className="admin-input"
                                    placeholder="Enter page title for search engines"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-medium text-slate-600">Meta Description</label>
                                    <span className={cn(
                                        "text-[10px] font-semibold px-2 py-0.5 rounded border",
                                        formData.homepageMetaDescription.length > 160 ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                    )}>
                                        {formData.homepageMetaDescription.length} / 320 characters
                                    </span>
                                </div>
                                <textarea
                                    name="homepageMetaDescription"
                                    rows={5}
                                    value={formData.homepageMetaDescription || ''}
                                    onChange={handleChange}
                                    className="admin-input h-auto py-2"
                                    placeholder="Describe your store for search engine snippets"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Social Share Image Card */}
                    <div className="admin-card">
                        <div className="admin-card-header bg-slate-50">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 rounded bg-slate-100 text-slate-700">
                                    <MessageSquare className="h-4.5 w-4.5" />
                                </div>
                                <h3 className="text-xs font-semibold text-slate-900">Social Share Image</h3>
                            </div>
                        </div>
                        <div className="p-6 flex flex-col md:flex-row gap-6 items-center">
                            <div className="w-full md:w-56 h-36 rounded-lg border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 relative shadow-sm">
                                {formData.socialShareImage ? (
                                    <img src={formData.socialShareImage} className="w-full h-full object-cover" alt="Social share preview" />
                                ) : (
                                    <ImageIcon className="h-10 w-10 text-slate-300" />
                                )}
                            </div>
                            <div className="flex-1 space-y-3 w-full">
                                <p className="text-xs text-slate-400 leading-normal">
                                    Recommended dimensions: <strong className="text-slate-700">1200 &times; 628 px</strong>. This image is displayed when your storefront URL is shared on platforms like Facebook, WhatsApp, or Twitter.
                                </p>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-600">Share Image URL</label>
                                    <input
                                        name="socialShareImage"
                                        value={formData.socialShareImage || ''}
                                        onChange={handleChange}
                                        placeholder="https://example.com/share-image.jpg"
                                        className="admin-input"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Analytics Card */}
                    <div className="admin-card">
                        <div className="admin-card-header bg-slate-50">
                            <div className="flex items-center gap-2.5">
                                <div className="p-1.5 rounded bg-slate-100 text-slate-700">
                                    <Code className="h-4.5 w-4.5" />
                                </div>
                                <h3 className="text-xs font-semibold text-slate-900">Analytics Integrations</h3>
                            </div>
                        </div>
                        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">Google Analytics (G4) Measurement ID</label>
                                <input
                                    name="googleAnalyticsId"
                                    value={formData.googleAnalyticsId || ''}
                                    onChange={handleChange}
                                    placeholder="e.g. G-XXXXXXXXXX"
                                    className="admin-input font-mono"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-medium text-slate-600">Meta Pixel ID</label>
                                <input
                                    name="facebookPixelId"
                                    value={formData.facebookPixelId || ''}
                                    onChange={handleChange}
                                    placeholder="e.g. 123456789012345"
                                    className="admin-input font-mono"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Column: Visualization HUD */}
                <div className="space-y-4">
                    {/* Google SERP Preview Card */}
                    <div className="admin-card p-5 bg-white shadow-sm border border-slate-100">
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-50">
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-blue-500" />
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Search Engine Snippet</span>
                            </div>
                            <Search className="h-3.5 w-3.5 text-slate-400" />
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <div className="h-5 w-5 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
                                    <Globe className="h-3 w-3 text-slate-400" />
                                </div>
                                <span className="text-xs text-slate-600 truncate">https://thefruittribe.com</span>
                            </div>
                            <h4 className="text-base font-semibold text-blue-800 leading-tight hover:underline cursor-pointer">
                                {formData.homepageTitle || 'The Fruit Tribe'}
                            </h4>
                            <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
                                {formData.homepageMetaDescription || 'Configure your meta description under SEO settings to display custom text in search engine results.'}
                            </p>
                        </div>
                    </div>

                    {/* Ecology System Callout */}
                    <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100/50 flex items-start gap-3">
                        <div className="h-9 w-9 bg-white rounded-lg flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-sm shrink-0">
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wider">SEO Compliance</h4>
                            <p className="text-[11px] text-emerald-700/80 leading-relaxed mt-0.5">Title tags are ideally under 60 characters and description tags under 160 characters for standard previews.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
