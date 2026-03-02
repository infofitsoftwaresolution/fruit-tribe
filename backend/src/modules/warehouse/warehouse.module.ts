import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { WarehouseController } from './interface/warehouse.controller';
import { WarehouseService } from './application/warehouse.service';

@Module({
    imports: [PrismaModule],
    controllers: [WarehouseController],
    providers: [WarehouseService],
    exports: [WarehouseService],
})
export class WarehouseModule {}
