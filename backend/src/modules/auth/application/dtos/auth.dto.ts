import { IsEmail, IsString, MinLength, MaxLength, IsOptional, IsIn, IsBoolean, Matches } from 'class-validator';
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
    @ApiProperty({
        example: '9876543210',
        description: 'Registered email or Indian mobile number used during signup.',
    })
    @IsString()
    @MinLength(6)
    @MaxLength(200)
    email: string;

    @ApiProperty({ example: '123456' })
    @IsString()
    @MinLength(4)
    code: string;
}

export class ResendEmailDto {
    @ApiProperty({
        example: '9876543210',
        description: 'Registered email or Indian mobile number used during signup.',
    })
    @IsString()
    @MinLength(6)
    @MaxLength(200)
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

export class UpdateProfileDto {
    @ApiProperty({ example: 'Jane', required: false })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    firstName?: string;

    @ApiProperty({ example: 'Doe', required: false })
    @IsOptional()
    @IsString()
    @MaxLength(100)
    lastName?: string;

    @ApiProperty({
        example: '9876543210',
        description: 'Indian mobile number (10 digits, or with +91 / leading 0).',
        required: false,
    })
    @IsOptional()
    @IsString()
    @MinLength(10)
    @MaxLength(20)
    phone?: string;

    @ApiProperty({ example: 'Sarjapur, Bangalore', required: false })
    @IsOptional()
    @IsString()
    @MaxLength(500)
    address?: string;
}

export class BulkCustomerAnnouncementDto {
    @ApiProperty({ example: 'Stock clearance sale — this weekend only' })
    @IsString()
    @MinLength(3)
    @MaxLength(200)
    title: string;

    @ApiProperty({
        example: 'Fresh fruit at reduced prices while stocks last. Shop now on The Fruit Tribe.',
    })
    @IsString()
    @MinLength(10)
    @MaxLength(5000)
    message: string;

    @ApiProperty({
        enum: ['all', 'verified', 'with_orders'],
        description: 'all: every customer account; verified: active (verified) only; with_orders: at least one order',
    })
    @IsIn(['all', 'verified', 'with_orders'])
    audience: 'all' | 'verified' | 'with_orders';

    @ApiProperty({
        required: false,
        description: 'Also send as email (SMTP must be configured; capped per request)',
    })
    @IsOptional()
    @IsBoolean()
    sendEmail?: boolean;
}

export class SendWhatsappOtpDto {
    @ApiProperty({
        example: '9876543210',
        description: 'Indian mobile number (10 digits, or with +91 prefix). OTP will be sent via WhatsApp.',
    })
    @IsString()
    @MinLength(10)
    @MaxLength(15)
    phone: string;
}

export class VerifyWhatsappOtpDto {
    @ApiProperty({
        example: '9876543210',
        description: 'Indian mobile number used in the send-otp step.',
    })
    @IsString()
    @MinLength(10)
    @MaxLength(15)
    phone: string;

    @ApiProperty({ example: '123456', description: '6-digit OTP sent via WhatsApp.' })
    @IsString()
    @MinLength(6)
    @MaxLength(6)
    @Matches(/^\d{6}$/, { message: 'OTP must be exactly 6 digits.' })
    otp: string;
}

export class FirebaseLoginDto {
    @ApiProperty({ description: 'Firebase ID token from the client after Google sign-in.' })
    @IsString()
    @MinLength(20)
    idToken: string;
}
