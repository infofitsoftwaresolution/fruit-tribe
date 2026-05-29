/** Saved address row from GET /addresses */
/** Single-line display for profile / invoices */
export function formatSavedAddressLine(addr: SavedDeliveryAddress): string {
  const parts = [
    addr.addressLine1,
    addr.addressLine2,
    `${addr.city}, ${addr.state} ${addr.pincode}`,
  ].filter((p) => typeof p === 'string' && p.trim());
  return parts.join(', ');
}

export type SavedDeliveryAddress = {
  id: string;
  label: string | null;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  createdAt: string;
};

export type CheckoutAddressFormShape = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  flatHouse: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
};

export function savedAddressToCheckoutForm(
  addr: SavedDeliveryAddress,
  emailFallback: string,
): CheckoutAddressFormShape {
  const parts = addr.name.trim().split(/\s+/);
  const firstName = parts[0] || '';
  const lastName = parts.slice(1).join(' ') || '';
  const segments = String(addr.addressLine1 || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const flatHouse = segments.length > 1 ? segments[0] : '';
  const addressLine1 = segments.length > 1 ? segments.slice(1).join(', ') : String(addr.addressLine1 || '');
  const address = [addressLine1, addr.addressLine2].filter(Boolean).join(', ');
  return {
    firstName,
    lastName,
    email: emailFallback,
    phone: addr.phone,
    flatHouse,
    address,
    city: addr.city,
    state: addr.state?.trim() || 'Karnataka',
    zipCode: addr.pincode,
  };
}

export function checkoutFormToCreateAddressBody(
  form: CheckoutAddressFormShape,
  opts?: { label?: string; isDefault?: boolean },
): {
  label?: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
} {
  const pin = form.zipCode.replace(/\D/g, '').slice(0, 6);
  return {
    label: opts?.label,
    name: `${form.firstName} ${form.lastName}`.trim(),
    phone: form.phone.trim(),
    addressLine1: form.address.trim(),
    addressLine2: null,
    city: form.city.trim(),
    state: (form.state || 'Karnataka').trim(),
    pincode: pin,
    isDefault: opts?.isDefault ?? false,
  };
}
