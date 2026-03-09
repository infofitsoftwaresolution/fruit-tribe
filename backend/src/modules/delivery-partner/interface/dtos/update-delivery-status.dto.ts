import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber } from 'class-validator';

export class UpdateDeliveryStatusDto {
    @ApiProperty({ example: 'OUT_FOR_DELIVERY' })
    @IsString()
    status: string;

    @ApiProperty({ example: 'Customer not available', required: false })
    @IsOptional()
    @IsString()
    reason?: string;

    @ApiProperty({ example: 12.9716, required: false })
    @IsOptional()
    @IsNumber()
    lat?: number;

    @ApiProperty({ example: 77.5946, required: false })
    @IsOptional()
    @IsNumber()
    lng?: number;
}

