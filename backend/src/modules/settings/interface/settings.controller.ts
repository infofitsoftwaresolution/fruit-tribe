import { Controller, Get, Put, Delete, Body, UseGuards, Query, Param } from '@nestjs/common';
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

    @ApiOperation({ summary: 'Get serviceable cities and optional pincodes (where we deliver)' })
    @Get('serviceable-areas')
    async getServiceableAreas() {
        const [cities, pincodes] = await Promise.all([
            this.settingsService.getServiceableCities(),
            this.settingsService.getServiceablePincodes(),
        ]);
        return { cities, pincodes };
    }

    @ApiOperation({ summary: 'Update serviceable cities and/or pincodes (admin only)' })
    @ApiBearerAuth()
    @Put('serviceable-areas')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    async updateServiceableAreas(@Body() body: { cities?: string[]; pincodes?: string[] }) {
        if (body.cities !== undefined) {
            await this.settingsService.setServiceableCities(body.cities);
        }
        if (body.pincodes !== undefined) {
            await this.settingsService.setServiceablePincodes(body.pincodes);
        }
        const cities = await this.settingsService.getServiceableCities();
        const pincodes = await this.settingsService.getServiceablePincodes();
        return { cities, pincodes, message: 'Service areas updated.' };
    }

    @ApiOperation({ summary: 'Get store settings (theme, preferences, delivery charge, distance fee rules) for storefront' })
    @Get('store')
    async getStoreSettings() {
        return this.settingsService.getStoreSettings();
    }

    @ApiOperation({ summary: 'Update store settings (theme, preferences, delivery charge, distance fee rules) — admin only' })
    @ApiBearerAuth()
    @Put('store')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    async updateStoreSettings(@Body() body: {
        theme?: Record<string, unknown>;
        preferences?: Record<string, unknown>;
        deliveryCharge?: number;
        deliveryFeeRules?: Array<{ upToKm: number; fee: number }>;
    }) {
        await this.settingsService.setStoreSettings(body);
        const store = await this.settingsService.getStoreSettings();
        return { ...store, message: 'Store settings saved.' };
    }

    @ApiOperation({ summary: 'Validate a promo/coupon code (public)' })
    @Get('validate-coupon')
    async validateCoupon(
        @Query('code') code: string,
        @Query('productId') productId?: string,
        @Query('categoryName') categoryName?: string,
        @Query('cartProductIds') cartProductIds?: string,
        @Query('cartCategoryNames') cartCategoryNames?: string,
    ) {
        const productIds = (cartProductIds ?? '')
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean);
        const categoryNames = (cartCategoryNames ?? '')
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean);
        return this.settingsService.validateCouponWithContext(code ?? '', {
            productId: productId ?? undefined,
            categoryName: categoryName ?? undefined,
            cartProductIds: productIds,
            cartCategoryNames: categoryNames,
        });
    }

    @ApiOperation({ summary: 'List currently available promo offers (public)' })
    @Get('offers')
    async getAvailableOffers(
        @Query('productId') productId?: string,
        @Query('categoryName') categoryName?: string,
        @Query('cartProductIds') cartProductIds?: string,
        @Query('cartCategoryNames') cartCategoryNames?: string,
    ) {
        const productIds = (cartProductIds ?? '')
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean);
        const categoryNames = (cartCategoryNames ?? '')
            .split(',')
            .map((v) => v.trim())
            .filter(Boolean);
        return {
            offers: await this.settingsService.getAvailableCouponOffers({
                productId: productId ?? undefined,
                categoryName: categoryName ?? undefined,
                cartProductIds: productIds,
                cartCategoryNames: categoryNames,
            }),
        };
    }

    @ApiOperation({ summary: 'Get coupon scope rules (admin only)' })
    @ApiBearerAuth()
    @Get('coupon-scopes')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    async getCouponScopes() {
        return { scopes: await this.settingsService.getCouponScopes() };
    }

    @ApiOperation({ summary: 'Update coupon scope rules (admin only)' })
    @ApiBearerAuth()
    @Put('coupon-scopes')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    async updateCouponScopes(
        @Body() body: {
            scopes: Array<{
                code: string;
                scopeType: 'ALL' | 'CATEGORY' | 'PRODUCT';
                categoryNames?: string[];
                productIds?: string[];
            }>;
        },
    ) {
        await this.settingsService.setCouponScopes(body?.scopes ?? []);
        return { scopes: await this.settingsService.getCouponScopes(), message: 'Coupon scopes saved.' };
    }

    @ApiOperation({ summary: 'List coupons (admin only)' })
    @ApiBearerAuth()
    @Get('coupons')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    async listCoupons() {
        return { coupons: await this.settingsService.listAdminCoupons() };
    }

    @ApiOperation({ summary: 'Create coupon (admin only)' })
    @ApiBearerAuth()
    @Put('coupons/create')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    async createCoupon(
        @Body()
        body: {
            code: string;
            discountType: 'PERCENTAGE' | 'FIXED';
            discountValue: number;
            minOrderValue?: number | null;
            maxDiscount?: number | null;
            expiryDate?: string | null;
            usageLimit?: number | null;
            isActive?: boolean;
        },
    ) {
        const coupon = await this.settingsService.createAdminCoupon(body);
        return { coupon, message: 'Coupon created.' };
    }

    @ApiOperation({ summary: 'Update coupon (admin only)' })
    @ApiBearerAuth()
    @Put('coupons/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    async updateCoupon(
        @Body()
        body: {
            code?: string;
            discountType?: 'PERCENTAGE' | 'FIXED';
            discountValue?: number;
            minOrderValue?: number | null;
            maxDiscount?: number | null;
            expiryDate?: string | null;
            usageLimit?: number | null;
            isActive?: boolean;
        },
        @Param('id') id: string,
    ) {
        const coupon = await this.settingsService.updateAdminCoupon(id, body);
        return { coupon, message: 'Coupon updated.' };
    }

    @ApiOperation({ summary: 'Delete coupon (admin only)' })
    @ApiBearerAuth()
    @Delete('coupons/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    async deleteCoupon(@Param('id') id: string) {
        await this.settingsService.deleteAdminCoupon(id);
        return { message: 'Coupon deleted.' };
    }
}
