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

@Injectable()
export class OrderService {
    private readonly logger = new Logger(OrderService.name);
    private static readonly ONLINE_HOLD_MINUTES = 10;

    constructor(
        private readonly prisma: PrismaService,
        private readonly settingsService: SettingsService,
    ) { }

    async createManualOrder(adminUserId: string, dto: CreateManualOrderDto) {
        // 1. Find or create user
        let targetUser = await this.prisma.user.findUnique({
            where: { email: dto.customerEmail },
        });

        if (!targetUser) {
            targetUser = await this.prisma.user.create({
                data: {
                    email: dto.customerEmail,
                    phone: dto.customerPhone,
                    firstName: dto.customerName.split(' ')[0],
                    lastName: dto.customerName.split(' ').slice(1).join(' ') || '',
                    passwordHash: crypto.randomBytes(16).toString('hex'), // Random password
                },
            });
        }

        // 2. Calculate totals
        const subtotal = dto.items.reduce(
            (sum, item) => sum + item.pricePerUnit * item.quantity,
            0,
        );

        const shippingFee = 0; // Manual orders usually have specific shipping or included
        const taxAmount = subtotal * 0.05; // 5% GST
        const payableAmount = subtotal + shippingFee + taxAmount;

        const orderNumber = `FT-MN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        return this.prisma.$transaction(async (tx) => {
            // Validate Stock
            for (const item of dto.items) {
                const variant = await tx.productVariant.findUnique({
                    where: { id: item.variantId },
                });

                if (!variant || variant.availableQuantity < item.quantity) {
                    throw new BadRequestException(
                        `Insufficient stock for variant ${item.variantId}. Available: ${variant?.availableQuantity ?? 0}`,
                    );
                }
            }

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
                include: { items: true },
            });

            // Handle stock reservations
            for (const item of dto.items) {
                const isFinalized = paymentStatus === 'PAID' || initialStatus === 'CONFIRMED';
                
                await tx.stockReservation.create({
                    data: {
                        variantId: item.variantId,
                        orderId: order.id,
                        userId: targetUser.id,
                        quantity: item.quantity,
                        expiresAt: new Date(Date.now() + OrderService.ONLINE_HOLD_MINUTES * 60000),
                        status: isFinalized ? 'COMPLETED' : 'PENDING'
                    }
                });

                if (isFinalized) {
                    await tx.productVariant.update({
                        where: { id: item.variantId },
                        data: {
                            stockQuantity: { decrement: item.quantity },
                            availableQuantity: { decrement: item.quantity }
                        }
                    });
                } else {
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
                        reason: isFinalized ? 'MANUAL_ORDER_PAID_OR_CONFIRMED_COMMIT' : 'MANUAL_ORDER_RESERVED',
                        referenceId: order.id,
                    },
                });
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
        });
    }

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

        // Server-side COD enforcement: if any cart product disables COD, order must be paid online.
        const products = await this.prisma.product.findMany({
            where: { id: { in: dto.items.map((i) => i.productId) } },
            select: { id: true, allowCashOnDelivery: true },
        });
        const codBlocked = new Set(
            products.filter((p) => p.allowCashOnDelivery === false).map((p) => p.id),
        );
        const requestedCod = String(dto.paymentMethod || 'online').toLowerCase() === 'cod';
        const hasCodBlockedItem = dto.items.some((i) => codBlocked.has(i.productId));
        const isCod = requestedCod && !hasCodBlockedItem;
        if (requestedCod && hasCodBlockedItem) {
            this.logger.warn(`Order create: forcing online payment because one or more products are COD-disabled.`);
        }

        const shippingFee = await this.settingsService.calculateDeliveryFeeByDistance(dto.distanceKm ?? null, subtotal);
        const taxAmount = subtotal * 0.05; // 5% GST
        const payableAmount = subtotal - discountAmount + shippingFee + taxAmount;

        const addr = dto.shippingAddress as Record<string, unknown>;
        const city = String(addr.city ?? '').trim();
        const zipDigits = String(addr.zipCode ?? addr.pincode ?? addr.postalCode ?? '').replace(/\D/g, '');

        const serviceableCities = await this.settingsService.getServiceableCities();
        if (serviceableCities.length > 0 && city) {
            const cityOk = serviceableCities.some((c) => c.toLowerCase() === city.toLowerCase());
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

        // Use a transaction to create the full order atomically
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
            
            for (const item of dto.items) {
                // If COD, we commit immediately. If online, we reserve.
                const reservationStatus = isCod ? 'COMPLETED' : 'PENDING';
                
                await tx.stockReservation.create({
                    data: {
                        variantId: item.variantId,
                        orderId: order.id,
                        userId,
                        quantity: item.quantity,
                        expiresAt: new Date(Date.now() + OrderService.ONLINE_HOLD_MINUTES * 60000), // 10-minute hold
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
                    status: initialOrderStatus,
                    changedByRole: 'CUSTOMER',
                    changedByName: null,
                },
            });

            this.logger.log(`Order ${order.orderNumber} created for user ${userId}`);
            return order;
        });
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
            const cityOk = serviceableCities.some((c) => c.toLowerCase() === city.toLowerCase());
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

        const price = Number(dto.price);
        const orderNumber = `FT-SUB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const metadata = {
            orderKind: 'SUBSCRIPTION',
            planId: dto.planId,
            planName: dto.planName,
            frequency: dto.frequency,
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

    /** Admin: list all orders (no user filter). Light payload — no statusLogs / product images (detail uses findOne when needed). */
    async findAll() {
        return this.prisma.order.findMany({
            include: {
                user: { select: { id: true, email: true, firstName: true, lastName: true } },
                items: {
                    include: {
                        product: { select: { id: true, name: true } },
                        variant: { select: { id: true, sku: true, attributeValue: true } },
                        seller: { select: { storeName: true } },
                    },
                },
                deliveries: {
                    include: {
                        deliveryPartner: { select: { name: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
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
                        data: { status: 'COMPLETED' }
                    });

                    await tx.productVariant.update({
                        where: { id: res.variantId },
                        data: {
                            stockQuantity: { decrement: res.quantity },
                            reservedQuantity: { decrement: res.quantity }
                        }
                    });

                    await tx.inventoryLog.create({
                        data: {
                            variantId: res.variantId,
                            changeAmount: -res.quantity,
                            reason: 'MANUAL_PAYMENT_PAID_COMMIT',
                            referenceId: orderId
                        }
                    });
                }
            }

            return updated;
        });
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
                    select: { id: true, status: true, paymentStatus: true },
                });
                if (!current || !['ON_HOLD', 'CREATED'].includes(String(current.status)) || current.paymentStatus !== 'PENDING') return;

                const reservations = await tx.stockReservation.findMany({
                    where: { orderId: order.id, status: 'PENDING' },
                });
                for (const res of reservations) {
                    await tx.productVariant.update({
                        where: { id: res.variantId },
                        data: {
                            reservedQuantity: { decrement: res.quantity },
                            availableQuantity: { increment: res.quantity },
                        },
                    });
                    await tx.inventoryLog.create({
                        data: {
                            variantId: res.variantId,
                            changeAmount: res.quantity,
                            reason: 'ORDER_HOLD_EXPIRED_RELEASE',
                            referenceId: order.id,
                        },
                    });
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
            });
        }
        return cancelled;
    }
}
