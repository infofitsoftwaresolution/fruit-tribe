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
import { CreateRazorpayOrderDto } from './dtos/create-razorpay-order.dto';
import { VerifyPaymentDto } from './dtos/verify-payment.dto';
import { JwtAuthGuard } from '../../auth/interface/guards/jwt-auth.guard';

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
}
