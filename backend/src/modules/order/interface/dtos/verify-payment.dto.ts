import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyPaymentDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    razorpayOrderId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    razorpayPaymentId: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    signature: string;
}
