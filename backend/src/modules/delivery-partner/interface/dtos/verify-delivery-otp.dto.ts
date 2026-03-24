import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class VerifyDeliveryOtpDto {
    @ApiProperty({ example: '123456' })
    @IsString()
    @Matches(/^\d{6}$/, { message: 'OTP must be a 6-digit code' })
    otp!: string;
}

