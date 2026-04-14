import { IsString, IsNumber, IsOptional, IsArray, Min, IsUUID, ValidateNested, IsObject, IsEmail } from 'class-validator';
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

export class CreateManualOrderDto {
    @ApiProperty()
    @IsString()
    customerName: string;

    @ApiProperty()
    @IsEmail()
    customerEmail: string;

    @ApiProperty()
    @IsString()
    customerPhone: string;

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
    @IsString()
    status?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    paymentStatus?: string;
}
