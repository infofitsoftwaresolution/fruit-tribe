/** Parse Nest auth error JSON for verification redirect (phone vs email). */
export function parseAuthVerificationFromResponse(data: unknown): {
  message: string;
  verifyIdentifier?: string;
  verifyChannel?: 'sms' | 'email';
} {
  const root = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const nested =
    root.message && typeof root.message === 'object' && !Array.isArray(root.message)
      ? (root.message as Record<string, unknown>)
      : null;
  const payload = nested ? { ...root, ...nested } : root;

  const rawMsg = payload.message;
  const message =
    typeof rawMsg === 'string'
      ? rawMsg
      : Array.isArray(rawMsg)
        ? rawMsg.join('; ')
        : typeof root.message === 'string'
          ? root.message
          : '';

  const phone =
    typeof payload.phone === 'string' && payload.phone.trim()
      ? payload.phone.trim()
      : undefined;
  const email =
    typeof payload.email === 'string' && payload.email.trim()
      ? payload.email.trim().toLowerCase()
      : undefined;

  const isPhoneOtp =
    message === 'PHONE_PENDING_VERIFICATION' ||
    message === 'PHONE_PENDING_VERIFICATION_OTP_RESENT' ||
    Boolean(phone && !email);

  if (isPhoneOtp && phone) {
    return { message, verifyIdentifier: phone, verifyChannel: 'sms' };
  }
  if (email) {
    return { message, verifyIdentifier: email, verifyChannel: 'email' };
  }
  if (phone) {
    return { message, verifyIdentifier: phone, verifyChannel: 'sms' };
  }
  return { message };
}

export function isPhoneVerificationIdentifier(value: string): boolean {
  const v = value.trim();
  if (!v || v.includes('@')) return false;
  const digits = v.replace(/\D/g, '');
  return digits.length >= 10;
}

export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  return last10 ? `+91 ${last10}` : phone;
}
