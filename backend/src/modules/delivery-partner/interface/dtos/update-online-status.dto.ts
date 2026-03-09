import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional } from 'class-validator';

export class UpdateOnlineStatusDto {
    @ApiProperty({ example: true })
    @IsBoolean()
    online: boolean;

    @ApiProperty({ example: 12.9716, required: false })
    @IsOptional()
    @IsNumber()
    lat?: number;

    @ApiProperty({ example: 77.5946, required: false })
    @IsOptional()
    @IsNumber()
    lng?: number;
}

