import {
    IsString,
    IsNumber,
    IsOptional,
    IsArray,
    Min,
    Max,
    IsObject,
    IsIn,
    IsUUID,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateSubscriptionOrderDto {
    @ApiProperty({ example: 'Premium Tribe' })
    @IsString()
    planId: string;

    @ApiProperty({ example: 'Premium Tribe' })
    @IsString()
    planName: string;

    @ApiProperty({ example: 1499, description: 'Amount in INR (first billing cycle)' })
    @IsNumber()
    @Min(1)
    @Max(500000)
    price: number;

    @ApiProperty({ enum: ['Weekly', 'Bi-weekly', 'Monthly'] })
    @IsIn(['Weekly', 'Bi-weekly', 'Monthly'])
    frequency: string;

    @ApiProperty({ type: [String], description: 'Selected fruit names for the box' })
    @IsArray()
    @IsString({ each: true })
    fruitSelection: string[];

    @ApiProperty({ example: 'Monday' })
    @IsString()
    deliveryDay: string;

    @ApiProperty({ description: 'Delivery / contact address (same shape as product checkout)' })
    @IsObject()
    shippingAddress: Record<string, any>;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    idempotencyKey?: string;

    @ApiProperty({ required: false, description: 'Optional saved UserAddress id (must belong to you)' })
    @IsOptional()
    @IsUUID()
    savedAddressId?: string;
}
