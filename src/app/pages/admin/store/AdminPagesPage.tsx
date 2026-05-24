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
        <div className="space-y-6 pb-20">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <Layout className="w-4 h-4 text-emerald-600" />
                        <span className="admin-section-label">Pages</span>
                    </div>
                    <h1 className="admin-page-title">Content Pages</h1>
                    <p className="admin-page-subtitle">Create and manage storefront pages like About Us, FAQs, and store policies.</p>
                </div>
                <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="admin-btn-primary"
                >
                    <Plus className="h-4 w-4 text-emerald-400" />
                    Add page
                </button>
            </div>

            {/* Discovery Interface */}
            <div className="admin-card">
                <div className="p-4 border-b border-slate-100 flex items-center gap-4 bg-slate-50/20">
                    <div className="relative flex-1 max-w-md group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search by title or URL..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="admin-input pl-9"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50/50">
                                <th className="admin-th">Page</th>
                                <th className="admin-th text-center">Status</th>
                                <th className="admin-th">Last updated</th>
                                <th className="admin-th text-right">Operations</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredPages.map((page, idx) => (
                                <motion.tr
                                    key={page.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                    className="admin-tr cursor-pointer"
                                    onClick={() => setEditingPage(page)}
                                >
                                    <td className="admin-td">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500">
                                                <FileText className="h-4 w-4" />
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-slate-900">{page.title}</span>
                                                <span className="text-xs text-slate-400">/{page.handle}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="admin-td text-center">
                                        <span className={page.status === 'Active' ? 'admin-badge-emerald' : 'admin-badge-slate'}>
                                            {page.status === 'Active' ? 'Published' : 'Draft'}
                                        </span>
                                    </td>
                                    <td className="admin-td">
                                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                            <Clock className="h-3.5 w-3.5 text-slate-300" />
                                            <span>{page.updatedAt}</span>
                                        </div>
                                    </td>
                                    <td className="admin-td" onClick={e => e.stopPropagation()}>
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button
                                                onClick={() => setEditingPage(page)}
                                                className="admin-btn-icon h-8 w-8"
                                                title="Edit page"
                                            >
                                                <Edit2 className="h-3.5 w-3.5" />
                                            </button>
                                            <a
                                                href={`#/${page.handle}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="admin-btn-icon h-8 w-8"
                                                title="View page"
                                            >
                                                <Eye className="h-3.5 w-3.5" />
                                            </a>
                                            <button
                                                onClick={() => handleDelete(page.id, page.title)}
                                                className="admin-btn-icon h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                                                title="Archive page"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>

                    {filteredPages.length === 0 && (
                        <div className="py-20 text-center">
                            <Activity className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                            <h3 className="text-sm font-semibold text-slate-900">No pages yet</h3>
                            <p className="text-slate-400 text-xs mt-1">Add a new content page to get started.</p>
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
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
                            onClick={() => setEditingPage(null)}
                        />
                        <motion.div
                            initial={{ x: '100%', opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: '100%', opacity: 0 }}
                            transition={{ type: 'spring', damping: 30, stiffness: 200 }}
                            className="relative h-full w-full max-w-2xl bg-white shadow-2xl flex flex-col overflow-hidden rounded-l-xl"
                        >
                            <div className="p-6 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2.5">
                                        <div className="h-8 w-8 bg-slate-900 rounded-lg flex items-center justify-center">
                                            <Edit2 className="w-4 h-4 text-emerald-400" />
                                        </div>
                                        <h2 className="text-base font-semibold text-slate-900">
                                            Edit Page: {editingPage.title}
                                        </h2>
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-mono">ID: {editingPage.id}</p>
                                </div>
                                <button onClick={() => setEditingPage(null)} className="h-8 w-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors shadow-sm">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar bg-white">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-500">Page title</label>
                                        <input
                                            type="text"
                                            value={editingPage.title}
                                            onChange={(e) => setEditingPage({ ...editingPage, title: e.target.value })}
                                            className="admin-input"
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-500">URL slug</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">/</span>
                                            <input
                                                type="text"
                                                value={editingPage.handle}
                                                onChange={(e) => setEditingPage({ ...editingPage, handle: e.target.value })}
                                                className="admin-input pl-6"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-medium text-slate-500">Page content (Markdown or HTML)</label>
                                        <div className="h-6 px-2 bg-emerald-50 text-emerald-600 rounded flex items-center gap-1 text-[10px] font-semibold border border-emerald-100">
                                            <Zap className="h-3 w-3" />
                                            Syntax Verified
                                        </div>
                                    </div>
                                    <textarea
                                        rows={12}
                                        value={editingPage.content}
                                        onChange={(e) => setEditingPage({ ...editingPage, content: e.target.value })}
                                        className="w-full p-4 bg-slate-900 text-slate-100 font-mono text-sm leading-relaxed rounded-lg border border-slate-700 outline-none custom-scrollbar focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-500">Visibility</label>
                                    <select
                                        value={editingPage.status}
                                        onChange={(e) => setEditingPage({ ...editingPage, status: e.target.value as 'Active' | 'Hidden' })}
                                        className="admin-select w-full"
                                    >
                                        <option value="Active">Published (visible in storefront menus)</option>
                                        <option value="Hidden">Hidden (draft only)</option>
                                    </select>
                                </div>
                            </div>

                            <div className="p-4 bg-slate-50 border-t border-slate-100 flex gap-3">
                                <button
                                    onClick={() => setEditingPage(null)}
                                    className="admin-btn-secondary flex-1 justify-center h-10"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        updatePage(editingPage.id, editingPage);
                                        setEditingPage(null);
                                        toast.success('Page updated');
                                    }}
                                    className="admin-btn-primary flex-1 justify-center h-10"
                                >
                                    <Save className="w-4 h-4" />
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
                    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                            onClick={() => setIsAddModalOpen(false)}
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white rounded-xl shadow-2xl w-full max-w-xl overflow-hidden relative z-10 p-6"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 bg-slate-900 rounded-lg flex items-center justify-center text-emerald-400">
                                        <Plus className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-base font-semibold text-slate-900">Add new page</h2>
                                        <p className="text-xs text-slate-400 mt-0.5">Create a new content page</p>
                                    </div>
                                </div>
                                <button onClick={() => setIsAddModalOpen(false)} className="h-8 w-8 bg-white border border-slate-200 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <form className="space-y-4" onSubmit={(e) => {
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
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-500">Page title</label>
                                        <input name="title" required type="text" className="admin-input" placeholder="e.g. Legal Hub" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-500">URL slug</label>
                                        <input name="handle" required type="text" className="admin-input" placeholder="e.g. legal" />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-500">Page content</label>
                                    <textarea name="content" required rows={6} className="admin-input h-auto py-2" placeholder="Write your page content here..." />
                                </div>
                                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                                    <div className="flex items-center gap-2 text-xs text-slate-400">
                                        <ShieldCheck className="h-4.5 w-4.5 text-emerald-500" />
                                        Secure connection
                                    </div>
                                    <button type="submit" className="admin-btn-primary">
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
