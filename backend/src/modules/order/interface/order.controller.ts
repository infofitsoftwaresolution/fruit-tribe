import {
    Controller,
    Post,
    Get,
    Patch,
    Param,
    Body,
    UseGuards,
    Request,
    ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrderService } from '../application/order.service';
import { PaymentService } from '../application/payment.service';
import { CreateOrderDto } from './dtos/create-order.dto';
import { CreateSubscriptionOrderDto } from './dtos/create-subscription-order.dto';
import { CreateManualOrderDto } from './dtos/create-manual-order.dto';
import { CreateRazorpayOrderDto } from './dtos/create-razorpay-order.dto';
import { VerifyPaymentDto } from './dtos/verify-payment.dto';
import { SimulatePricingDto } from './dtos/simulate-pricing.dto';
import { JwtAuthGuard } from '../../auth/interface/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/interface/guards/roles.guard';
import { Roles } from '../../auth/interface/decorators/roles.decorator';

@ApiTags('Orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrderController {
    constructor(
        private readonly orderService: OrderService,
        private readonly paymentService: PaymentService,
    ) { }

    @ApiOperation({ summary: 'Place a new order' })
    @Post()
    async create(@Request() req: any, @Body() dto: CreateOrderDto) {
        return this.orderService.create(req.user.id, dto);
    }

    @ApiOperation({ summary: 'Simulate canonical checkout pricing (no order created)' })
    @Post('pricing/simulate')
    async simulatePricing(@Request() req: any, @Body() dto: SimulatePricingDto) {
        return this.orderService.simulatePricing(req.user.id, dto);
    }

    @ApiOperation({ summary: 'Create subscription signup order (complete payment via Razorpay)' })
    @Post('subscription')
    async createSubscription(@Request() req: any, @Body() dto: CreateSubscriptionOrderDto) {
        return this.orderService.createSubscriptionOrder(req.user.id, dto);
    }

    @ApiOperation({ summary: 'Create a manual order (admin only)' })
    @Roles('ADMIN')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Post('manual')
    async createManual(@Request() req: any, @Body() dto: CreateManualOrderDto) {
        const order = await this.orderService.createManualOrder(req.user.id, dto);
        
        // If the order is created with payment status PENDING, generate a payment link automatically
        if (order.paymentStatus === 'PENDING') {
            try {
                const { paymentLink, emailDispatch } = await this.paymentService.createPaymentLink(
                    order.id,
                    order.userId,
                    Math.round(Number(order.payableAmount) * 100), // convert to paise
                    {
                        name: dto.customerName,
                        email: dto.customerEmail,
                        contact: dto.customerPhone,
                    }
                );
                return { ...order, paymentLink, emailDispatch };
            } catch (err: any) {
                // Return order even if link generation fails (can be generated later)
                return { ...order, paymentLinkError: err.message };
            }
        }
        
        return order;
    }

    @ApiOperation({ summary: 'Get all orders (admin: all orders, user: own orders)' })
    @Get()
    async findAll(@Request() req: any) {
        if (req.user.role === 'ADMIN') {
            return this.orderService.findAll();
        }
        return this.orderService.findByUser(req.user.id);
    }

    @ApiOperation({ summary: 'Get a specific order by ID' })
    @Get(':id')
    async findOne(
        @Param('id', ParseUUIDPipe) id: string,
        @Request() req: any,
    ) {
        return this.orderService.findOne(id, req.user.id);
    }

    @ApiOperation({ summary: 'Update order status (admin/seller)' })
    @Patch(':id/status')
    async updateStatus(
        @Param('id', ParseUUIDPipe) id: string,
        @Request() req: any,
        @Body() body: { status: string },
    ) {
        return this.orderService.updateStatus(id, req.user.id, req.user.role, body.status);
    }

    @ApiOperation({ summary: 'Create Razorpay order for payment (uses admin-configured keys)' })
    @Post(':id/create-razorpay-order')
    async createRazorpayOrder(
        @Param('id', ParseUUIDPipe) id: string,
        @Request() req: any,
        @Body() dto: CreateRazorpayOrderDto,
    ) {
        return this.paymentService.createRazorpayOrder(
            id,
            req.user.id,
            dto.amountInPaise,
            dto.currency ?? 'INR',
        );
    }

    @ApiOperation({ summary: 'Verify Razorpay payment and capture order' })
    @Post(':id/verify-payment')
    async verifyPayment(
        @Param('id', ParseUUIDPipe) id: string,
        @Request() req: any,
        @Body() dto: VerifyPaymentDto,
    ) {
        return this.paymentService.verifyAndCapturePayment(
            id,
            req.user.id,
            dto.razorpayOrderId,
            dto.razorpayPaymentId,
            dto.signature,
        );
    }

    @ApiOperation({ summary: 'Generate Razorpay payment link for manual sharing' })
    @Post(':id/payment-link')
    async createPaymentLink(
        @Param('id', ParseUUIDPipe) id: string,
        @Request() req: any,
        @Body() dto: { amountInPaise: number; customerDetails?: { name: string; email?: string; contact?: string } },
    ) {
        return this.paymentService.createPaymentLink(
            id,
            req.user.id,
            dto.amountInPaise,
            dto.customerDetails,
            req.user.role,
        );
    }

    @ApiOperation({ summary: 'Update payment status (admin only)' })
    @Roles('ADMIN')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Patch(':id/payment-status')
    async updatePaymentStatus(
        @Param('id', ParseUUIDPipe) id: string,
        @Request() req: any,
        @Body() body: { paymentStatus: string },
    ) {
        return this.orderService.updatePaymentStatus(id, body.paymentStatus);
    }
}
