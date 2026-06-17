import {
    Controller,
    Post,
    Get,
    Patch,
    Body,
    UseGuards,
    Request,
    HttpCode,
    HttpStatus,
    Res,
    Query,
    Param,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from '../application/auth.service';
import {
    RegisterDto,
    LoginDto,
    VerifyEmailDto,
    ResendEmailDto,
    ForgotPasswordDto,
    ResetPasswordDto,
    ChangePasswordDto,
    BulkCustomerAnnouncementDto,
    SendWhatsappOtpDto,
    VerifyWhatsappOtpDto,
    UpdateProfileDto,
    FirebaseLoginDto,
} from '../application/dtos/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import type { Response } from 'express';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
        const isProduction = process.env.NODE_ENV === 'production';
        res.cookie('ft_access_token', accessToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 24 * 60 * 60 * 1000,
            path: '/',
        });
        res.cookie('ft_refresh_token', refreshToken, {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: '/',
        });
    }

    @ApiOperation({ summary: 'Register a new user' })
    @Post('register')
    async register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @ApiOperation({ summary: 'Login with email and password' })
    @HttpCode(HttpStatus.OK)
    @Post('login')
    async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
        const result = await this.authService.login(dto);
        this.setAuthCookies(res, result.accessToken, result.refreshToken);
        return result;
    }

    @ApiOperation({ summary: 'Verify account with OTP code (email or phone)' })
    @Post('verify-email')
    async verifyEmail(@Body() dto: VerifyEmailDto) {
        return this.authService.verifyEmail(dto);
    }

    @ApiOperation({ summary: 'Resend verification code (email or phone)' })
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
    @ApiOperation({ summary: 'Update current user profile' })
    @UseGuards(JwtAuthGuard)
    @Patch('profile')
    async updateProfile(@Request() req: any, @Body() dto: UpdateProfileDto) {
        return this.authService.updateProfile(req.user.id, dto);
    }

    @ApiBearerAuth()
    @ApiOperation({ summary: 'List customers (Admin only)' })
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    @Get('users')
    async getUsers() {
        return this.authService.getCustomersForAdmin();
    }

    @ApiBearerAuth()
    @ApiOperation({ summary: 'Activate / verify a customer account (Admin only)' })
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    @Patch('users/:id/activate')
    async activateCustomer(@Param('id') id: string) {
        return this.authService.activateCustomerForAdmin(id);
    }

    @ApiBearerAuth()
    @ApiOperation({ summary: 'Bulk in-app message to customers (admin); optional email batch' })
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('ADMIN')
    @HttpCode(HttpStatus.OK)
    @Post('users/bulk-announcement')
    async bulkCustomerAnnouncement(@Body() dto: BulkCustomerAnnouncementDto) {
        return this.authService.bulkCustomerAnnouncement(dto);
    }

    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get current user notifications (latest first)' })
    @UseGuards(JwtAuthGuard)
    @Get('notifications')
    async getMyNotifications(
        @Request() req: any,
        @Query('limit') limit?: string,
        @Query('unreadOnly') unreadOnly?: string,
    ) {
        return this.authService.getMyNotifications(
            req.user.id,
            limit ? Number(limit) : 20,
            String(unreadOnly).toLowerCase() === 'true',
        );
    }

    @ApiBearerAuth()
    @ApiOperation({ summary: 'Mark all current user notifications as read' })
    @UseGuards(JwtAuthGuard)
    @Patch('notifications/read-all')
    async markAllNotificationsRead(@Request() req: any) {
        return this.authService.markAllNotificationsRead(req.user.id);
    }

    @ApiOperation({ summary: 'Check if WhatsApp OTP login is enabled on the server' })
    @Get('whatsapp/status')
    async getWhatsappStatus() {
        return { enabled: this.authService.isWhatsappEnabled() };
    }

    @ApiOperation({ summary: 'Check if Google / Firebase sign-in is enabled on the server' })
    @Get('firebase/status')
    async getFirebaseStatus() {
        return { enabled: this.authService.isFirebaseEnabled() };
    }

    @ApiOperation({ summary: 'Sign in with a Firebase ID token (Google, etc.)' })
    @HttpCode(HttpStatus.OK)
    @Post('firebase')
    async loginWithFirebase(@Body() dto: FirebaseLoginDto, @Res({ passthrough: true }) res: Response) {
        const result = await this.authService.loginWithFirebase(dto);
        this.setAuthCookies(res, result.accessToken, result.refreshToken);
        return result;
    }

    // ─── WhatsApp OTP Login ──────────────────────────────────────────────────

    @ApiOperation({
        summary: 'Step 1 – Send a 6-digit OTP to the given phone number via WhatsApp',
    })
    @HttpCode(HttpStatus.OK)
    @Post('whatsapp/send-otp')
    async whatsappSendOtp(@Body() dto: SendWhatsappOtpDto) {
        return this.authService.sendWhatsappOtp(dto);
    }

    @ApiOperation({
        summary: 'Step 2 – Verify WhatsApp OTP and receive JWT access + refresh tokens',
    })
    @HttpCode(HttpStatus.OK)
    @Post('whatsapp/verify-otp')
    async whatsappVerifyOtp(@Body() dto: VerifyWhatsappOtpDto, @Res({ passthrough: true }) res: Response) {
        const result = await this.authService.verifyWhatsappOtp(dto);
        this.setAuthCookies(res, result.accessToken, result.refreshToken);
        return result;
    }

    @ApiOperation({ summary: 'Clear auth cookies for current session' })
    @HttpCode(HttpStatus.OK)
    @Post('logout')
    async logout(@Res({ passthrough: true }) res: Response) {
        const isProduction = process.env.NODE_ENV === 'production';
        res.clearCookie('ft_access_token', {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            path: '/',
        });
        res.clearCookie('ft_refresh_token', {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            path: '/',
        });
        return { message: 'Logged out' };
    }
}
