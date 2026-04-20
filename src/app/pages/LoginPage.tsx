import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/app/context/AuthContext';
import { useStore } from '@/app/context/StoreContext';
import {
  LogIn, Eye, EyeOff, Shield, Loader2, UserCircle,
  MessageCircle, Phone, ArrowRight, CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn, pressableSurfaceClass } from '@/lib/utils';
import { getEffectiveApiBase } from '@/lib/api';

const AUTH_BG_IMAGE =
  'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=1920&q=80';

type LoginTab = 'password' | 'whatsapp';
type WhatsappStep = 'phone' | 'otp';

interface LoginPageProps {
  embedded?: boolean;
}

export function LoginPage({ embedded = false }: LoginPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { theme } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '15%']);

  // ── Password login state ──────────────────────────────────────────────
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  // ── WhatsApp OTP state ────────────────────────────────────────────────
  const [waPhone, setWaPhone] = useState('');
  const [waOtp, setWaOtp] = useState('');
  const [waStep, setWaStep] = useState<WhatsappStep>('phone');
  const [waResendTimer, setWaResendTimer] = useState(0);

  // ── Shared state ──────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<LoginTab>('password');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const resolvedAuthBg =
    (theme?.authBackgroundImage && theme.authBackgroundImage.trim()) || AUTH_BG_IMAGE;

  // ── Redirect helper ───────────────────────────────────────────────────
  const redirectAfterLogin = () => {
    const redirectFromState = (location.state as { from?: string } | null)?.from;
    const redirectFromQuery = new URLSearchParams(location.search).get('next') || undefined;
    const redirectTarget = redirectFromState || redirectFromQuery;
    if (redirectTarget && redirectTarget !== '/login') {
      navigate(redirectTarget, { replace: true });
      return;
    }
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const user = JSON.parse(storedUser);
      if (['admin', 'seller'].includes(user.role)) navigate('/admin');
      else if (user.role === 'delivery_partner') navigate('/delivery');
      else navigate('/');
    } else {
      navigate('/');
    }
  };

  // ── Password login ────────────────────────────────────────────────────
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await login(formData.email, formData.password);
      redirectAfterLogin();
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.includes('not verified') || msg.includes('verification code')) {
        toast.info('Enter the OTP we sent to your phone or email.');
        const verifyEmail = (err as Error & { verifyEmail?: string }).verifyEmail || formData.email;
        navigate(`/verify-email?email=${encodeURIComponent(verifyEmail)}&next=${encodeURIComponent('/login')}`);
        return;
      }
      setError(msg || 'Invalid email, mobile, or password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── WhatsApp: Step 1 — send OTP ───────────────────────────────────────
  const handleWhatsappSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch(`${getEffectiveApiBase()}/auth/whatsapp/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: waPhone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = Array.isArray(data?.message) ? data.message.join('; ') : (data?.message || 'Failed to send OTP.');
        throw new Error(msg);
      }
      toast.success('OTP sent! Check your WhatsApp.');
      setWaStep('otp');
      // 60-second resend cooldown
      setWaResendTimer(60);
      const interval = setInterval(() => {
        setWaResendTimer((t) => {
          if (t <= 1) { clearInterval(interval); return 0; }
          return t - 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err?.message || 'Could not send WhatsApp OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── WhatsApp: Step 2 — verify OTP ────────────────────────────────────
  const handleWhatsappVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch(`${getEffectiveApiBase()}/auth/whatsapp/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: waPhone.trim(), otp: waOtp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = Array.isArray(data?.message) ? data.message.join('; ') : (data?.message || 'Invalid OTP.');
        throw new Error(msg);
      }
      // Same handling as password login response
      const token = data.accessToken;
      const u = data.user;
      if (!token || !u) throw new Error('Invalid login response.');

      // Reuse AuthContext helper shape
      const nameParts = [u.firstName, u.lastName].filter(Boolean).join(' ');
      const name = nameParts || waPhone.slice(-4);
      const mapRole = (r: string | undefined) => {
        if (!r) return 'customer';
        const up = r.toUpperCase();
        if (up === 'ADMIN' || up === 'SUPER_ADMIN') return 'admin';
        if (up === 'SELLER') return 'seller';
        if (up === 'DELIVERY_PARTNER') return 'delivery_partner';
        return 'customer';
      };
      const seller = u.seller as { id?: string; storeName?: string } | undefined;
      const userData = {
        id: u.id,
        name: name.charAt(0).toUpperCase() + name.slice(1),
        email: u.email,
        role: mapRole(u.role),
        phone: typeof u.phone === 'string' ? u.phone : waPhone,
        address: '',
        memberSince: new Date().getFullYear().toString(),
        sellerId: seller?.id,
        sellerStoreName: seller?.storeName,
      };
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(userData));
      localStorage.setItem('requirePasswordChange', String(!!u.requirePasswordChange));
      toast.success(`Welcome back, ${userData.name}! 🎉`);
      redirectAfterLogin();
    } catch (err: any) {
      setError(err?.message || 'OTP verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const [isWaEnabled, setIsWaEnabled] = useState(false);
  const [waLoading, setWaLoading] = useState(true);

  // ── Sync WhatsApp status from backend ──────────────────────────────────
  useEffect(() => {
    fetch(`${getEffectiveApiBase()}/auth/whatsapp/status`)
      .then(r => r.json())
      .then(data => setIsWaEnabled(!!data.enabled))
      .catch(() => setIsWaEnabled(false))
      .finally(() => setWaLoading(false));
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const switchTab = (tab: LoginTab) => {
    setActiveTab(tab);
    setError('');
    setWaStep('phone');
    setWaOtp('');
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative min-h-screen w-full flex items-center justify-center overflow-auto bg-slate-100',
        embedded ? 'pt-16 pb-8' : 'pt-28 pb-12',
      )}
    >
      {/* Parallax background */}
      <motion.div
        style={{ y: bgY, backgroundImage: `url(${resolvedAuthBg})` }}
        className={cn('inset-0 z-0 bg-cover bg-center scale-105', embedded ? 'absolute' : 'fixed')}
        aria-hidden
      />
      <div
        className={cn(
          'inset-0 z-0 bg-gradient-to-br from-slate-100/95 via-emerald-50/40 to-slate-100/95',
          embedded ? 'absolute' : 'fixed',
        )}
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md px-4 my-auto"
      >
        <div className="bg-white/40 backdrop-blur-2xl rounded-2xl shadow-2xl shadow-slate-300/20 border border-white/40 ring-1 ring-white/30 p-6 md:p-7">
          {/* Header */}
          <div className="text-center mb-5">
            <div className="inline-flex h-12 w-12 bg-emerald-100 text-emerald-600 rounded-xl items-center justify-center mb-3">
              <UserCircle className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Welcome back</h1>
            <p className="text-slate-500 text-sm mt-0.5">Sign in to your account to continue</p>
          </div>

          {/* Tab switcher - only show if WhatsApp is enabled */}
          {isWaEnabled && (
            <div className="flex rounded-xl overflow-hidden border border-slate-200/80 mb-5 bg-slate-100/60 p-1 gap-1">
              <button
                id="tab-password"
                type="button"
                onClick={() => switchTab('password')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-all duration-200',
                  activeTab === 'password'
                    ? 'bg-white shadow-sm text-slate-900'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                <LogIn className="h-3.5 w-3.5" />
                Password
              </button>
              <button
                id="tab-whatsapp"
                type="button"
                onClick={() => switchTab('whatsapp')}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-all duration-200',
                  activeTab === 'whatsapp'
                    ? 'bg-white shadow-sm text-slate-900'
                    : 'text-slate-500 hover:text-slate-700',
                )}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp OTP
              </button>
            </div>
          )}

          {/* Error banner */}
          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-4 p-3 bg-red-50/90 backdrop-blur-sm border border-red-200/80 rounded-lg flex items-center gap-2"
              >
                <Shield className="h-4 w-4 text-red-500 flex-shrink-0" />
                <span className="text-sm text-red-700">{error}</span>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {/* ── Password login ── */}
            {activeTab === 'password' && (
              <motion.form
                key="password-form"
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 12 }}
                transition={{ duration: 0.2 }}
                onSubmit={handlePasswordLogin}
                className="space-y-4"
              >
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
                    Email or mobile
                  </label>
                  <input
                    id="email"
                    type="text"
                    name="email"
                    autoComplete="username"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="w-full h-11 px-4 bg-white/50 backdrop-blur-sm border border-white/60 rounded-lg text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-400 transition-all text-sm"
                    placeholder="you@example.com or 9876543210"
                  />
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      required
                      className="w-full h-11 px-4 pr-11 bg-white/50 backdrop-blur-sm border border-white/60 rounded-lg text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-400 transition-all text-sm"
                      placeholder="Enter your password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                    <span className="text-sm text-slate-600">Remember me</span>
                  </label>
                  <Link to="/forgot-password" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className={cn(
                    pressableSurfaceClass,
                    'w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-sm',
                  )}
                >
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><LogIn className="h-4 w-4" /> Sign in</>}
                </button>
              </motion.form>
            )}

            {/* ── WhatsApp OTP ── */}
            {activeTab === 'whatsapp' && (
              <motion.div
                key="whatsapp-flow"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
              >
                {/* Step indicator */}
                <div className="flex items-center gap-2 mb-5">
                  {(['phone', 'otp'] as WhatsappStep[]).map((step, idx) => (
                    <div key={step} className="flex items-center gap-2">
                      <div
                        className={cn(
                          'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                          waStep === step
                            ? 'bg-green-500 text-white shadow-md shadow-green-200'
                            : waStep === 'otp' && step === 'phone'
                              ? 'bg-emerald-100 text-emerald-600'
                              : 'bg-slate-200 text-slate-400',
                        )}
                      >
                        {waStep === 'otp' && step === 'phone' ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          idx + 1
                        )}
                      </div>
                      <span
                        className={cn(
                          'text-xs font-medium',
                          waStep === step ? 'text-slate-800' : 'text-slate-400',
                        )}
                      >
                        {step === 'phone' ? 'Mobile number' : 'Enter OTP'}
                      </span>
                      {idx < 1 && <div className="flex-1 h-px bg-slate-200 w-6" />}
                    </div>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  {waStep === 'phone' && (
                    <motion.form
                      key="wa-phone-step"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      onSubmit={handleWhatsappSend}
                      className="space-y-4"
                    >
                      <div>
                        <label htmlFor="wa-phone" className="block text-sm font-medium text-slate-700 mb-1">
                          WhatsApp mobile number
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">+91</span>
                          <input
                            id="wa-phone"
                            type="tel"
                            value={waPhone}
                            onChange={(e) => setWaPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            required
                            maxLength={10}
                            className="w-full h-11 pl-12 pr-4 bg-white/50 backdrop-blur-sm border border-white/60 rounded-lg text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-green-400/60 focus:border-green-400 transition-all text-sm"
                            placeholder="9876543210"
                          />
                        </div>
                        <p className="mt-1.5 text-xs text-slate-500 flex items-center gap-1">
                          <MessageCircle className="h-3 w-3 text-green-500" />
                          We'll send a 6-digit OTP to this WhatsApp number
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading || waPhone.length < 10}
                        className={cn(
                          pressableSurfaceClass,
                          'w-full h-11 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-sm',
                        )}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Phone className="h-4 w-4" />
                            Send OTP via WhatsApp
                            <ArrowRight className="h-3.5 w-3.5" />
                          </>
                        )}
                      </button>
                    </motion.form>
                  )}

                  {waStep === 'otp' && (
                    <motion.form
                      key="wa-otp-step"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      onSubmit={handleWhatsappVerify}
                      className="space-y-4"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label htmlFor="wa-otp" className="block text-sm font-medium text-slate-700">
                            Enter 6-digit OTP
                          </label>
                          <button
                            type="button"
                            onClick={() => { setWaStep('phone'); setWaOtp(''); setError(''); }}
                            className="text-xs text-emerald-600 hover:underline"
                          >
                            Change number
                          </button>
                        </div>
                        <p className="text-xs text-slate-500 mb-2">
                          Sent to <span className="font-semibold text-slate-700">+91 {waPhone}</span> on WhatsApp
                        </p>
                        <input
                          id="wa-otp"
                          type="text"
                          inputMode="numeric"
                          pattern="\d{6}"
                          value={waOtp}
                          onChange={(e) => setWaOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          required
                          maxLength={6}
                          autoFocus
                          className="w-full h-14 px-4 text-center text-2xl tracking-[0.4em] font-bold bg-white/50 backdrop-blur-sm border border-white/60 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-green-400/60 focus:border-green-400 transition-all"
                          placeholder="······"
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading || waOtp.length < 6}
                        className={cn(
                          pressableSurfaceClass,
                          'w-full h-11 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed text-sm',
                        )}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="h-4 w-4" />
                            Verify & Sign in
                          </>
                        )}
                      </button>

                      <p className="text-center text-xs text-slate-500">
                        Didn't receive it?{' '}
                        {waResendTimer > 0 ? (
                          <span className="font-medium text-slate-600">Resend in {waResendTimer}s</span>
                        ) : (
                          <button
                            type="button"
                            onClick={handleWhatsappSend as any}
                            className="font-medium text-green-600 hover:underline"
                          >
                            Resend OTP
                          </button>
                        )}
                      </p>
                    </motion.form>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="mt-5 text-center text-sm text-slate-500">
            Don't have an account?{' '}
            <Link to="/signup" className="font-medium text-emerald-600 hover:text-emerald-700">Create account</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
