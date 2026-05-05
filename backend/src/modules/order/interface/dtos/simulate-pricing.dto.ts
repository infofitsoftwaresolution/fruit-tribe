import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNumber, IsObject, IsOptional, IsString, IsUUID, Min, ValidateNested } from 'class-validator';

class SimulatePricingItemDto {
  @ApiProperty()
  @IsUUID()
  productId: string;

  @ApiProperty()
  @IsUUID()
  variantId: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class SimulatePricingDto {
  @ApiProperty({ type: [SimulatePricingItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SimulatePricingItemDto)
  items: SimulatePricingItemDto[];

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiProperty({ required: false, description: 'Approx delivery distance in km' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceKm?: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsObject()
  shippingAddress?: Record<string, unknown>;
}

