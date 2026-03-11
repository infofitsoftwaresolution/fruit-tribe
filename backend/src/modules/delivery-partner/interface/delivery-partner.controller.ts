import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DeliveryPartnerService } from '../application/delivery-partner.service';
import { JwtAuthGuard } from '../../auth/interface/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/interface/guards/roles.guard';
import { Roles } from '../../auth/interface/decorators/roles.decorator';
import { CreateDeliveryPartnerDto } from './dtos/create-delivery-partner.dto';

@ApiTags('Delivery Partners')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('delivery-partners')
export class DeliveryPartnerController {
    constructor(private readonly deliveryPartnerService: DeliveryPartnerService) {}

    @ApiOperation({ summary: 'List delivery partners (in-house staff)' })
    @Get()
    async list() {
        return this.deliveryPartnerService.findAll();
    }

    @ApiOperation({ summary: 'Add delivery partner' })
    @Post()
    async create(@Body() dto: CreateDeliveryPartnerDto) {
        return this.deliveryPartnerService.create(dto);
    }

    @ApiOperation({ summary: 'Update delivery partner' })
    @Put(':id')
    async update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<CreateDeliveryPartnerDto>) {
        return this.deliveryPartnerService.update(id, dto as any);
    }

    @ApiOperation({ summary: 'Remove delivery partner' })
    @Delete(':id')
    async remove(@Param('id', ParseUUIDPipe) id: string) {
        return this.deliveryPartnerService.remove(id);
    }

  @ApiOperation({ summary: 'Assign an order to a delivery partner (admin)' })
  @Post('assign')
  async assignOrder(
      @Body('orderId', new ParseUUIDPipe()) orderId: string,
      @Body('partnerId', new ParseUUIDPipe()) partnerId: string,
  ) {
      return this.deliveryPartnerService.assignOrderToPartner(orderId, partnerId);
  }
}
