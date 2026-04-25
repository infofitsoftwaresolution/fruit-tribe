import { Module } from '@nestjs/common';
import { SettingsController } from './interface/settings.controller';
import { PublicEngagementController } from './interface/public-engagement.controller';
import { SettingsService } from './application/settings.service';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { MailService } from '../../common/mail/mail.service';

@Module({
    imports: [PrismaModule],
    controllers: [SettingsController, PublicEngagementController],
    providers: [SettingsService, MailService],
    exports: [SettingsService],
})
export class SettingsModule {}
