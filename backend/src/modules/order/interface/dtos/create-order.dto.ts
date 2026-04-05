import { IsString, IsNumber, IsOptional, IsArray, Min, IsUUID, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

class OrderItemDto {
    @ApiProperty()
    @IsUUID()
    productId: string;

    @ApiProperty()
    @IsUUID()
    variantId: string;

    @ApiProperty()
    @IsUUID()
    sellerId: string;

    @ApiProperty()
    @IsNumber()
    @Min(1)
    quantity: number;

    @ApiProperty()
    @IsNumber()
    @Min(0)
    pricePerUnit: number;
}

export class CreateOrderDto {
    @ApiProperty({ type: [OrderItemDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => OrderItemDto)
    items: OrderItemDto[];

    @ApiProperty()
    @IsObject()
    shippingAddress: Record<string, any>;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsObject()
    billingAddress?: Record<string, any>;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    couponCode?: string;

  @ApiProperty({ required: false, description: 'Chosen delivery slot label for this order' })
  @IsOptional()
  @IsString()
  deliverySlot?: string;

    @ApiProperty({ required: false, description: 'Approx delivery distance in km from checkout' })
    @IsOptional()
    @IsNumber()
    @Min(0)
    distanceKm?: number;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    idempotencyKey?: string;

    @ApiProperty({ required: false, enum: ['online', 'cod'] })
    @IsOptional()
    @IsString()
    paymentMethod?: string;

    @ApiProperty({ required: false, description: 'Optional saved UserAddress id (must belong to you)' })
    @IsOptional()
    @IsUUID()
    savedAddressId?: string;
}
