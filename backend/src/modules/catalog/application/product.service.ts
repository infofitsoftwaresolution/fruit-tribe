import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { CreateProductDto } from '../interface/dtos/create-product.dto';
import { ProductFilterDto } from '../interface/dtos/product-filter.dto';

@Injectable()
export class ProductService {
    private readonly logger = new Logger(ProductService.name);

    constructor(private readonly prisma: PrismaService) { }

    async findAll(filters: ProductFilterDto) {
        const { page = 1, limit = 10, search, categoryId, minPrice, maxPrice, sortBy, sortOrder } = filters;
        const skip = (page - 1) * limit;

        const now = new Date();
        const where: any = {
            isActive: true,
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
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
                            { seasonalStart: { lte: now } },
                            { seasonalEnd: { gte: now } },
                        ]
                    }
                ]
            })
        };

        try {
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
                            where: { isPrimary: true },
                            take: 1,
                        },
                    },
                    skip,
                    take: limit,
                    orderBy: { [sortBy || 'createdAt']: sortOrder || 'desc' },
                }),
            ]);

            return {
                data: items,
                meta: {
                    total,
                    page,
                    limit,
                    totalPages: Math.ceil(total / limit),
                },
            };
        } catch (error) {
            this.logger.error(`Failed to fetch products: ${error.message}`);
            throw new BadRequestException('Could not fetch products');
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

        return product;
    }

    async create(dto: CreateProductDto) {
        // Principal Engineer Review Comment: 
        // We use a transaction to ensure atomicity between product, variants, and initial inventory.
        return this.prisma.$transaction(async (tx) => {
            const product = await tx.product.create({
                data: {
                    name: dto.name,
                    slug: this.generateSlug(dto.name),
                    description: dto.description,
                    basePrice: dto.basePrice,
                    unit: 'kg',
                    tags: [],
                    seller: { connect: { id: dto.sellerId } },
                    category: { connect: { id: dto.categoryId } },
                    harvestDate: dto.harvestDate ? new Date(dto.harvestDate) : undefined,
                    expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
                    isSeasonal: dto.isSeasonal ?? false,
                    seasonalStart: dto.seasonalStart ? new Date(dto.seasonalStart) : undefined,
                    seasonalEnd: dto.seasonalEnd ? new Date(dto.seasonalEnd) : undefined,
                    bulkDiscountQty: dto.bulkDiscountQty ?? undefined,
                    bulkDiscountPrice: dto.bulkDiscountPrice ?? undefined,
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

            return this.prisma.product.findUnique({
                where: { id: product.id },
                include: { images: true, variants: true },
            });
        });
    }

    async update(id: string, dto: any) {
        const existing = await this.prisma.product.findUnique({ where: { id } });
        if (!existing) throw new NotFoundException(`Product ${id} not found`);

        return this.prisma.$transaction(async (tx) => {
            const product = await tx.product.update({
                where: { id },
                data: {
                    ...(dto.name && { name: dto.name, slug: this.generateSlug(dto.name) }),
                    ...(dto.description !== undefined && { description: dto.description }),
                    ...(dto.basePrice !== undefined && { basePrice: dto.basePrice }),
                    ...(dto.categoryId && { categoryId: dto.categoryId }),
                    ...(dto.harvestDate !== undefined && { harvestDate: dto.harvestDate ? new Date(dto.harvestDate) : null }),
                    ...(dto.expiryDate !== undefined && { expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null }),
                    ...(dto.isSeasonal !== undefined && { isSeasonal: dto.isSeasonal }),
                    ...(dto.seasonalStart !== undefined && { seasonalStart: dto.seasonalStart ? new Date(dto.seasonalStart) : null }),
                    ...(dto.seasonalEnd !== undefined && { seasonalEnd: dto.seasonalEnd ? new Date(dto.seasonalEnd) : null }),
                    ...(dto.bulkDiscountQty !== undefined && { bulkDiscountQty: dto.bulkDiscountQty }),
                    ...(dto.bulkDiscountPrice !== undefined && { bulkDiscountPrice: dto.bulkDiscountPrice }),
                    ...(dto.isActive !== undefined && { isActive: dto.isActive }),
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

            return this.prisma.product.findUnique({
                where: { id },
                include: { images: true, variants: true },
            });
        });
    }

    async updateStock(variantId: string, changeAmount: number, reason: string) {
        return this.prisma.$transaction(async (tx) => {
            const variant = await tx.productVariant.findUnique({
                where: { id: variantId },
                select: { stockQuantity: true, productId: true }
            });

            if (!variant) throw new NotFoundException(`Variant ${variantId} not found`);

            const newQuantity = variant.stockQuantity + changeAmount;
            if (newQuantity < 0) throw new BadRequestException('Insufficient stock for this adjustment');

            // Update variant stock
            const updated = await tx.productVariant.update({
                where: { id: variantId },
                data: { stockQuantity: newQuantity }
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

    private generateSlug(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^\w ]+/g, '')
            .replace(/ +/g, '-');
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
