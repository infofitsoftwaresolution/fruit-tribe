import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CategoryService } from '../application/category.service';
import { CreateCategoryDto } from './dtos/create-category.dto';
import { Roles } from '../../auth/interface/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/interface/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/interface/guards/roles.guard';

@ApiTags('Categories')
@Controller('categories')
export class CategoryController {
    constructor(private readonly categoryService: CategoryService) {}

    @ApiOperation({ summary: 'List all categories' })
    @Get()
    async findAll() {
        return this.categoryService.findAll();
    }

    @ApiOperation({ summary: 'Create a new category (admin only)' })
    @Roles('ADMIN')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Post()
    async create(@Body() dto: CreateCategoryDto) {
        return this.categoryService.create(dto);
    }
}
