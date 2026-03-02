import { IsString, IsOptional, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePaymentSettingsDto {
    @ApiPropertyOptional({ description: 'Razorpay Key ID (public)' })
    @IsOptional()
    @IsString()
    @MinLength(1, { message: 'Key ID cannot be empty' })
    razorpayKeyId?: string;

    @ApiPropertyOptional({ description: 'Razorpay Key Secret (private)' })
    @IsOptional()
    @IsString()
    @MinLength(1, { message: 'Key Secret cannot be empty' })
    razorpayKeySecret?: string;
}
