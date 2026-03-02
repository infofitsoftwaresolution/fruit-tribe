import { Controller, Get, Put, Body, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SettingsService } from '../application/settings.service';
import { UpdatePaymentSettingsDto } from './dtos/update-payment-settings.dto';
import { JwtAuthGuard } from '../../auth/interface/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/interface/guards/roles.guard';
import { Roles } from '../../auth/interface/decorators/roles.decorator';

@ApiTags('Settings')
@Controller('settings')
export class SettingsController {
    constructor(private readonly settingsService: SettingsService) {}

    @ApiOperation({ summary: 'Get payment settings (Key ID only, for checkout)' })
    @Get('payment')
    async getPaymentSettings() {
        const keyId = await this.settingsService.getRazorpayKeyId();
        return { razorpayKeyId: keyId ?? null };
    }

    @ApiOperation({ summary: 'Update Razorpay credentials (admin only)' })
    @ApiBearerAuth()
    @Put('payment')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    async updatePaymentSettings(@Body() dto: UpdatePaymentSettingsDto) {
        if (dto.razorpayKeyId != null) {
            await this.settingsService.set('razorpay_key_id', dto.razorpayKeyId);
        }
        if (dto.razorpayKeySecret != null) {
            await this.settingsService.set('razorpay_key_secret', dto.razorpayKeySecret);
        }
        const keyId = await this.settingsService.getRazorpayKeyId();
        return { razorpayKeyId: keyId ?? null, message: 'Razorpay credentials updated. All new payments will use this account.' };
    }

    @ApiOperation({ summary: 'Get serviceable cities (where we deliver)' })
    @Get('serviceable-areas')
    async getServiceableAreas() {
        const cities = await this.settingsService.getServiceableCities();
        return { cities };
    }

    @ApiOperation({ summary: 'Update serviceable cities (admin only)' })
    @ApiBearerAuth()
    @Put('serviceable-areas')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    async updateServiceableAreas(@Body() body: { cities: string[] }) {
        await this.settingsService.setServiceableCities(body.cities ?? []);
        const cities = await this.settingsService.getServiceableCities();
        return { cities, message: 'Service areas updated.' };
    }

    @ApiOperation({ summary: 'Get store settings (theme, preferences, delivery charge) for storefront' })
    @Get('store')
    async getStoreSettings() {
        return this.settingsService.getStoreSettings();
    }

    @ApiOperation({ summary: 'Update store settings (theme, preferences, delivery charge) — admin only' })
    @ApiBearerAuth()
    @Put('store')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    async updateStoreSettings(@Body() body: { theme?: Record<string, unknown>; preferences?: Record<string, unknown>; deliveryCharge?: number }) {
        await this.settingsService.setStoreSettings(body);
        const store = await this.settingsService.getStoreSettings();
        return { ...store, message: 'Store settings saved.' };
    }

    @ApiOperation({ summary: 'Validate a promo/coupon code (public)' })
    @Get('validate-coupon')
    async validateCoupon(@Query('code') code: string) {
        return this.settingsService.validateCoupon(code ?? '');
    }
}
