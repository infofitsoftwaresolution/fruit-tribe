import { Module } from '@nestjs/common';
import { SettingsController } from './interface/settings.controller';
import { SettingsService } from './application/settings.service';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [SettingsController],
    providers: [SettingsService],
    exports: [SettingsService],
})
export class SettingsModule {}
