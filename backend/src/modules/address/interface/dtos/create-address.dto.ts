import { IsString, IsOptional, IsBoolean, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateAddressDto {
    @ApiProperty({ required: false, example: 'Home' })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    label?: string;

    @ApiProperty({ example: 'Priya Sharma' })
    @IsString()
    @MinLength(2)
    @MaxLength(200)
    name: string;

    @ApiProperty({ example: '9876543210' })
    @IsString()
    @MinLength(10)
    @MaxLength(20)
    phone: string;

    @ApiProperty({ example: '12 MG Road' })
    @IsString()
    @MinLength(3)
    @MaxLength(500)
    addressLine1: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    addressLine2?: string;

    @ApiProperty({ example: 'Bengaluru' })
    @IsString()
    @MinLength(2)
    @MaxLength(120)
    city: string;

    @ApiProperty({ example: 'Karnataka' })
    @IsString()
    @MinLength(2)
    @MaxLength(120)
    state: string;

    @ApiProperty({ example: '560001' })
    @IsString()
    @Matches(/^\d{6}$/, { message: 'pincode must be 6 digits' })
    pincode: string;

    @ApiProperty({ required: false, default: false })
    @IsOptional()
    @IsBoolean()
    isDefault?: boolean;
}
