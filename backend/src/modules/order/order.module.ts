import { Module } from '@nestjs/common';
import { OrderService } from './application/order.service';
import { PaymentService } from './application/payment.service';
import { OrderHoldCleanupService } from './application/order-hold-cleanup.service';
import { OrderController } from './interface/order.controller';
import { OrderPublicController } from './interface/order-public.controller';
import { SettingsModule } from '../settings/settings.module';
import { MailService } from '../../common/mail/mail.service';

@Module({
    imports: [SettingsModule],
    providers: [OrderService, PaymentService, OrderHoldCleanupService, MailService],
    controllers: [OrderController, OrderPublicController],
    exports: [OrderService],
})
export class OrderModule { }
