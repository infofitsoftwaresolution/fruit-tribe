import { Controller, Get, Param, ParseUUIDPipe, Post, Body, UseGuards, Request, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { DeliveryPartnerService } from '../application/delivery-partner.service';
import { JwtAuthGuard } from '../../auth/interface/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/interface/guards/roles.guard';
import { Roles } from '../../auth/interface/decorators/roles.decorator';
import { UpdateDeliveryStatusDto } from './dtos/update-delivery-status.dto';
import { UpdateOnlineStatusDto } from './dtos/update-online-status.dto';
import { UpdateLocationDto } from './dtos/update-location.dto';
import { VerifyDeliveryOtpDto } from './dtos/verify-delivery-otp.dto';

@ApiTags('Delivery App')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('DELIVERY_PARTNER')
@Controller('delivery')
export class DeliveryAppController {
    constructor(private readonly deliveryPartnerService: DeliveryPartnerService) {}

    @ApiOperation({ summary: 'Get dashboard metrics for the logged-in delivery partner' })
    @Get('dashboard')
    async dashboard(@Request() req: any) {
        return this.deliveryPartnerService.getDashboardForUser(req.user.id);
    }

    @ApiOperation({ summary: 'List active delivery assignments for the logged-in partner' })
    @Get('assignments')
    async assignments(@Request() req: any) {
        return this.deliveryPartnerService.getAssignmentsForUser(req.user.id);
    }

    @ApiOperation({ summary: 'Get a specific delivery assignment by ID' })
    @Get('assignments/:id')
    async assignmentDetail(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
        return this.deliveryPartnerService.getAssignmentDetailForUser(id, req.user.id);
    }

    @ApiOperation({ summary: 'Update status of a delivery assignment (e.g. OUT_FOR_DELIVERY, DELIVERED)' })
    @Post('assignments/:id/status')
    async updateStatus(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateDeliveryStatusDto,
        @Request() req: any,
    ) {
        return this.deliveryPartnerService.updateAssignmentStatusForUser(id, req.user.id, dto);
    }

    @ApiOperation({ summary: 'Generate customer OTP for delivery handover' })
    @Post('assignments/:id/generate-otp')
    async generateOtp(@Param('id', ParseUUIDPipe) id: string, @Request() req: any) {
        return this.deliveryPartnerService.generateDeliveryOtpForUser(id, req.user.id);
    }

    @ApiOperation({ summary: 'Verify customer OTP and mark assignment delivered' })
    @Post('assignments/:id/verify-otp')
    async verifyOtp(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: VerifyDeliveryOtpDto,
        @Request() req: any,
    ) {
        return this.deliveryPartnerService.verifyDeliveryOtpForUser(id, req.user.id, dto.otp);
    }

    @ApiOperation({ summary: 'Get earnings summary for the logged-in delivery partner' })
    @Get('earnings/summary')
    async earningsSummary(@Request() req: any) {
        return this.deliveryPartnerService.getEarningsSummaryForUser(req.user.id);
    }

    @ApiOperation({ summary: 'Get COD collection summary for the logged-in delivery partner' })
    @Get('cod/summary')
    async codSummary(@Request() req: any) {
        return this.deliveryPartnerService.getCodSummaryForUser(req.user.id);
    }

    @ApiOperation({ summary: 'Set online/offline status for the logged-in delivery partner' })
    @Patch('status')
    async setOnlineStatus(@Body() dto: UpdateOnlineStatusDto, @Request() req: any) {
        const updated = await this.deliveryPartnerService.setOnlineStatusForUser(
            req.user.id,
            dto.online,
            dto.lat,
            dto.lng,
        );
        return { onlineStatus: updated.onlineStatus };
    }

    @ApiOperation({ summary: 'Update current GPS location for the logged-in delivery partner' })
    @Post('location')
    async updateLocation(@Body() dto: UpdateLocationDto, @Request() req: any) {
        await this.deliveryPartnerService.updateLocationForUser(req.user.id, dto.lat, dto.lng);
        return { ok: true };
    }
}

