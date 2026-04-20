import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateProductDto } from '../interface/dtos/create-product.dto';
import { ProductFilterDto } from '../interface/dtos/product-filter.dto';

@Injectable()
export class ProductService {
    private readonly logger = new Logger(ProductService.name);

    constructor(private readonly prisma: PrismaService) { }

    /** Persist admin bulk qty / unit price as entered (positive numbers only). No auto-clear vs base price. */
    private parseBulkTier(
        qty: number | null | undefined,
        price: Prisma.Decimal | number | string | null | undefined,
    ): { qty: number | null; price: Prisma.Decimal | null } {
        const q = qty != null ? Number(qty) : NaN;
        const bu = price != null ? Number(price) : NaN;
        if (Number.isFinite(q) && q > 0 && Number.isFinite(bu) && bu > 0) {
            return { qty: Math.floor(q), price: price as Prisma.Decimal };
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

    async create(dto: CreateProductDto) {
        // Principal Engineer Review Comment: 
        // We use a transaction to ensure atomicity between product, variants, and initial inventory.
        return this.prisma.$transaction(async (tx) => {
            const slug = await this.resolveUniqueSlug(tx, dto.name);
            const bulk = this.parseBulkTier(dto.bulkDiscountQty, dto.bulkDiscountPrice);
            const product = await tx.product.create({
                data: {
                    name: dto.name,
                    slug,
                    description: dto.description,
                    basePrice: dto.basePrice,
                    unit: 'kg',
                    tags: [],
                    seller: { connect: { id: dto.sellerId } },
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

    async update(id: string, dto: any) {
        const existing = await this.prisma.product.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`Product ${id} not found`);

        const mergedBulkQty = dto.bulkDiscountQty !== undefined ? dto.bulkDiscountQty : existing.bulkDiscountQty;
        const mergedBulkPrice = dto.bulkDiscountPrice !== undefined ? dto.bulkDiscountPrice : existing.bulkDiscountPrice;
        const bulk = this.parseBulkTier(mergedBulkQty, mergedBulkPrice);

        return this.prisma.$transaction(async (tx) => {
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
                    ...(dto.sellerId && { sellerId: dto.sellerId }),
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

                // 1. Delete removed variants
                const idsToDelete = existingIds.filter(id => !incomingIds.includes(id));
                if (idsToDelete.length > 0) {
                    await tx.productVariant.deleteMany({ where: { id: { in: idsToDelete } } });
                }

                // 2. Update or Create
                for (const v of incomingVariants) {
                    const data = {
                        sku: v.sku || `SKU-${Date.now()}-${Math.random().toString(36).substring(7)}`,
                        attributeName: v.attributeName || 'Quantity',
                        attributeValue: v.attributeValue,
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
                    } else {
                        // New variant
                        await tx.productVariant.create({
                            data: {
                                ...data,
                                productId: id,
                                availableQuantity: v.stockQuantity || 0
                            }
                        });
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

            return result ? this.mapStats(result) : null;
        }, { timeout: 30000, maxWait: 10000 });
    }

    async updateStock(variantId: string, changeAmount: number, reason: string) {
        return this.prisma.$transaction(async (tx) => {
            const [variant] = await tx.$queryRawUnsafe<any[]>(
                'SELECT stock_quantity as "stockQuantity", reserved_quantity as "reservedQuantity" FROM product_variants WHERE id = $1 FOR UPDATE',
                variantId
            );

            if (!variant) throw new NotFoundException(`Variant ${variantId} not found`);

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

    async remove(id: string) {
        const existing = await this.prisma.product.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`Product ${id} not found`);

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
