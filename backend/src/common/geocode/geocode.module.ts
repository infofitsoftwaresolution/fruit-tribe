import { Module } from '@nestjs/common';
import { GeocodeController } from './geocode.controller';
import { GeocodeService } from './geocode.service';
import { GeoapifyService } from './geoapify.service';

@Module({
    controllers: [GeocodeController],
    providers: [GeocodeService, GeoapifyService],
})
export class GeocodeModule {}
