import { useState, useEffect } from 'react';
import { useStore, StoreContext } from '@/app/context/StoreContext';
import { Save, Type, Image as ImageIcon, Palette, Upload, Smartphone, Monitor, Globe, Lock, Zap, RefreshCcw, LayoutDashboard, Terminal, ArrowRight, ChevronRight, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { updateStoreSettings } from '@/lib/api';
import { HomePage } from '@/app/pages/HomePage';
import { AboutPage } from '@/app/pages/AboutPage';
import { LoginPage } from '@/app/pages/LoginPage';
import { SignUpPage } from '@/app/pages/SignUpPage';
import { cn } from '@/lib/utils';

// --- Premium Helper Components for the Theme Editor ---

const SectionHeader = ({ icon: Icon, title }: { icon: any, title: string }) => (
    <div className="flex items-center gap-3 pb-3 border-b border-slate-700 mb-4">
        <div className="h-9 w-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Icon className="h-4 w-4" />
        </div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
    </div>
);

const PremiumInput = ({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="space-y-1.5">
        <label className="block text-xs font-medium text-slate-400">{label}</label>
        <input
            {...props}
            className="w-full h-10 px-4 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all"
        />
    </div>
);

const PremiumTextarea = ({ label, ...props }: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
    <div className="space-y-1.5">
        <label className="block text-xs font-medium text-slate-400">{label}</label>
        <textarea
            {...props}
            rows={props.rows || 3}
            className="w-full px-4 py-3 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all resize-none"
        />
    </div>
);

const PremiumColorInput = ({ label, value, onChange, name }: { label: string, value?: string, onChange: any, name: string }) => (
    <div className="space-y-1.5">
        <label className="block text-xs font-medium text-slate-400">{label}</label>
        <div className="flex items-center gap-3 p-2 border border-slate-600 rounded-lg bg-slate-800">
            <div className="relative h-9 w-11 rounded-md overflow-hidden border border-slate-600 shrink-0">
                <input
                    type="color"
                    name={name}
                    value={value || '#000000'}
                    onChange={onChange}
                    className="absolute inset-0 w-full h-full cursor-pointer border-0 bg-transparent"
                />
            </div>
            <span className="text-xs text-slate-400 font-mono truncate">{value}</span>
        </div>
    </div>
);

const PremiumSelect = ({ label, options, ...props }: { label: string, options: string[] } & React.SelectHTMLAttributes<HTMLSelectElement>) => (
    <div className="space-y-1.5">
        <label className="block text-xs font-medium text-slate-400">{label}</label>
        <select
            {...props}
            className="w-full h-10 pl-4 pr-10 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all cursor-pointer appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2224%22%20height%3D%2224%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2394a3b8%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem] bg-[right_0.5rem_center] bg-no-repeat"
        >
            {options.map(opt => <option key={opt} value={opt} className="text-slate-900 bg-white">{opt}</option>)}
        </select>
    </div>
);

const PremiumToggle = ({ checked, onChange }: { checked?: boolean, onChange: (val: boolean) => void }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-900",
            checked ? 'bg-emerald-500' : 'bg-slate-600'
        )}
    >
        <span className={cn(
            "inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform",
            checked ? 'translate-x-6' : 'translate-x-1'
        )} />
    </button>
);

