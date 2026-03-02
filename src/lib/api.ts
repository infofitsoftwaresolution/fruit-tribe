/**
 * API client for backend. All data comes from the database via these endpoints.
 */
const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || 'http://localhost:3000/v1';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/** Backend product shape (from API) */
export interface ApiProduct {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  basePrice: number | string;
  stock: number;
  unit: string;
  isActive: boolean;
  isSeasonal?: boolean;
  seasonalStart?: string | null;
  seasonalEnd?: string | null;
  bulkDiscountQty?: number | null;
  bulkDiscountPrice?: number | string | null;
  harvestDate?: string | null;
  expiryDate?: string | null;
  isOrganic?: boolean;
  category?: { id: string; name: string; slug: string } | null;
  seller?: { id: string; storeName: string; rating?: number } | null;
  variants?: Array<{
    id: string;
    sku: string;
    attributeName?: string | null;
    attributeValue?: string | null;
    priceOverride?: number | string | null;
    stockQuantity: number;
  }>;
  images?: Array<{ imageUrl: string; isPrimary?: boolean }>;
}

/** Frontend product shape (used by ProductCard, etc.) */
export interface Product {
  id: string | number;
  name: string;
  price: number;
  discountPrice?: number;
  category: string;
  stock: number;
  image: string;
  images?: string[];
  vendor: string;
  sellerId?: string;
  status: 'Active' | 'Archived' | 'Draft';
  sku: string;
  description?: string;
  unit?: string;
  isSeasonal?: boolean;
  seasonalStart?: string;
  seasonalEnd?: string;
  bulkDiscountQty?: number;
  bulkDiscountPrice?: number;
  harvestDate?: string;
  expiryDate?: string;
  isOrganic?: boolean;
  variants?: { id: string; name: string; price: number; stock: number; sku: string }[];
  badge?: string;
}

export function mapApiProductToProduct(p: ApiProduct): Product {
  const price = typeof p.basePrice === 'string' ? parseFloat(p.basePrice) : p.basePrice;
  const primaryImage = p.images?.find((i) => i.isPrimary) || p.images?.[0];
  const imageUrl = primaryImage?.imageUrl || '';
  const firstVariant = p.variants?.[0];
  return {
    id: p.id,
    name: p.name,
    price,
    category: p.category?.name ?? 'Uncategorized',
    stock: p.stock ?? 0,
    image: getImageDisplayUrl(imageUrl),
    images: p.images?.map((i) => i.imageUrl) ?? [],
    vendor: p.seller?.storeName ?? 'Store',
    sellerId: p.seller?.id,
    status: p.isActive ? 'Active' : 'Draft',
    sku: firstVariant?.sku ?? p.slug,
    description: p.description ?? undefined,
    unit: p.unit,
    isSeasonal: p.isSeasonal,
    seasonalStart: p.seasonalStart ?? undefined,
    seasonalEnd: p.seasonalEnd ?? undefined,
    bulkDiscountQty: p.bulkDiscountQty ?? undefined,
    bulkDiscountPrice: p.bulkDiscountPrice != null ? (typeof p.bulkDiscountPrice === 'string' ? parseFloat(p.bulkDiscountPrice) : p.bulkDiscountPrice) : undefined,
    harvestDate: p.harvestDate ?? undefined,
    expiryDate: p.expiryDate ?? undefined,
    isOrganic: p.isOrganic,
    variants: p.variants?.map((v) => ({
      id: v.id,
      name: v.attributeValue || v.sku,
      price: v.priceOverride != null ? (typeof v.priceOverride === 'string' ? parseFloat(v.priceOverride) : v.priceOverride) : price,
      stock: v.stockQuantity,
      sku: v.sku,
    })),
  };
}

