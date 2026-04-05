import { Module } from '@nestjs/common';
import { PrismaModule } from '../../infrastructure/prisma/prisma.module';
import { AddressService } from './application/address.service';
import { AddressController } from './interface/address.controller';

@Module({
    imports: [PrismaModule],
    controllers: [AddressController],
    providers: [AddressService],
    exports: [AddressService],
})
export class AddressModule {}
