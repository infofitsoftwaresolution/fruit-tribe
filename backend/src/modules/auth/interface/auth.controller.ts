import {
    Controller,
    Post,
    Get,
    Body,
    UseGuards,
    Request,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from '../application/auth.service';
import { RegisterDto, LoginDto, VerifyEmailDto, ResendEmailDto, ForgotPasswordDto, ResetPasswordDto, ChangePasswordDto } from '../application/dtos/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @ApiOperation({ summary: 'Register a new user' })
    @Post('register')
    async register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @ApiOperation({ summary: 'Login with email and password' })
    @HttpCode(HttpStatus.OK)
    @Post('login')
    async login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @ApiOperation({ summary: 'Verify email with OTP code' })
    @Post('verify-email')
    async verifyEmail(@Body() dto: VerifyEmailDto) {
        return this.authService.verifyEmail(dto);
    }

    @ApiOperation({ summary: 'Resend email verification code' })
    @Post('resend-email-code')
    async resendEmail(@Body() dto: ResendEmailDto) {
        return this.authService.resendEmail(dto);
    }

    @ApiOperation({ summary: 'Request password reset code' })
    @Post('forgot-password')
    async forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.authService.forgotPassword(dto);
    }

    @ApiOperation({ summary: 'Reset password using email + code' })
    @Post('reset-password')
    async resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto);
    }

    @ApiBearerAuth()
    @ApiOperation({ summary: 'Change password for logged-in user (force after first login if required)' })
    @UseGuards(JwtAuthGuard)
    @Post('change-password')
    async changePassword(@Request() req: any, @Body() dto: ChangePasswordDto) {
        return this.authService.changePassword(req.user.id, dto);
    }

    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user profile' })
    @UseGuards(JwtAuthGuard)
    @Get('me')
    async getProfile(@Request() req: any) {
        return this.authService.getProfile(req.user.id);
    }

    @ApiBearerAuth()
    @ApiOperation({ summary: 'List customers (Admin only)' })
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    @Get('users')
    async getUsers() {
        return this.authService.getCustomersForAdmin();
    }
}