export interface ProductsResponse {
  data: ApiProduct[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export interface ProductFilters {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  showOutOfSeason?: boolean;
}

export async function getProducts(filters: ProductFilters = {}): Promise<ProductsResponse> {
  const params = new URLSearchParams();
  if (filters.page != null) params.set('page', String(filters.page));
  if (filters.limit != null) params.set('limit', String(filters.limit));
  if (filters.search) params.set('search', filters.search);
  if (filters.categoryId) params.set('categoryId', filters.categoryId);
  if (filters.minPrice != null) params.set('minPrice', String(filters.minPrice));
  if (filters.maxPrice != null) params.set('maxPrice', String(filters.maxPrice));
  if (filters.sortBy) params.set('sortBy', filters.sortBy);
  if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
  if (filters.showOutOfSeason !== undefined) params.set('showOutOfSeason', String(filters.showOutOfSeason));
  const qs = params.toString();
  const res = await fetch(`${API_BASE}/products${qs ? `?${qs}` : ''}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export async function getProduct(id: string): Promise<ApiProduct | null> {
  const res = await fetch(`${API_BASE}/products/${id}`, { headers: getAuthHeaders() });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  imageUrl?: string | null;
}

export async function getCategories(): Promise<Category[]> {
  const res = await fetch(`${API_BASE}/categories`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export async function getSellers(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/sellers`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export async function getOrders(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/orders`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

/** Create order (auth required). Persists to database. */
export async function createOrder(body: {
  items: Array<{ productId: string; variantId: string; sellerId: string; quantity: number; pricePerUnit: number }>;
  shippingAddress: Record<string, unknown>;
  billingAddress?: Record<string, unknown>;
  couponCode?: string;
  idempotencyKey?: string;
}): Promise<{ id: string; orderNumber: string; [k: string]: unknown }> {
  const res = await fetch(`${API_BASE}/orders`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    let message = text;
    try {
      const data = JSON.parse(text) as { message?: string | string[] };
      if (data?.message != null) {
        message = Array.isArray(data.message) ? data.message.join('; ') : data.message;
      }
    } catch {
      /* use text as message */
    }
    throw new Error(message || res.statusText);
  }
  return res.json();
}

/** Update order status (admin/seller). Persists to database. */
export async function updateOrderStatus(orderId: string, status: string): Promise<unknown> {
  const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

/** Create Razorpay order for an existing order (returns razorpayOrderId + keyId for checkout). */
export async function createRazorpayOrder(
  orderId: string,
  amountInPaise: number,
  currency: string = 'INR'
): Promise<{ razorpayOrderId: string; keyId: string }> {
  const res = await fetch(`${API_BASE}/orders/${orderId}/create-razorpay-order`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ amountInPaise, currency }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    let message = text;
    try {
      const data = JSON.parse(text) as { message?: string | string[] };
      if (data?.message != null) {
        message = Array.isArray(data.message) ? data.message.join('; ') : data.message;
      }
    } catch { /* use text */ }
    throw new Error(message || res.statusText);
  }
  return res.json();
}

/** Verify Razorpay payment and capture order (after checkout success). */
export async function verifyPayment(
  orderId: string,
  payload: { razorpayOrderId: string; razorpayPaymentId: string; signature: string }
): Promise<{ success: boolean }> {
  const res = await fetch(`${API_BASE}/orders/${orderId}/verify-payment`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export async function getCustomers(): Promise<any[]> {
  const res = await fetch(`${API_BASE}/auth/users`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

/** Create product (auth required). See backend CreateProductDto. */
export async function createProduct(body: {
  name: string;
  description?: string;
  basePrice: number;
  sellerId: string;
  categoryId: string;
  unit?: string;
  harvestDate?: string;
  expiryDate?: string;
  isSeasonal?: boolean;
  seasonalStart?: string;
  seasonalEnd?: string;
  bulkDiscountQty?: number;
  bulkDiscountPrice?: number;
  variants?: Array<{ sku: string; attributeName?: string; attributeValue?: string; priceOverride?: number; stockQuantity: number }>;
  images?: Array<{ imageUrl: string; isPrimary?: boolean }>;
}): Promise<ApiProduct> {
  const res = await fetch(`${API_BASE}/products`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

/** Update product (auth required). */
export async function updateProduct(
  id: string,
  body: Partial<{
    name: string;
    description: string;
    basePrice: number;
    categoryId: string;
    harvestDate: string | null;
    expiryDate: string | null;
    isSeasonal: boolean;
    seasonalStart: string | null;
    seasonalEnd: string | null;
    bulkDiscountQty: number;
    bulkDiscountPrice: number;
    isActive: boolean;
    images: Array<{ imageUrl: string; isPrimary?: boolean }>;
  }>
): Promise<ApiProduct> {
  const res = await fetch(`${API_BASE}/products/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

/** Soft-delete product (auth required). */
export async function deleteProduct(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/products/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
}

/** Approve seller application (admin only). */
export async function approveSeller(sellerId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/sellers/${sellerId}/approve`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
}

/** Get serviceable cities (where we deliver). Public. */
export async function getServiceableAreas(): Promise<{ cities: string[] }> {
  const res = await fetch(`${API_BASE}/settings/serviceable-areas`);
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

/** Update serviceable cities (admin only). */
export async function updateServiceableAreas(cities: string[]): Promise<{ cities: string[] }> {
  const res = await fetch(`${API_BASE}/settings/serviceable-areas`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ cities }),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

/** Get store settings (theme, preferences, delivery charge) — public, for storefront. */
export async function getStoreSettings(): Promise<{
  theme: Record<string, unknown> | null;
  preferences: Record<string, unknown> | null;
  deliveryCharge: number;
}> {
  const res = await fetch(`${API_BASE}/settings/store`);
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

/** Update store settings (admin only). Persists theme, preferences, delivery charge. */
export async function updateStoreSettings(body: {
  theme?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  deliveryCharge?: number;
}): Promise<{ theme: Record<string, unknown> | null; preferences: Record<string, unknown> | null; deliveryCharge: number; message?: string }> {
  const res = await fetch(`${API_BASE}/settings/store`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

/** Validate a promo/coupon code (public). Returns discount info if valid. */
export async function validateCoupon(code: string): Promise<{
  valid: boolean;
  message?: string;
  discountType?: string;
  discountValue?: number;
  maxDiscount?: number | null;
  minOrderValue?: number | null;
}> {
  const res = await fetch(`${API_BASE}/settings/validate-coupon?code=${encodeURIComponent(code.trim())}`);
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export { API_BASE };

/** Base URL of the backend server (no path). Use for static assets like /uploads/xxx */
export const API_ORIGIN = typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_ORIGIN
  ? (import.meta as any).env.VITE_API_ORIGIN
  : (() => {
      try {
        return new URL(API_BASE).origin;
      } catch {
        return 'http://localhost:3000';
      }
    })();

/** Turn image URL or path into a full URL for display */
export function getImageDisplayUrl(urlOrPath: string): string {
  if (!urlOrPath) return '';
  if (urlOrPath.startsWith('http://') || urlOrPath.startsWith('https://')) return urlOrPath;
  return `${API_ORIGIN}${urlOrPath.startsWith('/') ? '' : '/'}${urlOrPath}`;
}
