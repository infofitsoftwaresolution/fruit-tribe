import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateProductDto } from '../interface/dtos/create-product.dto';
import {
    getProductAvailableKg,
    parsePackQtyKg,
    variantInStock,
    variantPacksAvailable,
} from './inventory-pool.util';
import { ProductFilterDto } from '../interface/dtos/product-filter.dto';

@Injectable()
export class ProductService {
    private readonly logger = new Logger(ProductService.name);

    constructor(private readonly prisma: PrismaService) { }

    private async resolveActorSellerId(actor: { id: string; role?: string }): Promise<string | null> {
        if (String(actor?.role || '').toUpperCase() !== 'SELLER') return null;
        const seller = await this.prisma.seller.findUnique({
            where: { userId: actor.id },
            select: { id: true },
        });
        if (!seller) throw new BadRequestException('Seller profile not found for this account.');
        return seller.id;
    }

    /** Persist admin bulk qty / unit price as entered (positive numbers only). No auto-clear vs base price. */
    private parseBulkTier(
        qty: number | null | undefined,
        price: any | number | string | null | undefined,
    ): { qty: number | null; price: any | null } {
        const q = qty != null ? Number(qty) : NaN;
        const bu = price != null ? Number(price) : NaN;
        if (Number.isFinite(q) && q > 0 && Number.isFinite(bu) && bu > 0) {
            return { qty: Math.floor(q), price: price as any };
        }
        return { qty: null, price: null };
    }

    private isArchivedVariantLabel(value: string | null | undefined): boolean {
        return String(value || '').trim().toLowerCase().includes('(archived)');
    }

    private variantPackMatches(
        incomingValue: string | null | undefined,
        existingValue: string | null | undefined,
    ): boolean {
        const inc = String(incomingValue || '').trim().toLowerCase();
        const ex = String(existingValue || '').trim().toLowerCase();
        if (inc && ex && inc === ex) return true;
        const incKg = this.parsePackQtyKg(incomingValue);
        const exKg = this.parsePackQtyKg(existingValue);
        return Number.isFinite(incKg) && Number.isFinite(exKg) && incKg > 0 && incKg === exKg;
    }

    private findExistingVariantForIncoming(
        incoming: { id?: string; attributeValue?: string | null; sku?: string | null },
        existingVariants: Array<{
            id: string;
            sku: string | null;
            attributeValue: string | null;
            reservedQuantity?: number | null;
        }>,
        alreadyMatched: Set<string>,
    ) {
        if (incoming.id) {
            const byId = existingVariants.find((ev) => ev.id === incoming.id);
            if (byId && !alreadyMatched.has(byId.id)) return byId;
        }
        const incKg = this.parsePackQtyKg(incoming.attributeValue);
        if (!(Number.isFinite(incKg) && incKg > 0)) return null;
        return (
            existingVariants.find((ev) => {
                if (alreadyMatched.has(ev.id)) return false;
                if (this.isArchivedVariantLabel(ev.attributeValue)) return false;
                return this.variantPackMatches(incoming.attributeValue, ev.attributeValue);
            }) ?? null
        );
    }

