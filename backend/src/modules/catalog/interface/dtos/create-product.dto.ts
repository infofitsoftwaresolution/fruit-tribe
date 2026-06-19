import { IsString, IsNumber, IsOptional, IsArray, ValidateNested, Min, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ProductVariantDto {
    @ApiProperty({ example: 'uuid-of-variant', required: false })
    @IsOptional()
    @IsString()
    id?: string;

    @ApiProperty({ example: 'APPLE-RED-1KG' })
    @IsString()
    sku: string;

    @ApiProperty({ example: 'Weight', required: false })
    @IsOptional()
    @IsString()
    attributeName?: string;

    @ApiProperty({ example: '1kg', required: false })
    @IsOptional()
    @IsString()
    attributeValue?: string;

    @ApiProperty({ example: 99.99, required: false })
    @IsOptional()
    @IsNumber()
    priceOverride?: number;

    @ApiProperty({ example: 100 })
    @IsNumber()
    @Min(0)
    stockQuantity: number;

    @ApiProperty({ example: 5, required: false })
    @IsOptional()
    @IsNumber()
    @Min(0)
    lowStockThreshold?: number;

    @ApiProperty({ example: false, required: false })
    @IsOptional()
    @IsBoolean()
    isBulkVariant?: boolean;
}

export class CreateProductDto {
    @ApiProperty({ example: 'Organic Red Apple' })
    @IsString()
    name: string;

    @ApiProperty({ example: 'Fresh organic red apples from Himachal Pradesh', required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ example: 79.99 })
    @IsNumber()
    @Min(0)
    basePrice: number;

    @ApiProperty({ example: 'uuid-of-seller' })
    @IsString()
    sellerId: string;

    @ApiProperty({ example: 'uuid-of-category' })
    @IsString()
    @IsOptional()
    categoryId: string;

    @ApiProperty({ example: '2024-05-01T00:00:00Z', required: false })
    @IsOptional()
    @IsString()
    harvestDate?: string;

    @ApiProperty({ example: '2024-05-15T00:00:00Z', required: false })
    @IsOptional()
    @IsString()
    expiryDate?: string;

    @ApiProperty({ example: true, required: false })
    @IsOptional()
    @IsBoolean()
    isSeasonal?: boolean;

    @ApiProperty({ example: false, required: false, description: 'Whether product is organically produced' })
    @IsOptional()
    @IsBoolean()
    isOrganic?: boolean;

    @ApiProperty({
        example: 1000,
        required: false,
        description: 'Total physical stock units for the product. The sum of variant stockQuantity cannot exceed this.',
    })
    @IsOptional()
    @IsNumber()
    @Min(0)
    stock?: number;

    @ApiProperty({ example: '2024-03-01T00:00:00Z', required: false })
    @IsOptional()
    @IsString()
    seasonalStart?: string;

    @ApiProperty({ example: '2024-06-30T00:00:00Z', required: false })
    @IsOptional()
    @IsString()
    seasonalEnd?: string;

    @ApiProperty({ example: 5, required: false })
    @IsOptional()
    @IsNumber()
    bulkDiscountQty?: number;

    @ApiProperty({ example: 450, required: false })
    @IsOptional()
    @IsNumber()
    bulkDiscountPrice?: number;

    @ApiProperty({ example: true, description: 'Allow Cash on Delivery for this product', required: false })
    @IsOptional()
    @IsBoolean()
    allowCashOnDelivery?: boolean;

    @ApiProperty({ example: 4, description: 'Freshness score 1–5 (5 = just harvested)', required: false })
    @IsOptional()
    @IsNumber()
    @Min(1)
    freshnessScore?: number;

    @ApiProperty({ example: 'Ripe & Ready', description: "Ripeness stage: Unripe | Ripening | Ripe & Ready | Peak Ripe | Over-ripe", required: false })
    @IsOptional()
    @IsString()
    ripenessStage?: string;

    @ApiProperty({ example: 'Fruit Tribe Farm', description: 'Farm or supplier name', required: false })
    @IsOptional()
    @IsString()
    farmName?: string;

    @ApiProperty({ example: 'Karnataka', description: 'State where the farm is located', required: false })
    @IsOptional()
    @IsString()
    farmState?: string;

    @ApiProperty({
        example: 'Order now for next day delivery',
        description: 'Delivery promise badge shown on product cards. Leave empty to use the store default.',
        required: false,
    })
    @IsOptional()
    @IsString()
    deliveryTag?: string;

    @ApiProperty({ type: [ProductVariantDto], required: false })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ProductVariantDto)
    variants?: ProductVariantDto[];

    @ApiProperty({
        type: 'array',
        items: { type: 'object', properties: { imageUrl: { type: 'string' }, isPrimary: { type: 'boolean' } } },
        required: false,
    })
    @IsOptional()
    @IsArray()
    images?: Array<{ imageUrl: string; isPrimary?: boolean }>;
}
