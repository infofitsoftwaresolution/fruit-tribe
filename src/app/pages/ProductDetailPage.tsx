import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Heart, Star, Minus, Plus, Truck, Shield, ShieldCheck, Check, Clock, Zap, Leaf, Activity, ChevronRight, Share2, Info, TrendingUp, Calendar, Binary } from 'lucide-react';
import { useStore } from '@/app/context/StoreContext';
import { useAuth } from '@/app/context/AuthContext';
import { useProduct } from '@/app/hooks/useProducts';
import type { Product } from '@/lib/api';
import { toast } from 'sonner';
import { NotFoundPage } from './NotFoundPage';
import { AIRecommendations } from '@/app/components/AIRecommendations';
import { cn, getRoundedClass } from '@/lib/utils';

interface ProductDetailPageProps {
  onAddToCart: (product: Product) => void;
}

export function ProductDetailPage({ onAddToCart }: ProductDetailPageProps) {
  const { theme } = useStore();
  const { user } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { product: apiProduct, loading, error } = useProduct(id || null);
  const [quantity, setQuantity] = useState(1);
  const [isLiked, setIsLiked] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);
  const [activeVariant, setActiveVariant] = useState<string | null>(null);

  const productId = id || '';

  const handleAction = (callback: () => void) => {
    if (!user) {
      toast.error('Please sign in', {
        description: 'You need to sign in to add items to your cart.',
        action: {
          label: 'Sign in',
          onClick: () => navigate('/login')
        }
      });
      return;
    }
    callback();
  };

  const product = useMemo(() => {
    if (!apiProduct) return null;

    const variantData = activeVariant && apiProduct.variants
      ? apiProduct.variants.find(v => v.sku === activeVariant)
      : null;

    return {
      ...apiProduct,
      price: variantData ? variantData.price : apiProduct.price,
      stock: variantData ? variantData.stock : apiProduct.stock,
      sku: variantData ? variantData.sku : apiProduct.sku,
      fullDescription: apiProduct.description || `Fresh ${apiProduct.name} from our partners. Sourced with care by ${apiProduct.vendor}.`,
      rating: 4.9,
      reviews: 512,
      origin: apiProduct.origin || 'Trusted orchard',
      highlights: [
        'Organic when available',
        'Direct from source',
        'Pesticide-free growing',
        'Harvested at peak season'
      ],
      nutrition: {
        calories: 64,
        carbs: '14.2g',
        fiber: '2.4g',
        vitaminC: '22%',
        bioDensity: 'High'
      }
    };
  }, [apiProduct, activeVariant]);

  useEffect(() => {
    if (product && !activeImage) {
      setActiveImage(product.image || (product.images && product.images[0]) || null);
    }
  }, [product, activeImage]);

  if (loading) {
    return (
      <div className="pt-32 pb-32 min-h-screen flex items-center justify-center">
        <p className="text-slate-500 font-bold uppercase tracking-widest">Loading product…</p>
      </div>
    );
  }
  if (error || !product) {
    return <NotFoundPage />;
  }

  const handleAddToCart = () => {
    handleAction(() => {
      const safeQty = Math.max(1, Math.min(quantity, product.stock || quantity));
      for (let i = 0; i < safeQty; i++) {
        onAddToCart(product);
      }
      toast.success(`${product.name} added to cart!`, {
        description: `Quantity: ${safeQty}. ${activeVariant ? 'Variant selected' : 'Standard product'}.`,
        icon: <Zap className="w-4 h-4 text-emerald-500" />
      });
    });
  };

  const images = [
    product.image,
    ...(product.images || [])
  ].filter(Boolean) as string[];

  return (
    <div className="pt-32 pb-32 min-h-screen bg-white selection:bg-emerald-500 selection:text-white">
      {/* Background Architectural Manifold */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-30">
        <div className="absolute top-0 right-0 h-[1000px] w-[1000px] bg-emerald-500/5 rounded-full blur-[200px]" />
        <div className="absolute bottom-0 left-0 h-[1000px] w-[1000px] bg-slate-900/5 rounded-full blur-[200px]" />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12">
        {/* Breadcrumb HUD */}
        <nav className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-12">
          <Link to="/" className="hover:text-emerald-600 transition-colors flex items-center gap-2">
            Home <ChevronRight className="w-3 h-3" />
          </Link>
          <Link to="/products" className="hover:text-emerald-600 transition-colors flex items-center gap-2">
            Catalog <ChevronRight className="w-3 h-3" />
          </Link>
          <span className="text-slate-900 truncate">{product.name}</span>
        </nav>

        <div className="grid lg:grid-cols-12 gap-16 relative">
          {/* Visual Asset Manifold */}
          <div className="lg:col-span-12 xl:col-span-7 space-y-6">
            <div className="flex flex-col xl:flex-row gap-6">
              {/* Image Thumbnails Rail */}
              <div className="flex xl:flex-col gap-4 overflow-x-auto xl:overflow-y-auto no-scrollbar max-h-[700px] pb-4 xl:pb-0">
                {images.map((img, idx) => (
                  <motion.button
                    key={idx}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setActiveImage(img)}
                    className={cn(
                      "relative w-24 h-24 rounded-3xl overflow-hidden border-2 transition-all p-2 bg-white shrink-0",
                      activeImage === img ? "border-emerald-500 shadow-xl" : "border-slate-100 hover:border-slate-300"
                    )}
                  >
                    <img src={img} className="w-full h-full object-cover rounded-2xl" />
                  </motion.button>
                ))}
              </div>

              {/* Primary Visual Feed — image fills whole card */}
              <div className="flex-1 relative aspect-square xl:aspect-auto xl:h-[700px] rounded-[4rem] overflow-hidden bg-slate-100 border border-slate-100 group shadow-2xl">
                <AnimatePresence mode="wait">
                  <motion.img
                    key={activeImage}
                    initial={{ opacity: 0, scale: 1.05 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.6 }}
                    src={activeImage || ''}
                    alt={product.name}
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000"
                  />
                </AnimatePresence>

                {/* Status Overlays */}
                <div className="absolute top-10 left-10 flex flex-col gap-3">
                  {product.badge && (
                    <div className="px-6 py-2.5 bg-slate-900 text-white text-[9px] font-black rounded-2xl uppercase tracking-[0.3em] shadow-2xl border border-white/10 flex items-center gap-2">
                      <Zap className="w-3 h-3 text-emerald-500" />
                      {product.badge}
                    </div>
                  )}
                  {product.isSeasonal && (
                    <div className="px-6 py-2.5 bg-blue-600 text-white text-[9px] font-black rounded-2xl uppercase tracking-[0.3em] shadow-2xl border border-white/10 flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      Seasonal pick
                    </div>
                  )}
                </div>

                <div className="absolute bottom-10 right-10 flex gap-4">
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: -12 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => handleAction(() => setIsLiked(!isLiked))}
                    className={cn(
                      "p-5 rounded-[1.5rem] shadow-2xl backdrop-blur-xl border border-white/20 transition-all",
                      isLiked ? "bg-red-500 text-white" : "bg-white/80 text-slate-400 hover:text-red-500"
                    )}
                  >
                    <Heart className={cn("w-6 h-6", isLiked && "fill-current")} />
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.1, rotate: 12 }}
                    className="p-5 bg-white/80 backdrop-blur-xl rounded-[1.5rem] shadow-2xl border border-white/20 text-slate-400 hover:text-blue-500 transition-all"
                  >
                    <Share2 className="w-6 h-6" />
                  </motion.button>
                </div>
              </div>
            </div>
          </div>

          {/* Asset Intelligence Content */}
          <div className="lg:col-span-12 xl:col-span-5 flex flex-col gap-10">
            {/* Product header */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="px-4 py-1.5 bg-emerald-50 text-emerald-700 text-[10px] font-black uppercase tracking-widest rounded-xl border border-emerald-100">
                    {product.category}
                  </span>
                  <div className="px-3 py-1.5 bg-slate-900 border border-white/10 rounded-xl text-[9px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3" />
                    Verified seller
                  </div>
                  {product.isOrganic && (
                    <span className="px-4 py-1.5 bg-sky-50 text-sky-600 text-[10px] font-black uppercase tracking-widest rounded-xl border border-sky-100">
                      Organic
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[9px] font-black text-slate-300 uppercase tracking-widest">
                  <Binary className="w-4 h-4" />
                  SKU: {product.sku}
                </div>
              </div>

              <h1 className="text-5xl md:text-7xl font-black text-slate-900 leading-none tracking-tighter uppercase">
                {product.name}
              </h1>

              {/* Multi-Scalar Variant Selector */}
              {product.variants && product.variants.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Binary className="w-4 h-4 text-emerald-500" />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Configuration Matrix</span>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setActiveVariant(null)}
                      className={cn(
                        "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all",
                        activeVariant === null ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-400 border-slate-100 hover:border-slate-300"
                      )}
                    >
                      Base Model
                    </button>
                    {product.variants.map((variant: any) => (
                      <button
                        key={variant.sku}
                        onClick={() => setActiveVariant(variant.sku)}
                        className={cn(
                          "px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all",
                          activeVariant === variant.sku ? "bg-emerald-500 text-white border-emerald-500" : "bg-white text-slate-400 border-slate-100 hover:border-slate-300"
                        )}
                      >
                        {variant.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center flex-wrap gap-6 pt-2">
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-amber-400 text-white px-3 py-1.5 rounded-xl text-sm font-black shadow-lg shadow-amber-400/20">
                    {product.rating} <Star className="w-4 h-4 fill-white ml-2" />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {product.reviews} Verification Cycles
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest">Provider:</p>
                  <p className="text-[10px] text-emerald-600 font-black uppercase tracking-[0.25em] bg-emerald-50 px-3 py-1 rounded-lg">{product.vendor}</p>
                </div>
              </div>
            </div>

            {/* Commercial Calibration HUD */}
            <div className="bg-slate-900 rounded-[3rem] p-10 border border-white/10 shadow-3xl space-y-10 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <Activity className="h-20 w-20 text-emerald-500" />
              </div>

              <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-8">
                <div className="space-y-2">
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black text-white tracking-tighter">₹{product.price}</span>
                    <span className="text-emerald-500/60 font-black uppercase text-xs tracking-[0.2em] italic">/ {product.unit || 'kg'}</span>
                  </div>
                  {product.discountPrice && (
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 line-through text-lg font-bold">₹{product.discountPrice}</span>
                      <span className="text-emerald-400 font-black text-xs uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">
                        VALUATION OFFSET: {Math.round((1 - product.price / product.discountPrice) * 100)}%
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Yield Availability</span>
                  <div className={cn(
                    "flex items-center gap-3 py-2 px-5 rounded-2xl border",
                    product.stock <= 0 ? "bg-red-500/10 border-red-500/20 text-red-500" : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                  )}>
                    <div className={cn("h-2.5 w-2.5 rounded-full", product.stock <= 0 ? "bg-red-500" : "bg-emerald-500 animate-pulse")}></div>
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {product.stock <= 0 ? 'Out of stock' : (product.stock < 10 ? `Only ${product.stock} left` : 'In stock')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Bulk / quantity */}
              {product.bulkDiscountQty && product.bulkDiscountPrice && (
                <div className="relative z-10 p-6 bg-white/5 border border-white/10 rounded-3xl space-y-4">
                  <div className="flex items-center gap-3">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    <span className="text-[10px] font-black text-white uppercase tracking-widest">Wholesale Acquisition Signal</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Target Calibration</p>
                      <p className="text-xl font-black text-emerald-400 tracking-tighter">₹{product.bulkDiscountPrice} <span className="text-[10px]">/ unit</span></p>
                    </div>
                    <div className="h-10 w-[1px] bg-white/10" />
                    <div className="space-y-1 text-right">
                      <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest italic">Threshold</p>
                      <p className="text-xl font-black text-white tracking-tighter">{product.bulkDiscountQty}+ <span className="text-[10px]">units</span></p>
                    </div>
                  </div>
                </div>
              )}

              <div className="relative z-10 space-y-6 pt-4 border-t border-white/5">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className={cn(
                    "flex-1 flex items-center justify-between gap-4 rounded-[1.75rem] p-3 h-16 bg-white/5 border border-white/10",
                    product.stock <= 0 && "opacity-30 pointer-events-none"
                  )}>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-white text-slate-900 font-black shadow-xl"
                    >
                      <Minus className="w-3 h-3" />
                    </motion.button>
                    <span className="text-xl font-black text-white w-8 text-center">{product.stock <= 0 ? 0 : quantity}</span>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                      disabled={quantity >= product.stock}
                      className="w-10 h-10 flex items-center justify-center rounded-xl bg-white text-slate-900 font-black shadow-xl disabled:opacity-30"
                    >
                      <Plus className="w-3 h-3" />
                    </motion.button>
                  </div>

                  <motion.button
                    whileHover={{ scale: product.stock <= 0 ? 1 : 1.05 }}
                    whileTap={{ scale: product.stock <= 0 ? 1 : 0.95 }}
                    onClick={product.stock <= 0 ? undefined : handleAddToCart}
                    disabled={product.stock <= 0}
                    className={cn(
                      "flex-[2] h-16 rounded-[1.75rem] font-black text-[10px] uppercase tracking-[0.3em] shadow-2xl flex items-center justify-center gap-4 transition-all",
                      product.stock <= 0
                        ? "bg-white/5 text-slate-500 cursor-not-allowed border border-white/5"
                        : "bg-emerald-500 text-slate-900 hover:bg-white hover:text-slate-950"
                    )}
                  >
                    <Zap className="w-5 h-5 flex-shrink-0" />
                    {product.stock <= 0 ? 'Out of stock' : 'Add to cart'}
                  </motion.button>
                </div>
              </div>
            </div>

            {/* AI Freshness Radar */}
            <div className="p-8 bg-emerald-50 border border-emerald-100 rounded-[2.5rem] relative overflow-hidden group">
              <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:rotate-12 transition-transform duration-1000">
                <Zap className="w-32 h-32 text-emerald-900" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                    <Binary className="w-4 h-4 text-emerald-600" />
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Freshness</span>
                  </div>
                  <div className="px-3 py-1 bg-white rounded-lg text-[9px] font-black text-emerald-700 uppercase tracking-widest border border-emerald-100">AI Predicted</div>
                </div>

                <div className="flex items-end gap-6 mb-8">
                  <div>
                    <p className="text-5xl font-black text-emerald-900 tracking-tighter">98%</p>
                    <p className="text-[9px] font-black text-emerald-600/60 uppercase tracking-widest">Stability Index</p>
                  </div>
                  <div className="flex-1 pb-2">
                    <div className="h-1.5 w-full bg-emerald-200/50 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: '98%' }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        className="h-full bg-emerald-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-emerald-600/40 uppercase tracking-widest">Time to peak</p>
                    <p className="text-xs font-black text-emerald-900 uppercase">24.5 Hours</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-emerald-600/40 uppercase tracking-widest">Vial Integrity</p>
                    <p className="text-xs font-black text-emerald-900 uppercase">Ultra-Stable</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Product details */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-orange-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Harvest Registry</span>
                </div>
                <div>
                  <p className="text-xl font-black text-slate-900 uppercase tracking-tighter">
                    {product.harvestDate ? new Date(product.harvestDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Live Daily'}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">T-Minus preservation: Locked</p>
                </div>
              </div>
              <div className="p-6 bg-slate-50 border border-slate-100 rounded-[2rem] flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Storage</span>
                </div>
                <div>
                  <p className="text-xl font-black text-slate-900 uppercase tracking-tighter">
                    {product.expiryDate ? new Date(product.expiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Peak Alpha'}
                  </p>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1 italic">Optimal Bio-Utility</p>
                </div>
              </div>
            </div>

            {/* Detailed Integrity Blocks */}
            <div className="space-y-8">
              <div className="flex border-b border-slate-100">
                {['Bio-Analysis', 'Integrity', 'Narrative'].map((tab) => (
                  <button
                    key={tab}
                    className={cn(
                      "pb-6 px-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative",
                      tab === 'Bio-Analysis' ? "text-slate-900" : "text-slate-300 hover:text-slate-600"
                    )}
                  >
                    {tab}
                    {tab === 'Bio-Analysis' && (
                      <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-1 bg-emerald-500 rounded-full" />
                    )}
                  </button>
                ))}
              </div>

              <div className="space-y-8">
                <p className="text-slate-500 text-sm leading-relaxed font-bold italic uppercase tracking-tight">
                  {product.fullDescription}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {product.highlights?.map((highlight, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-5 bg-white border border-slate-100 rounded-3xl shadow-sm">
                      <div className="h-8 w-8 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
                        <Shield className="w-4 h-4" />
                      </div>
                      <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">{highlight}</span>
                    </div>
                  ))}
                </div>

                {/* Bio-Diagnostics Grid */}
                <div className="p-10 bg-slate-50 rounded-[3rem] border border-slate-100 space-y-8">
                  <div className="flex items-center gap-3">
                    <Activity className="h-4 w-4 text-emerald-500" />
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Bio-Diagnostic Core Metrics</h4>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                    {Object.entries(product.nutrition).map(([key, val], i) => (
                      <div key={i} className="space-y-1">
                        <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{key}</p>
                        <p className="text-lg font-black text-slate-900 uppercase tracking-tighter">{val as string}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Global Recommendations Feed */}
        <div className="mt-40 pt-24 border-t border-slate-50">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-12 mb-20">
            <div className="space-y-4">
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.5em]">Logistical Synergy</span>
              <h2 className="text-4xl md:text-6xl font-black text-slate-900 uppercase tracking-tighter leading-none">Complimentary <br /> Assets</h2>
            </div>
            <Link to="/products" className="group flex items-center gap-6">
              <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">View all products</span>
              <div className="h-16 w-16 bg-slate-900 rounded-[1.75rem] flex items-center justify-center text-white group-hover:bg-emerald-500 group-hover:rotate-12 transition-all shadow-2xl">
                <ArrowRight className="h-6 w-6" />
              </div>
            </Link>
          </div>
          <AIRecommendations currentProductId={productId as any} limit={3} />
        </div>
      </div>
    </div>
  );
}

// Fixed ArrowRight missing in imports
const ArrowRight = ({ className }: { className?: string }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
  </svg>
);