    private parsePackQtyKg(rawValue: string | null | undefined): number {
        const raw = String(rawValue || '').trim().toLowerCase();
        if (!raw) return 1;
        const m = raw.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|kilogram|kilograms|g|gm|grams)\b/);
        if (!m) {
            if (raw === 'default' || raw.includes('default')) return 1;
            return 1;
        }
        const q = Number(m[1]);
        if (!Number.isFinite(q) || q <= 0) return 1;
        const u = String(m[2]).toLowerCase();
        return ['g', 'gm', 'grams'].includes(u) ? q / 1000 : q;
    }

    private deriveTierPricingRows(
        basePrice: number,
        variants: Array<{ attributeValue?: string | null; priceOverride?: number | null; isBulkVariant?: boolean | null }>,
        productBulk?: { qty: number | null; price: number | null },
    ): Array<{ minWeight: number; discountPercentage: number }> {
        const byWeight = new Map<number, number>();
        for (const variant of variants) {
            const minWeight = this.parsePackQtyKg(variant.attributeValue);
            const totalPrice = Number(variant.priceOverride);
            if (!(Number.isFinite(minWeight) && minWeight > 0 && Number.isFinite(totalPrice) && totalPrice > 0 && Number.isFinite(basePrice) && basePrice > 0)) continue;
            const retailTotal = basePrice * minWeight;
            const discountPercentage = ((retailTotal - totalPrice) / retailTotal) * 100;
            const eligible = Boolean(variant.isBulkVariant) || discountPercentage > 0;
            if (!eligible) continue;
            if (!(discountPercentage > 0)) continue;
            const current = byWeight.get(minWeight);
            if (current == null || discountPercentage > current) byWeight.set(minWeight, discountPercentage);
        }
        if (productBulk?.qty && productBulk.price && Number.isFinite(basePrice) && basePrice > 0) {
            const minWeight = Number(productBulk.qty);
            const retailTotal = basePrice * minWeight;
            const discountPercentage = ((retailTotal - Number(productBulk.price)) / retailTotal) * 100;
            if (Number.isFinite(discountPercentage) && discountPercentage > 0) {
                const current = byWeight.get(minWeight);
                if (current == null || discountPercentage > current) byWeight.set(minWeight, discountPercentage);
            }
        }
        return Array.from(byWeight.entries())
            .map(([minWeight, discountPercentage]) => ({
                minWeight: Math.round(minWeight * 1000) / 1000,
                discountPercentage: Math.round(discountPercentage * 100) / 100,
            }))
            .filter((row) => row.minWeight > 0 && row.discountPercentage > 0)
            .sort((a, b) => a.minWeight - b.minWeight);
    }

    private async replaceTierPricingRows(
        tx: Prisma.TransactionClient,
        productId: string,
        rows: Array<{ minWeight: number; discountPercentage: number }>,
    ): Promise<void> {
        await tx.$executeRawUnsafe(`DELETE FROM product_tier_pricing WHERE product_id = $1::uuid`, productId);
        for (const row of rows) {
            await tx.$executeRawUnsafe(
                `INSERT INTO product_tier_pricing (id, product_id, min_weight, discount_percentage, created_at, updated_at)
                 VALUES ($1::uuid, $2::uuid, $3::numeric, $4::numeric, NOW(), NOW())`,
                randomUUID(),
                productId,
                row.minWeight,
                row.discountPercentage,
            );
        }
    }

    async findAll(filters: ProductFilterDto) {
        const { page = 1, limit = 10, search, categoryId, minPrice, maxPrice, sortBy, sortOrder } = filters;
        const skip = (page - 1) * limit;

        const now = new Date();
        const where: any = {
            ...(filters.includeInactive !== true && { isActive: true }),
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    // Intelligent multi-word search with stemming (e.g. mangoes -> mango)
                    ...search.split(' ').map(word => {
                        const stem = word.toLowerCase().endsWith('es') 
                            ? word.slice(0, -2) 
                            : (word.toLowerCase().endsWith('s') ? word.slice(0, -1) : word);
                        if (stem.length < 3) return null;
                        return {
                            OR: [
                                { name: { contains: stem, mode: 'insensitive' } },
                                { description: { contains: stem, mode: 'insensitive' } },
                                { tags: { has: stem } },
                                { category: { name: { contains: stem, mode: 'insensitive' } } }
                            ]
                        };
                    }).filter(Boolean)
                ],
            }),
            ...(categoryId && { categoryId }),
            ...((minPrice || maxPrice) && {
                basePrice: {
                    ...(minPrice && { gte: minPrice }),
                    ...(maxPrice && { lte: maxPrice }),
                },
            }),
            // Seasonal Filtering: Only show seasonal items if they are currently in season
            ...(filters.showOutOfSeason !== true && {
                OR: [
                    { isSeasonal: false },
                    {
                        AND: [
                            { isSeasonal: true },
                            { OR: [{ seasonalStart: null }, { seasonalStart: { lte: now } }] },
                            { OR: [{ seasonalEnd: null }, { seasonalEnd: { gte: now } }] },
                        ]
                    }
                ]
            })
        };

        try {
            const orderBy: any = {};
            const sortField = ['name', 'basePrice', 'createdAt'].includes(sortBy || '') ? sortBy : 'createdAt';
            orderBy[sortField as string] = sortOrder || 'desc';

            const [total, items] = await Promise.all([
                this.prisma.product.count({ where }),
                this.prisma.product.findMany({
                    where,
                    include: {
                        category: true,
                        seller: {
                            select: { id: true, storeName: true, rating: true },
                        },
                        variants: true,
                        images: {
                            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
                            take: 1,
                        },
                    },
                    skip,
                    take: limit,
                    orderBy,
                }),
            ]);

            const itemsWithStats = items.map(product => this.mapStats(product));

            return {
                data: itemsWithStats,
                meta: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                },
            };
        } catch (error) {
            this.logger.error(`Failed to fetch products: ${error.stack || error.message}`);
            throw new BadRequestException(`Could not fetch products: ${error.message}`);
        }
    }

    async findOne(id: string) {
        const product = await this.prisma.product.findUnique({
            where: { id },
            include: {
                category: true,
                seller: true,
                variants: {
                    include: { inventoryLogs: { take: 5, orderBy: { createdAt: 'desc' } } }
                },
                images: true,
                reviews: {
                    where: { status: 'APPROVED' },
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                },
            },
        });

        if (!product) {
            throw new NotFoundException(`Product with ID ${id} not found`);
        }

        return this.mapStats(product);
    }

    async create(dto: CreateProductDto, actor: { id: string; role?: string }) {
        // Principal Engineer Review Comment: 
        // We use a transaction to ensure atomicity between product, variants, and initial inventory.
        return this.prisma.$transaction(async (tx) => {
            const slug = await this.resolveUniqueSlug(tx, dto.name);
            const bulk = this.parseBulkTier(dto.bulkDiscountQty, dto.bulkDiscountPrice);
            const requestedTotalUnits = dto.stock != null ? Number(dto.stock) : 0;
            if (!Number.isFinite(requestedTotalUnits) || requestedTotalUnits < 0) {
                throw new BadRequestException('Invalid total stock quantity');
            }
            const actorSellerId = await this.resolveActorSellerId(actor);
            const effectiveSellerId =
                actorSellerId ??
                (dto.sellerId && String(dto.sellerId).trim()
                    ? String(dto.sellerId).trim()
                    : null);
            if (!effectiveSellerId) {
                throw new BadRequestException('sellerId is required for admin product creation.');
            }
            const product = await tx.product.create({
                data: {
                    name: dto.name,
                    slug,
                    description: dto.description,
                    basePrice: dto.basePrice,
                    unit: 'kg',
                    tags: [],
                    seller: { connect: { id: effectiveSellerId } },
                    category: { connect: { id: dto.categoryId } },
                    harvestDate: dto.harvestDate ? new Date(dto.harvestDate) : undefined,
                    expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
                    isSeasonal: dto.isSeasonal ?? false,
                    isOrganic: dto.isOrganic ?? false,
                    seasonalStart: dto.seasonalStart ? new Date(dto.seasonalStart) : undefined,
                    seasonalEnd: dto.seasonalEnd ? new Date(dto.seasonalEnd) : undefined,
                    bulkDiscountQty: bulk.qty ?? undefined,
                    bulkDiscountPrice: bulk.price ?? undefined,
                    allowCashOnDelivery: dto.allowCashOnDelivery ?? true,
                    // Freshness Intelligence
                    freshnessScore: dto.freshnessScore ?? undefined,
                    ripenessStage: dto.ripenessStage ?? undefined,
                    farmName: dto.farmName ?? undefined,
                    farmState: dto.farmState ?? undefined,
                    stock: requestedTotalUnits,
                },
            });

            const variantRows =
                Array.isArray(dto.variants) && dto.variants.length > 0
                    ? dto.variants
                    : [
                          {
                              sku: `${slug}-DEFAULT`,
                              attributeName: 'Quantity',
                              attributeValue: 'Default',
                              isBulkVariant: false,
                              priceOverride: undefined as number | undefined,
                              lowStockThreshold: 5,
                          },
                      ];

            if (variantRows.length > 0) {
                await tx.productVariant.createMany({
                    data: variantRows.map((v) => ({
                        productId: product.id,
                        sku: v.sku,
                        attributeName: v.attributeName,
                        attributeValue: v.attributeValue,
                        isBulkVariant: Boolean(v.isBulkVariant),
                        priceOverride: v.priceOverride,
                        stockQuantity: 0,
                        availableQuantity: 0,
                        lowStockThreshold: v.lowStockThreshold || 5,
                    })),
                });
            }
            const tierRows = this.deriveTierPricingRows(
                Number(dto.basePrice),
                (dto.variants || []).map((v) => ({
                    attributeValue: v.attributeValue,
                    priceOverride: v.priceOverride,
                    isBulkVariant: v.isBulkVariant,
                })),
                { qty: bulk.qty, price: bulk.price != null ? Number(bulk.price) : null },
            );
            await this.replaceTierPricingRows(tx, product.id, tierRows);

            if (dto.images && dto.images.length > 0) {
                await tx.productImage.createMany({
                    data: dto.images.map((img, idx) => ({
                        productId: product.id,
                        imageUrl: this.normalizeImageUrl(img.imageUrl),
                        isPrimary: img.isPrimary ?? idx === 0,
                        sortOrder: idx,
                    })),
                });
            }

            const result = await tx.product.findUnique({
                where: { id: product.id },
                include: { images: true, variants: true },
            });

            return result ? this.mapStats(result) : null;
        }, { timeout: 20000, maxWait: 10000 });
    }

    async update(id: string, dto: any, actor: { id: string; role?: string }) {
        const existing = await this.prisma.product.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`Product ${id} not found`);
        const actorSellerId = await this.resolveActorSellerId(actor);
        if (actorSellerId && existing.sellerId !== actorSellerId) {
            throw new BadRequestException('You can only update your own products.');
        }

        const mergedBulkQty = dto.bulkDiscountQty !== undefined ? dto.bulkDiscountQty : existing.bulkDiscountQty;
        const mergedBulkPrice = dto.bulkDiscountPrice !== undefined ? dto.bulkDiscountPrice : existing.bulkDiscountPrice;
        const bulk = this.parseBulkTier(mergedBulkQty, mergedBulkPrice);

        return this.prisma.$transaction(async (tx) => {
            const requestedTotalUnits = dto.stock != null ? Number(dto.stock) : undefined;
            const variantSyncStats = {
                created: 0,
                updated: 0,
                reusedBySku: 0,
                deleted: 0,
                archived: 0,
            };
            const nextSlug =
                dto.name != null && dto.name !== ''
                    ? await this.resolveUniqueSlug(tx, dto.name, id)
                    : undefined;
            const product = await tx.product.update({
                where: { id },
                data: {
                    ...(dto.name && { name: dto.name, ...(nextSlug && { slug: nextSlug }) }),
                    ...(dto.description !== undefined && { description: dto.description }),
                    ...(dto.basePrice !== undefined && { basePrice: dto.basePrice }),
                    ...(dto.categoryId && { categoryId: dto.categoryId }),
                    ...(!actorSellerId && dto.sellerId && { sellerId: dto.sellerId }),
                    ...(dto.harvestDate !== undefined && { harvestDate: dto.harvestDate ? new Date(dto.harvestDate) : null }),
                    ...(dto.expiryDate !== undefined && { expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null }),
                    ...(dto.isSeasonal !== undefined && { isSeasonal: dto.isSeasonal }),
                    ...(dto.isOrganic !== undefined && { isOrganic: dto.isOrganic }),
                    ...(dto.seasonalStart !== undefined && { seasonalStart: dto.seasonalStart ? new Date(dto.seasonalStart) : null }),
                    ...(dto.seasonalEnd !== undefined && { seasonalEnd: dto.seasonalEnd ? new Date(dto.seasonalEnd) : null }),
                    bulkDiscountQty: bulk.qty,
                    bulkDiscountPrice: bulk.price,
                    ...(dto.allowCashOnDelivery !== undefined && { allowCashOnDelivery: dto.allowCashOnDelivery }),
                    ...(dto.isActive !== undefined && { isActive: dto.isActive }),
                    // Freshness Intelligence fields
                    ...(dto.freshnessScore !== undefined && { freshnessScore: dto.freshnessScore }),
                    ...(dto.ripenessStage !== undefined && { ripenessStage: dto.ripenessStage }),
                    ...(dto.farmName !== undefined && { farmName: dto.farmName }),
                    ...(dto.farmState !== undefined && { farmState: dto.farmState }),
                },
            });

            if (dto.images !== undefined && Array.isArray(dto.images)) {
                await tx.productImage.deleteMany({ where: { productId: id } });
                if (dto.images.length > 0) {
                    await tx.productImage.createMany({
                        data: dto.images.map((img: { imageUrl: string; isPrimary?: boolean }, idx: number) => ({
                            productId: id,
                            imageUrl: this.normalizeImageUrl(img.imageUrl),
                            isPrimary: img.isPrimary ?? idx === 0,
                            sortOrder: idx,
                        })),
                    });
                }
            }

            // High-Precision Variant Synchronization (match by id or pack weight — never drop 5kg silently)
            if (dto.variants !== undefined && Array.isArray(dto.variants)) {
                const incomingVariants = dto.variants;
                const existingVariants = await tx.productVariant.findMany({ where: { productId: id } });
                const matchedExistingIds = new Set<string>();
                if (requestedTotalUnits != null) {
                    if (!Number.isFinite(requestedTotalUnits) || requestedTotalUnits < 0) {
                        throw new BadRequestException('Invalid total stock quantity');
                    }
                    const reservedSum = existingVariants.reduce(
                        (sum, v) => sum + Math.max(0, Number(v.reservedQuantity) || 0),
                        0,
                    );
                    if (requestedTotalUnits < reservedSum) {
                        throw new BadRequestException(
                            `Total stock (${requestedTotalUnits}) cannot be less than currently reserved stock (${reservedSum}).`,
                        );
                    }
                }

                for (const incoming of incomingVariants) {
                    const match = this.findExistingVariantForIncoming(incoming, existingVariants, matchedExistingIds);
                    if (match) matchedExistingIds.add(match.id);
                }

                const idsToDelete = existingVariants
                    .filter((ev) => !matchedExistingIds.has(ev.id))
                    .map((ev) => ev.id);

                if (idsToDelete.length > 0) {
                    const deletableIds: string[] = [];
                    const blockedIds: string[] = [];
                    for (const variantId of idsToDelete) {
                        const [orderItemsCount, inventoryLogsCount, reservationsCount] = await Promise.all([
                            tx.orderItem.count({ where: { variantId } }),
                            tx.inventoryLog.count({ where: { variantId } }),
                            tx.stockReservation.count({ where: { variantId } }),
                        ]);
                        const hasReferences = orderItemsCount > 0 || inventoryLogsCount > 0 || reservationsCount > 0;
                        if (hasReferences) blockedIds.push(variantId);
                        else deletableIds.push(variantId);
                    }
                    if (deletableIds.length > 0) {
                        await tx.productVariant.deleteMany({ where: { id: { in: deletableIds } } });
                        variantSyncStats.deleted += deletableIds.length;
                    }
                    for (const variantId of blockedIds) {
                        const existingVariant = existingVariants.find((v) => v.id === variantId);
                        const reserved = Math.max(0, Number(existingVariant?.reservedQuantity || 0));
                        const currentLabel = String(existingVariant?.attributeValue || existingVariant?.sku || 'Variant');
                        const archivedLabel = this.isArchivedVariantLabel(currentLabel)
                            ? currentLabel
                            : `${currentLabel} (Archived)`;
                        await tx.productVariant.update({
                            where: { id: variantId },
                            data: {
                                attributeValue: archivedLabel,
                                stockQuantity: 0,
                                availableQuantity: 0,
                                lowStockThreshold: 0,
                            },
                        });
                        variantSyncStats.archived += 1;
                    }
                }

                const usedSkus = new Set(
                    existingVariants.map((ev) => String(ev.sku || '').trim()).filter(Boolean),
                );
                matchedExistingIds.clear();

                for (const incoming of incomingVariants) {
                    const existing = this.findExistingVariantForIncoming(incoming, existingVariants, matchedExistingIds);
                    if (existing) matchedExistingIds.add(existing.id);

                    let sku = String(incoming.sku || '').trim();
                    if (!sku) {
                        sku = `SKU-${Date.now()}-${Math.random().toString(36).slice(-6).toUpperCase()}`;
                    }
                    while (usedSkus.has(sku) && existing && String(existing.sku || '').trim() !== sku) {
                        sku = `${sku}-${Math.random().toString(36).slice(-4).toUpperCase()}`;
                    }
                    usedSkus.add(sku);

                    const rowData = {
                        sku,
                        attributeName: incoming.attributeName || 'Quantity',
                        attributeValue: incoming.attributeValue,
                        isBulkVariant: Boolean(incoming.isBulkVariant),
                        priceOverride: incoming.priceOverride,
                        stockQuantity: 0,
                        lowStockThreshold: incoming.lowStockThreshold ?? 5,
                        availableQuantity: 0,
                    };

                    if (existing) {
                        await tx.productVariant.update({
                            where: { id: existing.id },
                            data: rowData,
                        });
                        variantSyncStats.updated += 1;
                    } else {
                        await tx.productVariant.create({
                            data: {
                                ...rowData,
                                productId: id,
                            },
                        });
                        variantSyncStats.created += 1;
                    }
                }
            }

            const refreshedVariants = await tx.productVariant.findMany({
                where: { productId: id },
                select: { attributeValue: true, priceOverride: true, isBulkVariant: true },
            });
            const tierRows = this.deriveTierPricingRows(
                Number(dto.basePrice ?? existing.basePrice),
                refreshedVariants.map((v) => ({
                    attributeValue: v.attributeValue,
                    priceOverride: v.priceOverride != null ? Number(v.priceOverride) : null,
                    isBulkVariant: v.isBulkVariant,
                })),
                { qty: bulk.qty, price: bulk.price != null ? Number(bulk.price) : null },
            );
            await this.replaceTierPricingRows(tx, id, tierRows);

            if (requestedTotalUnits != null) {
                await tx.product.update({
                    where: { id },
                    data: { stock: requestedTotalUnits },
                });
            }

            const result = await tx.product.findUnique({
                where: { id },
                include: { images: true, variants: true },
            });

            if (!result) return null;
            const mapped = this.mapStats(result) as any;
            mapped.variantSync = variantSyncStats;
            this.logger.log(
                `Product ${id} variant sync -> created:${variantSyncStats.created}, updated:${variantSyncStats.updated}, reusedBySku:${variantSyncStats.reusedBySku}, deleted:${variantSyncStats.deleted}, archived:${variantSyncStats.archived}`,
            );
            return mapped;
        }, { timeout: 30000, maxWait: 10000 });
    }

    async updateStock(variantId: string, changeAmount: number, reason: string, actor: { id: string; role?: string }) {
        const actorSellerId = await this.resolveActorSellerId(actor);
        return this.prisma.$transaction(async (tx) => {
            const [variant] = await tx.$queryRawUnsafe<any[]>(
                'SELECT pv.stock_quantity as "stockQuantity", pv.reserved_quantity as "reservedQuantity", p.seller_id as "sellerId" FROM product_variants pv JOIN products p ON p.id = pv.product_id WHERE pv.id = $1 FOR UPDATE',
                variantId
            );

            if (!variant) throw new NotFoundException(`Variant ${variantId} not found`);
            if (actorSellerId && String(variant.sellerId) !== actorSellerId) {
                throw new BadRequestException('You can only update stock for your own products.');
            }

            const newStock = variant.stockQuantity + changeAmount;
            const newAvailable = newStock - variant.reservedQuantity;

            if (newAvailable < 0) throw new BadRequestException('Insufficient available stock for this adjustment');

            // Update variant stock and availability
            const updated = await tx.productVariant.update({
                where: { id: variantId },
                data: { 
                    stockQuantity: newStock,
                    availableQuantity: newAvailable
                }
            });

            // Log the transition
            await tx.inventoryLog.create({
                data: {
                    variantId,
                    changeAmount,
                    reason,
                }
            });

            return updated;
        });
    }

    /**
     * Professional Reservation: Move stock from Available to Reserved
     */
    async reserveStock(variantId: string, quantity: number, userId?: string, expiresMinutes: number = 10) {
        return this.prisma.$transaction(async (tx) => {
            // Row-level lock to prevent race conditions
            const [variant] = await tx.$queryRawUnsafe<any[]>(
                `SELECT * FROM product_variants WHERE id = $1 FOR UPDATE`,
                variantId
            );

            if (!variant) throw new NotFoundException('Product variant not found');

            const available = variant.stock_quantity - variant.reserved_quantity;
            if (available < quantity) {
                throw new BadRequestException(`Insufficient stock. Only ${available} units available.`);
            }

            // Create reservation record
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + expiresMinutes);

            const reservation = await tx.stockReservation.create({
                data: {
                    variantId,
                    userId,
                    quantity,
                    expiresAt,
                    status: 'PENDING'
                }
            });

            // Update variant reserved/available counts
            await tx.productVariant.update({
                where: { id: variantId },
                data: {
                    reservedQuantity: { increment: quantity },
                    availableQuantity: { decrement: quantity }
                }
            });

            return reservation;
        });
    }

    /**
     * Release Reservation: Move stock back from Reserved to Available (Payment Failed/Timeout)
     */
    async releaseStock(reservationId: string) {
        return this.prisma.$transaction(async (tx) => {
            const reservation = await tx.stockReservation.findUnique({
                where: { id: reservationId }
            });

            if (!reservation || reservation.status !== 'PENDING') return;

            await tx.stockReservation.update({
                where: { id: reservationId },
                data: { status: 'CANCELLED' }
            });

            await tx.productVariant.update({
                where: { id: reservation.variantId },
                data: {
                    reservedQuantity: { decrement: reservation.quantity },
                    availableQuantity: { increment: reservation.quantity }
                }
            });
        });
    }

    /**
     * Finalize Sale: Physically reduce both Total and Reserved stock (Payment Success)
     */
    async commitStock(reservationId: string) {
        return this.prisma.$transaction(async (tx) => {
            const reservation = await tx.stockReservation.findUnique({
                where: { id: reservationId }
            });

            if (!reservation || reservation.status !== 'PENDING') return;

            // Finalize reservation
            await tx.stockReservation.update({
                where: { id: reservationId },
                data: { status: 'COMPLETED' }
            });

            // Physically subtract from stock and reserved pool
            // availableQuantity remains same (already reduced during reservation)
            await tx.productVariant.update({
                where: { id: reservation.variantId },
                data: {
                    stockQuantity: { decrement: reservation.quantity },
                    reservedQuantity: { decrement: reservation.quantity }
                }
            });

            await tx.inventoryLog.create({
                data: {
                    variantId: reservation.variantId,
                    changeAmount: -reservation.quantity,
                    reason: 'ORDER_COMPLETED',
                    referenceId: reservation.id
                }
            });
        });
    }

    async getNearExpiryProducts(daysThreshold: number = 7) {
        const thresholdDate = new Date();
        thresholdDate.setDate(thresholdDate.getDate() + daysThreshold);

        return this.prisma.product.findMany({
            where: {
                isActive: true,
                expiryDate: {
                    lte: thresholdDate,
                    gte: new Date()
                }
            },
            include: {
                seller: { select: { storeName: true } },
                variants: true
            }
        });
    }

    async remove(id: string, actor: { id: string; role?: string }, options?: { permanent?: boolean }) {
        const existing = await this.prisma.product.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`Product ${id} not found`);
        const actorSellerId = await this.resolveActorSellerId(actor);
        if (actorSellerId && existing.sellerId !== actorSellerId) {
            throw new BadRequestException('You can only remove your own products.');
        }
        const wantsPermanentDelete = options?.permanent === true;
        if (wantsPermanentDelete) {
            const role = String(actor?.role || '').toUpperCase();
            if (role !== 'ADMIN') {
                throw new BadRequestException('Only admin can permanently delete products.');
            }
            return this.prisma.$transaction(async (tx) => {
                const variants = await tx.productVariant.findMany({
                    where: { productId: id },
                    select: { id: true },
                });
                const variantIds = variants.map((v) => v.id);

                // Zepto-style safeguard: never hard-delete any SKU that already participated in orders.
                const linkedOrderItems = await tx.orderItem.count({
                    where: {
                        OR: [
                            { productId: id },
                            ...(variantIds.length > 0 ? [{ variantId: { in: variantIds } }] : []),
                        ],
                    },
                });
                if (linkedOrderItems > 0) {
                    throw new BadRequestException(
                        'This product has order history. Archive it instead of permanent deletion.',
                    );
                }

                // Non-transactional references can be cleaned safely.
                await tx.cartItem.deleteMany({
                    where: {
                        OR: [
                            { productId: id },
                            ...(variantIds.length > 0 ? [{ variantId: { in: variantIds } }] : []),
                        ],
                    },
                });
                await tx.wishlistItem.deleteMany({ where: { productId: id } });
                await tx.review.deleteMany({ where: { productId: id } });
                if (variantIds.length > 0) {
                    await tx.inventoryLog.deleteMany({ where: { variantId: { in: variantIds } } });
                    await tx.stockReservation.deleteMany({ where: { variantId: { in: variantIds } } });
                }
                await tx.productImage.deleteMany({ where: { productId: id } });

                // Delete variants explicitly, then product.
                if (variantIds.length > 0) {
                    await tx.productVariant.deleteMany({ where: { productId: id } });
                }
                return tx.product.delete({
                    where: { id },
                });
            }, { timeout: 20000 });
        }

        // We perform a soft delete via isActive flag for data integrity
        return this.prisma.product.update({
            where: { id },
            data: { isActive: false },
        });
    }

    private mapStats(product: any) {
        const variants = product.variants || [];
        const reservedQuantity = variants.reduce(
            (sum: number, v: any) => sum + Math.max(0, Number(v.reservedQuantity) || 0),
            0,
        );
        const availableKg = getProductAvailableKg(Number(product.stock) || 0, variants);
        const lowStockThreshold = variants.length > 0
            ? Math.min(...variants.map((v: any) => v.lowStockThreshold || 5))
            : 5;

        const enrichedVariants = variants.map((v: any) => {
            const packKg = parsePackQtyKg(v.attributeValue);
            const packsAvailable = variantPacksAvailable(availableKg, packKg);
            return {
                ...v,
                stockQuantity: 0,
                availableQuantity: packsAvailable,
                inStock: variantInStock(availableKg, packKg),
                packKg,
                packsAvailable,
            };
        });

        return {
            ...product,
            variants: enrichedVariants,
            availableQuantity: availableKg,
            reservedQuantity,
            stock: Math.max(0, Number(product.stock) || 0),
            lowStockThreshold,
        };
    }

    private generateSlug(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^\w ]+/g, '')
            .replace(/ +/g, '-');
    }

    /** Avoid P2002 on `slug` when two products share the same display name. */
    private async resolveUniqueSlug(
        tx: Prisma.TransactionClient,
        name: string,
        excludeProductId?: string,
    ): Promise<string> {
        const base = this.generateSlug(name) || 'product';
        let candidate = base;
        for (let i = 0; i < 64; i++) {
            const existing = await tx.product.findFirst({
                where: {
                    slug: candidate,
                    ...(excludeProductId ? { id: { not: excludeProductId } } : {}),
                },
                select: { id: true },
            });
            if (!existing) {
                return candidate;
            }
            candidate = `${base}-${Math.random().toString(36).slice(2, 10)}`;
        }
        return `${base}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    }

    /** Store path only (e.g. /uploads/xxx) so it works across origins */
    private normalizeImageUrl(url: string): string {
        if (!url || typeof url !== 'string') return url;
        try {
            if (url.startsWith('http://') || url.startsWith('https://')) {
                return new URL(url).pathname;
            }
        } catch {
            // ignore
        }
        return url.startsWith('/') ? url : `/${url}`;
    }
}
