import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ContactFormDto {
    @ApiProperty({ example: 'Jane Doe' })
    @IsString()
    @MinLength(2)
    @MaxLength(120)
    name: string;

    @ApiProperty({ example: 'jane@example.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'Bulk order inquiry' })
    @IsString()
    @MinLength(2)
    @MaxLength(200)
    subject: string;

    @ApiProperty({ example: 'I want to place a weekly office order.' })
    @IsString()
    @MinLength(5)
    @MaxLength(5000)
    message: string;
}

export class NewsletterSubscribeDto {
    @ApiProperty({ example: 'jane@example.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: 'footer', required: false })
    @IsOptional()
    @IsString()
    @MaxLength(50)
    source?: string;
}
