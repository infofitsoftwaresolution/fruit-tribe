import { IsOptional, IsString, IsNumber, IsIn, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ProductFilterDto {
    @ApiProperty({ required: false, default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    page?: number = 1;

    @ApiProperty({ required: false, default: 10 })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    @Min(1)
    limit?: number = 10;

    @ApiProperty({ required: false, description: 'Search term' })
    @IsOptional()
    @IsString()
    search?: string;

    @ApiProperty({ required: false, description: 'Filter by category UUID' })
    @IsOptional()
    @IsString()
    categoryId?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    minPrice?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @Type(() => Number)
    @IsNumber()
    maxPrice?: number;

    @ApiProperty({ required: false, enum: ['name', 'basePrice', 'createdAt'] })
    @IsOptional()
    @IsIn(['name', 'basePrice', 'createdAt'])
    sortBy?: string;

    @ApiProperty({ required: false, enum: ['asc', 'desc'] })
    @IsOptional()
    @IsIn(['asc', 'desc'])
    sortOrder?: 'asc' | 'desc';

    @ApiProperty({ required: false, description: 'If true, include products that are out of season' })
    @IsOptional()
    showOutOfSeason?: boolean;

    @ApiProperty({ required: false, description: 'If true, also include inactive/draft products (for admins)' })
    @IsOptional()
    includeInactive?: boolean;
}
