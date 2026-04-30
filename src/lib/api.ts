/**
 * API client for backend. All data comes from the database via these endpoints.
 */
import type { SavedDeliveryAddress } from './deliveryAddressUtils';

const API_BASE = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_URL) || 'http://localhost:3000/v1';

/** Use for all fetch(): avoids mixed content by using relative /api/v1 when page is HTTPS and base is HTTP */
export function getEffectiveApiBase(): string {
  if (typeof window !== 'undefined' && window.location?.protocol === 'https:' && API_BASE.startsWith('http://'))
    return '/api/v1';
  return API_BASE;
}

function getAuthHeaders(): HeadersInit {
  const token =
    localStorage.getItem('token')
    || localStorage.getItem('accessToken')
    || sessionStorage.getItem('token')
    || sessionStorage.getItem('accessToken');
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

/** Current user from GET /auth/me (includes linked seller row when applicable). */
export type AuthProfile = {
  id: string;
  email: string;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  lastLogin?: string | null;
  createdAt?: string;
  role?: { name: string } | null;
  seller?: { id: string; storeName: string } | null;
};

export type AuthProfileUpdate = {
  firstName?: string;
  lastName?: string;
  phone?: string;
  address?: string;
};

export async function getAuthProfile(): Promise<AuthProfile> {
  const res = await fetch(`${getEffectiveApiBase()}/auth/me`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export async function updateAuthProfile(body: AuthProfileUpdate): Promise<AuthProfile> {
  const res = await fetch(`${getEffectiveApiBase()}/auth/profile`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export async function submitContactMessage(body: {
  name: string;
  email: string;
  subject: string;
  message: string;
}): Promise<{ message?: string }> {
  const res = await fetch(`${getEffectiveApiBase()}/contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export async function subscribeNewsletter(email: string): Promise<{ message?: string }> {
  const res = await fetch(`${getEffectiveApiBase()}/newsletter/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

/** Saved delivery addresses for the logged-in customer. */
export async function getUserAddresses(): Promise<SavedDeliveryAddress[]> {
  const res = await fetch(`${getEffectiveApiBase()}/addresses`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export async function createUserAddress(body: {
  label?: string;
  name: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault?: boolean;
}): Promise<SavedDeliveryAddress> {
  const res = await fetch(`${getEffectiveApiBase()}/addresses`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export async function updateUserAddress(
  id: string,
  body: Partial<{
    label: string | null;
    name: string;
    phone: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    pincode: string;
    isDefault: boolean;
  }>,
): Promise<SavedDeliveryAddress> {
  const res = await fetch(`${getEffectiveApiBase()}/addresses/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export async function deleteUserAddress(id: string): Promise<void> {
  const res = await fetch(`${getEffectiveApiBase()}/addresses/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
}

export async function setDefaultUserAddress(id: string): Promise<SavedDeliveryAddress> {
  const res = await fetch(`${getEffectiveApiBase()}/addresses/${id}/default`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

/** Whether a catalog row belongs to the logged-in seller (prefers sellerId over display name). */
export function productBelongsToSeller(
  product: { sellerId?: string; vendor: string },
  user: { sellerId?: string; sellerStoreName?: string; name?: string } | null | undefined,
): boolean {
  if (!user) return false;
  if (user.sellerId && product.sellerId) {
    return String(product.sellerId) === String(user.sellerId);
  }
  const store = user.sellerStoreName ?? user.name;
  return !!store && product.vendor === store;
}

/** Backend product shape (from API) */
export interface ApiProduct {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  basePrice: number | string;
  stock: number; // mapped to availableQuantity
  availableQuantity: number;
  reservedQuantity: number;
  lowStockThreshold?: number;
  unit: string;
  isActive: boolean;
  isSeasonal?: boolean;
  seasonalStart?: string | null;
  seasonalEnd?: string | null;
  bulkDiscountQty?: number | null;
  bulkDiscountPrice?: number | string | null;
  allowCashOnDelivery?: boolean | null;
  harvestDate?: string | null;
  expiryDate?: string | null;
  isOrganic?: boolean;
  /** 1–5 freshness score set by admin/seller */
  freshnessScore?: number | null;
  /** e.g. 'Unripe', 'Ripening', 'Ripe & Ready', 'Peak Ripe', 'Over-ripe' */
  ripenessStage?: string | null;
  /** Farm / supplier name */
  farmName?: string | null;
  /** State the farm is in, e.g. 'Karnataka' */
  farmState?: string | null;
  origin?: string | null;
  nutritionalInfo?: string | null;
  category?: { id: string; name: string; slug: string } | null;
  seller?: { id: string; storeName: string; rating?: number } | null;
  variants?: Array<{
    id: string;
    sku: string;
    attributeName?: string | null;
    attributeValue?: string | null;
    priceOverride?: number | string | null;
    stockQuantity: number;
    availableQuantity: number;
    reservedQuantity: number;
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
  stock: number; // For compatibility
  availableStock: number;
  reservedStock: number;
  lowStockThreshold?: number;
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
  allowCashOnDelivery?: boolean;
  harvestDate?: string;
  expiryDate?: string;
  isOrganic?: boolean;
  variants?: { id: string; name: string; price: number; stock: number; availableStock: number; reservedStock: number; sku: string }[];
  badge?: string;
  /** 1–5 freshness intelligence score */
  freshnessScore?: number;
  /** Ripeness stage string, e.g. 'Ripe & Ready' */
  ripenessStage?: string;
  /** Farm origin name */
  farmName?: string;
  /** Farm origin state */
  farmState?: string;
  origin?: string;
  nutritionalInfo?: string;
}

export function mapApiProductToProduct(p: ApiProduct): Product {
  const price = typeof p.basePrice === 'object' ? Number(p.basePrice) : (typeof p.basePrice === 'string' ? parseFloat(p.basePrice) : p.basePrice);
  const primaryImage = p.images?.find((i) => i.isPrimary) || p.images?.[0];
  const imageUrl = primaryImage?.imageUrl || '';
  const firstVariant = p.variants?.[0];
  return {
    id: p.id,
    name: p.name,
    price,
    category: p.category?.name ?? 'Uncategorized',
    stock: p.stock ?? 0,
    availableStock: p.availableQuantity ?? p.stock ?? 0,
    reservedStock: p.reservedQuantity ?? 0,
    lowStockThreshold: p.lowStockThreshold ?? 5,
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
    bulkDiscountPrice: p.bulkDiscountPrice != null ? (typeof p.bulkDiscountPrice === 'object' ? Number(p.bulkDiscountPrice) : (typeof p.bulkDiscountPrice === 'string' ? parseFloat(p.bulkDiscountPrice) : p.bulkDiscountPrice)) : undefined,
    allowCashOnDelivery: p.allowCashOnDelivery ?? true,
    harvestDate: p.harvestDate ?? undefined,
    expiryDate: p.expiryDate ?? undefined,
    isOrganic: p.isOrganic,
    freshnessScore: p.freshnessScore ?? undefined,
    ripenessStage: p.ripenessStage ?? undefined,
    farmName: p.farmName ?? undefined,
    farmState: p.farmState ?? undefined,
    origin: p.origin ?? undefined,
    nutritionalInfo: p.nutritionalInfo ?? undefined,
    variants: p.variants?.map((v) => ({
      id: v.id,
      name: v.attributeValue || v.sku,
      price: v.priceOverride != null ? (typeof v.priceOverride === 'object' ? Number(v.priceOverride) : (typeof v.priceOverride === 'string' ? parseFloat(v.priceOverride) : v.priceOverride)) : price,
      stock: v.stockQuantity ?? 0,
      availableStock: v.availableQuantity ?? v.stockQuantity,
      reservedStock: v.reservedQuantity ?? 0,
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
  includeInactive?: boolean;
}

function productFiltersCacheKey(filters: ProductFilters): string {
  return JSON.stringify({
    p: filters.page ?? 1,
    l: filters.limit ?? 24,
    s: filters.search ?? '',
    c: filters.categoryId ?? '',
    min: filters.minPrice ?? '',
    max: filters.maxPrice ?? '',
    sb: filters.sortBy ?? '',
    so: filters.sortOrder ?? '',
    oos: filters.showOutOfSeason === true,
    ii: filters.includeInactive === true,
  });
}

const PRODUCT_LIST_TTL_MS = 8_000;
const productListCache = new Map<string, { at: number; data: ProductsResponse }>();
const productListInflight = new Map<string, Promise<ProductsResponse>>();

/** Clear cached product list responses (e.g. after admin edits). */
export function invalidateProductsListCache(): void {
  productListCache.clear();
  productListInflight.clear();
}

/** Synchronous check to see if a product list query is already in cache and fresh. */
export function hasProductsCache(filters: ProductFilters = {}): boolean {
  const key = productFiltersCacheKey(filters);
  const hit = productListCache.get(key);
  return !!(hit && Date.now() - hit.at < PRODUCT_LIST_TTL_MS);
}

/** Same as getProducts but dedupes in-flight requests and caches briefly (storefront performance). */
export async function getProductsCached(filters: ProductFilters = {}): Promise<ProductsResponse> {
  const key = productFiltersCacheKey(filters);
  const hit = productListCache.get(key);
  if (hit && Date.now() - hit.at < PRODUCT_LIST_TTL_MS) {
    return hit.data;
  }
  const pending = productListInflight.get(key);
  if (pending) return pending;

  const promise = getProducts(filters)
    .then((data) => {
      productListCache.set(key, { at: Date.now(), data });
      productListInflight.delete(key);
      return data;
    })
    .catch((err) => {
      productListInflight.delete(key);
      throw err;
    });
  productListInflight.set(key, promise);
  return promise;
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
  if (filters.includeInactive !== undefined) params.set('includeInactive', String(filters.includeInactive));
  const qs = params.toString();
  const res = await fetch(`${getEffectiveApiBase()}/products${qs ? `?${qs}` : ''}`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export async function getProduct(id: string): Promise<ApiProduct | null> {
  const res = await fetch(`${getEffectiveApiBase()}/products/${id}`, { headers: getAuthHeaders() });
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
  const res = await fetch(`${getEffectiveApiBase()}/categories`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export type AdminContactSubmission = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  submittedAt: string;
};

export async function getAdminContactSubmissions(limit: number = 12): Promise<AdminContactSubmission[]> {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  const res = await fetch(`${getEffectiveApiBase()}/settings/contact-submissions?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  const data = await res.json() as { items?: AdminContactSubmission[] };
  return Array.isArray(data?.items) ? data.items : [];
}

export async function createCategory(body: { name: string; description?: string; imageUrl?: string }): Promise<Category> {
  const res = await fetch(`${getEffectiveApiBase()}/categories`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export async function getSellers(): Promise<any[]> {
  const res = await fetch(`${getEffectiveApiBase()}/sellers`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

/** Suspend seller (admin only). */
export async function suspendSeller(sellerId: string): Promise<void> {
  const res = await fetch(`${getEffectiveApiBase()}/sellers/${sellerId}/suspend`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
}

/** Reactivate a suspended seller (admin only). */
export async function reactivateSeller(sellerId: string): Promise<void> {
  const res = await fetch(`${getEffectiveApiBase()}/sellers/${sellerId}/reactivate`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
}

export async function getOrders(): Promise<any[]> {
  const res = await fetch(`${getEffectiveApiBase()}/orders`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

const ORDERS_CACHE_TTL_MS = 20_000;
let ordersCache: { at: number; data: any[] } | null = null;
let ordersInflight: Promise<any[]> | null = null;

/** Cached orders for fast dashboard/profile loads (stale-while-revalidate friendly). */
export async function getOrdersCached(options?: { forceRefresh?: boolean }): Promise<any[]> {
  const forceRefresh = options?.forceRefresh === true;
  if (!forceRefresh && ordersCache && Date.now() - ordersCache.at < ORDERS_CACHE_TTL_MS) {
    return ordersCache.data;
  }
  if (!forceRefresh && ordersInflight) {
    return ordersInflight;
  }
  ordersInflight = getOrders()
    .then((data) => {
      const safe = Array.isArray(data) ? data : [];
      ordersCache = { at: Date.now(), data: safe };
      ordersInflight = null;
      return safe;
    })
    .catch((err) => {
      ordersInflight = null;
      throw err;
    });
  return ordersInflight;
}

/** Returns current cached orders snapshot without network call. */
export function getOrdersCachedSnapshot(): any[] | null {
  if (!ordersCache) return null;
  return ordersCache.data;
}

/** Invalidate orders cache after mutations. */
export function invalidateOrdersCache(): void {
  ordersCache = null;
  ordersInflight = null;
}

/** Create order (auth required). Persists to database. */
export async function createOrder(body: {
  items: Array<{ productId: string; variantId: string; quantity: number }>;
  shippingAddress: Record<string, unknown>;
  billingAddress?: Record<string, unknown>;
  couponCode?: string;
  deliverySlot?: string;
  distanceKm?: number;
  idempotencyKey?: string;
  paymentMethod?: 'online' | 'cod';
  savedAddressId?: string;
}): Promise<{ id: string; orderNumber: string; [k: string]: unknown }> {
  const res = await fetch(`${getEffectiveApiBase()}/orders`, {
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

/** Subscription signup order (no line items; pay via existing Razorpay endpoints). */
export async function createSubscriptionOrder(body: {
  planId: string;
  fruitSelection: string[];
  deliveryDay: string;
  shippingAddress: Record<string, unknown>;
  idempotencyKey?: string;
  savedAddressId?: string;
}): Promise<{ id: string; orderNumber: string; payableAmount?: unknown; [k: string]: unknown }> {
  const res = await fetch(`${getEffectiveApiBase()}/orders/subscription`, {
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
      /* use text */
    }
    throw new Error(message || res.statusText);
  }
  return res.json();
}

/** Update order status (admin/seller). Persists to database. */
export async function updateOrderStatus(orderId: string, status: string): Promise<unknown> {
  const res = await fetch(`${getEffectiveApiBase()}/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

/** Update order payment status (admin only). Persists to database. */
export async function updateOrderPaymentStatus(orderId: string, paymentStatus: string): Promise<unknown> {
  const res = await fetch(`${getEffectiveApiBase()}/orders/${orderId}/payment-status`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify({ paymentStatus }),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

/** Admin: Place a manual order ( Direct Entry ). automatically creates user if email is new. */
export async function createManualOrder(body: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: Array<{ productId: string; variantId: string; sellerId: string; quantity: number; pricePerUnit: number }>;
  shippingAddress: Record<string, unknown>;
  status?: string;
  paymentStatus?: string;
}): Promise<any> {
  const res = await fetch(`${getEffectiveApiBase()}/orders/manual`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || res.statusText);
  }
  return res.json();
}

/** Admin: Generate a sharable Razorpay payment link for an order. */
export async function generateOrderPaymentLink(
  orderId: string,
  amountInPaise: number,
  customerDetails?: { name: string; email?: string; contact?: string }
): Promise<{ paymentLink: string; emailDispatch?: { sent: boolean; error?: string } }> {
  const res = await fetch(`${getEffectiveApiBase()}/orders/${orderId}/payment-link`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ amountInPaise, customerDetails }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(text || res.statusText);
  }
  return res.json();
}

/** Create Razorpay order for an existing order (returns razorpayOrderId + keyId for checkout). */
export async function createRazorpayOrder(
  orderId: string,
  amountInPaise: number,
  currency: string = 'INR'
): Promise<{ razorpayOrderId: string; keyId: string }> {
  const res = await fetch(`${getEffectiveApiBase()}/orders/${orderId}/create-razorpay-order`, {
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
  const res = await fetch(`${getEffectiveApiBase()}/orders/${orderId}/verify-payment`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

/** Public: sync and capture payment for manual-order payment links (no auth required). */
export async function confirmPaymentLink(orderId: string, payload?: {
  paymentId?: string;
  paymentLinkId?: string;
  paymentLinkStatus?: string;
}): Promise<{ success: boolean; paymentStatus: string; orderStatus: string; captured: boolean }> {
  const res = await fetch(`${getEffectiveApiBase()}/orders/public/${orderId}/confirm-payment-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export async function registerUser(payload: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<{ message: string }> {
  const [firstName, ...rest] = payload.name.split(' ');
  const lastName = rest.join(' ');
  const body = {
    email: payload.email,
    phone: payload.phone.trim(),
    password: payload.password,
    firstName: firstName || undefined,
    lastName: lastName || undefined,
  };
  const res = await fetch(`${getEffectiveApiBase()}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = res.statusText;
    let verifyEmail: string | undefined;
    try {
      const data = await res.json();
      if (typeof data?.email === 'string' && data.email.trim()) verifyEmail = data.email.trim();
      const raw = data?.message;
      if (typeof raw === 'string' && raw.trim()) message = raw;
      else if (Array.isArray(raw)) message = raw.join('; ');
    } catch {
      message = await res.text().catch(() => res.statusText);
    }
    const err = new Error(message || 'Signup failed') as Error & { verifyEmail?: string };
    if (verifyEmail) err.verifyEmail = verifyEmail;
    throw err;
  }
  return res.json();
}

export async function verifyEmailCode(email: string, code: string): Promise<{ message: string }> {
  const res = await fetch(`${getEffectiveApiBase()}/auth/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export async function resendEmailCode(email: string): Promise<{ message: string }> {
  const res = await fetch(`${getEffectiveApiBase()}/auth/resend-email-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const res = await fetch(`${getEffectiveApiBase()}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export async function resetPasswordWithCode(email: string, code: string, newPassword: string): Promise<{ message: string }> {
  const res = await fetch(`${getEffectiveApiBase()}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, newPassword }),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  const res = await fetch(`${getEffectiveApiBase()}/auth/change-password`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export async function getCustomers(): Promise<any[]> {
  const res = await fetch(`${getEffectiveApiBase()}/auth/users`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

/** Admin: bulk in-app notification (+ optional email) to customers. */
export async function postBulkCustomerAnnouncement(body: {
  title: string;
  message: string;
  audience: 'all' | 'verified' | 'with_orders';
  sendEmail?: boolean;
}): Promise<{
  notificationsCreated: number;
  emailsSent?: number;
  emailsFailed?: number;
  emailBatchCapped?: boolean;
  emailCap?: number;
  message?: string;
}> {
  const res = await fetch(`${getEffectiveApiBase()}/auth/users/bulk-announcement`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    let msg = text;
    try {
      const data = JSON.parse(text) as { message?: string | string[] };
      if (data?.message != null) {
        msg = Array.isArray(data.message) ? data.message.join('; ') : String(data.message);
      }
    } catch {
      /* use text */
    }
    throw new Error(msg || res.statusText);
  }
  return res.json();
}

export interface UserNotification {
  id: string;
  title: string;
  message: string;
  type?: string;
  isRead: boolean;
  createdAt: string;
}

export async function getMyNotifications(params?: { limit?: number; unreadOnly?: boolean }): Promise<{
  items: UserNotification[];
  unreadCount: number;
}> {
  const q = new URLSearchParams();
  if (typeof params?.limit === 'number') q.set('limit', String(params.limit));
  if (typeof params?.unreadOnly === 'boolean') q.set('unreadOnly', String(params.unreadOnly));
  const suffix = q.toString() ? `?${q.toString()}` : '';
  const res = await fetch(`${getEffectiveApiBase()}/auth/notifications${suffix}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export async function markAllNotificationsRead(): Promise<{ updated: number }> {
  const res = await fetch(`${getEffectiveApiBase()}/auth/notifications/read-all`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
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
  isOrganic?: boolean;
  seasonalStart?: string;
  seasonalEnd?: string;
  bulkDiscountQty?: number;
  bulkDiscountPrice?: number;
  allowCashOnDelivery?: boolean;
  variants?: Array<{ sku: string; attributeName?: string; attributeValue?: string; priceOverride?: number; stockQuantity: number }>;
  images?: Array<{ imageUrl: string; isPrimary?: boolean }>;
  lowStockThreshold?: number;
  freshnessScore?: number;
  ripenessStage?: string;
  farmName?: string;
  farmState?: string;
  origin?: string;
  nutritionalInfo?: string;
}): Promise<ApiProduct> {
  const res = await fetch(`${getEffectiveApiBase()}/products`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  invalidateProductsListCache();
  return res.json();
}

/** Update product (auth required). */
export async function updateProduct(
  id: string,
  body: Partial<{
    name: string;
    description: string;
    basePrice: number;
    sellerId: string;
    categoryId: string;
    harvestDate: string | null;
    expiryDate: string | null;
    isSeasonal: boolean;
    isOrganic: boolean;
    seasonalStart: string | null;
    seasonalEnd: string | null;
    bulkDiscountQty: number;
    bulkDiscountPrice: number;
    allowCashOnDelivery: boolean;
    isActive: boolean;
    images: Array<{ imageUrl: string; isPrimary?: boolean }>;
    variants?: Array<{ id?: string; sku?: string; attributeName?: string; attributeValue?: string; priceOverride?: number; stockQuantity?: number; lowStockThreshold?: number }>;
    lowStockThreshold?: number;
    freshnessScore?: number;
    ripenessStage?: string;
    farmName?: string;
    farmState?: string;
    origin?: string;
    nutritionalInfo?: string;
  }>
): Promise<ApiProduct> {
  const res = await fetch(`${getEffectiveApiBase()}/products/${id}`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  invalidateProductsListCache();
  return res.json();
}

/** Archive product by default; admin may request permanent delete. */
export async function deleteProduct(id: string, options?: { permanent?: boolean }): Promise<void> {
  const params = new URLSearchParams();
  if (options?.permanent) params.set('permanent', 'true');
  const q = params.toString();
  const res = await fetch(`${getEffectiveApiBase()}/products/${id}${q ? `?${q}` : ''}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  invalidateProductsListCache();
}

/** Approve seller application (admin only). */
export async function approveSeller(sellerId: string): Promise<void> {
  const res = await fetch(`${getEffectiveApiBase()}/sellers/${sellerId}/approve`, {
    method: 'PATCH',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
}

/** Get serviceable cities and optional 6-digit pincodes (where we deliver). Public. */
export async function getServiceableAreas(): Promise<{ cities: string[]; pincodes: string[] }> {
  const res = await fetch(`${getEffectiveApiBase()}/settings/serviceable-areas`);
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  const data = await res.json();
  return {
    cities: Array.isArray(data?.cities) ? data.cities : [],
    pincodes: Array.isArray(data?.pincodes) ? data.pincodes : [],
  };
}

/** Update serviceable cities and/or pincodes (admin only). Omit a field to leave it unchanged. */
export async function updateServiceableAreas(body: {
  cities?: string[];
  pincodes?: string[];
}): Promise<{ cities: string[]; pincodes: string[] }> {
  const res = await fetch(`${getEffectiveApiBase()}/settings/serviceable-areas`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  const data = await res.json();
  return {
    cities: Array.isArray(data?.cities) ? data.cities : [],
    pincodes: Array.isArray(data?.pincodes) ? data.pincodes : [],
  };
}

/** Get store settings (theme, preferences, delivery charge) — public, for storefront. */
export async function getStoreSettings(): Promise<{
  theme: Record<string, unknown> | null;
  preferences: Record<string, unknown> | null;
  deliveryCharge: number;
  deliveryFeeRules?: Array<{ upToKm: number; fee: number }>;
  deliveryFeeMode?: 'SLAB' | 'PER_KM';
  deliveryPerKmRate?: number;
  freeDeliveryThreshold?: number;
}> {
  const res = await fetch(`${getEffectiveApiBase()}/settings/store`);
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

/** Update store settings (admin only). Persists theme, preferences, delivery charge. */
export async function updateStoreSettings(body: {
  theme?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  deliveryCharge?: number;
  deliveryFeeRules?: Array<{ upToKm: number; fee: number }>;
  deliveryFeeMode?: 'SLAB' | 'PER_KM';
  deliveryPerKmRate?: number;
  freeDeliveryThreshold?: number;
}): Promise<{
  theme: Record<string, unknown> | null;
  preferences: Record<string, unknown> | null;
  deliveryCharge: number;
  deliveryFeeRules?: Array<{ upToKm: number; fee: number }>;
  deliveryFeeMode?: 'SLAB' | 'PER_KM';
  deliveryPerKmRate?: number;
  freeDeliveryThreshold?: number;
  message?: string;
}> {
  const res = await fetch(`${getEffectiveApiBase()}/settings/store`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

/** List warehouses (for checkout distance/ETA). Public. */
export async function getWarehouses(activeOnly = true): Promise<Array<{
  id: string;
  name: string;
  address: string;
  latitude: number | string;
  longitude: number | string;
  isActive: boolean;
}>> {
  const res = await fetch(`${getEffectiveApiBase()}/warehouses?activeOnly=${activeOnly}`);
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

/** Create warehouse (admin only). */
export async function createWarehouse(data: { name: string; address: string; latitude: number; longitude: number; isActive?: boolean }): Promise<{ id: string }> {
  const res = await fetch(`${getEffectiveApiBase()}/warehouses`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

/** Update warehouse (admin only). */
export async function updateWarehouse(id: string, data: Partial<{ name: string; address: string; latitude: number; longitude: number; isActive: boolean }>): Promise<unknown> {
  const res = await fetch(`${getEffectiveApiBase()}/warehouses/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

/** Delete warehouse (admin only). */
export async function deleteWarehouse(id: string): Promise<void> {
  const res = await fetch(`${getEffectiveApiBase()}/warehouses/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
}

/** List delivery partners / in-house delivery staff (admin only). */
export async function getDeliveryPartners(): Promise<Array<{ id: string; name: string; phone: string; vehicle: string | null; status: string; onlineStatus?: string; user?: { email: string } }>> {
  const res = await fetch(`${getEffectiveApiBase()}/delivery-partners`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

/** Create delivery partner (admin only). Also provisions login with temp password. */
export async function createDeliveryPartner(data: { name: string; phone: string; email: string; vehicle?: string; status?: string }): Promise<{ id: string }> {
  const res = await fetch(`${getEffectiveApiBase()}/delivery-partners`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

/** Update delivery partner (admin only). */
export async function updateDeliveryPartner(
  id: string,
  data: Partial<{ name: string; phone: string; email: string; vehicle: string; status: string }>,
): Promise<unknown> {
  const res = await fetch(`${getEffectiveApiBase()}/delivery-partners/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

/** Delete delivery partner (admin only). */
export async function deleteDeliveryPartner(id: string): Promise<void> {
  const res = await fetch(`${getEffectiveApiBase()}/delivery-partners/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
}

/** Assign an order to a delivery partner (admin only). */
export async function assignDeliveryPartner(orderId: string, partnerId: string): Promise<void> {
  const res = await fetch(`${getEffectiveApiBase()}/delivery-partners/assign`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ orderId, partnerId }),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
}

/** Validate a promo/coupon code (public). Returns discount info if valid. */
export async function validateCoupon(code: string, context?: {
  productId?: string;
  categoryName?: string;
  cartProductIds?: string[];
  cartCategoryNames?: string[];
}): Promise<{
  valid: boolean;
  message?: string;
  discountType?: string;
  discountValue?: number;
  maxDiscount?: number | null;
  minOrderValue?: number | null;
}> {
  const params = new URLSearchParams();
  params.set('code', code.trim());
  if (context?.productId) params.set('productId', context.productId);
  if (context?.categoryName) params.set('categoryName', context.categoryName);
  if (context?.cartProductIds?.length) params.set('cartProductIds', context.cartProductIds.join(','));
  if (context?.cartCategoryNames?.length) params.set('cartCategoryNames', context.cartCategoryNames.join(','));
  const res = await fetch(`${getEffectiveApiBase()}/settings/validate-coupon?${params.toString()}`);
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  return res.json();
}

export interface AvailableOffer {
  code: string;
  discountType: string;
  discountValue: number;
  maxDiscount: number | null;
  minOrderValue: number | null;
  expiryDate: string | null;
  usageLeft: number | null;
  scopeType: 'ALL' | 'CATEGORY' | 'PRODUCT';
  categoryNames: string[];
  productIds: string[];
}

export interface AdminCoupon {
  id: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  minOrderValue: number | null;
  maxDiscount: number | null;
  expiryDate: string | null;
  usageLimit: number | null;
  usedCount: number;
  isActive: boolean;
}

export interface CouponScopeRule {
  code: string;
  scopeType: 'ALL' | 'CATEGORY' | 'PRODUCT';
  categoryNames?: string[];
  productIds?: string[];
}

/** Get public list of active offers for storefront surfaces. */
export async function getAvailableOffers(filters?: {
  productId?: string;
  categoryName?: string;
  cartProductIds?: string[];
  cartCategoryNames?: string[];
}): Promise<AvailableOffer[]> {
  const params = new URLSearchParams();
  if (filters?.productId) params.set('productId', filters.productId);
  if (filters?.categoryName) params.set('categoryName', filters.categoryName);
  if (filters?.cartProductIds?.length) params.set('cartProductIds', filters.cartProductIds.join(','));
  if (filters?.cartCategoryNames?.length) params.set('cartCategoryNames', filters.cartCategoryNames.join(','));
  const qs = params.toString();
  const res = await fetch(`${getEffectiveApiBase()}/settings/offers${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  const data = await res.json();
  return Array.isArray(data?.offers) ? data.offers : [];
}

export async function getAdminCoupons(): Promise<AdminCoupon[]> {
  const res = await fetch(`${getEffectiveApiBase()}/settings/coupons`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  const data = await res.json();
  return Array.isArray(data?.coupons) ? data.coupons : [];
}

export async function createAdminCoupon(body: {
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  minOrderValue?: number | null;
  maxDiscount?: number | null;
  expiryDate?: string | null;
  usageLimit?: number | null;
  isActive?: boolean;
}): Promise<AdminCoupon> {
  const res = await fetch(`${getEffectiveApiBase()}/settings/coupons/create`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  const data = await res.json();
  return data.coupon;
}

export async function updateAdminCoupon(id: string, body: {
  code?: string;
  discountType?: 'PERCENTAGE' | 'FIXED';
  discountValue?: number;
  minOrderValue?: number | null;
  maxDiscount?: number | null;
  expiryDate?: string | null;
  usageLimit?: number | null;
  isActive?: boolean;
}): Promise<AdminCoupon> {
  const res = await fetch(`${getEffectiveApiBase()}/settings/coupons/${id}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  const data = await res.json();
  return data.coupon;
}

export async function deleteAdminCoupon(id: string): Promise<void> {
  const res = await fetch(`${getEffectiveApiBase()}/settings/coupons/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
}

export async function getCouponScopes(): Promise<CouponScopeRule[]> {
  const res = await fetch(`${getEffectiveApiBase()}/settings/coupon-scopes`, { headers: getAuthHeaders() });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  const data = await res.json();
  return Array.isArray(data?.scopes) ? data.scopes : [];
}

export async function updateCouponScopes(scopes: CouponScopeRule[]): Promise<CouponScopeRule[]> {
  const res = await fetch(`${getEffectiveApiBase()}/settings/coupon-scopes`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ scopes }),
  });
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  const data = await res.json();
  return Array.isArray(data?.scopes) ? data.scopes : [];
}

export { API_BASE };

/** Base URL of the backend server (no path). Use for static assets like /uploads/xxx */
export const API_ORIGIN = (() => {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_ORIGIN)
    return (import.meta as any).env.VITE_API_ORIGIN;
  // Relative API path (e.g. /api/v1 in production) → use current origin so images and verify-payment work
  if (typeof API_BASE === 'string' && API_BASE.startsWith('/') && typeof window !== 'undefined' && window.location?.origin)
    return window.location.origin;
  try {
    return new URL(API_BASE).origin;
  } catch {
    return typeof window !== 'undefined' && window.location?.origin ? window.location.origin : 'http://localhost:3000';
  }
})();

/** Turn image URL or path into a full URL for display. Rewrites http to current origin when page is HTTPS to avoid mixed content. */
export function getImageDisplayUrl(urlOrPath: string): string {
  if (!urlOrPath) return '';
  if (urlOrPath.startsWith('http://')) {
    if (typeof window !== 'undefined' && window.location?.protocol === 'https:') {
      try {
        const u = new URL(urlOrPath);
        return window.location.origin + u.pathname + u.search;
      } catch {
        return urlOrPath;
      }
    }
    return urlOrPath;
  }
  if (urlOrPath.startsWith('https://')) return urlOrPath;
  return `${API_ORIGIN}${urlOrPath.startsWith('/') ? '' : '/'}${urlOrPath}`;
}
