import { useMemo, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldCheck, Mail, Phone, KeyRound, Loader2, RefreshCw } from 'lucide-react';
import { verifyEmailCode, resendEmailCode } from '@/lib/api';
import { toast } from 'sonner';
import { useAuth } from '@/app/context/AuthContext';
import { getUserErrorMessage } from '@/lib/userError';
import {
  formatPhoneDisplay,
  isPhoneVerificationIdentifier,
} from '@/lib/authVerification';

export function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const legacyEmail = params.get('email') || '';
  const identifierParam = params.get('identifier') || legacyEmail;
  const channelParam = params.get('channel');
  const next = params.get('next') || '/';
  const { login } = useAuth();

  const initialIdentifier = identifierParam.trim();
  const isPhoneChannel = useMemo(() => {
    if (channelParam === 'sms') return true;
    if (channelParam === 'email') return false;
    return isPhoneVerificationIdentifier(initialIdentifier);
  }, [channelParam, initialIdentifier]);

  const [identifier, setIdentifier] = useState(initialIdentifier);
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const sentToLabel = isPhoneChannel
    ? formatPhoneDisplay(identifier)
    : identifier;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await verifyEmailCode(identifier.trim(), code.trim());
      toast.success('Account verified successfully.', {
        description: 'Finishing sign-in...',
      });

      try {
        const raw = sessionStorage.getItem('pendingSignup');
        if (raw) {
          const pending = JSON.parse(raw) as { email: string; password: string };
          if (pending.email === identifier.trim() || !isPhoneChannel) {
            await login(pending.email, pending.password);
            sessionStorage.removeItem('pendingSignup');
            navigate(next || '/', { replace: true });
            return;
          }
        }
      } catch {
        // fall back to manual login redirect
      }

      navigate(`/login?next=${encodeURIComponent(next || '/')}`);
    } catch (err: unknown) {
      toast.error(getUserErrorMessage(err, 'Verification failed. Please check the code and try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 pt-28 pb-12 px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-8"
      >
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-3">
            <ShieldCheck className="w-6 h-6 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Verify your account</h1>
          <p className="text-sm text-slate-500 mt-1 text-center">
            {isPhoneChannel ? (
              <>
                We&apos;ve sent a 6-digit OTP to{' '}
                <span className="font-semibold text-slate-800">{sentToLabel}</span>. Enter it below.
              </>
            ) : (
              <>
                We&apos;ve sent a 6-digit OTP to{' '}
                <span className="font-semibold text-slate-800">{sentToLabel}</span>. Enter it below.
              </>
            )}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {isPhoneChannel ? 'Mobile number' : 'Email'}
            </label>
            <div className="relative">
              <input
                type={isPhoneChannel ? 'tel' : 'email'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                readOnly={Boolean(initialIdentifier)}
                className="w-full h-11 pl-9 pr-3 rounded-lg border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 read-only:text-slate-700"
                placeholder={isPhoneChannel ? '9876543210' : 'you@example.com'}
              />
              {isPhoneChannel ? (
                <Phone className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              ) : (
                <Mail className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              )}
            </div>
          </div>

          <button
            type="button"
            disabled={resending || !identifier}
            onClick={async () => {
              setResending(true);
              try {
                const res = await resendEmailCode(identifier.trim());
                toast.success(res.message || 'Verification code resent.');
              } catch (err: unknown) {
                toast.error(getUserErrorMessage(err, 'Could not resend code. Please try again later.'));
              } finally {
                setResending(false);
              }
            }}
            className="w-full h-10 text-xs mt-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {resending ? 'Resending…' : 'Resend verification code'}
          </button>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Verification code</label>
            <div className="relative">
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                maxLength={6}
                inputMode="numeric"
                className="w-full h-11 pl-9 pr-3 rounded-lg border border-slate-200 text-sm tracking-[0.4em] bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                placeholder="123456"
              />
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 mt-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify OTP'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Already verified?{' '}
          <Link to="/login" className="text-emerald-600 font-medium hover:text-emerald-700">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
