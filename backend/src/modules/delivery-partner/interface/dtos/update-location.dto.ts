import { ApiProperty } from '@nestjs/swagger';
import { IsNumber } from 'class-validator';

export class UpdateLocationDto {
    @ApiProperty({ example: 12.9716 })
    @IsNumber()
    lat: number;

    @ApiProperty({ example: 77.5946 })
    @IsNumber()
    lng: number;
}

