import React, { useState } from 'react';
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, Maximize2, X } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from "@/app/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

const GALLERY_IMAGES = [
  { url: '/images/hero.jpeg', alt: 'Premium Farm Selection' },
  { url: '/images/WhatsApp Image 2026-05-10 at 10.06.19 PM.jpeg', alt: 'Fresh Harvest' },
  { url: '/images/WhatsApp Image 2026-05-10 at 10.06.20 PM.jpeg', alt: 'Nature\'s Best' },
  { url: '/images/WhatsApp Image 2026-05-10 at 10.06.34 PM (1).jpeg', alt: 'Sun-ripened Fruits' },
  { url: '/images/WhatsApp Image 2026-05-10 at 10.06.34 PM (2).jpeg', alt: 'Farm Freshness' },
  { url: '/images/WhatsApp Image 2026-05-10 at 10.06.34 PM.jpeg', alt: 'Organic Quality' },
  { url: '/images/WhatsApp Image 2026-05-10 at 10.06.37 PM.jpeg', alt: 'Freshly Picked' },
  { url: '/images/WhatsApp Image 2026-05-10 at 10.06.39 PM (1).jpeg', alt: 'Golden Harvest' },
  { url: '/images/WhatsApp Image 2026-05-10 at 10.06.39 PM.jpeg', alt: 'Vibrant Flavors' },
  { url: '/images/WhatsApp Image 2026-05-10 at 10.06.40 PM.jpeg', alt: 'Healthy Living' },
  { url: '/images/WhatsApp Image 2026-05-10 at 10.06.48 PM (1).jpeg', alt: 'Fruit Basket' },
  { url: '/images/WhatsApp Image 2026-05-10 at 10.06.48 PM (2).jpeg', alt: 'Natural Sweetness' },
  { url: '/images/WhatsApp Image 2026-05-10 at 10.06.48 PM (3).jpeg', alt: 'Peak Freshness' },
  { url: '/images/WhatsApp Image 2026-05-10 at 10.06.48 PM.jpeg', alt: 'Farming Traditions' },
  { url: '/images/WhatsApp Image 2026-05-10 at 10.06.49 PM (1).jpeg', alt: 'Lush Gardens' },
  { url: '/images/WhatsApp Image 2026-05-10 at 10.06.49 PM.jpeg', alt: 'Morning Harvest' },
  { url: '/images/WhatsApp Image 2026-05-10 at 10.06.50 PM (1).jpeg', alt: 'Quality Check' },
  { url: '/images/WhatsApp Image 2026-05-10 at 10.06.50 PM (2).jpeg', alt: 'Farm Direct' },
  { url: '/images/WhatsApp Image 2026-05-10 at 10.06.50 PM.jpeg', alt: 'Purely Organic' },
  { url: '/images/WhatsApp Image 2026-05-10 at 10.06.51 PM.jpeg', alt: 'Daily Deliveries' },
  { url: '/images/WhatsApp Image 2026-05-10 at 10.06.54 PM.jpeg', alt: 'Our Pride' },
];

export function GalleryPage() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 overflow-hidden bg-slate-50 border-b border-slate-100">
        {/* Soft background elements */}
        <div className="absolute top-0 right-0 w-1/3 h-1/2 bg-emerald-50/50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-1/4 h-1/2 bg-emerald-50/30 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase tracking-[0.2em] mb-6">
              <Camera className="w-3.5 h-3.5" />
              Our Harvest Gallery
            </span>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold text-slate-900 tracking-tight leading-tight mb-8">
              Fresh From <span className="text-emerald-600">Our Farms</span>
            </h1>
            <div className="space-y-2">
              <p className="text-lg md:text-xl text-slate-600 font-medium italic">
                “Naturally Grown, Lovingly Delivered”
              </p>
              <p className="text-slate-400 text-sm md:text-base font-medium uppercase tracking-[0.1em]">
                Pure Freshness in Every Harvest
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-12 md:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ResponsiveMasonry
            columnsCountBreakPoints={{ 350: 1, 750: 2, 900: 3, 1200: 4 }}
          >
            <Masonry gutter="24px">
              {GALLERY_IMAGES.map((image, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, margin: "-50px" }}
                  transition={{ 
                    duration: 0.5, 
                    delay: (index % 4) * 0.1,
                    ease: "easeOut"
                  }}
                  className="relative group cursor-pointer overflow-hidden rounded-3xl bg-slate-100 shadow-sm hover:shadow-2xl hover:shadow-emerald-900/10 transition-all duration-500"
                  onClick={() => setSelectedImage(image.url)}
                >
                  <img
                    src={image.url}
                    alt={image.alt}
                    className="w-full h-auto object-cover transform group-hover:scale-105 transition-transform duration-1000"
                    loading="lazy"
                  />
                  
                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/10 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex flex-col justify-end p-6">
                    <motion.div 
                      initial={{ y: 20, opacity: 0 }}
                      whileHover={{ y: 0, opacity: 1 }}
                      className="flex items-center justify-between"
                    >
                      <div>
                        <p className="text-white font-bold text-sm tracking-tight">{image.alt}</p>
                        <p className="text-emerald-400 text-[10px] font-black uppercase tracking-widest mt-1">Grade A Quality</p>
                      </div>
                      <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center text-white">
                        <Maximize2 className="w-5 h-5" />
                      </div>
                    </motion.div>
                  </div>
                </motion.div>
              ))}
            </Masonry>
          </ResponsiveMasonry>
        </div>
      </section>

      {/* Lightbox / Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-[95vw] md:max-w-5xl h-[auto] max-h-[95vh] p-0 overflow-hidden bg-black/95 border-none">
          <VisuallyHidden>
            <DialogTitle>Image Preview</DialogTitle>
          </VisuallyHidden>
          <div className="relative w-full h-full flex items-center justify-center">
            <AnimatePresence mode="wait">
              {selectedImage && (
                <motion.img
                  key={selectedImage}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", damping: 25, stiffness: 300 }}
                  src={selectedImage}
                  alt="Gallery Preview"
                  className="max-w-full max-h-[90vh] object-contain"
                />
              )}
            </AnimatePresence>
            
            {/* Close Button Override */}
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute top-6 right-6 z-50 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-xl rounded-full text-white transition-all active:scale-95"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
