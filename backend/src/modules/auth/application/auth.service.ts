import {
    Injectable,
    UnauthorizedException,
    BadRequestException,
    ConflictException,
    Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import { RegisterDto, LoginDto, VerifyEmailDto, ResendEmailDto, ForgotPasswordDto, ResetPasswordDto } from './dtos/auth.dto';
import * as bcrypt from 'bcrypt';
import { MailService } from '../../../common/mail/mail.service';

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly config: ConfigService,
        private readonly mailService: MailService,
    ) { }

    async register(dto: RegisterDto) {
        // Extra safety: reject clearly invalid email formats before hitting the database,
        // even though class-validator already enforces @IsEmail on the DTO.
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(dto.email)) {
            throw new BadRequestException('Please enter a valid email address.');
        }

        // Soft-clean stale, never-verified users older than 24h
        // (cannot hard-delete because of foreign key constraints from carts, etc.)
        await this.prisma.user.updateMany({
            where: {
                otpCode: { not: null },
                otpExpiry: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) },
            },
            data: {
                otpCode: null,
                otpExpiry: null,
                isActive: false,
            },
        });

        const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (existing) {
            // If user has a pending OTP (not yet verified), hint frontend to redirect to verify-email
            if (existing.otpCode && existing.otpExpiry && existing.isActive === false) {
                throw new ConflictException('EMAIL_PENDING_VERIFICATION');
            }
            throw new ConflictException('EMAIL_ALREADY_REGISTERED');
        }

        const passwordHash = await bcrypt.hash(dto.password, 12);

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 15 * 60 * 1000);

        // Get default CUSTOMER role
        const customerRole = await this.prisma.role.findUnique({ where: { name: 'CUSTOMER' } });

        const user = await this.prisma.$transaction(async (tx) => {
            const created = await tx.user.create({
                data: {
                    email: dto.email,
                    passwordHash,
                    firstName: dto.firstName,
                    lastName: dto.lastName,
                    roleId: customerRole?.id,
                    otpCode: code,
                    otpExpiry: expiry,
                    isActive: false,
                },
                select: { id: true, email: true, firstName: true, lastName: true, createdAt: true },
            });

            await tx.cart.create({
                data: { userId: created.id },
            });

            await tx.wishlist.create({
                data: { userId: created.id },
            });

            await tx.otpLog.create({
                data: {
                    userId: created.id,
                    otp: code,
                    expiresAt: expiry,
                },
            });

            return created;
        });

        await this.mailService.sendVerificationEmail(user.email, code);

        return {
            message: 'Registration successful. Please check your email for the verification code.',
            user,
        };
    }

    async login(dto: LoginDto) {
        const user = await this.prisma.user.findUnique({
            where: { email: dto.email },
            include: { role: true },
        });

        if (!user) throw new UnauthorizedException('Invalid credentials');
        if (!user.isActive) throw new UnauthorizedException('Account is inactive');

        if (user.otpCode && user.otpExpiry && user.otpExpiry > new Date()) {
            throw new UnauthorizedException('Please verify your email with the code sent to you.');
        }

        // Account lockout check
        if (user.lockedUntil && user.lockedUntil > new Date()) {
            throw new UnauthorizedException('Account is temporarily locked. Please try again later.');
        }

        const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
        if (!passwordValid) {
            await this.prisma.user.update({
                where: { id: user.id },
                data: { failedLoginAttempts: { increment: 1 } },
            });
            throw new UnauthorizedException('Invalid credentials');
        }

        // Reset failed attempts on successful login
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                failedLoginAttempts: 0,
                lastLogin: new Date(),
            },
        });

        const payload = { sub: user.id, email: user.email, role: user.role?.name };
        const accessToken = this.jwtService.sign(payload);
        const refreshToken = this.jwtService.sign(payload, {
            secret: this.config.get('JWT_REFRESH_SECRET'),
            expiresIn: '7d',
        });

        const refreshHash = await bcrypt.hash(refreshToken, 10);
        await this.prisma.user.update({
            where: { id: user.id },
            data: { refreshTokenHash: refreshHash },
        });

        return {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role?.name,
            },
        };
    }

    async verifyEmail(dto: VerifyEmailDto) {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (!user) throw new BadRequestException('Invalid email or code');
        if (!user.otpCode || !user.otpExpiry) {
            throw new BadRequestException('No active verification code. Please register again.');
        }
        if (user.otpCode !== dto.code) {
            throw new BadRequestException('Invalid verification code');
        }
        if (user.otpExpiry < new Date()) {
            throw new BadRequestException('Verification code has expired. Please register again.');
        }

        await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: user.id },
                data: {
                    otpCode: null,
                    otpExpiry: null,
                    isActive: true,
                },
            });
            await tx.otpLog.updateMany({
                where: { userId: user.id, otp: dto.code, verified: false },
                data: { verified: true },
            });
        });

        return { message: 'Email verified successfully. You can now log in.' };
    }

    async resendEmail(dto: ResendEmailDto) {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (!user) {
            // Do not leak that email does not exist
            return { message: 'If this email exists, a new code has been sent.' };
        }

        // If already verified, nothing to resend
        if (!user.otpCode || !user.otpExpiry || user.otpExpiry < new Date()) {
            return { message: 'Account is already verified or has no pending code.' };
        }

        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        const recentOtps = await this.prisma.otpLog.count({
            where: {
                userId: user.id,
                createdAt: { gte: fifteenMinutesAgo },
            },
        });
        if (recentOtps >= 5) {
            throw new BadRequestException('Too many verification attempts. Please try again later.');
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 15 * 60 * 1000);

        await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: user.id },
                data: { otpCode: code, otpExpiry: expiry },
            });
            await tx.otpLog.create({
                data: { userId: user.id, otp: code, expiresAt: expiry },
            });
        });

        await this.mailService.sendVerificationEmail(user.email, code);
        return { message: 'A new verification code has been sent if the email exists.' };
    }

    async getProfile(userId: string) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                phone: true,
                firstName: true,
                lastName: true,
                role: { select: { name: true } },
                lastLogin: true,
                createdAt: true,
            },
        });
    }

    /** Admin: list users (customers) with order stats */
    async getCustomersForAdmin() {
        const users = await this.prisma.user.findMany({
            where: { role: { name: 'CUSTOMER' } },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                createdAt: true,
                isActive: true,
                otpCode: true,
                otpExpiry: true,
                _count: { select: { orders: true } },
                orders: {
                    select: { payableAmount: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        return users
            // Hide obviously invalid legacy emails from the admin dashboard
            .filter((u) => emailPattern.test(u.email))
            .map((u) => {
                const now = new Date();
                const hasActiveOtp = !!u.otpCode && !!u.otpExpiry && u.otpExpiry > now;
                const verificationStatus = u.isActive && !hasActiveOtp ? 'Verified' : 'Unverified';
                return {
                    id: u.id,
                    email: u.email,
                    firstName: u.firstName,
                    lastName: u.lastName,
                    name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
                    createdAt: u.createdAt,
                    orderCount: u._count.orders,
                    totalSpent: u.orders.reduce((sum, o) => sum + Number(o.payableAmount), 0),
                    verificationStatus,
                };
            });
    }

    async forgotPassword(dto: ForgotPasswordDto) {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
        // Do not leak whether the email exists
        if (!user) {
            return { message: 'If this email exists, a reset code has been sent.' };
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 15 * 60 * 1000);

        await this.prisma.otpLog.create({
            data: {
                userId: user.id,
                otp: code,
                expiresAt: expiry,
            },
        });

        await this.mailService.sendPasswordResetEmail(user.email, code);
        return { message: 'If this email exists, a reset code has been sent.' };
    }

    async resetPassword(dto: ResetPasswordDto) {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
        if (!user) {
            throw new BadRequestException('Invalid email or code');
        }

        const now = new Date();
        const otpLog = await this.prisma.otpLog.findFirst({
            where: {
                userId: user.id,
                otp: dto.code,
                expiresAt: { gt: now },
                verified: false,
            },
            orderBy: { createdAt: 'desc' },
        });

        if (!otpLog) {
            throw new BadRequestException('Invalid or expired reset code');
        }

        const newHash = await bcrypt.hash(dto.newPassword, 12);

        await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: user.id },
                data: {
                    passwordHash: newHash,
                    failedLoginAttempts: 0,
                    lockedUntil: null,
                },
            });
            await tx.otpLog.update({
                where: { id: otpLog.id },
                data: { verified: true },
            });
        });

        return { message: 'Password reset successful. You can now log in.' };
    }
}
