import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
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
import { AddressModule } from './modules/address/address.module';
import { MailService } from './common/mail/mail.service';
import { SmsService } from './common/sms/sms.service';

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
        AddressModule,
    ],
    providers: [
        MailService,
        SmsService,
        {
            provide: APP_GUARD,
            useClass: ThrottlerGuard,
        },
    ],
})
export class AppModule { }
