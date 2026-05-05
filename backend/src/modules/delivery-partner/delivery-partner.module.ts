import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { DeliveryPartnerController } from './interface/delivery-partner.controller';
import { DeliveryPartnerService } from './application/delivery-partner.service';
import { DeliveryAppController } from './interface/delivery-app.controller';
import { MailService } from '../../common/mail/mail.service';
import { DeliveryOverdueAlertService } from './application/delivery-overdue-alert.service';

@Module({
    imports: [PrismaModule],
    controllers: [DeliveryPartnerController, DeliveryAppController],
    providers: [DeliveryPartnerService, DeliveryOverdueAlertService, MailService],
    exports: [DeliveryPartnerService],
})
export class DeliveryPartnerModule {}
