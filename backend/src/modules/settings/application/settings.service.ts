import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

const KEY_RAZORPAY_KEY_ID = 'razorpay_key_id';
const KEY_RAZORPAY_KEY_SECRET = 'razorpay_key_secret';
const KEY_SERVICEABLE_CITIES = 'serviceable_cities';
const KEY_STORE_THEME = 'store_theme';
const KEY_STORE_PREFERENCES = 'store_preferences';
const KEY_DELIVERY_CHARGE = 'delivery_charge';

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
        const [keyId, keySecret] = await Promise.all([
            this.get(KEY_RAZORPAY_KEY_ID),
            this.get(KEY_RAZORPAY_KEY_SECRET),
        ]);
        if (!keyId?.trim() || !keySecret?.trim()) return null;
        return { keyId: keyId.trim(), keySecret: keySecret.trim() };
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

    /** Get all public store settings (theme, preferences, deliveryCharge) for storefront. */
    async getStoreSettings(): Promise<{
        theme: Record<string, unknown> | null;
        preferences: Record<string, unknown> | null;
        deliveryCharge: number;
    }> {
        const [theme, preferences, deliveryCharge] = await Promise.all([
            this.getStoreTheme(),
            this.getStorePreferences(),
            this.getDeliveryCharge(),
        ]);
        return { theme, preferences, deliveryCharge };
    }

    /** Update store settings (admin only). Partial update. */
    async setStoreSettings(updates: {
        theme?: Record<string, unknown>;
        preferences?: Record<string, unknown>;
        deliveryCharge?: number;
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
}
