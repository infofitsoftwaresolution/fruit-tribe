import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { DeliveryPartnerController } from './interface/delivery-partner.controller';
import { DeliveryPartnerService } from './application/delivery-partner.service';

@Module({
    imports: [PrismaModule],
    controllers: [DeliveryPartnerController],
    providers: [DeliveryPartnerService],
    exports: [DeliveryPartnerService],
})
export class DeliveryPartnerModule {}
