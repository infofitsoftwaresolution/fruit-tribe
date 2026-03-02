import { IsString, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDeliveryPartnerDto {
    @ApiPropertyOptional()
    @IsString()
    name: string;

    @ApiPropertyOptional()
    @IsString()
    phone: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    vehicle?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    status?: string;
}
