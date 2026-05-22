/** Canonical public contact shown in footer & contact page (not overridden by legacy theme placeholders). */
export const STORE_PUBLIC_CONTACT = {
  address: '706, Mahaveer Palatium, Jigani, Bangalore - 560105',
  phone: '9934722416',
  email: 'thefruittribes@gmail.com',
} as const;

export function storePhoneTelHref(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) return `tel:+91${digits.slice(-10)}`;
  return `tel:${phone}`;
}

/** E.164-style digits for wa.me (India: 91 + 10 digits). */
export function storePhoneWhatsAppDigits(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) return `91${digits.slice(-10)}`;
  return digits;
}

export function storeWhatsAppHref(phone: string, message?: string): string {
  const base = `https://wa.me/${storePhoneWhatsAppDigits(phone)}`;
  if (!message?.trim()) return base;
  return `${base}?text=${encodeURIComponent(message.trim())}`;
}
