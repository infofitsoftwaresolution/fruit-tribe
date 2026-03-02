import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore, Page } from '@/app/context/StoreContext';
import { FileText, Plus, Search, MoreVertical, Edit2, Trash2, Globe, Eye, Zap, Layout, ArrowRight, X, Clock, Activity, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function AdminPagesPage() {
    const { pages, addPage, updatePage, deletePage } = useStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [editingPage, setEditingPage] = useState<Page | null>(null);

    const filteredPages = pages.filter(page =>
        page.title.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleDelete = (id: string, title: string) => {
        toast(`Archive page "${title}"?`, {
            description: "This will remove it from the public menu.",
            action: {
                label: "Archive",
                onClick: () => {
                    deletePage(id);
                    toast.success('Page archived successfully');
                }
            }
        });
    };

    return (
        <div className="space-y-10 pb-20">
            {/* Ultra-Premium Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <Layout className="w-5 h-5 text-emerald-600" />
                        <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Pages</span>
                    </div>
                    <h1 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-none">Content Pages</h1>
                    <p className="text-slate-500 text-sm mt-1 max-w-lg italic">Create and manage your store's information pages.</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="flex items-center gap-3 px-8 h-12 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-900/20 active:scale-95"
                >
                    <Plus className="h-4 w-4 text-emerald-400" />
                    Add page
                </button>
            </div>

            {/* Discovery Interface */}
            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.03)] overflow-hidden">
                <div className="p-8 border-b border-slate-50 flex items-center gap-6 bg-slate-50/20">
                    <div className="relative flex-1 group">
                        <Search className="absolute left-6 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by title or URL..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full h-14 pl-14 pr-6 bg-white border border-slate-100 rounded-2xl text-sm font-medium focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all shadow-sm"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-slate-50/50 border-b border-slate-50">
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Page</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Last updated</th>
                                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Operations</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {filteredPages.map((page, idx) => (
                                <motion.tr
                                    key={page.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="group hover:bg-slate-50/50 transition-colors cursor-pointer"
                                    onClick={() => setEditingPage(page)}
                                >
                                    <td className="px-10 py-8">
                                        <div className="flex items-center gap-5">
                                            <div className="h-14 w-14 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center font-black text-slate-600 group-hover:bg-slate-900 group-hover:text-emerald-400 transition-all duration-500 group-hover:rotate-6">
                                                <FileText className="h-6 w-6" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-base font-black text-slate-900 group-hover:text-emerald-600 transition-colors uppercase tracking-tight">{page.title}</span>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1 italic">/{page.handle}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-10 py-8 text-center">
                                        <span className={cn(
                                            "inline-flex items-center px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-widest border shadow-sm transition-all",
                                            page.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-slate-100 text-slate-400 border-slate-200'
                                        )}>
                                            {page.status === 'Active' ? 'Published' : 'Draft'}
                                        </span>
                                    </td>
                                    <td className="px-10 py-8">
                                        <div className="flex items-center gap-2">
                                            <Clock className="h-3 w-3 text-slate-300" />
                                            <span className="text-xs font-black text-slate-400 uppercase tracking-tighter">{page.updatedAt}</span>
                                        </div>
                                    </td>
                                    <td className="px-10 py-8">
                                        <div className="flex items-center justify-end gap-3" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={() => setEditingPage(page)}
                                                className="h-10 w-10 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-emerald-600 hover:shadow-lg transition-all flex items-center justify-center"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                            <a
                                                href={`#/${page.handle}`}
                                                target="_blank"
                                                className="h-10 w-10 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-blue-600 hover:shadow-lg transition-all flex items-center justify-center"
                                            >
                                                <Eye className="h-4 w-4" />
                                            </a>
                                            <button
                                                onClick={() => handleDelete(page.id, page.title)}
                                                className="h-10 w-10 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-red-600 hover:shadow-lg transition-all flex items-center justify-center"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredPages.length === 0 && (
                        <div className="py-32 text-center">
                            <Activity className="w-20 h-20 text-slate-100 mx-auto mb-6" />
                            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">No pages yet</h3>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2 max-w-xs mx-auto leading-relaxed">Add a new page to get started.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Premium Node Editor Side-Sheet */}
            {editingPage && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[120] flex justify-end">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
                            onClick={() => setEditingPage(null)}
                        />
                        <motion.div
                            initial={{ x: '100%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                            className="relative h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col overflow-hidden"
                        >
                            <div className="p-10 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 bg-slate-900 rounded-2xl flex items-center justify-center">
                                            <Edit2 className="w-5 h-5 text-emerald-400" />
                                        </div>
                                        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">
                                            Edit page: {editingPage.title}
                                        </h2>
                                    </div>
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID: {editingPage.id}</p>
                                </div>
                                <button onClick={() => setEditingPage(null)} className="p-4 bg-white border border-slate-200 rounded-3xl text-slate-300 hover:text-red-500 hover:shadow-xl transition-all">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-12 space-y-10 custom-scrollbar bg-white">
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Page title</label>
                                        <input
                                            type="text"
                                            value={editingPage.title}
                                            onChange={(e) => setEditingPage({ ...editingPage, title: e.target.value })}
                                            className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-slate-900 focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">URL slug</label>
                                        <div className="relative">
                                            <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 font-bold">/</span>
                                            <input
                                                type="text"
                                                value={editingPage.handle}
                                                onChange={(e) => setEditingPage({ ...editingPage, handle: e.target.value })}
                                                className="w-full h-14 pl-10 pr-6 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-slate-900 focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between px-1">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Page content (Markdown or HTML)</label>
                                        <div className="h-8 px-3 bg-emerald-50 text-emerald-600 rounded-lg flex items-center gap-2 text-[9px] font-black uppercase tracking-widest border border-emerald-100">
                                            <Zap className="h-3 w-3" />
                                            Syntax OK
                                        </div>
                                    </div>
                                    <div className="relative group">
                                        <textarea
                                            rows={12}
                                            value={editingPage.content}
                                            onChange={(e) => setEditingPage({ ...editingPage, content: e.target.value })}
                                            className="w-full p-8 bg-slate-900 text-emerald-400 font-mono text-sm leading-relaxed rounded-[3rem] border-4 border-slate-50 shadow-inner focus:ring-8 focus:ring-emerald-500/5 outline-none custom-scrollbar"
                                        />
                                        <div className="absolute top-4 right-8 text-[9px] font-black text-white/20 uppercase tracking-widest pointer-events-none">Content</div>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Visibility</label>
                                    <select
                                        value={editingPage.status}
                                        onChange={(e) => setEditingPage({ ...editingPage, status: e.target.value as 'Active' | 'Hidden' })}
                                        className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-slate-900 focus:ring-8 focus:ring-emerald-500/5 focus:border-emerald-500 outline-none transition-all appearance-none cursor-pointer"
                                    >
                                        <option value="Active">Published (visible to everyone)</option>
                                        <option value="Hidden">Hidden (draft only)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="p-10 bg-slate-50 border-t border-slate-100 flex gap-6">
                                <button
                                    onClick={() => setEditingPage(null)}
                                    className="flex-1 h-16 bg-white border border-slate-200 text-slate-400 rounded-3xl hover:text-slate-900 transition-all text-[10px] font-black uppercase tracking-widest"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        updatePage(editingPage.id, editingPage);
                                        setEditingPage(null);
                                        toast.success('Page updated');
                                    }}
                                    className="flex-[2] h-16 bg-slate-900 text-white rounded-[2rem] hover:bg-black text-[10px] font-black uppercase tracking-widest transition-all shadow-2xl shadow-slate-900/20 flex items-center justify-center gap-3"
                                >
                                    <Zap className="w-5 h-5 text-emerald-400" />
                                    Save changes
                                </button>
                            </div>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}

            {/* Creation Modal (Reused Logic) */}
            {isAddModalOpen && createPortal(
                <AnimatePresence>
                    <div className="fixed inset-0 z-[130] flex items-center justify-center p-8">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-xl"
                            onClick={() => setIsAddModalOpen(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-white rounded-[4rem] shadow-2xl w-full max-w-3xl overflow-hidden relative z-10 p-12"
                        >
                            <div className="flex items-center justify-between mb-10">
                                <div className="flex items-center gap-4">
                                    <div className="h-16 w-16 bg-slate-900 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-slate-900/20">
                                        <Plus className="h-8 w-8 text-emerald-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Add new page</h2>
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Create a new content page</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsAddModalOpen(false)} className="p-4 bg-slate-50 border border-slate-200 rounded-3xl text-slate-300 hover:text-red-500 transition-all">
                                    <X className="h-6 w-6" />
                                </button>
                            </div>

                            <form className="space-y-8" onSubmit={(e) => {
                                e.preventDefault();
                                const formData = new FormData(e.currentTarget);
                                addPage({
                                    title: formData.get('title') as string,
                                    handle: formData.get('handle') as string,
                                    content: formData.get('content') as string,
                                    status: formData.get('status') as 'Active' | 'Hidden'
                                });
                                setIsAddModalOpen(false);
                                toast.success('Page created');
                            }}>
                                <div className="grid grid-cols-2 gap-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Page title</label>
                                        <input name="title" required type="text" className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-slate-900" placeholder="e.g. Legal Hub" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">URL slug</label>
                                        <input name="handle" required type="text" className="w-full h-14 px-6 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black text-slate-900" placeholder="e.g. legal" />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Page content</label>
                                    <textarea name="content" required rows={6} className="w-full p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] text-sm font-black text-slate-900 transition-all focus:bg-white" placeholder="Write your page content here..." />
                                </div>
                                <div className="flex items-center justify-between pt-6 border-t border-slate-50">
                                        <div className="flex items-center gap-3">
                                            <ShieldCheck className="h-5 w-5 text-emerald-500" />
                                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Secure connection</span>
                                        </div>
                                    <button type="submit" className="px-12 h-16 bg-slate-900 text-white rounded-[2rem] text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-2xl shadow-slate-900/20 active:scale-95">
                                        Create page
                                    </button>
                                </div>
                            </form>
                        </motion.div>
                    </div>
                </AnimatePresence>,
                document.body
            )}
        </div>
    );
}
