import { useState, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/app/context/AuthContext';
import { useStore } from '@/app/context/StoreContext';
import { LogIn, Eye, EyeOff, Shield, Loader2, UserCircle } from 'lucide-react';
import { toast } from 'sonner';
import { cn, pressableSurfaceClass } from '@/lib/utils';

// Default auth background: fruits only (store can override via authBackgroundImage).
const AUTH_BG_IMAGE =
  'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=1920&q=80';

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
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const resolvedAuthBg =
    (theme?.authBackgroundImage && theme.authBackgroundImage.trim()) || AUTH_BG_IMAGE;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(formData.email, formData.password);
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
        if (['admin', 'seller'].includes(user.role)) {
          navigate('/admin');
        } else if (user.role === 'delivery_partner') {
          navigate('/delivery');
        } else {
          navigate('/');
        }
      } else {
        navigate('/');
      }
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative min-h-screen w-full flex items-center justify-center overflow-auto bg-slate-100',
        embedded ? 'pt-16 pb-8' : 'pt-28 pb-12',
      )}
    >
      {/* Parallax background image */}
      <motion.div
        style={{
          y: bgY,
          backgroundImage: `url(${resolvedAuthBg})`,
        }}
        className={cn(
          'inset-0 z-0 bg-cover bg-center scale-105',
          embedded ? 'absolute' : 'fixed',
        )}
        aria-hidden
      />
      {/* Overlay so form stays readable */}
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
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Welcome back
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Sign in to your account to continue
            </p>
          </div>

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

          <form onSubmit={handleSubmit} className="space-y-4">
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
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <LogIn className="h-4 w-4" />
                  Sign in
                </>
              )}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            Don't have an account?{' '}
            <Link to="/signup" className="font-medium text-emerald-600 hover:text-emerald-700">Create account</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
