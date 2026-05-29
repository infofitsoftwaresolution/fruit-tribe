import { motion } from 'framer-motion';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { confirmPaymentLink, getOrder } from '@/lib/api';
import {
  downloadOrderInvoicePdf,
  formatShippingAddress,
  mapApiOrderToInvoice,
  type OrderInvoiceData,
} from '@/lib/orderInvoice';

import {
  CheckCircle as CheckIcon,
  Home as HomeIcon,
  ShoppingBag as BagIcon,
  Download as DownloadIcon,
  FileText as FileIcon,
  Zap as ZapIcon,
  Loader2,
} from 'lucide-react';

function inr(n: number): string {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function OrderConfirmationPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const allOrders = location.state?.allOrders as string[] | undefined;
  const params = new URLSearchParams(location.search);
  const queryOrderId = params.get('id') || '';
  const primaryOrderId = (location.state?.orderId as string) || queryOrderId || '';
  const orderNumberFromState = (location.state?.orderNumber as string) || '';
  const [isDownloading, setIsDownloading] = useState(false);
  const [paymentState, setPaymentState] = useState<'unknown' | 'paid' | 'pending'>('unknown');
  const [orderLoading, setOrderLoading] = useState(true);
  const [invoice, setInvoice] = useState<OrderInvoiceData | null>(null);

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

  useEffect(() => {
    if (!primaryOrderId) {
      setOrderLoading(false);
      return;
    }
    let cancelled = false;
    setOrderLoading(true);
    getOrder(primaryOrderId)
      .then((api) => {
        if (cancelled) return;
        const mapped = mapApiOrderToInvoice(api);
        setInvoice(mapped);
        const paid = String(api.paymentStatus ?? '').toUpperCase() === 'PAID';
        setPaymentState((prev) => (paid ? 'paid' : prev === 'paid' ? 'paid' : 'pending'));
      })
      .catch(() => {
        if (!cancelled) {
          toast.error('Could not load order details.');
          setInvoice(null);
        }
      })
      .finally(() => {
        if (!cancelled) setOrderLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [primaryOrderId]);

  const displayOrderNumber = invoice?.orderNumber || orderNumberFromState || primaryOrderId || '—';
  const deliveryAddress = useMemo(
    () => formatShippingAddress(invoice?.shippingAddress),
    [invoice?.shippingAddress],
  );

  const handleDownloadInvoice = useCallback(() => {
    if (!invoice) {
      toast.error('Bill is still loading. Please wait a moment.');
      return;
    }
    setIsDownloading(true);
    try {
      downloadOrderInvoicePdf(invoice);
      toast.success('Invoice downloaded', {
        description: `invoice-${invoice.orderNumber}.pdf`,
        icon: <FileIcon className="w-4 h-4" />,
      });
    } catch {
      toast.error('Could not generate PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  }, [invoice]);

  if (!primaryOrderId && !allOrders?.length) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 selection:bg-emerald-500 selection:text-white flex flex-col items-center justify-center px-4 py-20 relative overflow-hidden">
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

          <motion.div
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="w-32 h-32 bg-slate-900 rounded-[3rem] flex items-center justify-center mx-auto mb-12 shadow-4xl relative"
          >
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-emerald-500/20 to-transparent rounded-b-[3rem]" />
            <CheckIcon className="w-16 h-16 text-emerald-400 relative z-10" />
          </motion.div>

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

          <div className="bg-slate-50 border border-slate-100 rounded-[2rem] p-8 mb-10 relative overflow-hidden text-left">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <ZapIcon className="w-32 h-32" />
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-8 pb-8 border-b border-slate-200/50">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Order</p>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">#{displayOrderNumber}</h2>
              </div>
              <button
                type="button"
                onClick={handleDownloadInvoice}
                disabled={isDownloading || orderLoading || !invoice}
                className="inline-flex items-center gap-2 px-5 py-3 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all disabled:opacity-50"
              >
                {isDownloading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <DownloadIcon className="w-4 h-4" />
                )}
                Download PDF
              </button>
            </div>

            {orderLoading ? (
              <div className="flex items-center justify-center gap-3 py-12 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-sm font-semibold">Loading your bill…</span>
              </div>
            ) : invoice ? (
              <>
                <div className="grid md:grid-cols-2 gap-8 mb-8">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Delivery to</p>
                    <p className="text-sm font-semibold text-slate-900">{deliveryAddress}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Payment</p>
                    <p className="text-sm font-semibold text-slate-900">
                      {String(invoice.paymentStatus ?? 'PENDING').toUpperCase()}
                      {invoice.paymentMethod ? ` · ${invoice.paymentMethod}` : ''}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3 bg-slate-100/80 text-[10px] font-black uppercase tracking-widest text-slate-500">
                    <span>Item</span>
                    <span className="text-right">Qty</span>
                    <span className="text-right w-24">Amount</span>
                  </div>
                  <ul className="divide-y divide-slate-100">
                    {invoice.items.map((item, idx) => (
                      <li
                        key={`${item.name}-${idx}`}
                        className="grid grid-cols-[1fr_auto_auto] gap-4 px-4 py-3 text-sm"
                      >
                        <span className="font-semibold text-slate-900">{item.name}</span>
                        <span className="text-slate-500 font-medium text-right">{item.quantity}</span>
                        <span className="font-bold text-slate-900 text-right w-24">{inr(item.subtotal)}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-slate-200 px-4 py-4 space-y-2 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Subtotal</span>
                      <span>{inr(invoice.subtotal)}</span>
                    </div>
                    {invoice.discountAmount > 0 && (
                      <div className="flex justify-between text-emerald-700">
                        <span>Discount</span>
                        <span>-{inr(invoice.discountAmount)}</span>
                      </div>
                    )}
                    {invoice.shippingFee > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>Delivery</span>
                        <span>{inr(invoice.shippingFee)}</span>
                      </div>
                    )}
                    {invoice.taxAmount > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>Tax</span>
                        <span>{inr(invoice.taxAmount)}</span>
                      </div>
                    )}
                    {invoice.platformFee > 0 && (
                      <div className="flex justify-between text-slate-600">
                        <span>Platform fee</span>
                        <span>{inr(invoice.platformFee)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-slate-100 font-black text-slate-900 text-base">
                      <span>Total paid</span>
                      <span className="text-emerald-600">{inr(invoice.total)}</span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500 font-medium py-8 text-center">
                Order confirmed. Bill details could not be loaded — try downloading from My Orders later.
              </p>
            )}
          </div>

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
            <Link to="/profile#order-history">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="w-full py-4 bg-white border-2 border-slate-100 text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-slate-50 transition-all flex items-center justify-center gap-3"
              >
                <BagIcon className="w-4 h-4" />
                My orders
              </motion.button>
            </Link>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] mb-4">The Fruit Tribe</p>
        </div>
      </motion.div>
    </div>
  );
}
