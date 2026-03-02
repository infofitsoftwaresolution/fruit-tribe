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

    constructor(
        private readonly prisma: PrismaService,
        private readonly settingsService: SettingsService,
    ) {}

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

            const instance = new Razorpay({
                key_id: credentials.keyId,
                key_secret: credentials.keySecret,
            });

            const receipt = String(order.orderNumber).slice(0, 40);
            const options = {
                amount: Math.round(amountInPaise),
                currency,
                receipt,
                notes: { orderId, orderNumber: order.orderNumber },
            };

            const razorpayOrder = await instance.orders.create(options as any);
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

        const body = `${razorpayOrderId}|${razorpayPaymentId}`;
        const expectedSignature = crypto
            .createHmac('sha256', credentials.keySecret)
            .update(body)
            .digest('hex');

        if (expectedSignature !== signature) {
            this.logger.warn(`Invalid Razorpay signature for order ${orderId}`);
            throw new BadRequestException('Invalid payment signature.');
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
                data: { paymentStatus: 'PAID' },
            });
        });

        this.logger.log(`Payment verified for order ${order.orderNumber}`);
        return { success: true };
    }
}
