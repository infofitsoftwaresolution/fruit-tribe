import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WarehouseService } from '../application/warehouse.service';
import { JwtAuthGuard } from '../../auth/interface/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/interface/guards/roles.guard';
import { Roles } from '../../auth/interface/decorators/roles.decorator';
import { CreateWarehouseDto } from './dtos/create-warehouse.dto';

@ApiTags('Warehouses')
@Controller('warehouses')
export class WarehouseController {
    constructor(private readonly warehouseService: WarehouseService) {}

    @ApiOperation({ summary: 'List warehouses (for checkout distance/ETA). Optional auth.' })
    @Get()
    async list(@Query('activeOnly') activeOnly?: string) {
        return this.warehouseService.findAll(activeOnly !== 'false');
    }

    @ApiOperation({ summary: 'Create warehouse (admin)' })
    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    async create(@Body() dto: CreateWarehouseDto) {
        return this.warehouseService.create({
            name: dto.name,
            address: dto.address,
            latitude: dto.latitude,
            longitude: dto.longitude,
            isActive: dto.isActive,
        });
    }

    @ApiOperation({ summary: 'Update warehouse (admin)' })
    @Put(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<CreateWarehouseDto>) {
        return this.warehouseService.update(id, dto as any);
    }

    @ApiOperation({ summary: 'Delete warehouse (admin)' })
    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    @ApiBearerAuth()
    async remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.warehouseService.remove(id);
    }
}
