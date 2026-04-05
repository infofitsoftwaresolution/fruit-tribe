import { IsString, IsOptional, IsBoolean, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAddressDto {
    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(80)
    label?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(200)
    name?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MinLength(10)
    @MaxLength(20)
    phone?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MinLength(3)
    @MaxLength(500)
    addressLine1?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    addressLine2?: string | null;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(120)
    city?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @MinLength(2)
    @MaxLength(120)
    state?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsString()
    @Matches(/^\d{6}$/, { message: 'pincode must be 6 digits' })
    pincode?: string;

    @ApiProperty({ required: false })
    @IsOptional()
    @IsBoolean()
    isDefault?: boolean;
}
