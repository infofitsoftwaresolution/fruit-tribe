import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { MailService } from '../../../common/mail/mail.service';

const OVERDUE_ALERT_STATUS = 'OVERDUE_ALERT_SENT';
const OUT_FOR_DELIVERY_STATUS = 'OUT_FOR_DELIVERY';
const OVERDUE_THRESHOLD_MS = 2 * 60 * 60 * 1000;

@Injectable()
export class DeliveryOverdueAlertService {
    private readonly logger = new Logger(DeliveryOverdueAlertService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly mailService: MailService,
        private readonly config: ConfigService,
    ) {}

    private getAdminAlertRecipients(): string[] {
        const raw =
            this.config.get<string>('DELIVERY_ALERT_EMAILS') ||
            this.config.get<string>('CONTACT_RECEIVER_EMAIL') ||
            this.config.get<string>('SMTP_USER') ||
            '';
        return raw
            .split(/[;,]/g)
            .map((v) => v.trim().toLowerCase())
            .filter(Boolean);
    }

    private getAddressText(shippingAddress: unknown): string {
        if (!shippingAddress || typeof shippingAddress !== 'object') return 'Address available in admin dashboard';
        const addr = shippingAddress as Record<string, unknown>;
        const parts = [
            addr.firstName,
            addr.lastName,
            addr.address,
            addr.addressLine1,
            addr.addressLine2,
            addr.city,
            addr.state,
            addr.zipCode,
            addr.pincode,
        ]
            .map((v) => String(v ?? '').trim())
            .filter(Boolean);
        return parts.length ? parts.join(', ') : 'Address available in admin dashboard';
    }

    private getCustomerPhone(shippingAddress: unknown, orderUserPhone: string | null | undefined): string {
        if (shippingAddress && typeof shippingAddress === 'object') {
            const addr = shippingAddress as Record<string, unknown>;
            const phone = String(addr.phone ?? '').trim();
            if (phone) return phone;
        }
        return String(orderUserPhone ?? '').trim() || 'Not available';
    }

    private getItemsSummary(
        items: Array<{ quantity: number; product?: { name?: string | null } | null; pricePerUnit?: unknown }>,
    ): string {
        if (!Array.isArray(items) || items.length === 0) return 'Items unavailable';
        return items
            .slice(0, 8)
            .map((item) => {
                const name = String(item.product?.name ?? 'Item');
                const qty = Number(item.quantity) || 0;
                const price = Number(item.pricePerUnit);
                const priceText = Number.isFinite(price) ? ` @ ₹${price}` : '';
                return `${name} x ${qty}${priceText}`;
            })
            .join(', ');
    }

    @Cron(CronExpression.EVERY_10_MINUTES)
    async alertOverdueOutForDeliveryAssignments() {
        const recipients = this.getAdminAlertRecipients();
        if (recipients.length === 0) {
            this.logger.warn('Skipping overdue delivery alerts: no admin recipient email configured.');
            return;
        }

        const deliveries = await this.prisma.delivery.findMany({
            where: {
                status: OUT_FOR_DELIVERY_STATUS,
                actualDelivery: null,
            },
            include: {
                deliveryPartner: {
                    include: {
                        user: { select: { email: true } },
                    },
                },
                order: {
                    include: {
                        user: {
                            select: {
                                firstName: true,
                                lastName: true,
                                phone: true,
                                email: true,
                            },
                        },
                        items: {
                            include: {
                                product: { select: { name: true } },
                            },
                        },
                    },
                },
                trackingEvents: {
                    where: { status: OUT_FOR_DELIVERY_STATUS },
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
            },
        });

        const now = Date.now();
        for (const delivery of deliveries) {
            const startedAt = delivery.trackingEvents?.[0]?.createdAt?.getTime();
            if (!startedAt) continue;
            if (now - startedAt < OVERDUE_THRESHOLD_MS) continue;

            const alreadyAlerted = await this.prisma.deliveryTracking.findFirst({
                where: {
                    deliveryId: delivery.id,
                    status: OVERDUE_ALERT_STATUS,
                },
                select: { id: true },
            });
            if (alreadyAlerted) continue;

            const partnerName = String(delivery.deliveryPartner?.name ?? 'Unknown Rider');
            const partnerPhone = String(delivery.deliveryPartner?.phone ?? '').trim() || 'Not available';
            const partnerEmail = String(delivery.deliveryPartner?.user?.email ?? '').trim() || 'Not available';
            const orderNo = String(delivery.order?.orderNumber ?? delivery.orderId);
            const customerName =
                [delivery.order?.user?.firstName, delivery.order?.user?.lastName]
                    .map((v) => String(v ?? '').trim())
                    .filter(Boolean)
                    .join(' ') || 'Customer';
            const customerPhone = this.getCustomerPhone(delivery.order?.shippingAddress, delivery.order?.user?.phone);
            const addressText = this.getAddressText(delivery.order?.shippingAddress);
            const itemsSummary = this.getItemsSummary(delivery.order?.items ?? []);
            const minsOverdue = Math.max(0, Math.floor((now - startedAt - OVERDUE_THRESHOLD_MS) / 60000));

            const subject = `Delivery overdue alert: #${orderNo}`;
            const body =
                `A delivery has exceeded the 2-hour OUT_FOR_DELIVERY window.\n\n` +
                `Order: #${orderNo}\n` +
                `Current delivery status: ${delivery.status}\n` +
                `Out for delivery since: ${new Date(startedAt).toISOString()}\n` +
                `Overdue by: ${minsOverdue} minute(s)\n\n` +
                `Delivery partner: ${partnerName}\n` +
                `Delivery partner phone: ${partnerPhone}\n` +
                `Delivery partner email: ${partnerEmail}\n\n` +
                `Customer: ${customerName}\n` +
                `Customer phone: ${customerPhone}\n` +
                `Customer email: ${String(delivery.order?.user?.email ?? '').trim() || 'Not available'}\n\n` +
                `Delivery address: ${addressText}\n` +
                `Order items: ${itemsSummary}\n` +
                `Payable amount: ₹${Number(delivery.order?.payableAmount ?? 0)}\n` +
                `Delivery slot: ${String(delivery.order?.deliverySlot ?? 'Not specified')}`;

            let sent = 0;
            for (const to of recipients) {
                try {
                    await this.mailService.sendAnnouncementEmail(to, subject, body);
                    sent += 1;
                } catch (err) {
                    this.logger.error(
                        `Failed to send overdue delivery alert for ${orderNo} to ${to}: ${err instanceof Error ? err.message : String(err)}`,
                    );
                }
            }
            if (sent === 0) continue;

            await this.prisma.deliveryTracking.create({
                data: {
                    deliveryId: delivery.id,
                    deliveryPartnerId: delivery.deliveryPartnerId,
                    status: OVERDUE_ALERT_STATUS,
                    source: 'SYSTEM',
                    note: `Overdue alert sent to admin recipients (${sent})`,
                },
            });
        }
    }
}
