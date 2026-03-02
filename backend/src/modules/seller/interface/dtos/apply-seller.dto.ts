import { IsString, IsNotEmpty, IsOptional, IsJSON } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ApplySellerDto {
    @ApiProperty({ example: 'Alphonso Orchards' })
    @IsString()
    @IsNotEmpty()
    storeName: string;

    @ApiProperty({ example: 'Premium mango growers from the Konkan belt.' })
    @IsString()
    @IsOptional()
    description?: string;

    @ApiProperty({ example: '27AAAAA0000A1Z5' })
    @IsString()
    @IsOptional()
    gstNumber?: string;

    @ApiProperty({
        example: {
            bankName: 'HDFC Bank',
            accountNumber: '1234567890',
            ifscCode: 'HDFC0001234'
        }
    })
    @IsOptional()
    bankDetails?: any;

    @ApiProperty({
        example: {
            street: 'Main Road',
            city: 'Ratnagiri',
            state: 'Maharashtra',
            pincode: '415612'
        }
    })
    @IsOptional()
    address?: any;
}
