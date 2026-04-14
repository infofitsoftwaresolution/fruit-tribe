import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

const KEY_RAZORPAY_KEY_ID = 'razorpay_key_id';
const KEY_RAZORPAY_KEY_SECRET = 'razorpay_key_secret';
const KEY_SERVICEABLE_CITIES = 'serviceable_cities';
const KEY_SERVICEABLE_PINCODES = 'serviceable_pincodes';
const KEY_STORE_THEME = 'store_theme';
const KEY_STORE_PREFERENCES = 'store_preferences';
const KEY_DELIVERY_CHARGE = 'delivery_charge';
const KEY_DELIVERY_FEE_RULES = 'delivery_fee_rules';
const KEY_DELIVERY_FEE_MODE = 'delivery_fee_mode';
const KEY_DELIVERY_PER_KM_RATE = 'delivery_per_km_rate';
const KEY_FREE_DELIVERY_THRESHOLD = 'free_delivery_threshold';
const KEY_COUPON_SCOPES = 'coupon_scopes';
const KEY_PLATFORM_FEE = 'platform_fee';

export interface DeliveryFeeRule {
    upToKm: number;
    fee: number;
}

export type DeliveryFeeMode = 'SLAB' | 'PER_KM';

export interface PublicCouponOffer {
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
    discountType: string;
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

interface CouponContext {
    productId?: string | null;
    categoryName?: string | null;
    cartProductIds?: string[];
    cartCategoryNames?: string[];
}

@Injectable()
export class SettingsService {
    private readonly logger = new Logger(SettingsService.name);

    constructor(private readonly prisma: PrismaService) {}

    async get(key: string): Promise<string | null> {
        const row = await this.prisma.storeSetting.findUnique({
            where: { key },
        });
        return row?.value ?? null;
    }

    async set(key: string, value: string): Promise<void> {
        await this.prisma.storeSetting.upsert({
            where: { key },
            create: { key, value },
            update: { value },
        });
        this.logger.log(`Setting updated: ${key}`);
    }

    async getRazorpayCredentials(): Promise<{ keyId: string; keySecret: string } | null> {
        const rows = await this.prisma.storeSetting.findMany({
            where: { key: { in: [KEY_RAZORPAY_KEY_ID, KEY_RAZORPAY_KEY_SECRET] } },
        });
        const map = Object.fromEntries(rows.map((r) => [r.key, r.value ?? '']));
        const keyId = map[KEY_RAZORPAY_KEY_ID]?.trim();
        const keySecret = map[KEY_RAZORPAY_KEY_SECRET]?.trim();
        if (!keyId || !keySecret) return null;
        return { keyId, keySecret };
    }

    async setRazorpayCredentials(keyId: string, keySecret: string): Promise<void> {
        await Promise.all([
            this.set(KEY_RAZORPAY_KEY_ID, keyId.trim()),
            this.set(KEY_RAZORPAY_KEY_SECRET, keySecret.trim()),
        ]);
    }

    /** Returns only the public Key ID for client-side Razorpay checkout (no secret). */
    async getRazorpayKeyId(): Promise<string | null> {
        return this.get(KEY_RAZORPAY_KEY_ID);
    }

