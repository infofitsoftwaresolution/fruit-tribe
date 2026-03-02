import { IsString, IsNumber, Min, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateRazorpayOrderDto {
    @ApiProperty({ description: 'Amount in paise (e.g. 50000 = ₹500)' })
    @IsNumber()
    @Min(100)
    amountInPaise: number;

    @ApiProperty({ required: false, default: 'INR' })
    @IsOptional()
    @IsString()
    currency?: string;
}
