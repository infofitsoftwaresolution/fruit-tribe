import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsNumber, ValidateNested } from 'class-validator';

export class LatLngDto {
    @IsNumber()
    latitude!: number;

    @IsNumber()
    longitude!: number;
}

export class DrivingDistanceDto {
    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => LatLngDto)
    sources!: LatLngDto[];

    @ValidateNested()
    @Type(() => LatLngDto)
    destination!: LatLngDto;
}
