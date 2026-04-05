import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail()
    email: string;

    @ApiProperty({
        example: '9876543210',
        description: 'Indian mobile number (10 digits, or with +91 / leading 0). Stored normalized for login.',
    })
    @IsString()
    @MinLength(10)
    @MaxLength(20)
    phone: string;

    @ApiProperty({ example: 'SecureP@ss1' })
    @IsString()
    @MinLength(8)
    password: string;

    @ApiProperty({ example: 'Jane', required: false })
    @IsOptional()
    @IsString()
    firstName?: string;

    @ApiProperty({ example: 'Doe', required: false })
    @IsOptional()
    @IsString()
    lastName?: string;
}

export class LoginDto {
    @ApiProperty({
        example: 'user@example.com',
        description: 'Account email or registered phone number (with or without country code).',
    })
    @IsString()
    @MinLength(3)
    @MaxLength(200)
    email: string;

    @ApiProperty({ example: 'SecureP@ss1' })
    @IsString()
    password: string;
}

export class RefreshTokenDto {
    @ApiProperty()
    @IsString()
    refreshToken: string;
}

export class VerifyEmailDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: '123456' })
    @IsString()
    @MinLength(4)
    code: string;
}

export class ResendEmailDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail()
    email: string;
}

export class ForgotPasswordDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail()
    email: string;
}

export class ResetPasswordDto {
    @ApiProperty({ example: 'user@example.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ example: '123456' })
    @IsString()
    @MinLength(4)
    code: string;

    @ApiProperty({ example: 'NewSecureP@ss1' })
    @IsString()
    @MinLength(8)
    newPassword: string;
}

export class ChangePasswordDto {
    @ApiProperty({ example: 'OldSecureP@ss1' })
    @IsString()
    @MinLength(8)
    currentPassword: string;

    @ApiProperty({ example: 'NewSecureP@ss1' })
    @IsString()
    @MinLength(8)
    newPassword: string;
}
