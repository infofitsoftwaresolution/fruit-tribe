import { Body, Controller, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaymentService } from '../application/payment.service';

@ApiTags('Orders')
@Controller('orders/public')
export class OrderPublicController {
    constructor(private readonly paymentService: PaymentService) {}

    @ApiOperation({ summary: 'Public: sync manual-order payment-link status and capture payment if completed' })
    @Post(':id/confirm-payment-link')
    async confirmPaymentLink(
        @Param('id', ParseUUIDPipe) orderId: string,
        @Body() body: { paymentId?: string; paymentLinkId?: string; paymentLinkStatus?: string },
    ) {
        return this.paymentService.confirmPaymentFromPaymentLink(
            orderId,
            body?.paymentId,
            body?.paymentLinkId,
            body?.paymentLinkStatus,
        );
    }
}

