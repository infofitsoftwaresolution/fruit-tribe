import { Module } from '@nestjs/common';
import { SellerService } from './application/seller.service';
import { SellerController } from './interface/seller.controller';

@Module({
    providers: [SellerService],
    controllers: [SellerController],
    exports: [SellerService],
})
export class SellerModule { }
