import { IsString, IsNumber, IsOptional, IsBoolean, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWarehouseDto {
    @ApiPropertyOptional()
    @IsString()
    name: string;

    @ApiPropertyOptional()
    @IsString()
    address: string;

    @ApiPropertyOptional()
    @IsNumber()
    @Min(-90)
    @Max(90)
    latitude: number;

    @ApiPropertyOptional()
    @IsNumber()
    @Min(-180)
    @Max(180)
    longitude: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
