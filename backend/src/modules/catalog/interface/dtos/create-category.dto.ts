import { IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCategoryDto {
    @ApiProperty({ example: 'Exotic Fruits' })
    @IsString()
    name: string;

    @ApiProperty({ example: 'Premium imported and seasonal exotic fruits', required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ example: 'https://example.com/category-image.jpg', required: false })
    @IsOptional()
    @IsString()
    imageUrl?: string;
}