export function AdminThemeEditor() {
    const store = useStore();
    const { theme, updateTheme, setIsEditing } = store;
    const [formData, setFormData] = useState(theme);
    const [isDirty, setIsDirty] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [activePage, setActivePage] = useState<'home' | 'about' | 'login' | 'signup'>('home');
    const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
    const [sidebarTab, setSidebarTab] = useState<'content' | 'design' | 'layout'>('content');
    const [view, setView] = useState<'editor' | 'preview'>('editor');

    const handleChange = (e: any) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setIsDirty(true);
    };

    const handleImageUpload = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFormData(prev => ({ ...prev, [field]: reader.result as string }));
                setIsDirty(true);
                toast.success(`Image updated: ${field}`);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            updateTheme(formData);
            await updateStoreSettings({ theme: formData as unknown as Record<string, unknown> });
            setIsDirty(false);
            toast.success('Theme saved. Changes will persist after refresh.');
        } catch (e: any) {
            toast.error(e?.message || 'Failed to save theme');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSeasonalChange = (updates: any) => {
        setFormData(prev => ({
            ...prev,
            seasonal: {
                ...(prev.seasonal || { active: false, type: 'Summer', showEffects: true }),
                ...updates
            }
        }));
        setIsDirty(true);
    };

    const previewStore = { ...store, theme: formData };

    const renderPreviewContent = () => {
        switch (activePage) {
            case 'home': return <div className="bg-white min-h-full"><HomePage onAddToCart={() => toast.info('Preview mode: Added to cart')} /></div>;
            case 'about': return <div className="bg-white min-h-full"><AboutPage /></div>;
            case 'login': return <div className="bg-white min-h-full"><LoginPage embedded /></div>;
            case 'signup': return <div className="bg-white min-h-full"><SignUpPage embedded /></div>;
            default: return null;
        }
    };

    return (
        <div className="flex h-[calc(100vh-64px)] min-h-0 overflow-hidden bg-slate-900">
            {/* Left Panel: Theme controls - full visibility, no clip */}
            <div className={cn(
                "w-full md:w-[420px] lg:w-[440px] shrink-0 bg-slate-900 border-r border-slate-700 flex flex-col z-50 relative overflow-y-auto overflow-x-visible",
                view === 'preview' ? 'translate-x-[-100%] hidden md:flex' : 'translate-x-0 flex'
            )}>
                {/* Panel Header */}
                <div className="p-6 border-b border-slate-700 bg-slate-900/95 sticky top-0 z-20 shrink-0">
                    <div className="flex items-center justify-between gap-4 mb-6">
                        <div className="min-w-0">
                            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">Design system</p>
                            <h2 className="text-xl font-bold text-white truncate">Theme editor</h2>
                        </div>
                        <AnimatePresence mode="wait">
                            {isDirty ? (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 rounded-lg border border-amber-500/30 shrink-0"
                                >
                                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    <span className="text-xs font-medium text-amber-500">Unsaved</span>
                                </motion.div>
                            ) : (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/30 shrink-0"
                                >
                                    <Lock className="h-3.5 w-3.5 text-emerald-400" />
                                    <span className="text-xs font-medium text-emerald-400">Saved</span>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-800 rounded-xl border border-slate-700">
                        {[
                            { id: 'content', label: 'Content', icon: Terminal },
                            { id: 'design', label: 'Design', icon: Palette },
                            { id: 'layout', label: 'Layout', icon: LayoutDashboard }
                        ].map(tab => (
                            <motion.button
                                key={tab.id}
                                onClick={() => setSidebarTab(tab.id as any)}
                                className={cn(
                                    "relative flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg transition-all",
                                    sidebarTab === tab.id
                                        ? "text-slate-900 shadow-md"
                                        : "text-slate-400 hover:text-white hover:bg-slate-700"
                                )}
                                whileTap={{ scale: 0.98 }}
                            >
                                {sidebarTab === tab.id && (
                                    <motion.div
                                        layoutId="theme-editor-tab-active"
                                        className="absolute inset-0 rounded-lg bg-white"
                                        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                                    />
                                )}
                                <tab.icon className={cn("relative z-10 h-5 w-5 shrink-0", sidebarTab === tab.id ? "text-emerald-600" : "text-inherit")} />
                                <span className="relative z-10 text-[10px] font-semibold uppercase tracking-wide truncate w-full text-center">{tab.label}</span>
                                {sidebarTab === tab.id && (
                                    <motion.div layoutId="tab-underline" className="relative z-10 h-0.5 w-6 bg-emerald-500 rounded-full" />
                                )}
                            </motion.button>
                        ))}
                    </div>
                </div>

                {/* Scrollable form area - nothing clipped */}
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-6">
                    <AnimatePresence mode="wait">
                    {sidebarTab === 'content' && (
                        <motion.div
                            key="tab-content"
                            initial={{ opacity: 0, y: 12, filter: 'blur(3px)' }}
                            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, y: -8, filter: 'blur(3px)' }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                            className="space-y-12"
                        >
                            <div className="space-y-6">
                                <SectionHeader icon={Globe} title="Site identity" />
                                <div className="grid gap-5">
                                    <PremiumInput label="Store name" name="storeName" value={formData.storeName || ''} onChange={handleChange} placeholder="The Fruit Tribe" />
                                    <PremiumInput label="Announcement bar text" name="announcementBar" value={formData.announcementBar || ''} onChange={handleChange} placeholder="Free shipping on orders over ₹500" />
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Logo & favicon</label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <label className="flex h-10 items-center justify-center gap-2 px-3 bg-slate-800 border border-slate-600 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors text-sm font-medium text-slate-300">
                                                <Upload className="h-4 w-4" />
                                                Upload logo
                                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload('logoUrl')} />
                                            </label>
                                            <label className="flex h-10 items-center justify-center gap-2 px-3 bg-slate-800 border border-slate-600 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors text-sm font-medium text-slate-300">
                                                <ImageIcon className="h-4 w-4" />
                                                Upload favicon
                                                <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload('faviconUrl')} />
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <SectionHeader icon={Terminal} title="Hero section" />
                                <div className="grid gap-5">
                                    <PremiumTextarea label="Headline" name="heroTitle" value={formData.heroTitle || ''} onChange={handleChange} placeholder="Fresh from our fields" />
                                    <PremiumTextarea label="Subtitle" name="heroSubtitle" value={formData.heroSubtitle || ''} onChange={handleChange} placeholder="Hand-picked fruits delivered to your door" />
                                </div>
                            </div>

                            <div className="space-y-6">
                                <SectionHeader icon={Sparkles} title="Banner" />
                                <div className="grid gap-5">
                                    <div>
                                        <label className="block text-xs font-medium text-slate-400 mb-1.5">Banner image</label>
                                        <label className="flex h-36 flex-col items-center justify-center gap-2 bg-slate-800 border border-slate-600 rounded-xl cursor-pointer hover:border-emerald-500/50 hover:bg-slate-700/50 transition-all relative overflow-hidden">
                                            {formData.parallaxBannerImage ? (
                                                <img src={formData.parallaxBannerImage} className="absolute inset-0 w-full h-full object-cover opacity-40" alt="" />
                                            ) : null}
                                            <div className="relative z-10 flex flex-col items-center text-center px-4">
                                                <Upload className="h-6 w-6 text-emerald-400 mb-1" />
                                                <span className="text-xs font-medium text-slate-400">Click to upload</span>
                                                <p className="text-[10px] text-slate-500 mt-0.5">1920×1080 recommended</p>
                                            </div>
                                            <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload('parallaxBannerImage')} />
                                        </label>
                                    </div>
                                    <PremiumInput label="Banner title" name="parallaxTitle" value={formData.parallaxTitle || ''} onChange={handleChange} />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {sidebarTab === 'design' && (
                        <motion.div
                            key="tab-design"
                            initial={{ opacity: 0, y: 12, filter: 'blur(3px)' }}
                            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, y: -8, filter: 'blur(3px)' }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                            className="space-y-8"
                        >
                            <div className="space-y-5">
                                <SectionHeader icon={ImageIcon} title="Database image assets" />
                                <p className="text-xs text-slate-400">
                                    These values are persisted in store settings and used by live pages.
                                </p>
                                <div className="grid gap-5">
                                    {[
                                        { key: 'heroImage', label: 'Hero image URL' },
                                        { key: 'aboutPageImage', label: 'About page image URL' },
                                        { key: 'authBackgroundImage', label: 'Login & signup background image URL' },
                                        { key: 'logoUrl', label: 'Logo URL' },
                                        { key: 'faviconUrl', label: 'Favicon URL' },
                                    ].map((field) => (
                                        <div
                                            key={field.key}
                                            className="space-y-3 p-4 bg-slate-800/90 rounded-xl border border-slate-700 hover:border-slate-600 transition-colors"
                                        >
                                            <PremiumInput
                                                label={field.label}
                                                name={field.key}
                                                value={(formData as any)[field.key] || ''}
                                                onChange={handleChange}
                                                placeholder="https://..."
                                            />
                                            <div className="flex items-center gap-3">
                                                <label className="inline-flex h-10 min-w-[148px] items-center justify-center gap-2 px-3 bg-slate-900 border border-slate-600 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors text-xs font-semibold text-slate-300 whitespace-nowrap">
                                                    <Upload className="h-4 w-4" />
                                                    Upload image
                                                    <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload(field.key)} />
                                                </label>
                                                <span className="text-[11px] text-slate-500 truncate">
                                                    {(formData as any)[field.key] ? 'Image selected' : 'No image selected'}
                                                </span>
                                            </div>
                                            <div className="h-24 w-full rounded-lg border border-slate-700 bg-slate-900/60 overflow-hidden">
                                                {(formData as any)[field.key] ? (
                                                    <img
                                                        src={(formData as any)[field.key]}
                                                        alt=""
                                                        className="h-full w-full object-cover"
                                                    />
                                                ) : (
                                                    <div className="h-full w-full flex items-center justify-center text-[11px] text-slate-500">
                                                        Preview not available
                                                    </div>
                                                )}
                                            </div>
                                            {field.key === 'authBackgroundImage' ? (
                                                <p className="text-[11px] text-slate-400">
                                                    This image is used on both `Login` and `Sign up` pages.
                                                </p>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-5">
                                <SectionHeader icon={Palette} title="Colors" />
                                <div className="grid grid-cols-2 gap-5">
                                    <PremiumColorInput label="Primary" name="primaryColor" value={formData.primaryColor || '#10b981'} onChange={handleChange} />
                                    <PremiumColorInput label="Accent" name="accentColor" value={formData.accentColor || '#3b82f6'} onChange={handleChange} />
                                    <PremiumColorInput label="Hero text" name="heroTextColor" value={formData.heroTextColor || '#ffffff'} onChange={handleChange} />
                                    <PremiumColorInput label="Section titles" name="sectionTitleColor" value={formData.sectionTitleColor || '#0f172a'} onChange={handleChange} />
                                </div>
                            </div>

                            <div className="space-y-5">
                                <SectionHeader icon={Type} title="Typography" />
                                <div className="grid gap-5">
                                    <PremiumSelect label="Font" name="fontFamily" value={formData.fontFamily || 'Outfit'} onChange={handleChange} options={['Inter', 'Roboto', 'Outfit', 'Playfair Display']} />
                                    <PremiumSelect label="Button style" name="buttonStyle" value={formData.buttonStyle || 'Pill'} onChange={handleChange} options={['Rounded', 'Square', 'Pill']} />
                                </div>
                            </div>

                            <div className="p-5 bg-slate-800 rounded-xl border border-slate-700">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-semibold text-white">Seasonal theme</p>
                                        <p className="text-xs text-slate-400 mt-0.5">Auto-update by season</p>
                                    </div>
                                    <PremiumToggle checked={formData.seasonal?.active || false} onChange={(val) => handleSeasonalChange({ active: val })} />
                                </div>

                                {formData.seasonal?.active && (
                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="pt-5 mt-5 border-t border-slate-700 space-y-5">
                                        <PremiumSelect
                                            label="Season"
                                            value={formData.seasonal?.type || 'Summer'}
                                            onChange={(e) => handleSeasonalChange({ type: e.target.value })}
                                            options={['Spring', 'Summer', 'Autumn', 'Winter']}
                                        />
                                        <div className="flex items-center justify-between py-2">
                                            <span className="text-xs font-medium text-slate-400">Show seasonal effects</span>
                                            <PremiumToggle checked={formData.seasonal?.showEffects || false} onChange={(val) => handleSeasonalChange({ showEffects: val })} />
                                        </div>
                                    </motion.div>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {sidebarTab === 'layout' && (
                        <motion.div
                            key="tab-layout"
                            initial={{ opacity: 0, y: 12, filter: 'blur(3px)' }}
                            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, y: -8, filter: 'blur(3px)' }}
                            transition={{ duration: 0.22, ease: 'easeOut' }}
                            className="space-y-4"
                        >
                            <SectionHeader icon={LayoutDashboard} title="Homepage sections" />
                            <p className="text-xs text-slate-400 mb-4">Show or hide sections on the homepage.</p>
                            <div className="grid gap-3">
                                {[
                                    { id: 'showFeaturedProducts', label: 'Featured products' },
                                    { id: 'showHowItWorks', label: 'How it works' },
                                    { id: 'showSeasonalHighlights', label: 'Seasonal highlights' },
                                    { id: 'showSpecialOffers', label: 'Special offers' },
                                    { id: 'showStats', label: 'Stats' },
                                    { id: 'showNewsletter', label: 'Newsletter signup' }
                                ].map(section => (
                                    <div key={section.id} className="flex items-center justify-between p-4 bg-slate-800 border border-slate-700 rounded-lg hover:border-slate-600 transition-colors">
                                        <span className="text-sm font-medium text-white">{section.label}</span>
                                        <PremiumToggle
                                            checked={(formData as any)[section.id] !== false}
                                            onChange={(val) => setFormData(prev => ({ ...prev, [section.id]: val }))}
                                        />
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                    </AnimatePresence>
                </div>

                <div className="p-6 border-t border-slate-700 bg-slate-900 shrink-0">
                    <div className="flex gap-4 mb-6">
                        <div className="flex-1 flex flex-col gap-1 items-center justify-center p-3 bg-white/5 rounded-xl border border-white/5">
                            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Status</span>
                            <span className="text-[10px] font-bold text-white">Ready</span>
                        </div>
                        <div className="flex-1 flex flex-col gap-1 items-center justify-center p-3 bg-white/5 rounded-xl border border-white/5">
                            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Preview</span>
                            <span className="text-[10px] font-bold text-white">Live</span>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={() => setFormData(theme)}
                            disabled={!isDirty}
                            className="flex-1 h-11 bg-slate-800 border border-slate-600 rounded-lg flex items-center justify-center text-sm font-medium text-slate-400 hover:text-red-400 hover:bg-slate-700 disabled:opacity-40 transition-all"
                        >
                            Discard changes
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={!isDirty || isSaving}
                            className="flex-[2] h-11 bg-emerald-500 text-white rounded-lg flex items-center justify-center gap-2 text-sm font-semibold hover:bg-emerald-400 disabled:opacity-50 transition-all"
                        >
                            {isSaving ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            {isSaving ? 'Saving...' : 'Save changes'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Right Panel: Preview - ensure control bar is never clipped */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 bg-slate-800 relative">
                {/* Preview toolbar - responsive, nothing hidden */}
                <div className="h-16 shrink-0 bg-slate-800 border-b border-slate-700 flex flex-wrap items-center justify-between gap-4 px-4 md:px-6 py-3 z-40">
                    <div className="flex flex-wrap items-center gap-4 min-w-0">
                        <span className="text-xs font-medium text-slate-400 shrink-0">Preview</span>
                        <div className="flex bg-slate-900 p-1.5 rounded-lg border border-slate-600 shrink-0">
                            {['home', 'about', 'login', 'signup'].map(page => (
                                <button
                                    key={page}
                                    onClick={() => setActivePage(page as any)}
                                    className={cn(
                                        "px-4 py-2 text-xs font-medium rounded-md capitalize transition-all",
                                        activePage === page ? "bg-white text-slate-900" : "text-slate-400 hover:text-white hover:bg-slate-700"
                                    )}
                                >
                                    {page}
                                </button>
                            ))}
                        </div>

                        <div className="h-8 w-px bg-slate-600 shrink-0" />

                        <div className="flex p-1.5 rounded-lg border border-slate-600 bg-slate-900 shrink-0" role="group" aria-label="Device view">
                            <button
                                onClick={() => setDevice('desktop')}
                                className={cn(
                                    "p-2.5 rounded-md transition-all",
                                    device === 'desktop' ? "bg-emerald-500 text-white" : "text-slate-400 hover:text-white hover:bg-slate-700"
                                )}
                                title="Desktop view"
                            >
                                <Monitor className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => setDevice('mobile')}
                                className={cn(
                                    "p-2.5 rounded-md transition-all",
                                    device === 'mobile' ? "bg-emerald-500 text-white" : "text-slate-400 hover:text-white hover:bg-slate-700"
                                )}
                                title="Mobile view"
                            >
                                <Smartphone className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <div className="hidden sm:flex flex-col items-end border-r border-slate-600 pr-4">
                            <p className="text-xs font-medium text-slate-400">Live preview</p>
                            <p className="text-xs text-emerald-400 flex items-center gap-1.5">
                                <span className="h-1.5 w-1.5 bg-emerald-500 rounded-full animate-pulse" />
                                Up to date
                            </p>
                        </div>
                        <button
                            onClick={() => window.open('/', '_blank')}
                            className="h-10 px-4 bg-white text-slate-900 rounded-lg text-sm font-semibold hover:bg-slate-100 transition-all flex items-center gap-2 shrink-0"
                        >
                            View live site
                            <ArrowRight className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Preview area - scrollable so no content is cut off */}
                <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-4 md:p-8 flex justify-start items-start">
                    <motion.div
                        layout
                        initial={false}
                        animate={{
                            width: device === 'mobile' ? '414px' : '100%',
                            maxWidth: device === 'mobile' ? '414px' : '100%',
                            minWidth: device === 'mobile' ? undefined : 1280,
                            height: device === 'mobile' ? '896px' : 'auto',
                            minHeight: device === 'mobile' ? '896px' : 'auto',
                            scale: device === 'mobile' ? 0.9 : 1,
                        }}
                        transition={{ type: "spring", stiffness: 200, damping: 30 }}
                        className={cn(
                            "bg-white transition-all duration-1000 relative flex-shrink-0",
                            device === 'mobile'
                                ? "shadow-[0_100px_200px_rgba(0,0,0,0.8)] rounded-[4.5rem] ring-[16px] ring-slate-900 border-[8px] border-slate-800 overflow-hidden sticky top-8"
                                : "shadow-[0_100px_150px_rgba(0,0,0,0.4)] rounded-[4rem] border-8 border-slate-900/50"
                        )}
                    >
                        {/* Mobile Bezel Artifacts (IPHONE STYLE) */}
                        {device === 'mobile' && (
                            <div className="absolute top-0 inset-x-0 h-10 bg-slate-900 z-[100] flex items-center justify-between px-10">
                                <span className="text-[10px] text-white font-black">9:41</span>
                                <div className="h-5 w-32 bg-slate-950 rounded-full border border-white/5 relative overflow-hidden">
                                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-1 bg-white/10 rounded-full" />
                                </div>
                                <div className="flex gap-2">
                                    <div className="h-3 w-6 bg-emerald-500 rounded-sm" />
                                </div>
                            </div>
                        )}

                        <div className={cn(
                            "w-full min-w-0 relative",
                            device === 'mobile' ? "pt-10 overflow-y-auto overflow-x-hidden" : "rounded-3xl min-h-0"
                        )}>
                            <StoreContext.Provider value={previewStore}>
                                {renderPreviewContent()}
                            </StoreContext.Provider>
                        </div>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
