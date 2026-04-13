import { Module } from '@nestjs/common';
import { OrderService } from './application/order.service';
import { PaymentService } from './application/payment.service';
import { OrderHoldCleanupService } from './application/order-hold-cleanup.service';
import { OrderController } from './interface/order.controller';
import { SettingsModule } from '../settings/settings.module';

@Module({
    imports: [SettingsModule],
    providers: [OrderService, PaymentService, OrderHoldCleanupService],
    controllers: [OrderController],
    exports: [OrderService],
})
export class OrderModule { }
