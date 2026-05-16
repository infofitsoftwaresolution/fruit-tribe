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
