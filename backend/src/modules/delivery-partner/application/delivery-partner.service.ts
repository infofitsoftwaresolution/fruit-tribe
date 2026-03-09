import { Injectable, NotFoundException, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { MailService } from '../../../common/mail/mail.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class DeliveryPartnerService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly mailService: MailService,
    ) { }

    async findAll() {
        return this.prisma.deliveryPartner.findMany({
            orderBy: { name: 'asc' },
            include: { user: { select: { email: true } } },
        });
    }

    async create(data: { name: string; phone: string; email: string; vehicle?: string; status?: string }) {
        // Create or reuse role DELIVERY_PARTNER
        const role = await this.prisma.role.findUnique({ where: { name: 'DELIVERY_PARTNER' } });
        const tempPassword = Math.random().toString(36).slice(-10);
        const passwordHash = await bcrypt.hash(tempPassword, 12);

        const result = await this.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: data.email,
                    phone: data.phone,
                    passwordHash,
                    firstName: data.name,
                    roleId: role?.id ?? undefined,
                    isActive: true,
                    requirePasswordChange: true,
                },
            });

            const partner = await tx.deliveryPartner.create({
                data: {
                    name: data.name,
                    phone: data.phone,
                    vehicle: data.vehicle ?? null,
                    status: data.status ?? 'ACTIVE',
                    userId: user.id,
                },
            });

            return { user, partner, tempPassword };
        });

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
            const role = await this.prisma.role.findUnique({ where: { name: 'DELIVERY_PARTNER' } });
            const tempPassword = Math.random().toString(36).slice(-10);
            const passwordHash = await bcrypt.hash(tempPassword, 12);

            const user = await this.prisma.user.create({
                data: {
                    email: data.email,
                    phone: data.phone ?? existing.phone,
                    passwordHash,
                    firstName: data.name ?? existing.name,
                    roleId: role?.id ?? undefined,
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
        return delivery;
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
