import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { SettingsService } from '../../settings/application/settings.service';
import * as crypto from 'crypto';

// Razorpay package uses module.exports (no default); use require so constructor is available
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Razorpay = require('razorpay');

@Injectable()
export class PaymentService {
    private readonly logger = new Logger(PaymentService.name);
    /** Reuse SDK client per key pair (avoids reconstructing on every payment). */
    private readonly razorpayByKey = new Map<string, any>();

    constructor(
        private readonly prisma: PrismaService,
        private readonly settingsService: SettingsService,
    ) {}

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
            const options = {
                amount: Math.round(amountInPaise),
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
                            amountInPaise: Math.round(amountInPaise),
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

        await this.prisma.$transaction(async (tx) => {
            await tx.payment.create({
                data: {
                    orderId: order.id,
                    transactionId: razorpayPaymentId,
                    paymentMethod: 'razorpay',
                    amount: order.payableAmount,
                    currency: 'INR',
                    gatewayResponse: { razorpayOrderId, razorpayPaymentId },
                    status: 'CAPTURED',
                },
            });

            await tx.order.update({
                where: { id: order.id },
                data: { paymentStatus: 'PAID', status: 'CONFIRMED' },
            });

            // Professional Step: Commit Reserved Stock
            const reservations = await tx.stockReservation.findMany({
                where: { orderId: order.id, status: 'PENDING' }
            });

            for (const res of reservations) {
                // Update reservation status
                await tx.stockReservation.update({
                    where: { id: res.id },
                    data: { status: 'COMPLETED' }
                });

                // Physically reduce total stock (reserved count already accounted for in OrderService/ProductService logic)
                // We reduce physical stock and release the reservation hold
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
                        reason: 'PAYMENT_SUCCESS_COMMIT',
                        referenceId: order.id
                    }
                });
            }
        });

        this.logger.log(`Payment verified for order ${order.orderNumber}`);
        return { success: true };
    }

    async createPaymentLink(
        orderId: string,
        userId: string,
        amountInPaise: number,
        customerDetails?: { name: string; email?: string; contact?: string },
    ): Promise<{ paymentLink: string }> {
        try {
            const credentials = await this.settingsService.getRazorpayCredentials();
            if (!credentials) {
                throw new BadRequestException('Razorpay is not configured.');
            }

            const order = await this.prisma.order.findFirst({
                where: { id: orderId, userId },
            });
            if (!order) throw new BadRequestException('Order not found');

            // If order is already confirmed or paid, do not allow generating a new link
            const isConfirmed = String(order.status).toUpperCase() === 'CONFIRMED';
            const isPaid = String(order.paymentStatus).toUpperCase() === 'PAID';
            if (isConfirmed || isPaid) {
                throw new BadRequestException('This order is already confirmed or paid. No payment link needed.');
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
                callback_url: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/order-confirmation?id=${order.id}`,
                callback_method: 'get',
            };

            const response = await instance.paymentLink.create(options);
            this.logger.log(`Razorpay payment link created for order ${order.orderNumber}: ${response.short_url}`);

            return { paymentLink: response.short_url };
        } catch (err: any) {
            this.logger.error(`createPaymentLink failed: ${err.message}`, err.stack);
            throw new BadRequestException(err?.error?.description || 'Failed to create payment link');
        }
    }
}
