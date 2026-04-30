import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    Query,
    UseGuards,
    ParseUUIDPipe,
    HttpStatus,
    Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ProductService } from '../application/product.service';
import { CreateProductDto } from './dtos/create-product.dto';
import { UpdateProductDto } from './dtos/update-product.dto';
import { ProductFilterDto } from './dtos/product-filter.dto';
import { JwtAuthGuard } from '../../auth/interface/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/interface/guards/roles.guard';
import { Roles } from '../../auth/interface/decorators/roles.decorator';

@ApiTags('Products')
@Controller('products')
export class ProductController {
    constructor(private readonly productService: ProductService) { }

    @ApiOperation({ summary: 'Get all products with filters and pagination' })
    @ApiResponse({ status: HttpStatus.OK, description: 'Return list of products' })
    @Get()
    async findAll(@Query() filters: ProductFilterDto) {
        return this.productService.findAll(filters);
    }

    @ApiOperation({ summary: 'Get product details by ID' })
    @Get(':id')
    async findOne(@Param('id', ParseUUIDPipe) id: string) {
        return this.productService.findOne(id);
    }

    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new product (Sellers only)' })
    @Roles('SELLER', 'ADMIN')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Post()
    async create(@Request() req: any, @Body() createProductDto: CreateProductDto) {
        return this.productService.create(createProductDto, req.user);
    }

    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update an existing product (Sellers/Admins only)' })
    @Roles('SELLER', 'ADMIN')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Patch(':id')
    async update(
        @Param('id', ParseUUIDPipe) id: string,
        @Request() req: any,
        @Body() updateProductDto: UpdateProductDto
    ) {
        return this.productService.update(id, updateProductDto, req.user);
    }

    @ApiBearerAuth()
    @ApiOperation({ summary: 'Adjust variant stock level' })
    @Roles('SELLER', 'ADMIN')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Patch('variants/:variantId/stock')
    async adjustStock(
        @Param('variantId', ParseUUIDPipe) variantId: string,
        @Request() req: any,
        @Body() body: { changeAmount: number, reason: string }
    ) {
        return this.productService.updateStock(variantId, body.changeAmount, body.reason, req.user);
    }

    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get products nearing expiry' })
    @Roles('SELLER', 'ADMIN')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Get('inventory/near-expiry')
    async findNearExpiry(@Query('days') days?: number) {
        return this.productService.getNearExpiryProducts(days);
    }

    @ApiBearerAuth()
    @ApiOperation({ summary: 'Remove a product (Soft Delete)' })
    @Roles('SELLER', 'ADMIN')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Delete(':id')
    async remove(
        @Param('id', ParseUUIDPipe) id: string,
        @Request() req: any,
        @Query('permanent') permanent?: string,
    ) {
        const shouldPermanentlyDelete = String(permanent || '').toLowerCase() === 'true';
        return this.productService.remove(id, req.user, { permanent: shouldPermanentlyDelete });
    }
}
