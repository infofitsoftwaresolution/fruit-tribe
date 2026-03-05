import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/context/AuthContext';
import { useStore } from '@/app/context/StoreContext';
import { getOrders, getImageDisplayUrl } from '@/lib/api';
import {
  User, Mail, Phone, MapPin, LogOut, Edit2, Save, X, Leaf,
  Package, Truck, CheckCircle, Clock, ChevronRight, Box,
  Star, Zap, Calendar, Heart, ShieldCheck, Activity, Navigation, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

/** Map backend order to Profile order-history shape (includes product details per item) */
function mapApiOrderToProfileOrder(api: any, userName: string) {
  const statusMap: Record<string, string> = {
    CREATED: 'Processing',
    CONFIRMED: 'Confirmed',
    PACKED: 'Packed',
    SHIPPED: 'Shipped',
    DELIVERED: 'Delivered',
    CANCELLED: 'Cancelled',
  };
  const paymentMap: Record<string, 'Paid' | 'Pending' | 'Refunded'> = {
    PAID: 'Paid', PENDING: 'Pending', REFUNDED: 'Refunded',
  };
  const orderItems = (api.items || []).map((i: any) => {
    const imageUrl = i.product?.images?.[0]?.imageUrl ?? '';
    return {
      productId: i.productId,
      productName: i.product?.name ?? 'Product',
      imageUrl: getImageDisplayUrl(imageUrl),
      quantity: i.quantity ?? 0,
      pricePerUnit: Number(i.pricePerUnit ?? 0),
      subtotal: Number(i.subtotal ?? i.pricePerUnit * i.quantity ?? 0),
    };
  });
  const total = Number(api.payableAmount ?? api.totalAmount ?? 0);
  const platformFeeRate = 0.02; // 2% platform fee
  const platformFee = Math.round(total * platformFeeRate * 100) / 100;
  const rawStatus: string = api.status ?? 'CREATED';

  const timeline = (api.statusLogs || []).map((log: any) => {
    const raw = (log.status || '').toUpperCase();
    return {
      rawStatus: raw,
      label: statusMap[raw] || raw || 'Created',
      at: log.createdAt ? new Date(log.createdAt) : null,
      byRole: log.changedByRole || null,
      byName: log.changedByName || null,
    };
  });

  return {
    id: api.orderNumber ?? api.id,
    orderId: api.id,
    createdAt: api.createdAt,
    customer: userName,
    items: api.items?.reduce((s: number, i: any) => s + (i.quantity || 0), 0) ?? 0,
    date: api.createdAt ? new Date(api.createdAt).toLocaleDateString() : '—',
    total,
    payment: paymentMap[api.paymentStatus] || 'Pending',
    fulfillment: api.status === 'DELIVERED' ? 'Fulfilled' : 'Unfulfilled',
    status: statusMap[rawStatus] || 'Created',
    rawStatus,
    channel: 'Online Store' as const,
    itemsDetails: api.items?.map((i: any) => ({ productId: i.productId, quantity: i.quantity })) ?? [],
    orderItems,
    platformFee,
    statusTimeline: timeline,
  };
}

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, logout, updateUser } = useAuth();
  const { subscription } = useStore();
  const [apiOrders, setApiOrders] = useState<any[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [trackingOrder, setTrackingOrder] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: user?.address || '',
  });

  useEffect(() => {
    if (!user) {
      setOrdersLoading(false);
      return;
    }
    let cancelled = false;
    getOrders()
      .then((data) => {
        if (cancelled) return;
        const userName = [user.name, user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'You';
        setApiOrders((data || []).map((api: any) => mapApiOrderToProfileOrder(api, userName)));
      })
      .catch(() => { if (!cancelled) setApiOrders([]); })
      .finally(() => { if (!cancelled) setOrdersLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  const userOrders = useMemo(() => {
    if (!user) return [];
    if (ordersLoading) return [];
    return [...apiOrders].sort((a, b) => {
      const da = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return db - da;
    });
  }, [user, ordersLoading, apiOrders]);

  useEffect(() => {
    if (!user) navigate('/login');
  }, [user, navigate]);

  if (!user) {
    return null;
  }

  const handleSave = () => {
    updateUser(formData);
    setIsEditing(false);
    toast.success("Profile updated.");
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      address: user?.address ?? '',
    });
    setIsEditing(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="pt-28 pb-32 min-h-screen bg-slate-50 selection:bg-emerald-500 selection:text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Dashboard Header HUD */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-5 h-5 text-emerald-600 fill-emerald-600" />
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-[0.3em]">Your account</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter uppercase leading-[0.85]">
              {(user?.name ?? '').split(' ')[0] || 'My'}<span className="text-emerald-500">'s</span> <br /> Profile
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-6 bg-white rounded-[2rem] border border-slate-100 shadow-xl flex items-center gap-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
                <Leaf className="w-6 h-6" />
              </div>
              <div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Rewards points</p>
                <p className="text-xl font-black text-slate-900 tracking-tighter">{user.loyaltyPoints || 1250}</p>
              </div>
            </div>
            <button onClick={handleLogout} className="h-20 w-20 bg-slate-900 text-white rounded-[2rem] flex items-center justify-center hover:bg-red-500 transition-all shadow-2xl">
              <LogOut className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-10">
          {/* Left Column - Core Intel */}
          <div className="lg:col-span-4 space-y-10">
            {/* Subscription Manifold */}
            {subscription ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-emerald-600 rounded-[3.5rem] p-10 text-white shadow-3xl relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform duration-700">
                  <Zap className="w-32 h-32" />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-6">
                    <ShieldCheck className="w-4 h-4 text-emerald-200" />
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-100">Active subscription</span>
                  </div>
                  <h3 className="text-3xl font-black tracking-tighter mb-1 uppercase">{subscription.planName}</h3>
                  <p className="text-emerald-100 text-xs font-bold mb-8">Next delivery: {subscription.nextDelivery}</p>

                  <div className="grid grid-cols-2 gap-3 mb-8">
                    <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
                      <p className="text-[8px] font-black text-emerald-200 uppercase mb-1">Frequency</p>
                      <p className="text-sm font-black uppercase tracking-tighter">{subscription.frequency}</p>
                    </div>
                    <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
                      <p className="text-[8px] font-black text-emerald-200 uppercase mb-1">Items</p>
                      <p className="text-sm font-black uppercase tracking-tighter">{subscription.items.length} varieties</p>
                    </div>
                  </div>

                  <button onClick={() => navigate('/subscription')} className="w-full py-4 bg-white text-emerald-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-50 transition-all shadow-xl">
                    Manage Subscription
                  </button>
                </div>
              </motion.div>
            ) : (
              <div className="bg-white rounded-[3.5rem] p-10 border border-slate-100 shadow-2xl text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                  <Leaf className="w-10 h-10 text-slate-300" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Try a subscription?</h3>
                <p className="text-slate-500 text-sm font-medium mb-8">Get scheduled deliveries and save up to 45%.</p>
                <button onClick={() => navigate('/subscription')} className="w-full py-5 bg-slate-900 text-white rounded-[2rem] font-black text-[10px] uppercase tracking-widest hover:bg-black transition-all">
                  View subscription plans
                </button>
              </div>
            )}

            {/* Profile Manifest */}
            <div className="bg-white rounded-[3.5rem] p-10 border border-slate-100 shadow-2xl">
              <div className="flex items-center justify-between mb-10">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Profile</h3>
                <button onClick={() => setIsEditing(!isEditing)} className="p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-all">
                  <Edit2 className="w-4 h-4 text-slate-400" />
                </button>
              </div>

              <div className="space-y-6">
                {[
                  { label: 'Name', value: formData.name, name: 'name', icon: User },
                  { label: 'Email', value: formData.email, name: 'email', icon: Mail },
                  { label: 'Phone', value: formData.phone, name: 'phone', icon: Phone },
                  { label: 'Address', value: formData.address, name: 'address', icon: MapPin },
                ].map((field) => (
                  <div key={field.name} className="space-y-2">
                    <div className="flex items-center gap-2 pl-2">
                      <field.icon className="w-3 h-3 text-slate-300" />
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{field.label}</label>
                    </div>
                    {isEditing ? (
                      <input
                        type="text"
                        name={field.name}
                        value={(formData as any)[field.name]}
                        onChange={handleChange}
                        className="w-full px-5 py-3 rounded-xl border-2 border-slate-50 bg-slate-50/50 focus:bg-white focus:border-emerald-500 transition-all font-bold text-sm text-slate-900"
                      />
                    ) : (
                      <p className="text-sm font-black text-slate-900 pl-2">{field.value || 'Not set'}</p>
                    )}
                  </div>
                ))}
              </div>

              {isEditing && (
                <div className="grid grid-cols-2 gap-4 mt-10">
                  <button onClick={handleSave} className="py-4 bg-emerald-600 text-white rounded-2xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-emerald-600/20">Save</button>
                  <button onClick={handleCancel} className="py-4 bg-slate-100 text-slate-500 rounded-2xl font-black text-[9px] uppercase tracking-widest">Cancel</button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Logistics & Reviews */}
          <div className="lg:col-span-8 space-y-10">
            {/* Operational Registry (Orders) */}
            <div className="bg-white rounded-[4rem] p-10 border border-slate-100 shadow-2xl">
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Order history</h2>
                <div className="px-4 py-2 bg-slate-50 rounded-xl text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  {ordersLoading ? '…' : `${userOrders.length} orders`}
                </div>
              </div>

              {ordersLoading ? (
                <div className="py-20 text-center">
                  <Package className="w-16 h-16 text-slate-200 mx-auto mb-6 animate-pulse" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Loading orders…</p>
                </div>
              ) : userOrders.length === 0 ? (
                <div className="py-20 text-center">
                  <Package className="w-16 h-16 text-slate-200 mx-auto mb-6" />
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-sm italic">No orders yet.</p>
                  <button onClick={() => navigate('/products')} className="mt-8 px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl shadow-emerald-600/20">Browse products</button>
                </div>
              ) : (
                <div className="space-y-6">
                  {userOrders.map((order, idx) => (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="p-8 bg-slate-50 rounded-[3rem] border border-slate-100 group hover:border-emerald-200 transition-all cursor-pointer relative overflow-hidden"
                      onClick={() => setTrackingOrder(order)}
                    >
                      <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transition-opacity">
                        <Navigation className="w-24 h-24 text-emerald-900" />
                      </div>

                      <div className="flex flex-col gap-6 relative z-10">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Order #{order.id}</p>
                            <h4 className="text-2xl font-black text-slate-900 tracking-tighter">{order.date}</h4>
                            <p className="text-xs text-slate-500 mt-1">{order.items} item{order.items !== 1 ? 's' : ''}</p>
                          </div>
                          <div className="flex flex-col sm:items-end gap-2">
                            <div>
                              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                              <p className="text-2xl font-black text-slate-900 tracking-tighter">₹{order.total}</p>
                            </div>
                            <div className={cn(
                              "px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border",
                              order.status === 'Delivered' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-blue-50 text-blue-600 border-blue-100 animate-pulse"
                            )}>
                              {order.status}
                            </div>
                          </div>
                        </div>

                        {/* Product details list (like Amazon order history) */}
                        <div className="border-t border-slate-200/80 pt-6 space-y-4">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Items</p>
                          {(order.orderItems || []).map((item: { productId: string; productName: string; imageUrl: string; quantity: number; pricePerUnit: number; subtotal: number }) => (
                            <div key={item.productId} className="flex gap-4 items-center bg-white rounded-2xl p-4 border border-slate-100">
                              <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-100">
                                {item.imageUrl ? (
                                  <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center"><Box className="w-6 h-6 text-slate-300" /></div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-bold text-slate-900 truncate">{item.productName}</p>
                                <p className="text-xs text-slate-500 mt-0.5">Qty: {item.quantity} × ₹{item.pricePerUnit}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="font-black text-slate-900">₹{item.subtotal}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Professional Review Interface (Placeholder for Phase 5) */}
            <div className="bg-slate-900 rounded-[4rem] p-12 text-white relative overflow-hidden group shadow-3xl">
              <div className="absolute -right-10 -bottom-10 opacity-10 group-hover:scale-125 transition-transform duration-1000">
                <Heart className="w-64 h-64 text-emerald-500 fill-emerald-500" />
              </div>
              <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-12">
                <div className="max-w-md">
                  <h3 className="text-3xl font-black mb-4 uppercase tracking-tighter">Leave a review</h3>
                  <p className="text-slate-400 font-medium text-sm leading-relaxed mb-8 italic">Rate the quality and freshness of your recent order to earn bonus points.</p>
                  <div className="flex gap-4">
                    {[1, 2, 3, 4, 5].map(i => <Star key={i} className="w-6 h-6 text-emerald-500 fill-emerald-500 opacity-30 hover:opacity-100 transition-opacity cursor-pointer" />)}
                  </div>
                </div>
                <button className="px-10 py-5 bg-white text-slate-900 rounded-[2rem] font-black text-[10px] uppercase tracking-widest hover:bg-emerald-50 transition-all shadow-2xl">
                  Submit review
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tracking Modal Manifold */}
      <AnimatePresence>
        {trackingOrder && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl" onClick={() => setTrackingOrder(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 100 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 100 }}
              className="relative bg-white rounded-[4rem] p-10 md:p-14 max-w-4xl w-full shadow-6xl border border-white/20 max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="flex justify-between items-start mb-12">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Activity className="w-4 h-4 text-emerald-500" />
                    <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Tracking</span>
                  </div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Order #{trackingOrder.id}</h2>
                          <p className="text-slate-500 mt-2 font-medium">
                            Placed on {trackingOrder.date} · Total ₹{trackingOrder.total}
                          </p>
                          {typeof trackingOrder.platformFee === 'number' && trackingOrder.platformFee > 0 && (
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">
                              Platform fee (2%): ₹{trackingOrder.platformFee.toFixed(2)}
                            </p>
                          )}
                </div>
                <button onClick={() => setTrackingOrder(null)} className="p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-all text-slate-400 font-black">✕</button>
              </div>

              {/* Items in this order */}
              {(trackingOrder.orderItems?.length ?? 0) > 0 && (
                <div className="mb-12">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Items in this order</p>
                  <div className="space-y-3 max-h-48 overflow-y-auto pr-2">
                    {(trackingOrder.orderItems || []).map((item: { productId: string; productName: string; imageUrl: string; quantity: number; pricePerUnit: number; subtotal: number }) => (
                      <div key={item.productId} className="flex gap-4 items-center bg-slate-50 rounded-2xl p-4 border border-slate-100">
                        <div className="w-14 h-14 rounded-xl overflow-hidden bg-white shrink-0 border border-slate-100">
                          {item.imageUrl ? (
                            <img src={item.imageUrl} alt={item.productName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Box className="w-5 h-5 text-slate-300" /></div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-900 truncate">{item.productName}</p>
                          <p className="text-xs text-slate-500 mt-0.5">Qty: {item.quantity} × ₹{item.pricePerUnit}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-black text-slate-900">₹{item.subtotal}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-12">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Order roadmap</p>
                <div className="grid md:grid-cols-3 gap-8">
                  {(trackingOrder.statusTimeline || []).length > 0
                    ? (trackingOrder.statusTimeline as any[]).map((step: any, idx: number) => {
                        const isLast = idx === (trackingOrder.statusTimeline.length - 1);
                        const isComplete = step.rawStatus === 'DELIVERED' || !isLast;
                        return (
                          <div
                            key={`${step.rawStatus}-${idx}`}
                            className={cn(
                              "p-6 rounded-3xl border-2 transition-all flex flex-col gap-3 relative overflow-hidden",
                              isComplete ? "bg-emerald-50 border-emerald-100 text-emerald-900" : "bg-slate-50 border-slate-50 text-slate-300"
                            )}
                          >
                            {isLast && !isComplete && (
                              <div className="absolute top-0 right-0 h-1 w-full bg-emerald-500 animate-shimmer" />
                            )}
                            <div className="flex justify-between items-center">
                              <span className="text-[9px] font-black uppercase tracking-widest italic">Step {idx + 1}</span>
                              {isComplete && <CheckCircle className="w-4 h-4" />}
                            </div>
                            <p className="text-lg font-black uppercase tracking-tight leading-none">
                              {step.label}
                            </p>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                              {step.at ? step.at.toLocaleString() : 'Pending'}
                            </p>
                            {step.byRole && (
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                                Updated by {step.byName || (step.byRole === 'ADMIN' ? 'Admin' : step.byRole === 'SELLER' ? 'Seller' : 'System')}
                              </p>
                            )}
                          </div>
                        );
                      })
                    : (
                      <div className="p-6 rounded-3xl border-2 bg-slate-50 border-slate-100 text-slate-500 text-sm font-medium">
                        Tracking information will appear here as your order moves through processing, shipping and delivery.
                      </div>
                    )}
                </div>
              </div>

              <div className="bg-slate-900 rounded-[3rem] p-10 text-white flex flex-col md:flex-row items-center justify-between gap-10">
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center text-emerald-400 border border-white/10">
                    <Navigation className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Courier</p>
                    <p className="text-xl font-black tracking-tight">Driver: RAJU-451</p>
                    <p className="text-xs text-emerald-400 font-bold mt-1">Status: Out for delivery</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button className="px-8 py-4 bg-white text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-50 transition-all flex items-center gap-2">
                    <Phone className="w-4 h-4" />
                    Call driver
                  </button>
                  <button
                    className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-600/20 flex items-center gap-2"
                    onClick={() => {
                      toast.info('Your latest order status is shown above.', {
                        description: `Order #${trackingOrder.id} is currently ${trackingOrder.status}.`,
                      });
                    }}
                  >
                    <ExternalLink className="w-4 h-4" />
                    Track order
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
