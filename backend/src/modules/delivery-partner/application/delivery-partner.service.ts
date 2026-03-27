import { Injectable, NotFoundException, UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { MailService } from '../../../common/mail/mail.service';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';

@Injectable()
export class DeliveryPartnerService {
    private parseDeliveryOtpMeta(raw: string | null | undefined) {
        if (!raw) return { hasActiveOtp: false as const };
        const parts = raw.split('|');
        // Backward compatibility: old format was otp|expiresAt
        const expiresAt = Number(parts[1] || 0);
        const generatedAt = Number(parts[2] || 0);
        if (!expiresAt) return { hasActiveOtp: false as const };
        const now = Date.now();
        if (now > expiresAt) return { hasActiveOtp: false as const };
        return {
            hasActiveOtp: true as const,
            otpExpiresAt: new Date(expiresAt).toISOString(),
            otpGeneratedAt: generatedAt ? new Date(generatedAt).toISOString() : null,
        };
    }

    constructor(
        private readonly prisma: PrismaService,
        private readonly mailService: MailService,
    ) { }

    private buildAddressText(addr: any): string {
        if (!addr || typeof addr !== 'object') return 'Address available in app';
        const parts = [
            addr.addressLine1 || addr.address || '',
            addr.addressLine2 || '',
            addr.city || '',
            addr.state || '',
            addr.pincode || addr.zipCode || '',
        ].filter((v: string) => !!String(v || '').trim());
        return parts.length ? parts.join(', ') : 'Address available in app';
    }

    /** Admin: assign an order to a delivery partner (creates or rebinds Delivery row). */
    async assignOrderToPartner(orderId: string, partnerId: string) {
        const [order, partner] = await Promise.all([
            this.prisma.order.findUnique({
                where: { id: orderId },
                include: {
                    user: { select: { email: true, firstName: true, lastName: true } },
                },
            }),
            this.prisma.deliveryPartner.findUnique({
                where: { id: partnerId },
                include: { user: { select: { email: true } } },
            }),
        ]);
        if (!order) {
            throw new NotFoundException('Order not found');
        }
        if (!partner) {
            throw new NotFoundException('Delivery partner not found');
        }

        // Create or update a Delivery record linking this order and partner.
        const existing = await this.prisma.delivery.findFirst({
            where: { orderId: order.id },
        });

        let assignedDelivery: any;
        if (existing) {
            assignedDelivery = await this.prisma.delivery.update({
                where: { id: existing.id },
                data: {
                    deliveryPartnerId: partner.id,
                    status: existing.status ?? 'ASSIGNED',
                },
            });
        } else {
            assignedDelivery = await this.prisma.delivery.create({
                data: {
                    orderId: order.id,
                    deliveryPartnerId: partner.id,
                    status: 'ASSIGNED',
                },
            });
        }

        if (partner.user?.email) {
            const customerName =
                [order.user?.firstName, order.user?.lastName].filter(Boolean).join(' ') || undefined;
            this.mailService
                .sendDeliveryAssignmentEmail(partner.user.email, {
                    orderNumber: order.orderNumber,
                    customerName,
                    deliverySlot: order.deliverySlot,
                    address: this.buildAddressText(order.shippingAddress),
                })
                .catch(() => { /* Mail service logs errors */ });
        }

        return assignedDelivery;
    }

    async findAll() {
        return this.prisma.deliveryPartner.findMany({
            orderBy: { name: 'asc' },
            include: { user: { select: { email: true } } },
        });
    }

    async create(data: { name: string; phone: string; email: string; vehicle?: string; status?: string }) {
        const normalizedEmail = String(data.email || '').trim().toLowerCase();
        const normalizedPhone = String(data.phone || '').trim();

        const existingUser = await this.prisma.user.findFirst({
            where: {
                OR: [
                    { email: normalizedEmail },
                    { phone: normalizedPhone },
                ],
            },
            include: {
                deliveryPartner: true,
            },
        });

        if (existingUser?.deliveryPartner) {
            throw new ConflictException('A delivery partner with this email or phone already exists.');
        }
        if (existingUser) {
            throw new ConflictException('This email or phone is already registered. Use a different one.');
        }

        // Create or reuse role DELIVERY_PARTNER so delivery staff get the right dashboard
        const role = await this.prisma.role.upsert({
            where: { name: 'DELIVERY_PARTNER' },
            update: {},
            create: {
                name: 'DELIVERY_PARTNER',
                permissions: {},
            },
        });
        const tempPassword = Math.random().toString(36).slice(-10);
        const passwordHash = await bcrypt.hash(tempPassword, 12);

        let result: { user: any; partner: any; tempPassword: string };
        try {
            result = await this.prisma.$transaction(async (tx) => {
                const user = await tx.user.create({
                    data: {
                        email: normalizedEmail,
                        phone: normalizedPhone,
                        passwordHash,
                        firstName: data.name,
                        roleId: role.id,
                        isActive: true,
                        requirePasswordChange: true,
                    },
                });

                const partner = await tx.deliveryPartner.create({
                    data: {
                        name: data.name,
                        phone: normalizedPhone,
                        vehicle: data.vehicle ?? null,
                        status: data.status ?? 'ACTIVE',
                        userId: user.id,
                    },
                });

                return { user, partner, tempPassword };
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException('Email or phone already exists. Please use unique delivery staff details.');
            }
            throw error;
        }

        // Fire-and-forget welcome email
        this.mailService
            .sendDeliveryStaffWelcomeEmail(result.user.email, result.tempPassword)
            .catch(() => { /* log inside MailService */ });

        return result.partner;
    }

    async update(id: string, data: { name?: string; phone?: string; email?: string; vehicle?: string; status?: string }) {
        const existing = await this.prisma.deliveryPartner.findUnique({
            where: { id },
            include: { user: true },
        });
        if (!existing) {
            throw new NotFoundException('Delivery partner not found');
        }

        if (data.phone && data.phone !== existing.phone) {
            const phoneInUse = await this.prisma.user.findFirst({
                where: {
                    phone: data.phone,
                    NOT: existing.user ? { id: existing.user.id } : undefined,
                },
                select: { id: true },
            });
            if (phoneInUse) {
                throw new ConflictException('This phone number is already used by another account.');
            }
        }
        if (data.email && existing.user && data.email !== existing.user.email) {
            const emailInUse = await this.prisma.user.findFirst({
                where: {
                    email: data.email.toLowerCase(),
                    NOT: { id: existing.user.id },
                },
                select: { id: true },
            });
            if (emailInUse) {
                throw new ConflictException('This email is already used by another account.');
            }
        }

        const updatedPartner = await this.prisma.deliveryPartner.update({
            where: { id },
            data: {
                ...(data.name != null && { name: data.name }),
                ...(data.phone != null && { phone: data.phone }),
                ...(data.vehicle !== undefined && { vehicle: data.vehicle || null }),
                ...(data.status != null && { status: data.status }),
            },
        });

        // If an email is now provided and this partner has no linked user, provision one and send welcome email.
        if (data.email && !existing.user) {
            const role = await this.prisma.role.upsert({
                where: { name: 'DELIVERY_PARTNER' },
                update: {},
                create: {
                    name: 'DELIVERY_PARTNER',
                    permissions: {},
                },
            });
            const tempPassword = Math.random().toString(36).slice(-10);
            const passwordHash = await bcrypt.hash(tempPassword, 12);

            const user = await this.prisma.user.create({
                data: {
                    email: data.email.toLowerCase(),
                    phone: data.phone ?? existing.phone,
                    passwordHash,
                            firstName: data.name ?? existing.name,
                            roleId: role.id,
                    isActive: true,
                    requirePasswordChange: true,
                },
            });

            await this.prisma.deliveryPartner.update({
                where: { id },
                data: { userId: user.id },
            });

            this.mailService
                .sendDeliveryStaffWelcomeEmail(user.email, tempPassword)
                .catch(() => { /* logged in MailService */ });
        }

        return updatedPartner;
    }

    async remove(id: string) {
        try {
            return await this.prisma.deliveryPartner.delete({ where: { id } });
        } catch {
            throw new NotFoundException('Delivery partner not found');
        }
    }

    /** Resolve the delivery partner record for the currently logged-in user. */
    private async getPartnerForUser(userId: string) {
        const partner = await this.prisma.deliveryPartner.findUnique({
            where: { userId },
        });
        if (!partner) {
            throw new UnauthorizedException('You are not registered as a delivery partner.');
        }
        return partner;
    }

    /** Basic dashboard metrics for the delivery app home screen. */
    async getDashboardForUser(userId: string) {
        const partner = await this.getPartnerForUser(userId);
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const deliveriesToday = await this.prisma.delivery.findMany({
            where: {
                deliveryPartnerId: partner.id,
                createdAt: { gte: startOfDay },
            },
            select: { id: true, status: true },
        });

        const assignedToday = deliveriesToday.length;
        const deliveredToday = deliveriesToday.filter((d) => d.status === 'DELIVERED').length;
        const pendingToday = assignedToday - deliveredToday;

        const earningsAgg = await this.prisma.deliveryEarning.aggregate({
            _sum: { total: true },
            where: {
                deliveryPartnerId: partner.id,
                createdAt: { gte: startOfDay },
            },
        });

        const codAgg = await this.prisma.codTransaction.aggregate({
            _sum: { amount: true },
            where: {
                deliveryPartnerId: partner.id,
                createdAt: { gte: startOfDay },
                type: 'COLLECTED',
            },
        });

        return {
            partnerId: partner.id,
            name: partner.name,
            onlineStatus: partner.onlineStatus,
            assignedToday,
            deliveredToday,
            pendingToday,
            earningsToday: Number(earningsAgg._sum.total ?? 0),
            codCollectedToday: Number(codAgg._sum.amount ?? 0),
            // Distance tracking can be added later when we start computing routes.
            distanceTodayKm: 0,
        };
    }

    async setOnlineStatusForUser(userId: string, online: boolean, lat?: number, lng?: number) {
        const partner = await this.getPartnerForUser(userId);
        return this.prisma.deliveryPartner.update({
            where: { id: partner.id },
            data: {
                onlineStatus: online ? 'ONLINE' : 'OFFLINE',
                currentLat: lat != null ? lat : partner.currentLat,
                currentLng: lng != null ? lng : partner.currentLng,
            },
        });
    }

    async updateLocationForUser(userId: string, lat: number, lng: number) {
        const partner = await this.getPartnerForUser(userId);
        return this.prisma.deliveryPartner.update({
            where: { id: partner.id },
            data: {
                currentLat: lat,
                currentLng: lng,
            },
        });
    }

    /** Active assignments for the logged-in delivery partner. */
    async getAssignmentsForUser(userId: string) {
        const partner = await this.getPartnerForUser(userId);
        return this.prisma.delivery.findMany({
            where: {
                deliveryPartnerId: partner.id,
                status: { notIn: ['DELIVERED', 'CANCELLED', 'RETURNED'] },
            },
            orderBy: { createdAt: 'desc' },
            include: {
                order: {
                    select: {
                        id: true,
                        orderNumber: true,
                        payableAmount: true,
                        paymentStatus: true,
                        deliverySlot: true,
                        shippingAddress: true,
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                                phone: true,
                            },
                        },
                    },
                },
            },
        });
    }

    async getAssignmentDetailForUser(deliveryId: string, userId: string) {
        const partner = await this.getPartnerForUser(userId);
        const delivery = await this.prisma.delivery.findFirst({
            where: {
                id: deliveryId,
                deliveryPartnerId: partner.id,
            },
            include: {
                order: {
                    include: {
                        items: {
                            include: {
                                product: { select: { name: true, unit: true } },
                            },
                        },
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                                phone: true,
                                email: true,
                            },
                        },
                    },
                },
                trackingEvents: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
        if (!delivery) {
            throw new NotFoundException('Delivery assignment not found');
        }
        const otpMeta = this.parseDeliveryOtpMeta(delivery.otpCode);
        return {
            ...delivery,
            hasActiveOtp: otpMeta.hasActiveOtp,
            otpGeneratedAt: (otpMeta as any).otpGeneratedAt ?? null,
            otpExpiresAt: (otpMeta as any).otpExpiresAt ?? null,
        };
    }

    async generateDeliveryOtpForUser(deliveryId: string, userId: string) {
        const partner = await this.getPartnerForUser(userId);
        const delivery = await this.prisma.delivery.findFirst({
            where: { id: deliveryId, deliveryPartnerId: partner.id },
            include: {
                order: {
                    include: { user: { select: { email: true } } },
                },
            },
        });
        if (!delivery) {
            throw new NotFoundException('Delivery assignment not found');
        }
        if ((delivery.status || '').toUpperCase() === 'DELIVERED') {
            throw new BadRequestException('Order is already delivered.');
        }

        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const expiresInMinutes = 10;
        const generatedAt = Date.now();
        const expiresAt = generatedAt + expiresInMinutes * 60 * 1000;
        await this.prisma.delivery.update({
            where: { id: delivery.id },
            data: {
                otpCode: `${otp}|${expiresAt}|${generatedAt}`,
            },
        });

        if (delivery.order.user?.email) {
            this.mailService
                .sendDeliveryOtpToCustomerEmail(delivery.order.user.email, {
                    orderNumber: delivery.order.orderNumber,
                    otp,
                    expiresInMinutes,
                })
                .catch(() => { /* Mail service logs errors */ });
        }

        return {
            ok: true,
            message: delivery.order.user?.email
                ? 'OTP generated and sent to customer email.'
                : 'OTP generated, but customer email is not available.',
            expiresInMinutes,
            generatedAt: new Date(generatedAt).toISOString(),
            expiresAt: new Date(expiresAt).toISOString(),
        };
    }

    async verifyDeliveryOtpForUser(deliveryId: string, userId: string, code: string) {
        const partner = await this.getPartnerForUser(userId);
        if (!code || !/^\d{6}$/.test(code)) {
            throw new BadRequestException('Invalid OTP format.');
        }

        return this.prisma.$transaction(async (tx) => {
            const delivery = await tx.delivery.findFirst({
                where: { id: deliveryId, deliveryPartnerId: partner.id },
                include: { order: true },
            });
            if (!delivery) {
                throw new NotFoundException('Delivery assignment not found');
            }
            if ((delivery.status || '').toUpperCase() === 'DELIVERED') {
                return { ok: true, message: 'Order already marked as delivered.' };
            }
            if (!delivery.otpCode) {
                throw new BadRequestException('Please generate OTP before delivery.');
            }

            const [storedOtp, expiresRaw] = delivery.otpCode.split('|');
            const expiresAt = Number(expiresRaw || 0);
            if (!storedOtp || !expiresAt) {
                throw new BadRequestException('OTP is invalid. Generate a new OTP.');
            }
            if (Date.now() > expiresAt) {
                throw new BadRequestException('OTP has expired. Generate a new OTP.');
            }
            if (storedOtp !== code) {
                throw new BadRequestException('Incorrect OTP.');
            }

            await tx.delivery.update({
                where: { id: delivery.id },
                data: {
                    status: 'DELIVERED',
                    actualDelivery: new Date(),
                    otpCode: null,
                },
            });
            await tx.deliveryTracking.create({
                data: {
                    deliveryId: delivery.id,
                    deliveryPartnerId: partner.id,
                    status: 'DELIVERED',
                    source: 'APP',
                    note: 'Customer OTP verified',
                },
            });
            await tx.order.update({
                where: { id: delivery.orderId },
                data: { status: 'DELIVERED' },
            });
            await tx.orderStatusLog.create({
                data: {
                    orderId: delivery.orderId,
                    status: 'DELIVERED',
                    changedByRole: 'DELIVERY_PARTNER',
                    changedByName: partner.name,
                },
            });

            return { ok: true, message: 'Delivery OTP verified. Order marked as delivered.' };
        });
    }

    async updateAssignmentStatusForUser(
        deliveryId: string,
        userId: string,
        payload: { status: string; reason?: string; lat?: number; lng?: number },
    ) {
        const partner = await this.getPartnerForUser(userId);
        const normalizedStatus = payload.status?.toUpperCase();
        if (!normalizedStatus) {
            throw new NotFoundException('Status is required');
        }

        return this.prisma.$transaction(async (tx) => {
            const delivery = await tx.delivery.findFirst({
                where: { id: deliveryId, deliveryPartnerId: partner.id },
                include: { order: true },
            });
            if (!delivery) {
                throw new NotFoundException('Delivery assignment not found');
            }

            const currentStatus = (delivery.status || 'ASSIGNED').toUpperCase();
            if (currentStatus === normalizedStatus) {
                // Idempotent: nothing to change
                return delivery;
            }

            const allowedTransitions: Record<string, string[]> = {
                ASSIGNED: ['PICKED_UP', 'OUT_FOR_DELIVERY', 'FAILED'],
                PICKED_UP: ['OUT_FOR_DELIVERY', 'FAILED'],
                OUT_FOR_DELIVERY: ['DELIVERED', 'FAILED'],
                FAILED: [],
                DELIVERED: [],
            };

            const allowedNext = allowedTransitions[currentStatus] ?? [];
            if (!allowedNext.includes(normalizedStatus)) {
                throw new BadRequestException(
                    `Cannot change status from ${currentStatus} to ${normalizedStatus}`,
                );
            }

            if (normalizedStatus === 'FAILED' && !payload.reason) {
                throw new BadRequestException('Failure reason is required when marking delivery as FAILED.');
            }

            const updated = await tx.delivery.update({
                where: { id: delivery.id },
                data: { status: normalizedStatus },
            });

            await tx.deliveryTracking.create({
                data: {
                    deliveryId: delivery.id,
                    deliveryPartnerId: partner.id,
                    status: normalizedStatus,
                    lat: payload.lat != null ? payload.lat : null,
                    lng: payload.lng != null ? payload.lng : null,
                    note: payload.reason ?? null,
                    source: 'APP',
                },
            });

            // When the partner marks the order as DELIVERED, also update the order status timeline.
            if (normalizedStatus === 'DELIVERED') {
                throw new BadRequestException(
                    'Use OTP verification endpoint to mark delivery as DELIVERED.',
                );
            }

            return updated;
        });
    }

    async getEarningsSummaryForUser(userId: string) {
        const partner = await this.getPartnerForUser(userId);
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const todayAgg = await this.prisma.deliveryEarning.aggregate({
            _sum: { total: true },
            _count: { id: true },
            where: {
                deliveryPartnerId: partner.id,
                createdAt: { gte: startOfDay },
            },
        });

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const weekAgg = await this.prisma.deliveryEarning.aggregate({
            _sum: { total: true },
            where: {
                deliveryPartnerId: partner.id,
                createdAt: { gte: weekAgo },
            },
        });

        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        const monthAgg = await this.prisma.deliveryEarning.aggregate({
            _sum: { total: true },
            where: {
                deliveryPartnerId: partner.id,
                createdAt: { gte: monthAgo },
            },
        });

        return {
            today: {
                earnings: Number(todayAgg._sum.total ?? 0),
                deliveries: todayAgg._count.id ?? 0,
            },
            week: {
                earnings: Number(weekAgg._sum.total ?? 0),
            },
            month: {
                earnings: Number(monthAgg._sum.total ?? 0),
            },
        };
    }

    async getCodSummaryForUser(userId: string) {
        const partner = await this.getPartnerForUser(userId);
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const collectedAgg = await this.prisma.codTransaction.aggregate({
            _sum: { amount: true },
            where: {
                deliveryPartnerId: partner.id,
                type: 'COLLECTED',
                createdAt: { gte: todayStart },
            },
        });

        const submittedAgg = await this.prisma.codTransaction.aggregate({
            _sum: { amount: true },
            where: {
                deliveryPartnerId: partner.id,
                type: 'SUBMITTED',
                createdAt: { gte: todayStart },
            },
        });

        const collected = Number(collectedAgg._sum.amount ?? 0);
        const submitted = Number(submittedAgg._sum.amount ?? 0);

        return {
            collectedToday: collected,
            submittedToday: submitted,
            pendingToday: collected - submitted,
        };
    }
}
