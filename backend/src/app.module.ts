import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { OrderModule } from './modules/order/order.module';
import { SellerModule } from './modules/seller/seller.module';
import { SettingsModule } from './modules/settings/settings.module';
import { UploadsModule } from './common/uploads/uploads.module';
import { WarehouseModule } from './modules/warehouse/warehouse.module';
import { DeliveryPartnerModule } from './modules/delivery-partner/delivery-partner.module';
import { MailService } from './common/mail/mail.service';

@Module({
    imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env',
        }),
        ThrottlerModule.forRoot([{
            ttl: 60000,
            limit: 100,
        }]),
        ScheduleModule.forRoot(),
        PrismaModule,
        AuthModule,
        CatalogModule,
        OrderModule,
        SellerModule,
        SettingsModule,
        UploadsModule,
        WarehouseModule,
        DeliveryPartnerModule,
    ],
    providers: [MailService],
})
export class AppModule { }
