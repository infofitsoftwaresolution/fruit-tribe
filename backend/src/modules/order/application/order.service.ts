import {
    Injectable,
    BadRequestException,
    NotFoundException,
    ConflictException,
    Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { SettingsService } from '../../settings/application/settings.service';
import { CreateOrderDto } from '../interface/dtos/create-order.dto';
import { CreateSubscriptionOrderDto } from '../interface/dtos/create-subscription-order.dto';
import { CreateManualOrderDto } from '../interface/dtos/create-manual-order.dto';
import * as crypto from 'crypto';
import { userCityMatchesServiceList } from '../../../common/utils/indian-city-aliases';
import { WhatsappService } from '../../../common/whatsapp/whatsapp.service';
import { parsePackQtyKg as parsePackQtyKgUtil } from '../../catalog/application/inventory-pool.util';

@Injectable()
export class OrderService {
    private readonly logger = new Logger(OrderService.name);
    private static readonly ONLINE_HOLD_MINUTES = 30;

    constructor(
        private readonly prisma: PrismaService,
        private readonly settingsService: SettingsService,
        private readonly whatsappService: WhatsappService,
    ) { }

    private normalizeTaxRates(raw: unknown): Record<string, number> {
        if (!raw || typeof raw !== 'object') return {};
        const out: Record<string, number> = {};
        for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
            const n = Number(v);
            if (!Number.isFinite(n) || n < 0) continue;
            out[String(k)] = n;
        }
        return out;
    }

    private resolveTaxRateForCategory(categoryName: string | null | undefined, rates: Record<string, number>): number {
        const key = String(categoryName ?? '').trim();
        if (!key) return 0;
        const exact = rates[key];
        if (Number.isFinite(exact)) return Number(exact);
        const lowerKey = key.toLowerCase();
        for (const [k, v] of Object.entries(rates)) {
            if (String(k).toLowerCase() === lowerKey) return Number(v);
        }
        return 0;
    }

    private calculateTaxAmountFromLines(
        lines: Array<{ subtotal: number; categoryName?: string | null }>,
        rates: Record<string, number>,
    ): number {
        const total = lines.reduce((sum, line) => {
            const subtotal = Number(line.subtotal);
            if (!Number.isFinite(subtotal) || subtotal <= 0) return sum;
            const rate = this.resolveTaxRateForCategory(line.categoryName, rates);
            return sum + (subtotal * rate) / 100;
        }, 0);
        return Math.round(total * 100) / 100;
    }

    private parsePackQtyKg(rawValue: string | null | undefined): number {
        return parsePackQtyKgUtil(rawValue);
    }

    /** Return sellable kg (physical stock minus pending reservations). */
    private async loadProductAvailableKgMap(
        tx: { $queryRawUnsafe: PrismaService['$queryRawUnsafe'] },
        productIds: string[],
        forUpdate = true,
    ): Promise<Map<string, number>> {
        if (!productIds.length) return new Map();
        const lockClause = forUpdate ? 'FOR UPDATE' : '';
        const rows = await tx.$queryRawUnsafe<Array<{ id: string; stock: number; reservedKg: number }>>(
            `SELECT p.id,
                    p.stock::float AS stock,
                    COALESCE((
                        SELECT SUM(pv.reserved_quantity)::float
                        FROM product_variants pv
                        WHERE pv.product_id = p.id
                    ), 0)::float AS "reservedKg"
             FROM products p
             WHERE p.id = ANY($1::uuid[])
             ${lockClause}`,
            productIds,
        );
        const map = new Map<string, number>();
        for (const row of rows) {
            map.set(String(row.id), Math.max(0, Number(row.stock) - Number(row.reservedKg)));
        }
        return map;
    }

    private assertProductStockForLines(
        availableByProduct: Map<string, number>,
        lines: Array<{ productId: string; stockUnits: number; sku?: string | null; variantId?: string }>,
    ): void {
        const requiredByProduct = new Map<string, number>();
        for (const line of lines) {
            const pid = String(line.productId);
            requiredByProduct.set(pid, (requiredByProduct.get(pid) || 0) + line.stockUnits);
        }
        for (const [pid, requiredKg] of requiredByProduct.entries()) {
            const availableKg = availableByProduct.get(pid) ?? 0;
            if (availableKg < requiredKg) {
                throw new BadRequestException(
                    `Insufficient inventory. Available: ${availableKg} kg, required: ${requiredKg} kg.`,
                );
            }
        }
        for (const line of lines) {
            const availableKg = availableByProduct.get(String(line.productId)) ?? 0;
            if (availableKg < line.stockUnits) {
                throw new BadRequestException(
                    `Insufficient stock for SKU ${line.sku || line.variantId || 'variant'}. Available: ${availableKg} kg, required: ${line.stockUnits} kg.`,
                );
            }
        }
    }

    private async commitPhysicalStock(
        tx: any,
        lines: Array<{ productId: string; variantId: string; stockUnits: number; orderId: string; reason: string }>,
    ): Promise<void> {
        for (const line of lines) {
            await tx.product.update({
                where: { id: line.productId },
                data: { stock: { decrement: line.stockUnits } },
            });
            await tx.inventoryLog.create({
                data: {
                    variantId: line.variantId,
                    changeAmount: -line.stockUnits,
                    reason: line.reason,
                    referenceId: line.orderId,
                },
            });
        }
    }

    private async reserveStockHold(
        tx: any,
        lines: Array<{ variantId: string; stockUnits: number; orderId: string }>,
    ): Promise<void> {
        for (const line of lines) {
            await tx.productVariant.update({
                where: { id: line.variantId },
                data: { reservedQuantity: { increment: line.stockUnits } },
            });
            await tx.inventoryLog.create({
                data: {
                    variantId: line.variantId,
                    changeAmount: -line.stockUnits,
                    reason: 'ORDER_RESERVED_ONLINE',
                    referenceId: line.orderId,
                },
            });
        }
    }

    private async restorePhysicalStock(
        tx: any,
        reservations: Array<{ variantId: string; quantity: number; productId?: string }>,
        orderId: string,
        reason: string,
    ): Promise<void> {
        const variantIds = reservations.map((r) => r.variantId);
        const variants = await tx.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: { id: true, productId: true },
        });
        const productByVariant = new Map(variants.map((v) => [String(v.id), String(v.productId)]));
        const kgByProduct = new Map<string, number>();
        for (const res of reservations) {
            const pid = String(res.productId || productByVariant.get(String(res.variantId)) || '');
            if (!pid) continue;
            kgByProduct.set(pid, (kgByProduct.get(pid) || 0) + Number(res.quantity));
        }
        for (const [productId, kg] of kgByProduct.entries()) {
            await tx.product.update({
                where: { id: String(productId) },
                data: { stock: { increment: kg } },
            });
        }
        for (const res of reservations) {
            await tx.inventoryLog.create({
                data: {
                    variantId: res.variantId,
                    changeAmount: res.quantity,
                    reason,
                    referenceId: orderId,
                },
            });
        }
    }

    private async releaseReservedStock(
        tx: any,
        reservations: Array<{ variantId: string; quantity: number }>,
        orderId: string,
        reason: string,
    ): Promise<void> {
        for (const res of reservations) {
            await tx.productVariant.update({
                where: { id: res.variantId },
                data: { reservedQuantity: { decrement: res.quantity } },
            });
            await tx.inventoryLog.create({
                data: {
                    variantId: res.variantId,
                    changeAmount: res.quantity,
                    reason,
                    referenceId: orderId,
                },
            });
        }
    }

    private async commitReservedToPhysical(
        tx: any,
        reservations: Array<{ variantId: string; quantity: number }>,
        orderId: string,
        reason: string,
    ): Promise<void> {
        const variantIds = reservations.map((r) => r.variantId);
        const variants = await tx.productVariant.findMany({
            where: { id: { in: variantIds } },
            select: { id: true, productId: true },
        });
        const productByVariant = new Map(variants.map((v) => [String(v.id), String(v.productId)]));
        const kgByProduct = new Map<string, number>();
        for (const res of reservations) {
            const pid = String(productByVariant.get(String(res.variantId)) || '');
            if (!pid) continue;
            kgByProduct.set(pid, (kgByProduct.get(pid) || 0) + Number(res.quantity));
        }
        for (const [productId, kg] of kgByProduct.entries()) {
            await tx.product.update({
                where: { id: String(productId) },
                data: { stock: { decrement: kg } },
            });
        }
        for (const res of reservations) {
            await tx.productVariant.update({
                where: { id: res.variantId },
                data: { reservedQuantity: { decrement: res.quantity } },
            });
            await tx.inventoryLog.create({
                data: {
                    variantId: res.variantId,
                    changeAmount: -res.quantity,
                    reason,
                    referenceId: orderId,
                },
            });
        }
    }

    private async getAdminTaxRates(): Promise<Record<string, number>> {
        const preferences = await this.settingsService.getStorePreferences();
        return this.normalizeTaxRates((preferences as any)?.taxRates);
    }

    /** Keep fiscal state consistent for already delivered orders. */
    private async reconcileDeliveredFiscalState(): Promise<void> {
        await this.prisma.order.updateMany({
            where: {
                status: 'DELIVERED',
                paymentStatus: 'PENDING',
            },
            data: {
                paymentStatus: 'PAID',
            },
        });
    }

    async createManualOrder(adminUserId: string, dto: CreateManualOrderDto) {
        // 1. Find or create user (support existing users by either email or phone)
        const normalizedEmail = String(dto.customerEmail || '').trim().toLowerCase();
        const normalizedPhone = String(dto.customerPhone || '').replace(/\D/g, '');
        const userByEmail = await this.prisma.user.findUnique({
            where: { email: normalizedEmail },
        });
        const userByPhone = normalizedPhone
            ? await this.prisma.user.findUnique({
                where: { phone: normalizedPhone },
            })
            : null;

        // If both are present but belong to different users, fail fast with clear reason.
        if (userByEmail && userByPhone && userByEmail.id !== userByPhone.id) {
            throw new ConflictException(
                'Email and phone number belong to different users. Please use matching customer details.',
            );
        }

        let targetUser = userByEmail || userByPhone;
        if (targetUser && !targetUser.email) {
            targetUser = await this.prisma.user.update({
                where: { id: targetUser.id },
                data: { email: normalizedEmail },
            });
        }

        if (!targetUser) {
            targetUser = await this.prisma.user.create({
                data: {
                    email: normalizedEmail,
                    phone: normalizedPhone || dto.customerPhone,
                    firstName: dto.customerName.split(' ')[0],
                    lastName: dto.customerName.split(' ').slice(1).join(' ') || '',
                    passwordHash: crypto.randomBytes(16).toString('hex'), // Random password
                },
            });
        }

        // 2. Calculate totals
        const platformFee = await this.settingsService.getPlatformFee();
        const subtotal = dto.items.reduce(
            (sum, item) => sum + item.pricePerUnit * item.quantity,
            0,
        );

        const productRows = await this.prisma.product.findMany({
            where: { id: { in: dto.items.map((item) => String(item.productId)) } },
            select: { id: true, category: { select: { name: true } } },
        });
        const productCategoryById = new Map(
            productRows.map((p) => [String(p.id), p.category?.name ?? null]),
        );
        const taxRates = await this.getAdminTaxRates();
        const taxAmount = this.calculateTaxAmountFromLines(
            dto.items.map((item) => ({
                subtotal: item.pricePerUnit * item.quantity,
                categoryName: productCategoryById.get(String(item.productId)) ?? null,
            })),
            taxRates,
        );
        const shippingFee = 0; // Manual orders usually have specific shipping or included
        const payableAmount = subtotal + shippingFee + taxAmount + platformFee;

        const orderNumber = `FT-MN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        return this.prisma.$transaction(async (tx) => {
            const manualVariants = await tx.productVariant.findMany({
                where: { id: { in: dto.items.map((i) => i.variantId) } },
                select: { id: true, productId: true, attributeValue: true, sku: true },
            });
            const manualVariantMap = new Map(manualVariants.map((v) => [String(v.id), v]));
            const manualStockLines = dto.items.map((item) => {
                const variant = manualVariantMap.get(String(item.variantId));
                const packQty = this.parsePackQtyKg(variant?.attributeValue);
                const stockUnits = Math.max(1, Number(item.quantity) || 1) * packQty;
                return {
                    productId: String(variant?.productId || item.productId),
                    variantId: String(item.variantId),
                    stockUnits,
                    sku: variant?.sku,
                };
            });
            const manualProductIds = Array.from(new Set(manualStockLines.map((l) => l.productId)));
            const manualAvailable = await this.loadProductAvailableKgMap(tx, manualProductIds);
            this.assertProductStockForLines(manualAvailable, manualStockLines);

            const initialStatus = (dto.status || 'CREATED').toUpperCase();
            const paymentStatus = (dto.paymentStatus || 'PENDING').toUpperCase();

            const order = await tx.order.create({
                data: {
                    orderNumber,
                    userId: targetUser.id,
                    totalAmount: subtotal,
                    discountAmount: 0,
                    shippingFee,
                    taxAmount,
                    platformFee,
                    payableAmount,
                    shippingAddress: dto.shippingAddress,
                    status: initialStatus,
                    paymentStatus: paymentStatus,
                    items: {
                        create: dto.items.map((item) => ({
                            productId: item.productId,
                            variantId: item.variantId,
                            sellerId: item.sellerId,
                            quantity: item.quantity,
                            pricePerUnit: item.pricePerUnit,
                            subtotal: item.pricePerUnit * item.quantity,
                            status: 'PENDING',
                        })),
                    },
                },
                include: {
                    items: {
                        include: {
                            product: { select: { name: true } },
                        },
                    },
                },
            });

            const isFinalized = paymentStatus === 'PAID' || initialStatus === 'CONFIRMED';
            for (const line of manualStockLines) {
                await tx.stockReservation.create({
                    data: {
                        variantId: line.variantId,
                        orderId: order.id,
                        userId: targetUser.id,
                        quantity: line.stockUnits,
                        expiresAt: new Date(Date.now() + OrderService.ONLINE_HOLD_MINUTES * 60000),
                        status: isFinalized ? 'COMPLETED' : 'PENDING',
                    },
                });
            }
            if (isFinalized) {
                await this.commitPhysicalStock(
                    tx,
                    manualStockLines.map((line) => ({
                        ...line,
                        orderId: order.id,
                        reason: 'MANUAL_ORDER_PAID_OR_CONFIRMED_COMMIT',
                    })),
                );
            } else {
                await this.reserveStockHold(
                    tx,
                    manualStockLines.map((line) => ({
                        variantId: line.variantId,
                        stockUnits: line.stockUnits,
                        orderId: order.id,
                    })),
                );
            }

            // Log status
            await tx.orderStatusLog.create({
                data: {
                    orderId: order.id,
                    status: initialStatus,
                    changedByRole: 'ADMIN',
                    changedByName: 'Admin (Manual Entry)',
                },
            });

            return order;
        }, { timeout: 15000 });
    }

    async create(userId: string, dto: CreateOrderDto) {
        // Idempotency: prevent duplicate order submissions
        if (dto.idempotencyKey) {
            const existing = await this.prisma.order.findUnique({
                where: { idempotencyKey: dto.idempotencyKey },
            });
            if (existing) return existing;
        }

        // Canonicalize cart lines from DB (never trust client-submitted sellerId/pricePerUnit).
        const variantIds = dto.items.map((i) => i.variantId);
        const lockedVariants = await this.prisma.$queryRawUnsafe<Array<{
            id: string;
            sku: string | null;
            availableQuantity: number;
            threshold: number | null;
            productId: string;
            sellerId: string;
            basePrice: number | string;
            priceOverride: number | string | null;
            attributeValue: string | null;
            isBulkVariant: boolean | null;
        }>>(
            `SELECT
                pv.id,
                pv.sku,
                pv.available_quantity as "availableQuantity",
                pv.low_stock_threshold as "threshold",
                pv.product_id as "productId",
                p.seller_id as "sellerId",
                p.base_price as "basePrice",
                pv.price_override as "priceOverride",
                pv.attribute_value as "attributeValue",
                pv.is_bulk_variant as "isBulkVariant"
             FROM product_variants pv
             JOIN products p ON p.id = pv.product_id
             WHERE pv.id = ANY($1::uuid[]) FOR UPDATE`,
            variantIds,
        );
        const variantMap = new Map(lockedVariants.map((v) => [v.id, v]));
        const productIds = Array.from(new Set(lockedVariants.map((v) => String(v.productId))));
        const preOrderAvailableKg = await this.loadProductAvailableKgMap(this.prisma, productIds, false);
        const tierRows = await this.prisma.$queryRawUnsafe<Array<{
            productId: string;
            minWeight: number | string;
            discountPercentage: number | string;
        }>>(
            `SELECT
                product_id as "productId",
                min_weight as "minWeight",
                discount_percentage as "discountPercentage"
             FROM product_tier_pricing
             WHERE product_id = ANY($1::uuid[])`,
            productIds,
        );
        const fallbackPricingRows = await this.prisma.$queryRawUnsafe<Array<{
            productId: string;
            attributeValue: string | null;
            isBulkVariant: boolean | null;
            priceOverride: number | string | null;
            basePrice: number | string;
        }>>(
            `SELECT
                pv.product_id as "productId",
                pv.attribute_value as "attributeValue",
                pv.is_bulk_variant as "isBulkVariant",
                pv.price_override as "priceOverride",
                p.base_price as "basePrice"
             FROM product_variants pv
             JOIN products p ON p.id = pv.product_id
             WHERE pv.product_id = ANY($1::uuid[])`,
            productIds,
        );
        const tiersByProduct = new Map<string, Array<{ minWeight: number; discountPercentage: number }>>();
        for (const row of tierRows) {
            const pid = String(row.productId);
            const minWeight = Number(row.minWeight);
            const discountPercentage = Number(row.discountPercentage);
            if (!(Number.isFinite(minWeight) && minWeight > 0 && Number.isFinite(discountPercentage) && discountPercentage > 0)) continue;
            const list = tiersByProduct.get(pid) || [];
            if (!list.some((t) => Math.abs(t.minWeight - minWeight) < 1e-6)) {
                list.push({ minWeight, discountPercentage });
            }
            tiersByProduct.set(pid, list);
        }
        // Backward compatibility: if no explicit product tiers exist, derive discount tiers from variant rows.
        for (const row of fallbackPricingRows) {
            const pid = String(row.productId);
            if ((tiersByProduct.get(pid) || []).length > 0) continue;
            const qty = this.parsePackQtyKg(row.attributeValue);
            const basePrice = Number(row.basePrice);
            const totalPrice = row.priceOverride != null ? Number(row.priceOverride) : Number.NaN;
            if (!(Number.isFinite(qty) && qty > 0 && Number.isFinite(basePrice) && basePrice > 0 && Number.isFinite(totalPrice) && totalPrice > 0)) continue;
            const retailTotal = basePrice * qty;
            if (!(retailTotal > 0)) continue;
            const discountPercentage = ((retailTotal - totalPrice) / retailTotal) * 100;
            if (!(Number.isFinite(discountPercentage) && discountPercentage > 0)) continue;
            const list = tiersByProduct.get(pid) || [];
            if (!list.some((t) => Math.abs(t.minWeight - qty) < 1e-6)) {
                list.push({ minWeight: qty, discountPercentage });
            }
            tiersByProduct.set(pid, list);
        }
        for (const [pid, list] of tiersByProduct.entries()) {
            list.sort((a, b) => a.minWeight - b.minWeight);
            tiersByProduct.set(pid, list);
        }
        const totalWeightByProduct = new Map<string, number>();
        const grossSubtotalByProduct = new Map<string, number>();
        for (const item of dto.items) {
            const variant = variantMap.get(item.variantId);
            if (!variant) continue;
            const pid = String(variant.productId);
            const packQty = this.parsePackQtyKg(variant.attributeValue);
            const qty = Math.max(1, Number(item.quantity) || 1);
            const basePrice = Number(variant.basePrice);
            const prevWeight = totalWeightByProduct.get(pid) || 0;
            totalWeightByProduct.set(pid, prevWeight + (qty * packQty));
            const prevSubtotal = grossSubtotalByProduct.get(pid) || 0;
            grossSubtotalByProduct.set(pid, prevSubtotal + (basePrice * packQty * qty));
        }
        const canonicalGrossItems = dto.items.map((item) => {
            const variant = variantMap.get(item.variantId);
            if (!variant) {
                throw new BadRequestException(`Product variant ${item.variantId} not found`);
            }
            if (String(item.productId) !== String(variant.productId)) {
                throw new BadRequestException(`Variant ${item.variantId} does not belong to product ${item.productId}`);
            }
            const basePrice = Number(variant.basePrice);
            const packQty = this.parsePackQtyKg(variant.attributeValue);
            const unitPrice = basePrice * packQty;
            const stockUnits = Math.max(1, Number(item.quantity) || 1) * packQty;
            return {
                productId: String(variant.productId),
                variantId: String(variant.id),
                sellerId: String(variant.sellerId),
                quantity: item.quantity,
                grossUnitPrice: unitPrice,
                stockUnits,
                subtotal: unitPrice * item.quantity,
                sku: variant.sku,
            };
        });
        this.assertProductStockForLines(
            preOrderAvailableKg,
            canonicalGrossItems.map((item) => ({
                productId: item.productId,
                stockUnits: item.stockUnits,
                sku: item.sku,
                variantId: item.variantId,
            })),
        );
        const discountPctByProduct = new Map<string, number>();
        for (const productId of productIds) {
            const totalWeight = totalWeightByProduct.get(productId) || 0;
            const tiers = tiersByProduct.get(productId) || [];
            let bestPct = 0;
            for (const t of tiers) {
                if (totalWeight >= t.minWeight) bestPct = t.discountPercentage;
            }
            discountPctByProduct.set(productId, bestPct);
        }
        const productTierDiscountAmount = new Map<string, number>();
        for (const productId of productIds) {
            const gross = grossSubtotalByProduct.get(productId) || 0;
            const pct = discountPctByProduct.get(productId) || 0;
            const discountAmount = Math.round(gross * (pct / 100) * 100) / 100;
            productTierDiscountAmount.set(productId, Math.max(0, discountAmount));
        }
        const canonicalItems = canonicalGrossItems.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            sellerId: item.sellerId,
            quantity: item.quantity,
            pricePerUnit: item.grossUnitPrice,
            stockUnits: item.stockUnits,
            subtotal: item.subtotal,
        }));
        const itemIndexesByProduct = new Map<string, number[]>();
        canonicalItems.forEach((item, index) => {
            const list = itemIndexesByProduct.get(item.productId) || [];
            list.push(index);
            itemIndexesByProduct.set(item.productId, list);
        });
        for (const [productId, indexes] of itemIndexesByProduct.entries()) {
            const gross = grossSubtotalByProduct.get(productId) || 0;
            const totalDiscount = productTierDiscountAmount.get(productId) || 0;
            if (!(gross > 0 && totalDiscount > 0)) continue;
            let allocated = 0;
            for (let i = 0; i < indexes.length; i++) {
                const idx = indexes[i];
                const lineGross = canonicalItems[idx].subtotal;
                const lineDiscount =
                    i === indexes.length - 1
                        ? Math.max(0, Math.round((totalDiscount - allocated) * 100) / 100)
                        : Math.round(((lineGross / gross) * totalDiscount) * 100) / 100;
                allocated += lineDiscount;
                const lineNet = Math.max(0, Math.round((lineGross - lineDiscount) * 100) / 100);
                canonicalItems[idx].subtotal = lineNet;
                canonicalItems[idx].pricePerUnit = lineNet / Math.max(1, canonicalItems[idx].quantity);
            }
        }
        const subtotal = canonicalItems.reduce((sum, item) => sum + item.subtotal, 0);

        let discountAmount = 0;
        let couponId: string | undefined;

        // Apply coupon if provided
        if (dto.couponCode) {
            const couponContextItems = await this.prisma.product.findMany({
                where: { id: { in: canonicalItems.map((i) => i.productId) } },
                select: { id: true, category: { select: { name: true } } },
            });
            const couponContext = {
                cartProductIds: couponContextItems.map((p) => p.id),
                cartCategoryNames: couponContextItems
                    .map((p) => p.category?.name)
                    .filter((name): name is string => !!name),
            };
            const validation = await this.settingsService.validateCouponWithContext(dto.couponCode, couponContext);
            if (!validation.valid) {
                throw new BadRequestException(validation.message || 'Invalid or expired coupon code');
            }
            const coupon = await this.prisma.coupon.findUnique({
                where: { code: dto.couponCode },
            });
            if (!coupon || !coupon.isActive) {
                throw new BadRequestException('Invalid or expired coupon code');
            }
            if (coupon.expiryDate && coupon.expiryDate < new Date()) {
                throw new BadRequestException('Coupon has expired');
            }
            if (coupon.usageLimit && coupon.usedCount >= coupon.usageLimit) {
                throw new BadRequestException('Coupon usage limit reached');
            }
            if (coupon.minOrderValue && subtotal < Number(coupon.minOrderValue)) {
                throw new BadRequestException(
                    `Minimum order value for this coupon is ₹${coupon.minOrderValue}`,
                );
            }
            discountAmount =
                coupon.discountType === 'PERCENTAGE'
                    ? (subtotal * Number(coupon.discountValue)) / 100
                    : Number(coupon.discountValue);

            if (coupon.maxDiscount) {
                discountAmount = Math.min(discountAmount, Number(coupon.maxDiscount));
            }

            couponId = coupon.id;
        }

        // Professional Idempotency Check
        if (dto.idempotencyKey) {
            const existing = await this.prisma.order.findUnique({
                where: { idempotencyKey: dto.idempotencyKey },
                include: { items: true }
            });
            if (existing) {
                this.logger.log(`Order already exists for idempotency key: ${dto.idempotencyKey}`);
                return existing;
            }
        }

        // Check for "Cart Abuse" (Point 9) - Prevent locking too much inventory without paying
        const activeReservations = await this.prisma.stockReservation.aggregate({
            where: { userId, status: 'PENDING' },
            _sum: { quantity: true }
        });
        if ((activeReservations._sum.quantity || 0) > 50) {
            throw new BadRequestException('Too many active reservations. Please complete your existing orders first.');
        }

        // Server-side COD enforcement: if any cart product disables COD, order must be paid online.
        const products = await this.prisma.product.findMany({
            where: { id: { in: canonicalItems.map((i) => i.productId) } },
            select: {
                id: true,
                allowCashOnDelivery: true,
                category: { select: { name: true } },
            },
        });
        const codBlocked = new Set(
            products.filter((p) => p.allowCashOnDelivery === false).map((p) => p.id),
        );
        const productCategoryById = new Map(
            products.map((p) => [String(p.id), p.category?.name ?? null]),
        );
        const requestedCod = String(dto.paymentMethod || 'online').toLowerCase() === 'cod';
        const hasCodBlockedItem = canonicalItems.some((i) => codBlocked.has(i.productId));
        const isCod = requestedCod && !hasCodBlockedItem;
        if (requestedCod && hasCodBlockedItem) {
            this.logger.warn(`Order create: forcing online payment because one or more products are COD-disabled.`);
        }

        const platformFee = await this.settingsService.getPlatformFee();
        const shippingFee = await this.settingsService.calculateDeliveryFeeByDistance(dto.distanceKm ?? null, subtotal);
        const taxRates = await this.getAdminTaxRates();
        const taxAmount = this.calculateTaxAmountFromLines(
            canonicalItems.map((item) => ({
                subtotal: item.subtotal,
                categoryName: productCategoryById.get(String(item.productId)) ?? null,
            })),
            taxRates,
        );
        const payableAmount = subtotal - discountAmount + shippingFee + taxAmount + platformFee;

        const addr = dto.shippingAddress as Record<string, unknown>;
        const city = String(addr.city ?? '').trim();
        const zipDigits = String(addr.zipCode ?? addr.pincode ?? addr.postalCode ?? '').replace(/\D/g, '');

        const serviceableCities = await this.settingsService.getServiceableCities();
        if (serviceableCities.length > 0 && city) {
            const cityOk = userCityMatchesServiceList(city, serviceableCities);
            if (!cityOk) {
                throw new BadRequestException(
                    `We do not deliver to "${city}". Available cities: ${serviceableCities.join(', ')}.`,
                );
            }
        }

        const serviceablePincodes = await this.settingsService.getServiceablePincodes();
        if (serviceablePincodes.length > 0) {
            if (zipDigits.length !== 6 || !serviceablePincodes.includes(zipDigits)) {
                throw new BadRequestException('This PIN code is not in our delivery area.');
            }
        }

        // Validate that city matches pincode (Cross-city prevention)
        const areaValidation = this.settingsService.validateCityPincode(city, zipDigits);
        if (!areaValidation.valid) {
            throw new BadRequestException(areaValidation.message);
        }

        // Cross-check street address for mentioned city mismatches
        const streetLower = String(addr.streetAddress ?? '').toLowerCase();
        
        const MAJOR_INDIAN_CITIES = [
            'kolkata', 'mumbai', 'delhi', 'chennai', 'hyderabad', 'pune', 'ahmedabad', 'surat', 'jaipur', 'lucknow', 'kanpur', 'nagpur',
            'indore', 'bhopal', 'patna', 'vadodara', 'ghaziabad', 'ludhiana', 'agra', 'nashik', 'faridabad', 'meerut', 'rajkot', 
            'pimpri', 'chinchwad', 'varanasi', 'srinagar', 'aurangabad', 'dhanbad', 'amritsar', 'navi mumbai', 'allahabad', 'howrah', 
            'ranchi', 'gwalior', 'jabalpur', 'coimbatore', 'vijayawada', 'jodhpur', 'madurai', 'raipur', 'kota', 'guwahati', 
            'chandigarh', 'solapur', 'hubli', 'dharwad', 'bareilly', 'mysore', 'tiruchirappalli', 'gurgaon', 'aligarh', 'jalandhar', 
            'bhubaneswar', 'salem', 'warangal', 'thiruvananthapuram', 'bhiwandi', 'saharanpur', 'guntur', 'amravati', 'bikaner', 
            'noida', 'jamshedpur', 'bhilai', 'cuttack', 'firozabad', 'kochi', 'nellore', 'bhavnagar', 'dehradun', 'durgapur', 
            'asansol', 'rourkela', 'nanded', 'kolhapur', 'ajmer', 'akola', 'gulbarga', 'jamnagar', 'ujjain', 'loni', 'siliguri', 
            'jhansi', 'ulhasnagar', 'jammu', 'belgaum', 'mangaluru', 'ambattur', 'tirunelveli', 'malegaon', 'gaya', 'jalgaon', 
            'udaipur', 'maheshtala'
        ];

        const citiesToCheck = Array.from(new Set([...serviceableCities.map(c => c.toLowerCase()), ...MAJOR_INDIAN_CITIES]));

        for (const c of citiesToCheck) {
            if (c !== city.toLowerCase() && streetLower.includes(c)) {
                throw new BadRequestException(
                    `Your street address mentions "${c}", but you have selected "${city}" as your city. Please ensure your address is consistent.`
                );
            }
        }

        // Use a transaction to create the full order atomically with an increased timeout
        const order = await this.prisma.$transaction(async (tx) => {
            let linkedAddressId: string | undefined;
            if (dto.savedAddressId) {
                const saved = await tx.userAddress.findFirst({
                    where: { id: dto.savedAddressId, userId },
                });
                if (!saved) {
                    throw new BadRequestException('Saved address not found.');
                }
                linkedAddressId = saved.id;
            }

            const orderNumber = `FT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            const txProductIds = Array.from(new Set(canonicalItems.map((i) => String(i.productId))));
            const txAvailableKg = await this.loadProductAvailableKgMap(tx, txProductIds);
            this.assertProductStockForLines(
                txAvailableKg,
                canonicalItems.map((item) => ({
                    productId: String(item.productId),
                    stockUnits: item.stockUnits,
                    variantId: String(item.variantId),
                })),
            );

            const initialOrderStatus = isCod ? 'CONFIRMED' : 'ON_HOLD';
            const order = await tx.order.create({
                data: {
                    orderNumber,
                    userId,
                    totalAmount: subtotal,
                    deliverySlot: dto.deliverySlot,
                    discountAmount,
                    shippingFee,
                    taxAmount,
                    platformFee,
                    payableAmount,
                    shippingAddress: dto.shippingAddress,
                    billingAddress: dto.billingAddress,
                    couponId,
                    idempotencyKey: dto.idempotencyKey,
                    addressId: linkedAddressId,
                    distanceKm: dto.distanceKm,
                    status: initialOrderStatus,
                    paymentStatus: 'PENDING',
                    items: {
                        create: canonicalItems.map((item) => ({
                            productId: item.productId,
                            variantId: item.variantId,
                            sellerId: item.sellerId,
                            quantity: item.quantity,
                            pricePerUnit: item.pricePerUnit,
                            subtotal: item.subtotal,
                            status: 'PENDING',
                        })),
                    },
                },
                include: { items: true },
            });

            for (const item of canonicalItems) {
                const reservationStatus = isCod ? 'COMPLETED' : 'PENDING';
                await tx.stockReservation.create({
                    data: {
                        variantId: item.variantId,
                        orderId: order.id,
                        userId,
                        quantity: item.stockUnits,
                        expiresAt: new Date(Date.now() + OrderService.ONLINE_HOLD_MINUTES * 60000),
                        status: reservationStatus,
                    },
                });
            }
            if (isCod) {
                await this.commitPhysicalStock(
                    tx,
                    canonicalItems.map((item) => ({
                        productId: String(item.productId),
                        variantId: String(item.variantId),
                        stockUnits: item.stockUnits,
                        orderId: order.id,
                        reason: 'ORDER_PLACED_COD_COMMIT',
                    })),
                );
            } else {
                await this.reserveStockHold(
                    tx,
                    canonicalItems.map((item) => ({
                        variantId: String(item.variantId),
                        stockUnits: item.stockUnits,
                        orderId: order.id,
                    })),
                );
            }

            // Increment coupon usage
            if (couponId) {
                await tx.coupon.update({
                    where: { id: couponId },
                    data: { usedCount: { increment: 1 } },
                });
            }

            await tx.orderStatusLog.create({
                data: {
                    orderId: order.id,
                    status: initialOrderStatus,
                    changedByRole: 'CUSTOMER',
                    changedByName: null,
                },
            });

            this.logger.log(`Order ${order.orderNumber} created for user ${userId}`);
            return order;
        }, { timeout: 15000 });

        void this.dispatchOrderWhatsAppAlert(order, userId, dto, isCod).catch((err) => {
            this.logger.warn(
                `WhatsApp order alert failed for ${order.orderNumber}: ${err?.message || err}`,
            );
        });

        return order;
    }

    /** Send new-order alert to the store WhatsApp configured in theme / env. */
    private async dispatchOrderWhatsAppAlert(
        order: {
            orderNumber: string;
            payableAmount: unknown;
            deliverySlot?: string | null;
            shippingAddress: unknown;
            items: Array<{ productId: string; quantity: number; subtotal: unknown }>;
        },
        userId: string,
        dto: CreateOrderDto,
        isCod: boolean,
    ): Promise<void> {
        if (!this.whatsappService.isEnabled()) return;

        const [theme, preferences, user, products] = await Promise.all([
            this.settingsService.getStoreTheme(),
            this.settingsService.getStorePreferences(),
            this.prisma.user.findUnique({
                where: { id: userId },
                select: { firstName: true, lastName: true, email: true, phone: true },
            }),
            this.prisma.product.findMany({
                where: { id: { in: order.items.map((i) => i.productId) } },
                select: { id: true, name: true },
            }),
        ]);

        const storePhone = this.whatsappService.resolveStoreNotifyPhone(
            typeof theme?.contactPhone === 'string' ? theme.contactPhone : null,
            typeof preferences?.contactPhone === 'string' ? preferences.contactPhone : null,
        );
        if (!storePhone) {
            this.logger.warn(`WhatsApp order alert skipped for ${order.orderNumber}: no store phone configured`);
            return;
        }

        const productNameById = new Map(products.map((p) => [String(p.id), p.name]));
        const customerName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim()
            || String((order.shippingAddress as Record<string, unknown>)?.fullName ?? '').trim()
            || 'Customer';
        const addr = order.shippingAddress as Record<string, unknown>;
        const customerPhone =
            this.whatsappService.normalizeIndianPhone10(user?.phone)
            ?? this.whatsappService.normalizeIndianPhone10(String(addr.phone ?? addr.mobile ?? ''));
        const payable = Number(order.payableAmount);
        const paymentLabel = isCod
            ? 'Cash on Delivery'
            : String(dto.paymentMethod || 'online').toLowerCase() === 'cod'
                ? 'Cash on Delivery'
                : 'Online (pending payment)';

        await this.whatsappService.sendOrderAlert(storePhone, {
            orderNumber: order.orderNumber,
            payableAmount: Number.isFinite(payable) ? payable : 0,
            paymentLabel,
            deliverySlot: order.deliverySlot,
            customerName,
            customerPhone,
            customerEmail: user?.email ?? null,
            shippingAddress: (order.shippingAddress as Record<string, unknown>) || {},
            itemLines: order.items.map((item) => {
                const name = productNameById.get(String(item.productId)) || 'Item';
                const qty = Number(item.quantity) || 1;
                const sub = Number(item.subtotal);
                const subtotalStr = Number.isFinite(sub) ? ` — ₹${sub.toFixed(2)}` : '';
                return `${name} × ${qty}${subtotalStr}`;
            }),
        });
    }

    async simulatePricing(
        userId: string,
        dto: {
            items: Array<{ productId: string; variantId: string; quantity: number }>;
            couponCode?: string;
            distanceKm?: number;
        },
    ) {
        if (!Array.isArray(dto.items) || dto.items.length === 0) {
            throw new BadRequestException('At least one item is required.');
        }
        const variantIds = dto.items.map((i) => i.variantId);
        const lockedVariants = await this.prisma.$queryRawUnsafe<Array<{
            id: string;
            sku: string | null;
            availableQuantity: number;
            productId: string;
            sellerId: string;
            basePrice: number | string;
            priceOverride: number | string | null;
            attributeValue: string | null;
            isBulkVariant: boolean | null;
        }>>(
            `SELECT
                pv.id,
                pv.sku,
                pv.available_quantity as "availableQuantity",
                pv.product_id as "productId",
                p.seller_id as "sellerId",
                p.base_price as "basePrice",
                pv.price_override as "priceOverride",
                pv.attribute_value as "attributeValue",
                pv.is_bulk_variant as "isBulkVariant"
             FROM product_variants pv
             JOIN products p ON p.id = pv.product_id
             WHERE pv.id = ANY($1::uuid[])`,
            variantIds,
        );
        const variantMap = new Map(lockedVariants.map((v) => [v.id, v]));
        const productIds = Array.from(new Set(lockedVariants.map((v) => String(v.productId))));
        const simulateAvailableKg = await this.loadProductAvailableKgMap(this.prisma, productIds, false);
        const tierRows = await this.prisma.$queryRawUnsafe<Array<{
            productId: string;
            minWeight: number | string;
            discountPercentage: number | string;
        }>>(
            `SELECT
                product_id as "productId",
                min_weight as "minWeight",
                discount_percentage as "discountPercentage"
             FROM product_tier_pricing
             WHERE product_id = ANY($1::uuid[])`,
            productIds,
        );
        const fallbackPricingRows = await this.prisma.$queryRawUnsafe<Array<{
            productId: string;
            attributeValue: string | null;
            isBulkVariant: boolean | null;
            priceOverride: number | string | null;
            basePrice: number | string;
        }>>(
            `SELECT
                pv.product_id as "productId",
                pv.attribute_value as "attributeValue",
                pv.is_bulk_variant as "isBulkVariant",
                pv.price_override as "priceOverride",
                p.base_price as "basePrice"
             FROM product_variants pv
             JOIN products p ON p.id = pv.product_id
             WHERE pv.product_id = ANY($1::uuid[])`,
            productIds,
        );
        const tiersByProduct = new Map<string, Array<{ minWeight: number; discountPercentage: number }>>();
        for (const row of tierRows) {
            const pid = String(row.productId);
            const minWeight = Number(row.minWeight);
            const discountPercentage = Number(row.discountPercentage);
            if (!(Number.isFinite(minWeight) && minWeight > 0 && Number.isFinite(discountPercentage) && discountPercentage > 0)) continue;
            const list = tiersByProduct.get(pid) || [];
            if (!list.some((t) => Math.abs(t.minWeight - minWeight) < 1e-6)) {
                list.push({ minWeight, discountPercentage });
            }
            tiersByProduct.set(pid, list);
        }
        for (const row of fallbackPricingRows) {
            const pid = String(row.productId);
            if ((tiersByProduct.get(pid) || []).length > 0) continue;
            const qty = this.parsePackQtyKg(row.attributeValue);
            const basePrice = Number(row.basePrice);
            const totalPrice = row.priceOverride != null ? Number(row.priceOverride) : Number.NaN;
            if (!(Number.isFinite(qty) && qty > 0 && Number.isFinite(basePrice) && basePrice > 0 && Number.isFinite(totalPrice) && totalPrice > 0)) continue;
            const retailTotal = basePrice * qty;
            if (!(retailTotal > 0)) continue;
            const discountPercentage = ((retailTotal - totalPrice) / retailTotal) * 100;
            if (!(Number.isFinite(discountPercentage) && discountPercentage > 0)) continue;
            const list = tiersByProduct.get(pid) || [];
            if (!list.some((t) => Math.abs(t.minWeight - qty) < 1e-6)) {
                list.push({ minWeight: qty, discountPercentage });
            }
            tiersByProduct.set(pid, list);
        }
        const totalWeightByProduct = new Map<string, number>();
        const grossSubtotalByProduct = new Map<string, number>();
        for (const item of dto.items) {
            const variant = variantMap.get(item.variantId);
            if (!variant) continue;
            const pid = String(variant.productId);
            const packQty = this.parsePackQtyKg(variant.attributeValue);
            const qty = Math.max(1, Number(item.quantity) || 1);
            const basePrice = Number(variant.basePrice);
            const prevWeight = totalWeightByProduct.get(pid) || 0;
            totalWeightByProduct.set(pid, prevWeight + (qty * packQty));
            const prevSubtotal = grossSubtotalByProduct.get(pid) || 0;
            grossSubtotalByProduct.set(pid, prevSubtotal + (basePrice * packQty * qty));
        }
        const canonicalGrossItems = dto.items.map((item) => {
            const variant = variantMap.get(item.variantId);
            if (!variant) throw new BadRequestException(`Product variant ${item.variantId} not found`);
            if (String(item.productId) !== String(variant.productId)) {
                throw new BadRequestException(`Variant ${item.variantId} does not belong to product ${item.productId}`);
            }
            const basePrice = Number(variant.basePrice);
            const packQty = this.parsePackQtyKg(variant.attributeValue);
            const unitPrice = basePrice * Math.max(1, packQty);
            const stockUnits = Math.max(1, Number(item.quantity) || 1) * Math.max(1, packQty);
            return {
                productId: String(variant.productId),
                variantId: String(variant.id),
                quantity: item.quantity,
                grossUnitPrice: unitPrice,
                stockUnits,
                subtotal: unitPrice * item.quantity,
                sku: variant.sku,
            };
        });
        this.assertProductStockForLines(
            simulateAvailableKg,
            canonicalGrossItems.map((item) => ({
                productId: item.productId,
                stockUnits: item.stockUnits,
                sku: item.sku,
                variantId: item.variantId,
            })),
        );
        const discountPctByProduct = new Map<string, number>();
        for (const productId of productIds) {
            const totalWeight = totalWeightByProduct.get(productId) || 0;
            const tiers = tiersByProduct.get(productId) || [];
            let bestPct = 0;
            for (const t of tiers) {
                if (totalWeight >= t.minWeight) bestPct = t.discountPercentage;
            }
            discountPctByProduct.set(productId, bestPct);
        }
        const productTierDiscountAmount = new Map<string, number>();
        for (const productId of productIds) {
            const gross = grossSubtotalByProduct.get(productId) || 0;
            const pct = discountPctByProduct.get(productId) || 0;
            const discountAmount = Math.round(gross * (pct / 100) * 100) / 100;
            productTierDiscountAmount.set(productId, Math.max(0, discountAmount));
        }
        const canonicalItems = canonicalGrossItems.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            pricePerUnit: item.grossUnitPrice,
            subtotal: item.subtotal,
        }));
        const itemIndexesByProduct = new Map<string, number[]>();
        canonicalItems.forEach((item, index) => {
            const list = itemIndexesByProduct.get(item.productId) || [];
            list.push(index);
            itemIndexesByProduct.set(item.productId, list);
        });
        for (const [productId, indexes] of itemIndexesByProduct.entries()) {
            const gross = grossSubtotalByProduct.get(productId) || 0;
            const totalDiscount = productTierDiscountAmount.get(productId) || 0;
            if (!(gross > 0 && totalDiscount > 0)) continue;
            let allocated = 0;
            for (let i = 0; i < indexes.length; i++) {
                const idx = indexes[i];
                const lineGross = canonicalItems[idx].subtotal;
                const lineDiscount =
                    i === indexes.length - 1
                        ? Math.max(0, Math.round((totalDiscount - allocated) * 100) / 100)
                        : Math.round(((lineGross / gross) * totalDiscount) * 100) / 100;
                allocated += lineDiscount;
                const lineNet = Math.max(0, Math.round((lineGross - lineDiscount) * 100) / 100);
                canonicalItems[idx].subtotal = lineNet;
                canonicalItems[idx].pricePerUnit = lineNet / Math.max(1, canonicalItems[idx].quantity);
            }
        }
        const subtotal = canonicalItems.reduce((sum, i) => sum + i.subtotal, 0);
        let discountAmount = 0;
        if (dto.couponCode) {
            const couponContextItems = await this.prisma.product.findMany({
                where: { id: { in: canonicalItems.map((i) => i.productId) } },
                select: { id: true, category: { select: { name: true } } },
            });
            const couponContext = {
                cartProductIds: couponContextItems.map((p) => p.id),
                cartCategoryNames: couponContextItems.map((p) => p.category?.name).filter((name): name is string => !!name),
            };
            const validation = await this.settingsService.validateCouponWithContext(dto.couponCode, couponContext);
            if (validation.valid) {
                const coupon = await this.prisma.coupon.findUnique({ where: { code: dto.couponCode } });
                if (coupon?.isActive && (!coupon.expiryDate || coupon.expiryDate >= new Date()) && (!coupon.minOrderValue || subtotal >= Number(coupon.minOrderValue))) {
                    discountAmount =
                        coupon.discountType === 'PERCENTAGE'
                            ? (subtotal * Number(coupon.discountValue)) / 100
                            : Number(coupon.discountValue);
                    if (coupon.maxDiscount) discountAmount = Math.min(discountAmount, Number(coupon.maxDiscount));
                }
            }
        }
        const platformFee = await this.settingsService.getPlatformFee();
        const shippingFee = await this.settingsService.calculateDeliveryFeeByDistance(dto.distanceKm ?? null, subtotal);
        const products = await this.prisma.product.findMany({
            where: { id: { in: canonicalItems.map((i) => i.productId) } },
            select: { id: true, category: { select: { name: true } } },
        });
        const productCategoryById = new Map(products.map((p) => [String(p.id), p.category?.name ?? null]));
        const taxRates = await this.getAdminTaxRates();
        const taxAmount = this.calculateTaxAmountFromLines(
            canonicalItems.map((item) => ({ subtotal: item.subtotal, categoryName: productCategoryById.get(String(item.productId)) ?? null })),
            taxRates,
        );
        const payableAmount = subtotal - discountAmount + shippingFee + taxAmount + platformFee;
        return {
            items: canonicalItems,
            subtotal,
            discountAmount,
            shippingFee,
            taxAmount,
            platformFee,
            payableAmount,
            currency: 'INR',
            amountInPaise: Math.round(Math.max(0, payableAmount) * 100),
            simulatedForUserId: userId,
        };
    }

    /**
     * Subscription signup: order with no line items, payable = plan price, metadata holds plan snapshot.
     * Payment via existing Razorpay flow; verify skips stock when there are no reservations.
     */
    async createSubscriptionOrder(userId: string, dto: CreateSubscriptionOrderDto) {
        if (dto.idempotencyKey) {
            const existing = await this.prisma.order.findUnique({
                where: { idempotencyKey: dto.idempotencyKey },
            });
            if (existing) return existing;
        }

        const addr = dto.shippingAddress as Record<string, any>;
        const city = String(addr.city ?? '').trim();
        const zipDigits = String(addr.zipCode ?? addr.pincode ?? addr.postalCode ?? '').replace(/\D/g, '');

        const serviceableCities = await this.settingsService.getServiceableCities();
        if (serviceableCities.length > 0 && city) {
            const cityOk = userCityMatchesServiceList(city, serviceableCities);
            if (!cityOk) {
                throw new BadRequestException(
                    `We do not deliver to "${city}". Available cities: ${serviceableCities.join(', ')}.`,
                );
            }
        }

        const serviceablePincodes = await this.settingsService.getServiceablePincodes();
        if (serviceablePincodes.length > 0) {
            if (zipDigits.length !== 6 || !serviceablePincodes.includes(zipDigits)) {
                throw new BadRequestException('This PIN code is not in our delivery area.');
            }
        }

        const prefs = await this.settingsService.getStorePreferences();
        const subscriptionPage = (prefs?.subscriptionPage && typeof prefs.subscriptionPage === 'object')
            ? (prefs.subscriptionPage as any)
            : null;
        const plans = Array.isArray(subscriptionPage?.plans) ? subscriptionPage.plans : [];
        const matchedPlan = plans.find((p: any) => String(p?.id) === String(dto.planId));
        if (!matchedPlan) {
            throw new BadRequestException('Invalid subscription plan selected.');
        }
        const price = Number(matchedPlan.price);
        if (!Number.isFinite(price) || price <= 0) {
            throw new BadRequestException('Selected subscription plan has invalid pricing.');
        }
        const canonicalPlanName = String(matchedPlan.name || dto.planId);
        const canonicalFrequency = String(matchedPlan.frequency || 'Monthly');
        const orderNumber = `FT-SUB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const metadata = {
            orderKind: 'SUBSCRIPTION',
            planId: String(dto.planId),
            planName: canonicalPlanName,
            frequency: canonicalFrequency,
            fruitSelection: dto.fruitSelection,
            deliveryDay: dto.deliveryDay,
        };

        return this.prisma.$transaction(async (tx) => {
            let linkedAddressId: string | undefined;
            if (dto.savedAddressId) {
                const saved = await tx.userAddress.findFirst({
                    where: { id: dto.savedAddressId, userId },
                });
                if (!saved) {
                    throw new BadRequestException('Saved address not found.');
                }
                linkedAddressId = saved.id;
            }

            const order = await tx.order.create({
                data: {
                    orderNumber,
                    userId,
                    totalAmount: price,
                    discountAmount: 0,
                    shippingFee: 0,
                    taxAmount: 0,
                    payableAmount: price,
                    shippingAddress: dto.shippingAddress,
                    billingAddress: dto.shippingAddress,
                    deliverySlot: `Subscription · ${dto.deliveryDay}`,
                    status: 'CREATED',
                    paymentStatus: 'PENDING',
                    idempotencyKey: dto.idempotencyKey,
                    addressId: linkedAddressId,
                    metadata: metadata as object,
                },
                include: { items: true },
            });

            await tx.orderStatusLog.create({
                data: {
                    orderId: order.id,
                    status: 'CREATED',
                    changedByRole: 'CUSTOMER',
                    changedByName: null,
                },
            });

            this.logger.log(`Subscription order ${order.orderNumber} created for user ${userId}`);
            return order;
        }, { timeout: 15000 });
    }

    async findByUser(userId: string) {
        await this.reconcileDeliveredFiscalState();
        return this.prisma.order.findMany({
            where: { userId },
            include: {
                items: {
                    include: {
                        product: {
                            select: {
                                id: true,
                                name: true,
                                images: {
                                    take: 1,
                                    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
                                },
                            },
                        },
                        variant: {
                            select: { id: true, attributeValue: true, sku: true },
                        },
                    },
                },
                deliveries: {
                    include: {
                        deliveryPartner: { select: { id: true, name: true, phone: true } },
                    },
                },
                statusLogs: {
                    orderBy: { createdAt: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(id: string, userId: string) {
        await this.reconcileDeliveredFiscalState();
        const order = await this.prisma.order.findFirst({
            where: { id, userId },
            include: {
                items: {
                    include: {
                        product: true,
                        variant: true,
                        seller: { select: { storeName: true } },
                    },
                },
                payments: true,
                deliveries: true,
                statusLogs: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });

        if (!order) throw new NotFoundException('Order not found');
        return order;
    }

    /** Admin: list all orders (no user filter). Light payload — no statusLogs / product images (detail uses findOne when needed). */
    async findAll() {
        await this.reconcileDeliveredFiscalState();
        return this.prisma.order.findMany({
            include: {
                user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
                items: {
                    include: {
                        product: { select: { id: true, name: true } },
                        variant: { select: { id: true, sku: true, attributeValue: true } },
                        seller: { select: { storeName: true } },
                    },
                },
                deliveries: {
                    include: {
                        deliveryPartner: { select: { id: true, name: true, phone: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /**
     * Orders with an assigned rider that are still not completed after `hoursThreshold` from the best-known
     * milestone (latest SHIPPED log, else latest PACKED log, else delivery record created).
     */
    async findAdminDeliveryOverdue(hoursThreshold: number) {
        const safeHours = Math.min(72, Math.max(0.5, Number(hoursThreshold) || 2));
        const ms = safeHours * 60 * 60 * 1000;
        const now = Date.now();

        const rows = await this.prisma.delivery.findMany({
            where: {
                deliveryPartnerId: { not: null },
                actualDelivery: null,
                order: {
                    status: { notIn: ['DELIVERED', 'CANCELLED'] },
                },
            },
            include: {
                deliveryPartner: { select: { id: true, name: true, phone: true } },
                order: {
                    select: {
                        id: true,
                        orderNumber: true,
                        status: true,
                        user: {
                            select: { firstName: true, lastName: true, email: true, phone: true },
                        },
                        statusLogs: { orderBy: { createdAt: 'asc' } },
                    },
                },
            },
        });

        const items: Array<{
            orderId: string;
            orderNumber: string;
            orderStatus: string;
            referenceLabel: 'Shipped' | 'Packed' | 'Delivery record';
            referenceAt: string;
            hoursSinceReference: number;
            hoursPastDue: number;
            deliveryPartner: { id: string; name: string; phone: string | null };
            customerName: string;
            customerEmail: string | null;
            customerPhone: string | null;
        }> = [];

        for (const d of rows) {
            const partner = d.deliveryPartner;
            if (!partner) continue;

            const logs = d.order.statusLogs;
            const shippedAt = [...logs].reverse().find((l) => l.status === 'SHIPPED')?.createdAt;
            const packedAt = [...logs].reverse().find((l) => l.status === 'PACKED')?.createdAt;

            let referenceAt: Date;
            let referenceLabel: 'Shipped' | 'Packed' | 'Delivery record';
            if (shippedAt) {
                referenceAt = shippedAt;
                referenceLabel = 'Shipped';
            } else if (packedAt) {
                referenceAt = packedAt;
                referenceLabel = 'Packed';
            } else {
                referenceAt = d.createdAt;
                referenceLabel = 'Delivery record';
            }

            const elapsed = now - referenceAt.getTime();
            if (elapsed < ms) {
                continue;
            }

            const hoursSinceReference = elapsed / 3600000;
            const hoursPastDue = (elapsed - ms) / 3600000;
            const user = d.order.user;
            const customerName =
                [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() ||
                (user?.email ?? '—');

            items.push({
                orderId: d.order.id,
                orderNumber: d.order.orderNumber,
                orderStatus: d.order.status,
                referenceLabel,
                referenceAt: referenceAt.toISOString(),
                hoursSinceReference: Math.round(hoursSinceReference * 10) / 10,
                hoursPastDue: Math.round(hoursPastDue * 10) / 10,
                deliveryPartner: {
                    id: partner.id,
                    name: partner.name,
                    phone: partner.phone ?? null,
                },
                customerName,
                customerEmail: user?.email ?? null,
                customerPhone: user?.phone ?? null,
            });
        }

        items.sort(
            (a, b) => new Date(a.referenceAt).getTime() - new Date(b.referenceAt).getTime(),
        );
        return { thresholdHours: safeHours, items };
    }

    /**
     * One-time admin repair for legacy reservations that stored pack-count instead of kg-equivalent units.
     */
    async reconcileLegacyStockUnits() {
        type ReservationGroup = {
            orderId: string;
            variantId: string;
            reservationTotal: number;
            reservationStatus: string;
            expectedUnits: number;
            delta: number;
        };

        return this.prisma.$transaction(async (tx) => {
            const orders = await tx.order.findMany({
                where: {
                    status: { not: 'CANCELLED' },
                    paymentStatus: { not: 'REFUNDED' },
                },
                select: {
                    id: true,
                    items: {
                        select: {
                            variantId: true,
                            quantity: true,
                            variant: { select: { attributeValue: true } },
                        },
                    },
                    reservations: {
                        where: { status: { in: ['PENDING', 'COMPLETED'] } },
                        select: { id: true, variantId: true, quantity: true, status: true },
                    },
                },
            });

            const groups: ReservationGroup[] = [];
            const variantAdjust = new Map<string, { stock: number; reserved: number; available: number }>();
            const reservationPatch = new Map<string, number>();
            let skippedMixedStatusGroups = 0;

            for (const order of orders) {
                const expectedByVariant = new Map<string, number>();
                for (const item of order.items) {
                    const variantId = String(item.variantId || '');
                    if (!variantId) continue;
                    const packQty = this.parsePackQtyKg(item.variant?.attributeValue);
                    const expected = Math.max(1, Number(item.quantity) || 1) * packQty;
                    expectedByVariant.set(variantId, (expectedByVariant.get(variantId) || 0) + expected);
                }

                const reservationsByVariant = new Map<string, Array<{ id: string; qty: number; status: string }>>();
                for (const res of order.reservations) {
                    const variantId = String(res.variantId || '');
                    if (!variantId) continue;
                    const list = reservationsByVariant.get(variantId) || [];
                    list.push({ id: res.id, qty: Number(res.quantity) || 0, status: String(res.status || '').toUpperCase() });
                    reservationsByVariant.set(variantId, list);
                }

                for (const [variantId, expectedUnits] of expectedByVariant.entries()) {
                    const rows = reservationsByVariant.get(variantId) || [];
                    if (!rows.length) continue;

                    const statuses = Array.from(new Set(rows.map((r) => r.status)));
                    if (statuses.length !== 1) {
                        skippedMixedStatusGroups += 1;
                        continue;
                    }

                    const reservationStatus = statuses[0];
                    const reservationTotal = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
                    const delta = expectedUnits - reservationTotal;
                    if (delta === 0) continue;

                    const first = rows[0];
                    reservationPatch.set(first.id, Math.max(0, (Number(first.qty) || 0) + delta));

                    const existing = variantAdjust.get(variantId) || { stock: 0, reserved: 0, available: 0 };
                    if (reservationStatus === 'COMPLETED') {
                        existing.stock -= delta;
                        existing.available -= delta;
                    } else if (reservationStatus === 'PENDING') {
                        existing.reserved += delta;
                        existing.available -= delta;
                    } else {
                        continue;
                    }
                    variantAdjust.set(variantId, existing);

                    groups.push({
                        orderId: order.id,
                        variantId,
                        reservationTotal,
                        reservationStatus,
                        expectedUnits,
                        delta,
                    });
                }
            }

            const variantIds = Array.from(variantAdjust.keys());
            if (variantIds.length) {
                const variants = await tx.productVariant.findMany({
                    where: { id: { in: variantIds } },
                    select: { id: true, stockQuantity: true, reservedQuantity: true, availableQuantity: true },
                });
                const byId = new Map(variants.map((v) => [String(v.id), v]));

                for (const [variantId, d] of variantAdjust.entries()) {
                    const current = byId.get(variantId);
                    if (!current) {
                        throw new NotFoundException(`Variant ${variantId} not found during stock reconciliation.`);
                    }
                    const nextStock = Number(current.stockQuantity) + d.stock;
                    const nextReserved = Number(current.reservedQuantity) + d.reserved;
                    const nextAvailable = Number(current.availableQuantity) + d.available;
                    if (nextStock < 0 || nextReserved < 0 || nextAvailable < 0) {
                        throw new BadRequestException(
                            `Reconciliation would make stock negative for variant ${variantId}. Aborting.`,
                        );
                    }
                }
            }

            for (const [reservationId, nextQty] of reservationPatch.entries()) {
                await tx.stockReservation.update({
                    where: { id: reservationId },
                    data: { quantity: nextQty },
                });
            }

            for (const [variantId, d] of variantAdjust.entries()) {
                await tx.productVariant.update({
                    where: { id: variantId },
                    data: {
                        stockQuantity: { increment: d.stock },
                        reservedQuantity: { increment: d.reserved },
                        availableQuantity: { increment: d.available },
                    },
                });

                if (d.stock !== 0 || d.available !== 0 || d.reserved !== 0) {
                    await tx.inventoryLog.create({
                        data: {
                            variantId,
                            changeAmount: d.stock,
                            reason: `ADMIN_LEGACY_PACK_RECONCILE stock=${d.stock},reserved=${d.reserved},available=${d.available}`,
                        },
                    });
                }
            }

            return {
                scannedOrders: orders.length,
                touchedGroups: groups.length,
                updatedReservations: reservationPatch.size,
                updatedVariants: variantAdjust.size,
                skippedMixedStatusGroups,
                totalDeltaUnits: groups.reduce((s, g) => s + g.delta, 0),
                groups,
            };
        }, { timeout: 60000 });
    }

    /** Update order status (admin or seller who has items in the order). Persists to DB. */
    async updateStatus(orderId: string, userId: string, userRole: string, status: string) {
        const allowed = ['CREATED', 'ON_HOLD', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
        const nextStatus = status?.toUpperCase();
        if (!nextStatus || !allowed.includes(nextStatus)) {
            throw new BadRequestException(`Invalid status. Use one of: ${allowed.join(', ')}`);
        }
        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { items: { select: { sellerId: true } } },
        });
        if (!order) throw new NotFoundException('Order not found');
        const isAdmin = userRole === 'ADMIN';
        let isSeller = false;
        if (userRole === 'SELLER') {
            const sellerProfile = await this.prisma.seller.findUnique({
                where: { userId },
                select: { id: true },
            });
            isSeller = !!sellerProfile && order.items.some((i) => i.sellerId === sellerProfile.id);
        }
        if (!isAdmin && !isSeller) {
            throw new NotFoundException('Order not found');
        }
        const actorRole = isAdmin ? 'ADMIN' : isSeller ? 'SELLER' : 'SYSTEM';
        let actorName: string | null = null;

        if (isAdmin) {
            const adminUser = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { firstName: true, lastName: true, email: true },
            });
            if (adminUser) {
                const name = [adminUser.firstName, adminUser.lastName].filter(Boolean).join(' ');
                actorName = name || adminUser.email || 'Admin';
            }
        } else if (isSeller) {
            const sellerProfile = await this.prisma.seller.findUnique({
                where: { userId },
                select: { storeName: true },
            });
            actorName = sellerProfile?.storeName || 'Seller';
        }

        const updatedOrder = await this.prisma.$transaction(async (tx) => {
            const currentOrder = await tx.order.findUnique({
                where: { id: orderId },
                include: { items: true }
            });

            // Handle Stock Restoration if transitioning to CANCELLED
            if (nextStatus === 'CANCELLED' && currentOrder.status !== 'CANCELLED') {
                const reservations = await tx.stockReservation.findMany({
                    where: { orderId: orderId, status: { in: ['PENDING', 'COMPLETED'] } }
                });

                const completedReservations = reservations.filter((r) => r.status === 'COMPLETED');
                const pendingReservations = reservations.filter((r) => r.status === 'PENDING');
                if (completedReservations.length) {
                    await this.restorePhysicalStock(
                        tx,
                        completedReservations.map((r) => ({ variantId: r.variantId, quantity: r.quantity })),
                        orderId,
                        'ORDER_CANCELLED_RESTORE_PHYSICAL',
                    );
                }
                if (pendingReservations.length) {
                    await this.releaseReservedStock(
                        tx,
                        pendingReservations.map((r) => ({ variantId: r.variantId, quantity: r.quantity })),
                        orderId,
                        'ORDER_CANCELLED_RELEASE_RESERVATION',
                    );
                }
                for (const res of reservations) {
                    await tx.stockReservation.update({
                        where: { id: res.id },
                        data: { status: 'CANCELLED' },
                    });
                }
            }

            const shouldAutoMarkPaid = nextStatus === 'DELIVERED' && currentOrder.paymentStatus === 'PENDING';

            // If delivery transition auto-marks payment as PAID, commit any pending reservations.
            // This keeps physical stock (stockQuantity) consistent for fulfillment-driven flows.
            if (shouldAutoMarkPaid) {
                const reservations = await tx.stockReservation.findMany({
                    where: { orderId, status: 'PENDING' },
                });
                for (const res of reservations) {
                    await tx.stockReservation.update({
                        where: { id: res.id },
                        data: { status: 'COMPLETED' },
                    });
                }
                if (reservations.length) {
                    await this.commitReservedToPhysical(
                        tx,
                        reservations.map((r) => ({ variantId: r.variantId, quantity: r.quantity })),
                        orderId,
                        'AUTO_DELIVERED_PAYMENT_COMMIT',
                    );
                }
            }

            const o = await tx.order.update({
                where: { id: orderId },
                data: {
                    status: nextStatus,
                    ...(shouldAutoMarkPaid ? { paymentStatus: 'PAID' } : {}),
                },
            });

            await tx.orderStatusLog.create({
                data: {
                    orderId,
                    status: nextStatus,
                    changedByRole: actorRole,
                    changedByName: actorName,
                },
            });
            return o;
        }, { timeout: 15000 });

        return this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                user: { select: { id: true, email: true, phone: true, firstName: true, lastName: true } },
                items: {
                    include: {
                        product: { select: { name: true, id: true } },
                        variant: true,
                        seller: { select: { storeName: true } },
                    },
                },
                statusLogs: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
    }

    async updatePaymentStatus(orderId: string, paymentStatus: string) {
        const allowed = ['PENDING', 'PAID', 'REFUNDED'];
        const nextPaymentStatus = paymentStatus?.toUpperCase();
        if (!nextPaymentStatus || !allowed.includes(nextPaymentStatus)) {
            throw new BadRequestException(`Invalid payment status. Use one of: ${allowed.join(', ')}`);
        }

        const order = await this.prisma.order.findUnique({
            where: { id: orderId },
            include: { items: true }
        });

        if (!order) throw new NotFoundException('Order not found');

        return this.prisma.$transaction(async (tx) => {
            const updated = await tx.order.update({
                where: { id: orderId },
                data: { 
                    paymentStatus: nextPaymentStatus,
                    // Auto-confirm if paid
                    status: nextPaymentStatus === 'PAID' ? 'CONFIRMED' : order.status
                },
            });

            // Handle stock commitment if changed to PAID
            if (nextPaymentStatus === 'PAID' && order.paymentStatus !== 'PAID') {
                const reservations = await tx.stockReservation.findMany({
                    where: { orderId: orderId, status: 'PENDING' }
                });

                for (const res of reservations) {
                    await tx.stockReservation.update({
                        where: { id: res.id },
                        data: { status: 'COMPLETED' },
                    });
                }
                if (reservations.length) {
                    await this.commitReservedToPhysical(
                        tx,
                        reservations.map((r) => ({ variantId: r.variantId, quantity: r.quantity })),
                        orderId,
                        'MANUAL_PAYMENT_PAID_COMMIT',
                    );
                }
            }

            return updated;
        }, { timeout: 15000 });
    }

    /** Auto-cancel unpaid ON_HOLD orders after hold window and release their reserved stock. */
    async expireUnpaidOnHoldOrders(): Promise<number> {
        const staleThreshold = new Date(Date.now() - OrderService.ONLINE_HOLD_MINUTES * 60000);
        const staleOrders = await this.prisma.order.findMany({
            where: {
                status: { in: ['ON_HOLD', 'CREATED'] },
                paymentStatus: 'PENDING',
                createdAt: { lte: staleThreshold },
            },
            select: { id: true },
            take: 200,
            orderBy: { createdAt: 'asc' },
        });
        if (!staleOrders.length) return 0;

        let cancelled = 0;
        for (const order of staleOrders) {
            await this.prisma.$transaction(async (tx) => {
                const current = await tx.order.findUnique({
                    where: { id: order.id },
                    include: { items: { include: { product: { select: { allowCashOnDelivery: true } } } } },
                });

                if (!current || !['ON_HOLD', 'CREATED'].includes(String(current.status)) || current.paymentStatus !== 'PENDING') return;

                // Even more lenient for COD-eligible orders.
                // If every item in the order allows COD, we give them 120 minutes total before auto-canceling.
                const allowsCod = current.items.every(it => it.product.allowCashOnDelivery);
                const codGraceThreshold = new Date(Date.now() - 120 * 60000); // 2 hours
                if (allowsCod && current.createdAt > codGraceThreshold) {
                    return; // Skip for now, give more time
                }

                const reservations = await tx.stockReservation.findMany({
                    where: { orderId: order.id, status: 'PENDING' },
                });
                if (reservations.length) {
                    await this.releaseReservedStock(
                        tx,
                        reservations.map((r) => ({ variantId: r.variantId, quantity: r.quantity })),
                        order.id,
                        'ORDER_HOLD_EXPIRED_RELEASE',
                    );
                }
                for (const res of reservations) {
                    await tx.stockReservation.update({
                        where: { id: res.id },
                        data: { status: 'CANCELLED' },
                    });
                }

                await tx.order.update({
                    where: { id: order.id },
                    data: { status: 'CANCELLED' },
                });
                await tx.orderStatusLog.create({
                    data: {
                        orderId: order.id,
                        status: 'CANCELLED',
                        changedByRole: 'SYSTEM',
                        changedByName: 'Auto-cancel (hold expired)',
                    },
                });
                cancelled += 1;
            }, { timeout: 10000 });
        }
        return cancelled;
    }
}
