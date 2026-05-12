import React from 'react';
import { motion } from 'framer-motion';
import { 
  Leaf, 
  ShieldCheck, 
  MapPin, 
  Heart, 
  Star, 
  ArrowRight, 
  Globe, 
  CheckCircle2,
  TreeDeciduous,
  Quote
} from 'lucide-react';
import { Link } from 'react-router-dom';

export function AboutPage() {
  return (
    <div className="bg-[#fdfcf6] min-h-screen font-outfit overflow-x-hidden">
      
      {/* ── Hero Section ── */}
      <section className="relative pt-20 pb-12 md:pt-32 md:pb-20 overflow-hidden">
        {/* Soft decorative blur */}
        <div className="absolute top-0 right-0 w-[300px] h-[300px] md:w-[400px] md:h-[400px] bg-amber-100/30 rounded-full blur-[80px] md:blur-[100px] -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[250px] h-[250px] md:w-[300px] md:h-[300px] bg-emerald-50/30 rounded-full blur-[60px] md:blur-[80px] translate-y-1/3 -translate-x-1/4 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-2xl mx-auto">
            <motion.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 text-amber-700 text-[9px] font-black uppercase tracking-[0.2em] mb-4"
            >
              <Star className="w-3 h-3 fill-amber-500" />
              The Fruit Tribe Journey
            </motion.span>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 tracking-tight leading-[1.2] mb-4"
            >
              Welcome to our <span className="text-emerald-800 italic">mango heaven</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-sm sm:text-base md:text-lg text-slate-600 leading-relaxed font-medium px-4"
            >
              Where freshness, flavor, and organic goodness come together.
            </motion.p>
          </div>
        </div>
      </section>

      {/* ── Our Story Section ── */}
      <section className="py-12 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-5 gap-10 lg:gap-16 items-center">
            
            {/* Image Column (40%) */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7 }}
              className="relative lg:col-span-2"
            >
              <div className="aspect-[4/3] sm:aspect-[3/2] lg:aspect-[4/5] max-w-sm mx-auto lg:max-w-none rounded-[1.25rem] overflow-hidden shadow-lg shadow-amber-900/5">
                <img 
                  src="/images/about.jpeg" 
                  alt="Organic Mango Orchard in Bihar" 
                  className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-1000"
                />
              </div>
              <div className="absolute -bottom-4 -right-2 bg-emerald-800 text-white p-4 rounded-[1rem] hidden md:block max-w-[180px] shadow-lg">
                <Quote className="w-4 h-4 text-amber-400 mb-2 fill-amber-400 opacity-40" />
                <p className="text-[10px] font-medium leading-relaxed italic">
                  "Naturally sweet taste, grown the way nature intended."
                </p>
              </div>
            </motion.div>

            {/* Content Column (60%) */}
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="space-y-6 lg:col-span-3"
            >
              <div className="space-y-2 text-center lg:text-left">
                <h2 className="text-[9px] font-black text-amber-600 uppercase tracking-[0.3em]">Our Journey</h2>
                <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 leading-[1.2] tracking-tight">
                  Born from a <span className="text-emerald-800">simple idea.</span>
                </h3>
              </div>
              
              <div className="space-y-4 text-slate-600 leading-relaxed text-sm md:text-base text-center lg:text-left">
                <p>
                  Our journey began with a simple idea: to make premium, farm-fresh organic mangoes easily accessible without compromising on quality. 
                </p>
                <p className="font-medium text-slate-800">
                  We work closely with local farmers in Bihar who follow sustainable, eco-friendly, and organic farming practices, supporting both the environment and farming communities.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:gap-4 pt-2 max-w-md mx-auto lg:mx-0">
                <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-100/50 hover:shadow-md hover:shadow-amber-900/5 transition-all text-center lg:text-left">
                  <Leaf className="w-5 h-5 text-amber-600 mb-2 mx-auto lg:mx-0" />
                  <p className="text-base sm:text-lg font-bold text-slate-900 mb-0.5">Organic</p>
                  <p className="text-[8px] text-amber-900/50 font-black uppercase tracking-wider">Certified Methods</p>
                </div>
                <div className="p-4 sm:p-5 rounded-2xl bg-emerald-50 border border-emerald-100/50 hover:shadow-md hover:shadow-emerald-900/5 transition-all text-center lg:text-left">
                  <MapPin className="w-5 h-5 text-emerald-700 mb-2 mx-auto lg:mx-0" />
                  <p className="text-base sm:text-lg font-bold text-slate-900 mb-0.5">Bihar</p>
                  <p className="text-[8px] text-emerald-900/50 font-black uppercase tracking-wider">Trusted Farms</p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Variety Spotlight ── */}
      <section className="py-16 md:py-24 bg-emerald-900 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/4 h-full bg-emerald-800/20 skew-x-12 translate-x-1/4 pointer-events-none" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-5 gap-10 lg:gap-16 items-center">
            
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="text-white space-y-6 lg:col-span-3 text-center lg:text-left order-2 lg:order-1"
            >
              <div className="space-y-2">
                <h2 className="text-[9px] font-black text-amber-400 uppercase tracking-[0.3em]">Primary Variety</h2>
                <h3 className="text-2xl sm:text-3xl md:text-5xl font-bold leading-tight tracking-tight">
                  The King of Fruits: <br className="hidden sm:block" />
                  <span className="text-amber-400 italic">Malda & Langra</span>
                </h3>
              </div>
              
              <div className="space-y-4 text-sm sm:text-base md:text-lg text-emerald-50/80 leading-relaxed font-light">
                <p>
                  We are passionate about bringing you the finest, hand-picked organic mangoes straight from trusted farms in Bihar to your doorstep. 
                </p>
                <p className="font-medium text-white">
                  Our primary variety — Malda/Langra — is known for its rich aroma, smooth texture, and naturally sweet taste. 
                </p>
                <p>
                  Every mango we offer is carefully selected for its quality and ripeness — grown without harmful chemicals, so you can enjoy fruit the way nature intended.
                </p>
              </div>

              <div className="pt-2 flex justify-center lg:justify-start">
                <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
                  <span className="w-1 h-1 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-[9px] font-bold uppercase tracking-[0.15em]">Seasonal Selection Available</span>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="relative lg:col-span-2 order-1 lg:order-2"
            >
              <div className="aspect-square max-w-xs sm:max-w-sm mx-auto rounded-[1.5rem] overflow-hidden border-2 border-emerald-800 shadow-xl">
                <img 
                  src="/images/WhatsApp Image 2026-05-10 at 10.06.34 PM.jpeg" 
                  alt="Premium Malda Mangoes" 
                  className="w-full h-full object-cover"
                />
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Seasonal Variety Info ── */}
      <section className="py-10 bg-[#fdfcf6] border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex flex-col md:flex-row items-center gap-5 sm:gap-6 bg-white p-6 sm:p-8 rounded-[1.5rem] shadow-md shadow-amber-900/5 text-center md:text-left"
          >
            <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 bg-amber-100 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-amber-600" />
            </div>
            <p className="text-base sm:text-lg md:text-xl font-semibold text-slate-900 leading-tight">
              While Malda/Langra remain at the heart of what we offer, we strive to bring you the best of seasonal varieties — <span className="text-emerald-800 font-bold">pure, fresh, and naturally grown.</span>
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Expansion Section ── */}
      <section className="py-16 md:py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto space-y-6"
          >
            <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto">
              <TreeDeciduous className="w-6 h-6 text-emerald-800" />
            </div>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
              Growing <span className="text-emerald-800 italic">beyond mangoes</span>
            </h2>
            <p className="text-xs sm:text-sm md:text-base text-slate-500 leading-relaxed font-medium px-4">
              As we grow, we’re excited to expand beyond mangoes and bring you a wider range of fresh, organic fruits — continuing our promise of quality, sustainability, and great taste across everything we offer.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ── Commitment & Closing ── */}
      <section className="py-16 md:py-24 relative overflow-hidden bg-[#fdfcf6]">
        <div className="absolute top-1/2 left-0 -translate-y-1/2 w-48 h-48 sm:w-64 sm:h-64 bg-amber-100/30 rounded-full blur-[60px] sm:blur-[80px] pointer-events-none" />
        <div className="absolute top-1/2 right-0 -translate-y-1/2 w-48 h-48 sm:w-64 sm:h-64 bg-emerald-100/30 rounded-full blur-[60px] sm:blur-[80px] pointer-events-none" />

        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="space-y-6 md:space-y-8"
          >
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 leading-[1.2] tracking-tight">
              A clean, wholesome taste of <br className="hidden sm:block" />
              <span className="text-amber-500 italic">summer you can trust.</span>
            </h2>
            
            <div className="space-y-4 text-xs sm:text-sm md:text-base text-slate-600 leading-relaxed font-medium max-w-xl mx-auto px-4">
              <p>
                At the heart of what we do is a commitment to organic farming, freshness, authenticity, and customer satisfaction. From orchard to your home, we ensure every mango delivers a clean, wholesome taste of summer you can trust.
              </p>
              <p className="text-slate-900 font-bold italic pt-1">
                “Thank you for choosing us to be a part of your mango experience.”
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center items-center pt-4 px-4 sm:px-0">
              <Link
                to="/products"
                className="w-full sm:w-auto h-11 md:h-12 px-8 bg-emerald-800 text-white rounded-full font-bold text-[10px] sm:text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-900 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md"
              >
                Shop Our Harvest
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/contact"
                className="w-full sm:w-auto h-11 md:h-12 px-8 bg-white text-emerald-800 border border-emerald-800/10 rounded-full font-bold text-[10px] sm:text-[11px] uppercase tracking-widest flex items-center justify-center hover:bg-slate-50 transition-all"
              >
                Get in Touch
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer-like Spacer ── */}
      <div className="h-10 md:h-12 bg-emerald-900" />

    </div>
  );
}
