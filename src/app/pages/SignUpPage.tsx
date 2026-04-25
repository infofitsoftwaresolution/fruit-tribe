import { useState, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/app/context/AuthContext';
import { useStore } from '@/app/context/StoreContext';
import { UserPlus, Eye, EyeOff, Shield, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn, pressableSurfaceClass } from '@/lib/utils';

const AUTH_BG_IMAGE =
  'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=1920&q=80';

interface SignUpPageProps {
  embedded?: boolean;
}

export function SignUpPage({ embedded = false }: SignUpPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const next = params.get('next') || '/';
  const { signup } = useAuth();
  const { theme } = useStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  });
  const bgY = useTransform(scrollYProgress, [0, 1], ['0%', '15%']);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const resolvedAuthBg =
    (theme?.authBackgroundImage && theme.authBackgroundImage.trim()) || AUTH_BG_IMAGE;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const email = formData.email.trim();

    if (!emailPattern.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!email.toLowerCase().endsWith('@gmail.com')) {
      setError('Please enter a valid Gmail address (e.g. you@gmail.com).');
      return;
    }

    const phoneDigits = formData.phone.replace(/\D/g, '');
    if (phoneDigits.length < 10) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match. Please try again.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsLoading(true);

    try {
      await signup(formData.name, formData.email, formData.phone, formData.password);
      navigate(`/verify-email?email=${encodeURIComponent(formData.phone)}&next=${encodeURIComponent(next)}`);
    } catch (err) {
      const msg = String((err as Error)?.message || '');
      const verifyEmail = (err as Error & { verifyEmail?: string }).verifyEmail;
      if (msg === 'EMAIL_PENDING_VERIFICATION') {
        toast.info('This email is already registered but not verified. Enter the code we sent, or resend below.');
        navigate(`/verify-email?email=${encodeURIComponent(formData.email)}&next=${encodeURIComponent(next)}`, {
          replace: true,
        });
      } else if (msg === 'EMAIL_ALREADY_REGISTERED') {
        setError('This email is already in use. Sign in or use a different email.');
      } else if (msg === 'PHONE_ALREADY_REGISTERED') {
        setError('This mobile number is already in use. Sign in or use a different number.');
      } else if (msg === 'PHONE_PENDING_VERIFICATION') {
        const emailForVerify = verifyEmail?.trim() || formData.phone;
        toast.info(
          'This mobile number is already linked to an account that has not finished verification. Continue and verify with OTP.',
        );
        navigate(`/verify-email?email=${encodeURIComponent(emailForVerify)}&next=${encodeURIComponent(next)}`, {
          replace: true,
        });
      } else {
        setError(msg || 'Sign up failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const nextForm = { ...formData, [name]: value };
    setFormData(nextForm);

    // Real-time password validation
    if (name === 'password' || name === 'confirmPassword') {
      if (nextForm.password && nextForm.password.length < 6) {
        setError('Password must be at least 6 characters.');
        return;
      }
      if (nextForm.confirmPassword && nextForm.password !== nextForm.confirmPassword) {
        setError('Passwords do not match. Please try again.');
        return;
      }
      setError('');
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative min-h-screen w-full flex items-center justify-center overflow-auto bg-slate-100',
        embedded ? 'pt-16 pb-8' : 'pt-20 pb-12',
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
              <UserPlus className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Create account
            </h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Sign up to get started
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
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
              <input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full h-11 px-4 bg-white/50 backdrop-blur-sm border border-white/60 rounded-lg text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-400 transition-all text-sm"
                placeholder="Your name"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                className="w-full h-11 px-4 bg-white/50 backdrop-blur-sm border border-white/60 rounded-lg text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-400 transition-all text-sm"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">Mobile number</label>
              <input
                id="phone"
                type="tel"
                name="phone"
                inputMode="numeric"
                autoComplete="tel"
                value={formData.phone}
                onChange={handleChange}
                required
                className="w-full h-11 px-4 bg-white/50 backdrop-blur-sm border border-white/60 rounded-lg text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-400 transition-all text-sm"
                placeholder="9876543210 or +91 9876543210"
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
                  placeholder="At least 6 characters"
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

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-700 mb-1">Confirm password</label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  className="w-full h-11 px-4 pr-11 bg-white/50 backdrop-blur-sm border border-white/60 rounded-lg text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-400 transition-all text-sm"
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
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
                  <UserPlus className="h-4 w-4" />
                  Create account
                </>
              )}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-emerald-600 hover:text-emerald-700">Sign in</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