    /** Get list of cities/areas where the store delivers (e.g. ["Bangalore", "Mumbai"]). */
    async getServiceableCities(): Promise<string[]> {
        const raw = await this.get(KEY_SERVICEABLE_CITIES);
        if (!raw?.trim()) return ['Bangalore'];
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === 'string') : ['Bangalore'];
        } catch {
            return ['Bangalore'];
        }
    }

    /** Set list of serviceable cities (admin only). */
    async setServiceableCities(cities: string[]): Promise<void> {
        const list = cities.filter(c => typeof c === 'string' && c.trim().length > 0);
        await this.set(KEY_SERVICEABLE_CITIES, JSON.stringify(list));
    }

    /** 6-digit PINs where we deliver. Empty list = no pincode restriction (city rules still apply). */
    async getServiceablePincodes(): Promise<string[]> {
        const raw = await this.get(KEY_SERVICEABLE_PINCODES);
        if (!raw?.trim()) return [];
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return [
                ...new Set(
                    parsed
                        .filter((p): p is string => typeof p === 'string')
                        .map((p) => p.replace(/\D/g, ''))
                        .filter((p) => p.length === 6),
                ),
            ];
        } catch {
            return [];
        }
    }

    async setServiceablePincodes(pincodes: string[]): Promise<void> {
        const normalized = [
            ...new Set(
                pincodes
                    .map((p) => String(p).replace(/\D/g, ''))
                    .filter((p) => p.length === 6),
            ),
        ];
        await this.set(KEY_SERVICEABLE_PINCODES, JSON.stringify(normalized));
    }

    /** Get store theme JSON (for storefront). Returns null if not set. */
    async getStoreTheme(): Promise<Record<string, unknown> | null> {
        const raw = await this.get(KEY_STORE_THEME);
        if (!raw?.trim()) return null;
        try {
            const parsed = JSON.parse(raw);
            return typeof parsed === 'object' && parsed !== null ? parsed : null;
        } catch {
            return null;
        }
    }

    /** Set store theme (admin only). */
    async setStoreTheme(theme: Record<string, unknown>): Promise<void> {
        await this.set(KEY_STORE_THEME, JSON.stringify(theme));
    }

    /** Get store preferences JSON (for storefront). Returns null if not set. */
    async getStorePreferences(): Promise<Record<string, unknown> | null> {
        const raw = await this.get(KEY_STORE_PREFERENCES);
        if (!raw?.trim()) return null;
        try {
            const parsed = JSON.parse(raw);
            return typeof parsed === 'object' && parsed !== null ? parsed : null;
        } catch {
            return null;
        }
    }

    /** Set store preferences (admin only). */
    async setStorePreferences(preferences: Record<string, unknown>): Promise<void> {
        await this.set(KEY_STORE_PREFERENCES, JSON.stringify(preferences));
    }

    /** Get delivery charge in INR (default 0). */
    async getDeliveryCharge(): Promise<number> {
        const raw = await this.get(KEY_DELIVERY_CHARGE);
        if (raw == null || raw === '') return 0;
        const n = parseFloat(raw);
        return Number.isFinite(n) && n >= 0 ? n : 0;
    }

    /** Set delivery charge in INR (admin only). */
    async setDeliveryCharge(amount: number): Promise<void> {
        const n = Number.isFinite(amount) && amount >= 0 ? amount : 0;
        await this.set(KEY_DELIVERY_CHARGE, String(n));
    }

    /** Get distance-based delivery fee rules. */
    async getDeliveryFeeRules(): Promise<DeliveryFeeRule[]> {
        const raw = await this.get(KEY_DELIVERY_FEE_RULES);
        if (!raw?.trim()) {
            // default slabs
            return [
                { upToKm: 3, fee: 20 },
                { upToKm: 8, fee: 40 },
                { upToKm: 15, fee: 60 },
                { upToKm: 9999, fee: 90 },
            ];
        }
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) throw new Error('Invalid rules');
            const normalized = parsed
                .map((r: any) => ({
                    upToKm: Number(r?.upToKm),
                    fee: Number(r?.fee),
                }))
                .filter((r) => Number.isFinite(r.upToKm) && r.upToKm > 0 && Number.isFinite(r.fee) && r.fee >= 0)
                .sort((a, b) => a.upToKm - b.upToKm);
            return normalized.length
                ? normalized
                : [
                    { upToKm: 3, fee: 20 },
                    { upToKm: 8, fee: 40 },
                    { upToKm: 15, fee: 60 },
                    { upToKm: 9999, fee: 90 },
                ];
        } catch {
            return [
                { upToKm: 3, fee: 20 },
                { upToKm: 8, fee: 40 },
                { upToKm: 15, fee: 60 },
                { upToKm: 9999, fee: 90 },
            ];
        }
    }

    /** Set distance-based delivery fee rules. */
    async setDeliveryFeeRules(rules: DeliveryFeeRule[]): Promise<void> {
        const normalized = (rules || [])
            .map((r) => ({
                upToKm: Number(r?.upToKm),
                fee: Number(r?.fee),
            }))
            .filter((r) => Number.isFinite(r.upToKm) && r.upToKm > 0 && Number.isFinite(r.fee) && r.fee >= 0)
            .sort((a, b) => a.upToKm - b.upToKm);
        await this.set(KEY_DELIVERY_FEE_RULES, JSON.stringify(normalized));
    }

    /** Calculate delivery fee from distance and current admin-defined slabs. */
    async calculateDeliveryFeeByDistance(distanceKm: number | null, orderValue?: number): Promise<number> {
        // Free delivery threshold check
        if (orderValue !== undefined) {
            const threshold = await this.getFreeDeliveryThreshold();
            if (threshold > 0 && orderValue >= threshold) {
                return 0;
            }
        }

        const flat = await this.getDeliveryCharge();
        const d = Number(distanceKm);
        if (!Number.isFinite(d) || d < 0) return flat;

        const mode = await this.getDeliveryFeeMode();
        if (mode === 'PER_KM') {
            let rate = await this.getDeliveryPerKmRate();
            // Backward compatibility: if legacy "1 km => ₹X" slab exists, treat that as per-km rate
            // when saved per-km rate is missing/incorrectly low.
            if (!(rate > 0) || rate <= 1) {
                const legacyRules = await this.getDeliveryFeeRules();
                const oneKmRule = legacyRules.find((r) => r.upToKm === 1 && r.fee > 0);
                if (oneKmRule && oneKmRule.fee > rate) {
                    rate = oneKmRule.fee;
                }
            }
            if (rate > 0) {
                return Math.ceil(d * rate);
            }
            return flat;
        }

        const rules = await this.getDeliveryFeeRules();
        const matched = rules.find((r) => d <= r.upToKm);
        if (matched) return matched.fee;
        return rules.length ? rules[rules.length - 1].fee : flat;
    }

    /** Get all public store settings (theme, preferences, deliveryCharge) for storefront. */
    async getStoreSettings(): Promise<{
        theme: Record<string, unknown> | null;
        preferences: Record<string, unknown> | null;
        deliveryCharge: number;
        deliveryFeeRules: DeliveryFeeRule[];
        deliveryFeeMode: DeliveryFeeMode;
        deliveryPerKmRate: number;
        freeDeliveryThreshold: number;
        platformFee: number;
    }> {
        const [theme, preferences, deliveryCharge, deliveryFeeRules, deliveryFeeMode, deliveryPerKmRate, freeDeliveryThreshold, platformFee] = await Promise.all([
            this.getStoreTheme(),
            this.getStorePreferences(),
            this.getDeliveryCharge(),
            this.getDeliveryFeeRules(),
            this.getDeliveryFeeMode(),
            this.getDeliveryPerKmRate(),
            this.getFreeDeliveryThreshold(),
            this.getPlatformFee(),
        ]);
        return { theme, preferences, deliveryCharge, deliveryFeeRules, deliveryFeeMode, deliveryPerKmRate, freeDeliveryThreshold, platformFee };
    }

    /** Update store settings (admin only). Partial update. */
    async setStoreSettings(updates: {
        theme?: Record<string, unknown>;
        preferences?: Record<string, unknown>;
        deliveryCharge?: number;
        deliveryFeeRules?: DeliveryFeeRule[];
        deliveryFeeMode?: DeliveryFeeMode;
        deliveryPerKmRate?: number;
        freeDeliveryThreshold?: number;
        platformFee?: number;
    }): Promise<void> {
        if (updates.theme !== undefined) {
            await this.setStoreTheme(updates.theme);
        }
        if (updates.preferences !== undefined) {
            await this.setStorePreferences(updates.preferences);
        }
        if (updates.deliveryCharge !== undefined) {
            await this.setDeliveryCharge(updates.deliveryCharge);
        }
        if (updates.deliveryFeeRules !== undefined) {
            await this.setDeliveryFeeRules(updates.deliveryFeeRules);
        }
        if (updates.deliveryFeeMode !== undefined) {
            await this.setDeliveryFeeMode(updates.deliveryFeeMode);
        }
        if (updates.deliveryPerKmRate !== undefined) {
            await this.setDeliveryPerKmRate(updates.deliveryPerKmRate);
        }
        if (updates.freeDeliveryThreshold !== undefined) {
            await this.setFreeDeliveryThreshold(updates.freeDeliveryThreshold);
        }
        if (updates.platformFee !== undefined) {
            await this.setPlatformFee(updates.platformFee);
        }
    }

    async getDeliveryFeeMode(): Promise<DeliveryFeeMode> {
        const raw = (await this.get(KEY_DELIVERY_FEE_MODE))?.trim().toUpperCase();
        if (raw === 'PER_KM') return 'PER_KM';
        return 'SLAB';
    }

    async setDeliveryFeeMode(mode: DeliveryFeeMode): Promise<void> {
        const normalized: DeliveryFeeMode = String(mode).toUpperCase() === 'PER_KM' ? 'PER_KM' : 'SLAB';
        await this.set(KEY_DELIVERY_FEE_MODE, normalized);
    }

    async getDeliveryPerKmRate(): Promise<number> {
        const raw = await this.get(KEY_DELIVERY_PER_KM_RATE);
        if (raw == null || raw === '') return 0;
        const n = Number(raw);
        return Number.isFinite(n) && n >= 0 ? n : 0;
    }

    async setDeliveryPerKmRate(rate: number): Promise<void> {
        const n = Number(rate);
        await this.set(KEY_DELIVERY_PER_KM_RATE, Number.isFinite(n) && n >= 0 ? String(n) : '0');
    }

    async getFreeDeliveryThreshold(): Promise<number> {
        const raw = await this.get(KEY_FREE_DELIVERY_THRESHOLD);
        if (raw == null || raw === '') return 0;
        const n = parseFloat(raw);
        return Number.isFinite(n) && n >= 0 ? n : 0;
    }

    async setFreeDeliveryThreshold(threshold: number): Promise<void> {
        const n = Number.isFinite(threshold) && threshold >= 0 ? threshold : 0;
        await this.set(KEY_FREE_DELIVERY_THRESHOLD, String(n));
    }

    async getPlatformFee(): Promise<number> {
        const raw = await this.get(KEY_PLATFORM_FEE);
        if (raw == null || raw === '') return 5; // Default Zepto-like fee
        const n = parseFloat(raw);
        return Number.isFinite(n) && n >= 0 ? n : 5;
    }

    async setPlatformFee(fee: number): Promise<void> {
        const n = Number.isFinite(fee) && fee >= 0 ? fee : 5;
        await this.set(KEY_PLATFORM_FEE, String(n));
    }

    /** Validate a coupon code (public). Returns discount info if valid. */
    async validateCoupon(code: string): Promise<{
        valid: boolean;
        message?: string;
        discountType?: string;
        discountValue?: number;
        maxDiscount?: number | null;
        minOrderValue?: number | null;
    }> {
        const trimmed = code?.trim();
        if (!trimmed) {
            return { valid: false, message: 'Enter a promo code' };
        }
        const coupon = await this.prisma.coupon.findUnique({
            where: { code: trimmed },
        });
        if (!coupon || !coupon.isActive) {
            return { valid: false, message: 'Invalid or inactive promo code' };
        }
        if (coupon.expiryDate && coupon.expiryDate < new Date()) {
            return { valid: false, message: 'This promo code has expired' };
        }
        if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) {
            return { valid: false, message: 'This promo code has reached its usage limit' };
        }
        return {
            valid: true,
            discountType: coupon.discountType,
            discountValue: Number(coupon.discountValue),
            maxDiscount: coupon.maxDiscount != null ? Number(coupon.maxDiscount) : null,
            minOrderValue: coupon.minOrderValue != null ? Number(coupon.minOrderValue) : null,
        };
    }

    private normalizeCouponScope(raw: unknown): CouponScopeRule | null {
        const entry = raw as any;
        const code = String(entry?.code ?? '').trim().toUpperCase();
        const scopeType = String(entry?.scopeType ?? 'ALL').toUpperCase() as CouponScopeRule['scopeType'];
        if (!code || !['ALL', 'CATEGORY', 'PRODUCT'].includes(scopeType)) return null;
        const categoryNames = Array.isArray(entry?.categoryNames)
            ? entry.categoryNames.map((v: unknown) => String(v).trim().toLowerCase()).filter(Boolean)
            : [];
        const productIds = Array.isArray(entry?.productIds)
            ? entry.productIds.map((v: unknown) => String(v).trim()).filter(Boolean)
            : [];
        return { code, scopeType, categoryNames, productIds };
    }

    private async getCouponScopesMap(): Promise<Map<string, CouponScopeRule>> {
        const raw = await this.get(KEY_COUPON_SCOPES);
        if (!raw?.trim()) return new Map();
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return new Map();
            const map = new Map<string, CouponScopeRule>();
            for (const item of parsed) {
                const normalized = this.normalizeCouponScope(item);
                if (normalized) map.set(normalized.code, normalized);
            }
            return map;
        } catch {
            return new Map();
        }
    }

    async getCouponScopes(): Promise<CouponScopeRule[]> {
        const map = await this.getCouponScopesMap();
        return Array.from(map.values());
    }

    async setCouponScopes(scopes: CouponScopeRule[]): Promise<void> {
        const normalized = (scopes ?? [])
            .map((item) => this.normalizeCouponScope(item))
            .filter((item): item is CouponScopeRule => !!item);
        await this.set(KEY_COUPON_SCOPES, JSON.stringify(normalized));
    }

    async listAdminCoupons(): Promise<AdminCoupon[]> {
        const coupons = await this.prisma.coupon.findMany({
            orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
        });
        return coupons.map((coupon) => ({
            id: coupon.id,
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: Number(coupon.discountValue),
            minOrderValue: coupon.minOrderValue != null ? Number(coupon.minOrderValue) : null,
            maxDiscount: coupon.maxDiscount != null ? Number(coupon.maxDiscount) : null,
            expiryDate: coupon.expiryDate ? coupon.expiryDate.toISOString() : null,
            usageLimit: coupon.usageLimit ?? null,
            usedCount: coupon.usedCount,
            isActive: coupon.isActive,
        }));
    }

    async createAdminCoupon(input: {
        code: string;
        discountType: 'PERCENTAGE' | 'FIXED';
        discountValue: number;
        minOrderValue?: number | null;
        maxDiscount?: number | null;
        expiryDate?: string | null;
        usageLimit?: number | null;
        isActive?: boolean;
    }): Promise<AdminCoupon> {
        const coupon = await this.prisma.coupon.create({
            data: {
                code: String(input.code).trim().toUpperCase(),
                discountType: input.discountType,
                discountValue: input.discountValue,
                minOrderValue: input.minOrderValue ?? null,
                maxDiscount: input.maxDiscount ?? null,
                expiryDate: input.expiryDate ? new Date(input.expiryDate) : null,
                usageLimit: input.usageLimit ?? null,
                isActive: input.isActive ?? true,
            },
        });
        return {
            id: coupon.id,
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: Number(coupon.discountValue),
            minOrderValue: coupon.minOrderValue != null ? Number(coupon.minOrderValue) : null,
            maxDiscount: coupon.maxDiscount != null ? Number(coupon.maxDiscount) : null,
            expiryDate: coupon.expiryDate ? coupon.expiryDate.toISOString() : null,
            usageLimit: coupon.usageLimit ?? null,
            usedCount: coupon.usedCount,
            isActive: coupon.isActive,
        };
    }

    async updateAdminCoupon(id: string, input: {
        code?: string;
        discountType?: 'PERCENTAGE' | 'FIXED';
        discountValue?: number;
        minOrderValue?: number | null;
        maxDiscount?: number | null;
        expiryDate?: string | null;
        usageLimit?: number | null;
        isActive?: boolean;
    }): Promise<AdminCoupon> {
        const coupon = await this.prisma.coupon.update({
            where: { id },
            data: {
                code: input.code != null ? String(input.code).trim().toUpperCase() : undefined,
                discountType: input.discountType,
                discountValue: input.discountValue,
                minOrderValue: input.minOrderValue,
                maxDiscount: input.maxDiscount,
                expiryDate: input.expiryDate !== undefined ? (input.expiryDate ? new Date(input.expiryDate) : null) : undefined,
                usageLimit: input.usageLimit,
                isActive: input.isActive,
            },
        });
        return {
            id: coupon.id,
            code: coupon.code,
            discountType: coupon.discountType,
            discountValue: Number(coupon.discountValue),
            minOrderValue: coupon.minOrderValue != null ? Number(coupon.minOrderValue) : null,
            maxDiscount: coupon.maxDiscount != null ? Number(coupon.maxDiscount) : null,
            expiryDate: coupon.expiryDate ? coupon.expiryDate.toISOString() : null,
            usageLimit: coupon.usageLimit ?? null,
            usedCount: coupon.usedCount,
            isActive: coupon.isActive,
        };
    }

    /** Permanently remove a coupon and its scope entry. Detaches from past orders (coupon id cleared). */
    async deleteAdminCoupon(id: string): Promise<void> {
        const coupon = await this.prisma.coupon.findUnique({ where: { id } });
        if (!coupon) {
            throw new NotFoundException('Coupon not found');
        }
        await this.prisma.order.updateMany({ where: { couponId: id }, data: { couponId: null } });
        await this.prisma.coupon.delete({ where: { id } });
        const scopes = await this.getCouponScopes();
        const next = scopes.filter((s) => s.code.toUpperCase() !== coupon.code.toUpperCase());
        await this.setCouponScopes(next);
    }

    private isCouponApplicableToContext(scope: CouponScopeRule | undefined, ctx?: CouponContext): boolean {
        if (!scope || scope.scopeType === 'ALL') return true;
        if (!ctx) return true;
        const singleProductId = String(ctx.productId ?? '').trim();
        const singleCategory = String(ctx.categoryName ?? '').trim().toLowerCase();
        const cartProductIds = (ctx.cartProductIds ?? []).map((id) => String(id).trim()).filter(Boolean);
        const cartCategoryNames = (ctx.cartCategoryNames ?? []).map((n) => String(n).trim().toLowerCase()).filter(Boolean);

        if (scope.scopeType === 'PRODUCT') {
            const scopedProducts = scope.productIds ?? [];
            if (singleProductId) return scopedProducts.includes(singleProductId);
            return cartProductIds.some((id) => scopedProducts.includes(id));
        }
        if (scope.scopeType === 'CATEGORY') {
            const scopedCategories = scope.categoryNames ?? [];
            if (singleCategory) return scopedCategories.includes(singleCategory);
            return cartCategoryNames.some((name) => scopedCategories.includes(name));
        }
        return true;
    }

    async validateCouponWithContext(code: string, ctx?: CouponContext): Promise<{
        valid: boolean;
        message?: string;
        discountType?: string;
        discountValue?: number;
        maxDiscount?: number | null;
        minOrderValue?: number | null;
    }> {
        const base = await this.validateCoupon(code);
        if (!base.valid) return base;
        const scopes = await this.getCouponScopesMap();
        const scope = scopes.get(String(code ?? '').trim().toUpperCase());
        if (!this.isCouponApplicableToContext(scope, ctx)) {
            return { valid: false, message: 'This promo is not applicable for selected products' };
        }
        return base;
    }

    /** List all currently available coupon offers (public, storefront-safe). */
    async getAvailableCouponOffers(ctx?: CouponContext): Promise<PublicCouponOffer[]> {
        const now = new Date();
        const scopes = await this.getCouponScopesMap();
        const coupons = await this.prisma.coupon.findMany({
            where: {
                isActive: true,
                OR: [{ expiryDate: null }, { expiryDate: { gt: now } }],
            },
            orderBy: [{ discountValue: 'desc' }, { code: 'asc' }],
        });
        return coupons
            .filter((coupon) => coupon.usageLimit == null || coupon.usedCount < coupon.usageLimit)
            .filter((coupon) => this.isCouponApplicableToContext(scopes.get(coupon.code.toUpperCase()), ctx))
            .map((coupon) => ({
                code: coupon.code,
                discountType: coupon.discountType,
                discountValue: Number(coupon.discountValue),
                maxDiscount: coupon.maxDiscount != null ? Number(coupon.maxDiscount) : null,
                minOrderValue: coupon.minOrderValue != null ? Number(coupon.minOrderValue) : null,
                expiryDate: coupon.expiryDate ? coupon.expiryDate.toISOString() : null,
                usageLeft: coupon.usageLimit != null ? Math.max(0, coupon.usageLimit - coupon.usedCount) : null,
                scopeType: (scopes.get(coupon.code.toUpperCase())?.scopeType ?? 'ALL') as 'ALL' | 'CATEGORY' | 'PRODUCT',
                categoryNames: scopes.get(coupon.code.toUpperCase())?.categoryNames ?? [],
                productIds: scopes.get(coupon.code.toUpperCase())?.productIds ?? [],
            }));
    }
}
