import { Body, Controller, DefaultValuePipe, Get, HttpCode, ParseFloatPipe, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { DrivingDistanceDto } from './dto/driving-distance.dto';
import { GeocodeService } from './geocode.service';
import { GeoapifyService } from './geoapify.service';

/**
 * Checkout debounces but still fires bursts of forward/reverse lookups while the user types.
 * The global HTTP throttler (100/min) trips 429 before Nominatim; geocode is a read-only proxy.
 * Rate limits: OSM usage policy + optional env tuning on GeocodeService — not per-IP Nest throttle here.
 */
@SkipThrottle()
@ApiTags('Geocode')
@Controller('geocode')
export class GeocodeController {
    constructor(
        private readonly geocodeService: GeocodeService,
        private readonly geoapifyService: GeoapifyService,
    ) {}

    @Get('search')
    @ApiOperation({ summary: 'Forward geocode (India), proxied from Nominatim for browser CORS' })
    async search(
        @Query('q') q?: string,
        @Query('postalcode') postalcode?: string,
        @Query('limit', new DefaultValuePipe(12), ParseIntPipe) limit?: number,
    ) {
        const pc = postalcode?.replace(/\D/g, '').slice(0, 6) ?? '';
        if (pc.length === 6) {
            return this.geocodeService.searchIndiaByPostalCode(pc, limit ?? 12);
        }
        return this.geocodeService.searchIndia(q ?? '', limit ?? 12);
    }

    @Get('reverse')
    @ApiOperation({ summary: 'Reverse geocode, proxied from Nominatim' })
    async reverse(
        @Query('lat', ParseFloatPipe) lat: number,
        @Query('lon', ParseFloatPipe) lon: number,
    ) {
        return this.geocodeService.reverse(lat, lon);
    }

    @Post('driving-distance')
    @HttpCode(200)
    @ApiOperation({
        summary: 'Road distance (km) from nearest warehouse to destination via Mapbox Matrix',
    })
    async drivingDistance(@Body() body: DrivingDistanceDto) {
        const km = await this.geoapifyService.minDrivingDistanceKm(body.sources, body.destination);
        return { distanceKm: km };
    }
}
