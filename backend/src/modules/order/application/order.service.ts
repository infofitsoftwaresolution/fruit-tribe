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

@Injectable()
export class OrderService {
    private readonly logger = new Logger(OrderService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly settingsService: SettingsService,
    ) { }

    async create(userId: string, dto: CreateOrderDto) {
        // Idempotency: prevent duplicate order submissions
        if (dto.idempotencyKey) {
            const existing = await this.prisma.order.findUnique({
                where: { idempotencyKey: dto.idempotencyKey },
            });
            if (existing) return existing;
        }

        // Calculate totals
        const subtotal = dto.items.reduce(
            (sum, item) => sum + item.pricePerUnit * item.quantity,
            0,
        );

        let discountAmount = 0;
        let couponId: string | undefined;

        // Apply coupon if provided
        if (dto.couponCode) {
            const couponContextItems = await this.prisma.product.findMany({
                where: { id: { in: dto.items.map((i) => i.productId) } },
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

        const shippingFee = await this.settingsService.calculateDeliveryFeeByDistance(dto.distanceKm ?? null);
        const taxAmount = subtotal * 0.05; // 5% GST
        const payableAmount = subtotal - discountAmount + shippingFee + taxAmount;

        // Use a transaction to create the full order atomically
        return this.prisma.$transaction(async (tx) => {
            const orderNumber = `FT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

            // 1. Row-level Lock all variants and Validate Stock with Safety Buffer
            // Precision logic: (Total - Reserved) - Safety Margin = Sellable
            for (const item of dto.items) {
                const [variant] = await tx.$queryRawUnsafe<any[]>(
                    'SELECT sku, available_quantity as "availableQuantity", low_stock_threshold as "threshold" FROM product_variants WHERE id = $1::uuid FOR UPDATE',
                    item.variantId
                );

                if (!variant) {
                    throw new BadRequestException(`Product variant ${item.variantId} not found`);
                }

                const safetyBuffer = Math.max(1, Math.floor((variant.availableQuantity || 0) * 0.05)); // 5% Safety Buffer or 1 unit
                const sellableQuantity = variant.availableQuantity - safetyBuffer;

                if (variant.availableQuantity < item.quantity) {
                    throw new BadRequestException(
                        `Insufficient stock for SKU ${variant.sku || item.variantId}. Available: ${variant.availableQuantity}, requested: ${item.quantity}.`,
                    );
                }
                
                // Optional: If we want to strictly respect safety buffer in high-load, we'd check sellableQuantity
                // For now, we allow the sale but log the buffer hit if needed.
            }

            const order = await tx.order.create({
                data: {
                    orderNumber,
                    userId,
                    totalAmount: subtotal,
                    deliverySlot: dto.deliverySlot,
                    discountAmount,
                    shippingFee,
                    taxAmount,
                    payableAmount,
                    shippingAddress: dto.shippingAddress,
                    billingAddress: dto.billingAddress,
                    couponId,
                    idempotencyKey: dto.idempotencyKey,
                    status: 'CREATED',
                    paymentStatus: 'PENDING',
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
                include: { items: true },
            });

            // Decrement stock for each variant (Professional approach: RESERVE STOCK vs COMMIT)
            const isCod = dto.paymentMethod === 'cod';
            
            for (const item of dto.items) {
                // If COD, we commit immediately. If online, we reserve.
                const reservationStatus = isCod ? 'COMPLETED' : 'PENDING';
                
                await tx.stockReservation.create({
                    data: {
                        variantId: item.variantId,
                        orderId: order.id,
                        userId,
                        quantity: item.quantity,
                        expiresAt: new Date(Date.now() + 15 * 60000), // 15 minute hold
                        status: reservationStatus
                    }
                });

                if (isCod) {
                    // COD: Physically reduce total stock immediately
                    await tx.productVariant.update({
                        where: { id: item.variantId },
                        data: {
                            stockQuantity: { decrement: item.quantity },
                            availableQuantity: { decrement: item.quantity }
                        }
                    });
                    
                    // Confirmation status for the order
                    await tx.order.update({
                        where: { id: order.id },
                        data: { status: 'CONFIRMED' }
                    });
                } else {
                    // Online: Just reserve, don't reduce physical stock yet
                    await tx.productVariant.update({
                        where: { id: item.variantId },
                        data: {
                            reservedQuantity: { increment: item.quantity },
                            availableQuantity: { decrement: item.quantity }
                        }
                    });
                }

                await tx.inventoryLog.create({
                    data: {
                        variantId: item.variantId,
                        changeAmount: -item.quantity,
                        reason: isCod ? 'ORDER_PLACED_COD_COMMIT' : 'ORDER_RESERVED_ONLINE',
                        referenceId: order.id,
                    },
                });
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
                    status: 'CREATED',
                    changedByRole: 'CUSTOMER',
                    changedByName: null,
                },
            });

            this.logger.log(`Order ${order.orderNumber} created for user ${userId}`);
            return order;
        });
    }

    async findByUser(userId: string) {
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
                        deliveryPartner: { select: { name: true } },
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

    /** Admin: list all orders (no user filter) */
    async findAll() {
        return this.prisma.order.findMany({
            include: {
                user: { select: { id: true, email: true, firstName: true, lastName: true } },
                items: {
                    include: {
                        product: { select: { name: true, id: true, images: { where: { isPrimary: true }, take: 1 } } },
                        variant: true,
                        seller: { select: { storeName: true } },
                    },
                },
                deliveries: {
                    include: {
                        deliveryPartner: { select: { name: true } },
                    },
                },
                statusLogs: {
                    orderBy: { createdAt: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    /** Update order status (admin or seller who has items in the order). Persists to DB. */
    async updateStatus(orderId: string, userId: string, userRole: string, status: string) {
        const allowed = ['CREATED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
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

                for (const res of reservations) {
                    if (res.status === 'COMPLETED') {
                        // Order was already confirmed/paid, restore physical stock
                        await tx.productVariant.update({
                            where: { id: res.variantId },
                            data: {
                                stockQuantity: { increment: res.quantity },
                                availableQuantity: { increment: res.quantity }
                            }
                        });
                        await tx.inventoryLog.create({
                            data: {
                                variantId: res.variantId,
                                changeAmount: res.quantity,
                                reason: 'ORDER_CANCELLED_RESTORE_PHYSICAL',
                                referenceId: orderId
                            }
                        });
                    } else if (res.status === 'PENDING') {
                        // Order was just reserved, release the hold
                        await tx.productVariant.update({
                            where: { id: res.variantId },
                            data: {
                                reservedQuantity: { decrement: res.quantity },
                                availableQuantity: { increment: res.quantity }
                            }
                        });
                        await tx.inventoryLog.create({
                            data: {
                                variantId: res.variantId,
                                changeAmount: res.quantity,
                                reason: 'ORDER_CANCELLED_RELEASE_RESERVATION',
                                referenceId: orderId
                            }
                        });
                    }
                    
                    await tx.stockReservation.update({
                        where: { id: res.id },
                        data: { status: 'CANCELLED' }
                    });
                }
            }

            const o = await tx.order.update({
                where: { id: orderId },
                data: { status: nextStatus },
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
        });

        return this.prisma.order.findUnique({
            where: { id: orderId },
            include: {
                user: { select: { id: true, email: true, firstName: true, lastName: true } },
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
}
