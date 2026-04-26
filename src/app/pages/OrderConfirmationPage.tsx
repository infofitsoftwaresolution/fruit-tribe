import { motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { confirmPaymentLink } from '@/lib/api';

// Re-using same icons but with consistent imports
import {
  CheckCircle as CheckIcon,
  Home as HomeIcon,
  ShoppingBag as BagIcon,
  Download as DownloadIcon,
  Printer as PrintIcon,
  FileText as FileIcon,
  Zap as ZapIcon
} from 'lucide-react';

export function OrderConfirmationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const allOrders = location.state?.allOrders as string[] | undefined;
  const params = new URLSearchParams(location.search);
  const queryOrderId = params.get('id') || '';
  const primaryOrderId = location.state?.orderId || queryOrderId || '';
  const [isPrinting, setIsPrinting] = useState(false);
  const [paymentState, setPaymentState] = useState<'unknown' | 'paid' | 'pending'>('unknown');

  useEffect(() => {
    if (!location.state?.orderId && !location.state?.allOrders && !queryOrderId) {
      navigate('/', { replace: true });
    }
  }, [location.state, navigate, queryOrderId]);

  useEffect(() => {
    if (!primaryOrderId) return;
    const paymentId =
      params.get('razorpay_payment_id') ||
      params.get('payment_id') ||
      undefined;
    const paymentLinkId =
      params.get('razorpay_payment_link_id') ||
      params.get('payment_link_id') ||
      undefined;
    const paymentLinkStatus =
      params.get('razorpay_payment_link_status') ||
      params.get('payment_link_status') ||
      undefined;

    const hasPaymentSignal = Boolean(paymentId || paymentLinkId || paymentLinkStatus);
    if (!hasPaymentSignal && !queryOrderId) return;

    confirmPaymentLink(primaryOrderId, { paymentId, paymentLinkId, paymentLinkStatus })
      .then((res) => {
        if (res.paymentStatus === 'PAID') {
          setPaymentState('paid');
          toast.success('Payment captured successfully.');
        } else {
          setPaymentState('pending');
          toast.info('Order created. Payment is still pending.');
        }
      })
      .catch(() => {
        setPaymentState('pending');
      });
  }, [primaryOrderId, queryOrderId, location.search]);

  if (!primaryOrderId && !allOrders?.length) {
    return null;
  }

  const displayOrderId = primaryOrderId || (allOrders && allOrders[0]) || '—';

  const handleDownloadManifest = () => {
    setIsPrinting(true);
    toast.info("Preparing your invoice...", {
      description: "Your order details are being generated.",
      icon: <FileIcon className="w-4 h-4" />
    });

    setTimeout(() => {
      setIsPrinting(false);
      toast.success("Invoice ready", {
        description: "Your order summary is ready to download."
      });
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-emerald-500 selection:text-white flex flex-col items-center justify-center px-4 py-20 relative overflow-hidden">
      {/* Background Architectural Manifold */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-40">
        <div className="absolute top-0 right-0 h-[1000px] w-[1000px] bg-emerald-500/10 rounded-full blur-[200px]" />
        <div className="absolute bottom-0 left-0 h-[1000px] w-[1000px] bg-sky-900/10 rounded-full blur-[200px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl relative z-10"
      >
        <div className="bg-white rounded-[3rem] shadow-2xl p-8 md:p-12 text-center border border-slate-100 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 via-blue-500 to-orange-500" />

          {/* Success Icon */}
          <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="w-32 h-32 bg-slate-900 rounded-[3rem] flex items-center justify-center mx-auto mb-12 shadow-4xl relative"
          >
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-emerald-500/20 to-transparent rounded-b-[3rem]" />
            <CheckIcon className="w-16 h-16 text-emerald-400 relative z-10" />
          </motion.div>

          {/* Title */}
          <h1 className="text-4xl md:text-6xl font-black mb-6 tracking-tight leading-[0.95] text-slate-900">
            Order
            <br />
            <span className="text-emerald-500">confirmed</span>
          </h1>

          <p className="text-base text-slate-500 font-semibold mb-10 px-4">
            {paymentState === 'paid'
              ? "Payment received. We're preparing your items for delivery."
              : paymentState === 'pending'
                ? 'Order created. Complete payment to confirm processing.'
                : "Thank you for your order. We're preparing your items for delivery."}
          </p>

          {/* Order details card */}
          <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-8 mb-10 relative overflow-hidden text-left">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <ZapIcon className="w-32 h-32" />
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-10 pb-10 border-b border-slate-200/50">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Order ID</p>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">#{displayOrderId}</h2>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleDownloadManifest}
                  disabled={isPrinting}
                  className="p-4 bg-white rounded-2xl border border-slate-200 text-slate-900 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm group disabled:opacity-50"
                >
                  <DownloadIcon className={cn("w-5 h-5", isPrinting && "animate-bounce")} />
                </button>
                <button className="p-4 bg-white rounded-2xl border border-slate-200 text-slate-900 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm">
                  <PrintIcon className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-12">
              <div className="space-y-6">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Order IDs</p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {allOrders && allOrders.length > 1 ? (
                      allOrders.map(id => (
                        <span key={id} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-[9px] font-black text-slate-900 uppercase">
                          Order #{id}
                        </span>
                      ))
                    ) : (
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-lg text-[9px] font-black uppercase tracking-widest">Single order</span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Delivery to</p>
                  <p className="text-sm font-semibold text-slate-900">Your delivery address</p>
                </div>
              </div>
              <div className="space-y-6">
                <div className="p-6 bg-slate-900 rounded-3xl text-white relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-3 opacity-20 group-hover:scale-110 transition-transform">
                    <ZapIcon className="w-8 h-8 text-emerald-400" />
                  </div>
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-2">Estimated delivery</p>
                  <p className="text-xl font-black tracking-tight">~24 HOURS</p>
                  <p className="text-[10px] font-bold text-emerald-400 mt-2">Priority shipping</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid sm:grid-cols-2 gap-6 max-w-md mx-auto">
            <Link to="/">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3"
              >
                <HomeIcon className="w-4 h-4" />
                Back to home
              </motion.button>
            </Link>
            <Link to="/products">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full py-4 bg-white border-2 border-slate-100 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-50 transition-all flex items-center justify-center gap-3"
              >
                <BagIcon className="w-4 h-4" />
                Continue shopping
              </motion.button>
            </Link>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] mb-4">The Fruit Tribe</p>
          <div className="inline-flex gap-4 opacity-30 grayscale hover:grayscale-0 transition-all">
            <img src="https://upload.wikimedia.org/wikipedia/commons/b/b3/Visa_2021.svg" className="h-4" alt="Visa" />
            <img src="https://upload.wikimedia.org/wikipedia/commons/2/2a/Mastercard-logo.svg" className="h-4" alt="Mastercard" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
