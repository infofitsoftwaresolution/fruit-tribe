import {
    Controller,
    Get,
    Post,
    Patch,
    Param,
    Body,
    UseGuards,
    Request,
    ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SellerService } from '../application/seller.service';
import { JwtAuthGuard } from '../../auth/interface/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/interface/guards/roles.guard';
import { Roles } from '../../auth/interface/decorators/roles.decorator';

import { ApplySellerDto } from './dtos/apply-seller.dto';

@ApiTags('Sellers')
@Controller('sellers')
export class SellerController {
    constructor(private readonly sellerService: SellerService) { }

    @ApiOperation({ summary: 'List all sellers (Admin only)' })
    @ApiBearerAuth()
    @Get()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    async findAll(@Request() req: any) {
        return this.sellerService.findAll();
    }

    @ApiOperation({ summary: 'Apply to become a seller' })
    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Post('apply')
    async apply(@Request() req: any, @Body() applySellerDto: ApplySellerDto) {
        return this.sellerService.apply(req.user.id, applySellerDto);
    }

    @ApiOperation({ summary: 'Approve a seller application (Admin only)' })
    @Roles('ADMIN')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Patch(':id/approve')
    async approve(
        @Param('id', ParseUUIDPipe) sellerId: string,
        @Request() req: any,
    ) {
        return this.sellerService.approve(sellerId, req.user.id);
    }

    @ApiOperation({ summary: 'Suspend a seller (Admin only)' })
    @Roles('ADMIN')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Patch(':id/suspend')
    async suspend(
        @Param('id', ParseUUIDPipe) sellerId: string,
        @Request() req: any,
    ) {
        return this.sellerService.suspend(sellerId, req.user.id);
    }

    @ApiOperation({ summary: 'Reactivate a suspended seller (Admin only)' })
    @Roles('ADMIN')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Patch(':id/reactivate')
    async reactivate(
        @Param('id', ParseUUIDPipe) sellerId: string,
        @Request() req: any,
    ) {
        return this.sellerService.reactivate(sellerId, req.user.id);
    }
}
