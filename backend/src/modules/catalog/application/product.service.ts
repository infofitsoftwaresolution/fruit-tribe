import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateProductDto } from '../interface/dtos/create-product.dto';
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
                    stock: dto.variants?.reduce((sum, v) => sum + (v.stockQuantity || 0), 0) || 0,
                },
            });

            if (dto.variants && dto.variants.length > 0) {
                await tx.productVariant.createMany({
                    data: dto.variants.map((v) => ({
                        productId: product.id,
                        sku: v.sku,
                        attributeName: v.attributeName,
                        attributeValue: v.attributeValue,
                        isBulkVariant: Boolean(v.isBulkVariant),
                        priceOverride: v.priceOverride,
                        stockQuantity: v.stockQuantity,
                        availableQuantity: v.stockQuantity,
                        lowStockThreshold: v.lowStockThreshold || 5,
                    })),
                });
            }

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

            // High-Precision Variant Synchronization
            if (dto.variants !== undefined && Array.isArray(dto.variants)) {
                const incomingVariants = dto.variants;
                const existingVariants = await tx.productVariant.findMany({ where: { productId: id } });
                const existingIds = existingVariants.map(v => v.id);
                const incomingIds = incomingVariants.filter((v: any) => v.id).map((v: any) => v.id);

                // 1. Delete removed variants (safe-delete only when not referenced by historical records).
                const idsToDelete = existingIds.filter(id => !incomingIds.includes(id));
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
                        if (hasReferences) {
                            blockedIds.push(variantId);
                        } else {
                            deletableIds.push(variantId);
                        }
                    }
                    if (deletableIds.length > 0) {
                        await tx.productVariant.deleteMany({ where: { id: { in: deletableIds } } });
                        variantSyncStats.deleted += deletableIds.length;
                    }
                    if (blockedIds.length > 0) {
                        // Preserve referential integrity for historical rows by archiving instead of deleting.
                        for (const variantId of blockedIds) {
                            const existingVariant = existingVariants.find((v) => v.id === variantId);
                            const reserved = Math.max(0, Number(existingVariant?.reservedQuantity || 0));
                            const currentLabel = String(existingVariant?.attributeValue || existingVariant?.sku || 'Variant');
                            const archivedLabel = currentLabel.toLowerCase().includes('(archived)')
                                ? currentLabel
                                : `${currentLabel} (Archived)`;
                            await tx.productVariant.update({
                                where: { id: variantId },
                                data: {
                                    attributeValue: archivedLabel,
                                    stockQuantity: reserved,
                                    availableQuantity: 0,
                                    lowStockThreshold: 0,
                                },
                            });
                        }
                        this.logger.warn(
                            `Product ${id}: archived ${blockedIds.length} variant(s) instead of deleting due to historical references.`,
                        );
                        variantSyncStats.archived += blockedIds.length;
                    }
                }

                // 2. Update or Create
                const existingBySku = new Map(
                    existingVariants
                        .map((ev) => [String(ev.sku || '').trim(), ev] as const)
                        .filter(([sku]) => sku.length > 0),
                );
                for (const v of incomingVariants) {
                    const normalizedSku = String(v.sku || '').trim();
                    const data = {
                        sku: normalizedSku || `SKU-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                        attributeName: v.attributeName || 'Quantity',
                        attributeValue: v.attributeValue,
                        isBulkVariant: Boolean(v.isBulkVariant),
                        priceOverride: v.priceOverride,
                        stockQuantity: v.stockQuantity,
                        lowStockThreshold: v.lowStockThreshold,
                        availableQuantity: v.id 
                            ? undefined // Don't reset available stock blindly on update
                            : v.stockQuantity // Initial available = stock for new variants
                    };

                    if (v.id && existingIds.includes(v.id)) {
                        // For existing: update stock carefully
                        const existingV = existingVariants.find(ex => ex.id === v.id);
                        const stockDiff = (v.stockQuantity || 0) - (existingV?.stockQuantity || 0);
                        
                        await tx.productVariant.update({
                            where: { id: v.id },
                            data: {
                                ...data,
                                availableQuantity: { increment: stockDiff }
                            }
                        });
                        variantSyncStats.updated += 1;
                    } else {
                        const skuMatchedExisting = normalizedSku ? existingBySku.get(normalizedSku) : null;
                        if (skuMatchedExisting) {
                            // SKU already exists (often archived/historical row). Reuse it instead of creating duplicate SKU.
                            const stockDiff = (v.stockQuantity || 0) - (skuMatchedExisting.stockQuantity || 0);
                            const currentAvailable = Number(skuMatchedExisting.availableQuantity || 0);
                            const nextAvailable = Math.max(0, currentAvailable + stockDiff);
                            await tx.productVariant.update({
                                where: { id: skuMatchedExisting.id },
                                data: {
                                    ...data,
                                    availableQuantity: nextAvailable,
                                },
                            });
                            variantSyncStats.reusedBySku += 1;
                            continue;
                        }
                        // New variant
                        await tx.productVariant.create({
                            data: {
                                ...data,
                                productId: id,
                                availableQuantity: v.stockQuantity || 0
                            }
                        });
                        variantSyncStats.created += 1;
                    }
                }
            }

            // Sync total stock summary
            const allVariants = await tx.productVariant.findMany({ where: { productId: id } });
            const totalStock = allVariants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0);
            await tx.product.update({
                where: { id },
                data: { stock: totalStock }
            });

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
        const availableQuantity = product.variants?.length > 0
            ? product.variants.reduce((sum, v) => sum + (v.availableQuantity || 0), 0)
            : product.stock || 0;
        const reservedQuantity = product.variants?.length > 0
            ? product.variants.reduce((sum, v) => sum + (v.reservedQuantity || 0), 0)
            : 0;
        const totalStock = product.variants?.length > 0
            ? product.variants.reduce((sum, v) => sum + (v.stockQuantity || 0), 0)
            : product.stock || 0;
        const lowStockThreshold = product.variants?.length > 0
            ? Math.min(...product.variants.map((v: any) => v.lowStockThreshold || 5))
            : 5;
        
        return {
            ...product,
            availableQuantity,
            reservedQuantity,
            stock: totalStock,
            lowStockThreshold
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
