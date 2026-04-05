import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    UseGuards,
    Request,
    ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/interface/guards/jwt-auth.guard';
import { AddressService } from '../application/address.service';
import { CreateAddressDto } from './dtos/create-address.dto';
import { UpdateAddressDto } from './dtos/update-address.dto';

@ApiTags('Addresses')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('addresses')
export class AddressController {
    constructor(private readonly addressService: AddressService) {}

    @ApiOperation({ summary: 'List my saved delivery addresses' })
    @Get()
    list(@Request() req: { user: { id: string } }) {
        return this.addressService.findAllForUser(req.user.id);
    }

    @ApiOperation({ summary: 'Save a new delivery address' })
    @Post()
    create(@Request() req: { user: { id: string } }, @Body() dto: CreateAddressDto) {
        return this.addressService.create(req.user.id, dto);
    }

    @ApiOperation({ summary: 'Mark an address as default (must be before generic :id patch)' })
    @Patch(':id/default')
    setDefault(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { id: string } }) {
        return this.addressService.setDefault(req.user.id, id);
    }

    @ApiOperation({ summary: 'Update a saved address' })
    @Patch(':id')
    update(
        @Param('id', ParseUUIDPipe) id: string,
        @Request() req: { user: { id: string } },
        @Body() dto: UpdateAddressDto,
    ) {
        return this.addressService.update(req.user.id, id, dto);
    }

    @ApiOperation({ summary: 'Delete a saved address' })
    @Delete(':id')
    remove(@Param('id', ParseUUIDPipe) id: string, @Request() req: { user: { id: string } }) {
        return this.addressService.remove(req.user.id, id);
    }
}
