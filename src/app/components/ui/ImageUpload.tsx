import { useState, useRef } from 'react';
import { Upload, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { API_BASE, getImageDisplayUrl } from '@/lib/api';

interface ImageUploadProps {
    value: string[];
    onChange: (urls: string[]) => void;
    maxFiles?: number;
    label?: string;
}

export function ImageUpload({ value, onChange, maxFiles = 4, label = 'Biological Asset Uplink' }: ImageUploadProps) {
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        const formData = new FormData();
        Array.from(files).forEach((file) => {
            formData.append('files', file);
        });

        setIsUploading(true);
        try {
            const response = await fetch(`${API_BASE}/uploads/multiple`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const data = await response.json();
            const newUrls = data.map((file: { url: string }) => file.url);
            onChange([...value, ...newUrls].slice(0, maxFiles));
            toast.success('Assets synchronized successfully');
        } catch (error) {
            console.error('Upload error:', error);
            toast.error('Asset uplink failure', {
                description: 'The neural transmission was interrupted. Verify backend nexus status.'
            });
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const removeImage = (urlToRemove: string) => {
        onChange(value.filter((url) => url !== urlToRemove));
    };

    return (
        <div className="space-y-6">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                {label}
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <AnimatePresence>
                    {value.map((url, i) => (
                        <motion.div
                            key={url}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            className="relative group aspect-square rounded-3xl overflow-hidden border border-slate-100 shadow-sm"
                        >
                            <img src={getImageDisplayUrl(url)} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt={`Asset ${i}`} />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button
                                    type="button"
                                    onClick={() => removeImage(url)}
                                    className="p-2 bg-white rounded-xl text-red-500 hover:scale-110 transition-transform shadow-xl"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                {value.length < maxFiles && (
                    <motion.button
                        type="button"
                        whileHover={{ scale: 1.02, y: -2 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        className={cn(
                            "aspect-square rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300 hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-50/50 transition-all cursor-pointer",
                            isUploading && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        {isUploading ? (
                            <Loader2 className="w-8 h-8 animate-spin" />
                        ) : (
                            <>
                                <Upload className="w-8 h-8" />
                                <span className="text-[8px] font-black uppercase mt-2 tracking-widest whitespace-nowrap">Initialize Uplink</span>
                            </>
                        )}
                    </motion.button>
                )}
            </div>

            <input
                type="file"
                ref={fileInputRef}
                onChange={handleUpload}
                multiple
                accept="image/*"
                className="hidden"
            />

            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest italic">
                {value.length} / {maxFiles} assets registered in the biological buffer.
            </p>
        </div>
    );
}
