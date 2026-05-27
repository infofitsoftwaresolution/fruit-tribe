import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { SettingsService } from '../../settings/application/settings.service';
import { MailService } from '../../../common/mail/mail.service';
import * as crypto from 'crypto';

// Razorpay package uses module.exports (no default); use require so constructor is available
const Razorpay = require('razorpay');

@Injectable()
export class PaymentService {
    private readonly logger = new Logger(PaymentService.name);
    /** Reuse SDK client per key pair (avoids reconstructing on every payment). */
    private readonly razorpayByKey = new Map<string, any>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly settingsService: SettingsService,
        private readonly mailService: MailService,
    ) {}

    private async finalizeOrderPayment(params: {
        orderId: string;
        transactionId: string;
        amount: number;
        currency: string;
        gatewayResponse: Record<string, unknown>;
    }): Promise<void> {
        const { orderId, transactionId, amount, currency, gatewayResponse } = params;
        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) throw new BadRequestException('Order not found');
        if (String(order.paymentStatus).toUpperCase() === 'PAID') return;

        const existingPayment = await this.prisma.payment.findUnique({
            where: { transactionId },
        });
        if (existingPayment) return;

        await this.prisma.$transaction(async (tx) => {
            await tx.payment.create({
                data: {
                    orderId,
                    transactionId,
                    paymentMethod: 'razorpay',
                    amount,
                    currency,
                    gatewayResponse: gatewayResponse as Prisma.InputJsonValue,
                    status: 'CAPTURED',
                },
            });

            await tx.order.update({
                where: { id: orderId },
                data: { paymentStatus: 'PAID', status: 'CONFIRMED' },
            });
            if (String(order.status).toUpperCase() !== 'CONFIRMED') {
                await tx.orderStatusLog.create({
                    data: {
                        orderId,
                        status: 'CONFIRMED',
                        changedByRole: 'SYSTEM',
                        changedByName: 'Payment Gateway',
                    },
                });
            }

            const reservations = await tx.stockReservation.findMany({
                where: { orderId, status: 'PENDING' },
            });

            const variantIds = reservations.map((r) => r.variantId);
            const variants = variantIds.length
                ? await tx.productVariant.findMany({
                      where: { id: { in: variantIds } },
                      select: { id: true, productId: true },
                  })
                : [];
            const productByVariant = new Map(variants.map((v) => [String(v.id), String(v.productId)]));
            const kgByProduct = new Map<string, number>();
            for (const res of reservations) {
                await tx.stockReservation.update({
                    where: { id: res.id },
                    data: { status: 'COMPLETED' },
                });
                const pid = productByVariant.get(String(res.variantId));
                if (!pid) continue;
                kgByProduct.set(pid, (kgByProduct.get(pid) || 0) + Number(res.quantity));
            }
            for (const [productId, kg] of kgByProduct.entries()) {
                await tx.product.update({
                    where: { id: productId },
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
                        reason: 'PAYMENT_SUCCESS_COMMIT',
                        referenceId: orderId,
                    },
                });
            }
        });
    }

    private getRazorpayInstance(keyId: string, keySecret: string) {
        const cacheKey = `${keyId}\0${keySecret}`;
        let inst = this.razorpayByKey.get(cacheKey);
        if (!inst) {
            inst = new Razorpay({
                key_id: keyId,
                key_secret: keySecret,
            });
            this.razorpayByKey.set(cacheKey, inst);
        }
        return inst;
    }

    /**
     * Create a Razorpay order using credentials stored by admin. All payments go to the configured account.
     */
    async createRazorpayOrder(
        orderId: string,
        userId: string,
        amountInPaise: number,
        currency: string = 'INR',
    ): Promise<{ razorpayOrderId: string; keyId: string }> {
        try {
            const credentials = await this.settingsService.getRazorpayCredentials();
            if (!credentials) {
                throw new BadRequestException(
                    'Razorpay is not configured. Ask admin to add Key ID and Key Secret in Settings.',
                );
            }

            const order = await this.prisma.order.findFirst({
                where: { id: orderId, userId },
                include: {
                    user: { select: { firstName: true, lastName: true } },
                },
            });
            if (!order) throw new BadRequestException('Order not found');
            if (String(order.status).toUpperCase() === 'CANCELLED') {
                throw new BadRequestException('This order was cancelled and cannot be paid.');
            }
            if (String(order.paymentStatus).toUpperCase() === 'PAID') {
                throw new BadRequestException('Order is already paid.');
            }

            const instance = this.getRazorpayInstance(credentials.keyId, credentials.keySecret);

            const receipt = String(order.orderNumber).slice(0, 40);
            const persistedPaise = Math.round(Number(order.payableAmount) * 100);
            const requestedPaise = Number.isFinite(amountInPaise) ? Math.max(1, Math.round(amountInPaise)) : persistedPaise;
            const finalPaise = persistedPaise > 0 ? persistedPaise : requestedPaise;
            if (requestedPaise !== persistedPaise) {
                this.logger.warn(
                    `createRazorpayOrder: ignored client amount ${requestedPaise} paise; using persisted ${finalPaise} paise for ${order.orderNumber}.`,
                );
            }
            const options = {
                amount: finalPaise,
                currency,
                receipt,
                notes: { orderId, orderNumber: order.orderNumber },
            };

            const razorpayOrder = await instance.orders.create(options as any);
            const existingMetadata =
                order.metadata && typeof order.metadata === 'object' && !Array.isArray(order.metadata)
                    ? (order.metadata as Record<string, unknown>)
                    : {};
            await this.prisma.order.update({
                where: { id: order.id },
                data: {
                    metadata: {
                        ...existingMetadata,
                        paymentContext: {
                            razorpayOrderId: razorpayOrder.id,
                            amountInPaise: finalPaise,
                            currency,
                        },
                    },
                },
            });
            this.logger.log(`Razorpay order created for order ${order.orderNumber}: ${razorpayOrder.id}`);
            return {
                razorpayOrderId: razorpayOrder.id,
                keyId: credentials.keyId,
            };
        } catch (err: any) {
            if (err instanceof BadRequestException) throw err;
            const message =
                err?.error?.description ?? err?.message ?? err?.reason ?? 'Payment setup failed. Check Razorpay settings.';
            this.logger.error(`createRazorpayOrder failed: ${message}`, err?.stack ?? err);
            throw new BadRequestException(
                typeof message === 'string' ? message : 'Unable to create payment session. Check Razorpay credentials in Settings.',
            );
        }
    }

    /**
     * Verify Razorpay payment signature using stored key secret and update order + payment record.
     */
    async verifyAndCapturePayment(
        orderId: string,
        userId: string,
        razorpayOrderId: string,
        razorpayPaymentId: string,
        signature: string,
    ): Promise<{ success: boolean }> {
        const credentials = await this.settingsService.getRazorpayCredentials();
        if (!credentials) {
            throw new BadRequestException('Razorpay is not configured.');
        }

        const order = await this.prisma.order.findFirst({
            where: { id: orderId, userId },
        });
        if (!order) throw new BadRequestException('Order not found');
        if (String(order.status).toUpperCase() === 'CANCELLED') {
            throw new BadRequestException('This order was cancelled and cannot be paid.');
        }

        const paymentContext =
            order.metadata &&
            typeof order.metadata === 'object' &&
            !Array.isArray(order.metadata) &&
            (order.metadata as any).paymentContext &&
            typeof (order.metadata as any).paymentContext === 'object'
                ? (order.metadata as any).paymentContext
                : null;
        if (!paymentContext?.razorpayOrderId || !paymentContext?.amountInPaise || !paymentContext?.currency) {
            throw new BadRequestException('Missing payment context. Please create a new payment session.');
        }
        if (String(paymentContext.razorpayOrderId) !== String(razorpayOrderId)) {
            throw new BadRequestException('Payment session does not match this order.');
        }
        const expectedAmountInPaise = Math.round(Number(order.payableAmount) * 100);
        if (Number(paymentContext.amountInPaise) !== expectedAmountInPaise) {
            throw new BadRequestException('Payment amount mismatch for this order.');
        }
        if (String(paymentContext.currency).toUpperCase() !== 'INR') {
            throw new BadRequestException('Unsupported payment currency for this order.');
        }

        const body = `${razorpayOrderId}|${razorpayPaymentId}`;
        const expectedSignature = crypto
            .createHmac('sha256', credentials.keySecret)
            .update(body)
            .digest('hex');

        if (expectedSignature !== signature) {
            this.logger.warn(`Invalid Razorpay signature for order ${orderId}`);
            throw new BadRequestException('Invalid payment signature.');
        }

        if (order.paymentStatus === 'PAID') {
            this.logger.log(`Order ${order.orderNumber} already paid. Skipping capture.`);
            return { success: true };
        }

        const existingPayment = await this.prisma.payment.findUnique({
            where: { transactionId: razorpayPaymentId }
        });
        if (existingPayment) {
            this.logger.log(`Payment ${razorpayPaymentId} already processed.`);
            return { success: true };
        }

        await this.finalizeOrderPayment({
            orderId: order.id,
            transactionId: razorpayPaymentId,
            amount: Number(order.payableAmount),
            currency: 'INR',
            gatewayResponse: { razorpayOrderId, razorpayPaymentId },
        });

        this.logger.log(`Payment verified for order ${order.orderNumber}`);
        return { success: true };
    }

    async createPaymentLink(
        orderId: string,
        userId: string,
        amountInPaise: number,
        customerDetails?: { name: string; email?: string; contact?: string },
        requesterRole: string = 'CUSTOMER',
    ): Promise<{ paymentLink: string; emailDispatch?: { sent: boolean; error?: string } }> {
        try {
            const credentials = await this.settingsService.getRazorpayCredentials();
            if (!credentials) {
                throw new BadRequestException('Razorpay is not configured.');
            }

            const normalizedRole = String(requesterRole || 'CUSTOMER').toUpperCase();
            const order = await this.prisma.order.findFirst({
                where:
                    normalizedRole === 'ADMIN'
                        ? { id: orderId }
                        : normalizedRole === 'DELIVERY_PARTNER'
                            ? {
                                id: orderId,
                                deliveries: {
                                    some: {
                                        deliveryPartner: { userId },
                                    },
                                },
                            }
                            : { id: orderId, userId },
                include: {
                    user: {
                        select: { firstName: true, lastName: true },
                    },
                },
            });
            if (!order) {
                throw new BadRequestException(
                    normalizedRole === 'ADMIN'
                        ? 'Order not found.'
                        : normalizedRole === 'DELIVERY_PARTNER'
                            ? 'Order not found for this delivery assignment.'
                        : 'Order not found for this user.',
                );
            }

            // If order is already paid, do not allow generating a new link
            const isPaid = String(order.paymentStatus).toUpperCase() === 'PAID';
            if (isPaid) {
                throw new BadRequestException('This order is already paid. No payment link needed.');
            }

            const instance = this.getRazorpayInstance(credentials.keyId, credentials.keySecret);

            const options = {
                amount: Math.round(amountInPaise),
                currency: 'INR',
                accept_partial: false,
                description: `Payment for Order #${order.orderNumber}`,
                customer: {
                    name: customerDetails?.name || 'Customer',
                    email: customerDetails?.email || 'customer@example.com',
                    contact: customerDetails?.contact || '9876543210',
                },
                notify: {
                    sms: true,
                    email: true,
                },
                reminder_enable: true,
                notes: {
                    orderId: order.id,
                },
                callback_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/#/order-confirmation?id=${order.id}`,
                callback_method: 'get',
            };

            const response = await instance.paymentLink.create(options);
            const existingMetadata =
                order.metadata && typeof order.metadata === 'object' && !Array.isArray(order.metadata)
                    ? (order.metadata as Record<string, unknown>)
                    : {};
            await this.prisma.order.update({
                where: { id: order.id },
                data: {
                    metadata: {
                        ...existingMetadata,
                        paymentContext: {
                            ...(existingMetadata['paymentContext'] && typeof existingMetadata['paymentContext'] === 'object'
                                ? (existingMetadata['paymentContext'] as Record<string, unknown>)
                                : {}),
                            paymentLinkId: response.id,
                            paymentLinkUrl: response.short_url,
                            amountInPaise: Math.round(amountInPaise),
                            currency: 'INR',
                        },
                    },
                },
            });
            this.logger.log(`Razorpay payment link created for order ${order.orderNumber}: ${response.short_url}`);
            const normalizedEmail = String(customerDetails?.email || '').trim().toLowerCase();
            if (!normalizedEmail) {
                return { paymentLink: response.short_url };
            }
            const nameFromUser = [order.user?.firstName, order.user?.lastName].filter(Boolean).join(' ').trim();
            const customerName = String(customerDetails?.name || nameFromUser || 'Customer');
            const items = await this.prisma.orderItem.findMany({
                where: { orderId: order.id },
                include: { product: { select: { name: true } } },
            });
            try {
                await this.mailService.sendManualOrderPaymentLinkEmail({
                    to: normalizedEmail,
                    customerName,
                    orderNumber: String(order.orderNumber),
                    payableAmount: Number(order.payableAmount),
                    items: items.map((item) => ({
                        name: item.product?.name || `Item ${String(item.productId).slice(0, 8)}`,
                        quantity: Number(item.quantity || 0),
                        unitPrice: Number(item.pricePerUnit || 0),
                    })),
                    paymentLink: response.short_url,
                });
                return { paymentLink: response.short_url, emailDispatch: { sent: true } };
            } catch (emailErr: any) {
                const message = emailErr?.message || 'Failed to send payment link email';
                this.logger.warn(`Payment link email failed for order ${order.orderNumber}: ${message}`);
                return { paymentLink: response.short_url, emailDispatch: { sent: false, error: message } };
            }
        } catch (err: any) {
            const message =
                err?.error?.description ??
                err?.error?.reason ??
                err?.message ??
                'Failed to create payment link';
            this.logger.error(`createPaymentLink failed: ${message}`, err?.stack ?? err);
            throw new BadRequestException(
                typeof message === 'string' ? message : 'Failed to create payment link',
            );
        }
    }

    async confirmPaymentFromPaymentLink(
        orderId: string,
        paymentId?: string,
        paymentLinkIdFromClient?: string,
        paymentLinkStatusFromClient?: string,
    ): Promise<{ success: boolean; paymentStatus: string; orderStatus: string; captured: boolean }> {
        const credentials = await this.settingsService.getRazorpayCredentials();
        if (!credentials) {
            throw new BadRequestException('Razorpay is not configured.');
        }

        const order = await this.prisma.order.findUnique({ where: { id: orderId } });
        if (!order) throw new BadRequestException('Order not found');

        if (String(order.paymentStatus).toUpperCase() === 'PAID') {
            return { success: true, paymentStatus: 'PAID', orderStatus: String(order.status), captured: false };
        }

        const paymentContext =
            order.metadata &&
            typeof order.metadata === 'object' &&
            !Array.isArray(order.metadata) &&
            (order.metadata as any).paymentContext &&
            typeof (order.metadata as any).paymentContext === 'object'
                ? (order.metadata as any).paymentContext
                : {};

        const paymentLinkId = String(paymentLinkIdFromClient || paymentContext.paymentLinkId || '').trim();
        const instance = this.getRazorpayInstance(credentials.keyId, credentials.keySecret);
        const expectedAmountInPaise = Math.round(Number(order.payableAmount) * 100);
        let resolvedPaymentId = String(paymentId || '').trim();

        if (!resolvedPaymentId && paymentLinkId) {
            try {
                const paymentCollection = await instance.payments.all({ payment_link_id: paymentLinkId, count: 1 });
                const first = Array.isArray(paymentCollection?.items) ? paymentCollection.items[0] : null;
                if (first?.id) resolvedPaymentId = String(first.id);
            } catch {
                // fallback to status checks below
            }
        }

        if (resolvedPaymentId) {
            const payment = await instance.payments.fetch(resolvedPaymentId);
            const paid = String(payment?.status || '').toLowerCase() === 'captured';
            const amountMatches = Number(payment?.amount || 0) === expectedAmountInPaise;
            const orderNoteMatches = String(payment?.notes?.orderId || '') === String(order.id);
            if (paid && amountMatches && orderNoteMatches) {
                await this.finalizeOrderPayment({
                    orderId: order.id,
                    transactionId: resolvedPaymentId,
                    amount: Number(order.payableAmount),
                    currency: String(payment.currency || 'INR'),
                    gatewayResponse: {
                        source: 'payment_link_sync',
                        paymentLinkId: paymentLinkId || null,
                        paymentId: resolvedPaymentId,
                    },
                });
                return { success: true, paymentStatus: 'PAID', orderStatus: 'CONFIRMED', captured: true };
            }
        }

        const normalizedClientStatus = String(paymentLinkStatusFromClient || '').toLowerCase();
        if (normalizedClientStatus === 'paid') {
            return { success: true, paymentStatus: String(order.paymentStatus), orderStatus: String(order.status), captured: false };
        }

        if (paymentLinkId) {
            try {
                const paymentLink = await instance.paymentLink.fetch(paymentLinkId);
                const linkStatus = String(paymentLink?.status || '').toLowerCase();
                if (linkStatus === 'paid') {
                    return { success: true, paymentStatus: String(order.paymentStatus), orderStatus: String(order.status), captured: false };
                }
            } catch {
                // Keep graceful response when fetch is unavailable.
            }
        }

        return {
            success: true,
            paymentStatus: String(order.paymentStatus),
            orderStatus: String(order.status),
            captured: false,
        };
    }
}
