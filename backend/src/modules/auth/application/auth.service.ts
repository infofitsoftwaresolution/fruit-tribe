import {
    Injectable,
    UnauthorizedException,
    BadRequestException,
    ConflictException,
    ServiceUnavailableException,
    Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';
import type { Prisma } from '@prisma/client';
import {
    RegisterDto,
    LoginDto,
    VerifyEmailDto,
    ResendEmailDto,
    ForgotPasswordDto,
    ResetPasswordDto,
    ChangePasswordDto,
    BulkCustomerAnnouncementDto,
} from './dtos/auth.dto';
import * as bcrypt from 'bcrypt';
import { createHash } from 'crypto';
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

    /** Normalize to 10-digit Indian mobile for storage and uniqueness checks. */
    private normalizeIndianMobile(raw: string): string | null {
        const digits = raw.replace(/\D/g, '');
        if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) return digits;
        if (digits.length === 11 && digits.startsWith('0') && /^0[6-9]\d{9}$/.test(digits)) {
            return digits.slice(1);
        }
        if (digits.length === 12 && digits.startsWith('91') && /^91[6-9]\d{9}$/.test(digits)) {
            return digits.slice(2);
        }
        if (digits.length >= 10) {
            const last10 = digits.slice(-10);
            if (/^[6-9]\d{9}$/.test(last10)) return last10;
        }
        return null;
    }

    private async issueFreshVerificationOtp(userId: string, email: string) {
        if (!this.mailService.isEnabled()) {
            throw new ServiceUnavailableException(
                'Cannot send a verification code because email is not configured on the server.',
            );
        }
        const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
        const recentOtps = await this.prisma.otpLog.count({
            where: {
                userId,
                createdAt: { gte: fifteenMinutesAgo },
            },
        });
        if (recentOtps >= 5) {
            throw new UnauthorizedException('Too many verification attempts. Please try again later.');
        }

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 15 * 60 * 1000);
        await this.prisma.$transaction(async (tx) => {
            await tx.user.update({
                where: { id: userId },
                data: { otpCode: code, otpExpiry: expiry, isActive: false },
            });
            await tx.otpLog.create({
                data: { userId, otp: code, expiresAt: expiry },
            });
        });
        await this.mailService.sendVerificationEmail(email, code);
    }

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

        const emailNorm = dto.email.trim().toLowerCase();
        const existing = await this.prisma.user.findUnique({
            where: { email: emailNorm },
            include: { role: true, deliveryPartner: true },
        });
        if (existing) {
            if (existing.deliveryPartner || existing.role?.name === 'DELIVERY_PARTNER') {
                throw new ConflictException(
                    'This email is used for delivery partner access. Sign in on the delivery login page.',
                );
            }
            // If user has a pending OTP (not yet verified), hint frontend to redirect to verify-email
            if (existing.otpCode && existing.otpExpiry && existing.isActive === false) {
                throw new ConflictException('EMAIL_PENDING_VERIFICATION');
            }
            throw new ConflictException('EMAIL_ALREADY_REGISTERED');
        }

        const normalizedPhone = this.normalizeIndianMobile(dto.phone);
        if (!normalizedPhone) {
            throw new BadRequestException('Please enter a valid 10-digit Indian mobile number.');
        }
        const phoneTaken = await this.prisma.user.findUnique({
            where: { phone: normalizedPhone },
            include: { role: true, deliveryPartner: true },
        });
        if (phoneTaken) {
            if (phoneTaken.deliveryPartner || phoneTaken.role?.name === 'DELIVERY_PARTNER') {
                throw new ConflictException(
                    'This mobile number is used for delivery partner access. Sign in on the delivery login page.',
                );
            }
            if (phoneTaken.otpCode && phoneTaken.otpExpiry && phoneTaken.isActive === false) {
                throw new ConflictException({
                    message: 'PHONE_PENDING_VERIFICATION',
                    email: phoneTaken.email,
                });
            }
            throw new ConflictException('PHONE_ALREADY_REGISTERED');
        }

        if (!this.mailService.isEnabled()) {
            this.logger.warn('Registration rejected: SMTP is not configured');
            throw new ServiceUnavailableException(
                'Verification email cannot be sent because email is not configured on the server. Please contact support.',
            );
        }

        const passwordHash = await bcrypt.hash(dto.password, 12);

        const code = Math.floor(100000 + Math.random() * 900000).toString();
        const expiry = new Date(Date.now() + 15 * 60 * 1000);

        // Get default CUSTOMER role
        const customerRole = await this.prisma.role.findUnique({ where: { name: 'CUSTOMER' } });

        const user = await this.prisma.$transaction(async (tx) => {
            const created = await tx.user.create({
                data: {
                    email: emailNorm,
                    phone: normalizedPhone,
                    passwordHash,
                    firstName: dto.firstName,
                    lastName: dto.lastName,
                    roleId: customerRole?.id,
                    otpCode: code,
                    otpExpiry: expiry,
                    isActive: false,
                },
                select: {
                    id: true,
                    email: true,
                    phone: true,
                    firstName: true,
                    lastName: true,
                    createdAt: true,
                },
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

        try {
            await this.mailService.sendVerificationEmail(user.email, code);
        } catch (err: any) {
            this.logger.error(
                `Verification email failed after user create (${user.email}): ${err?.message || err}`,
            );
            throw new ServiceUnavailableException(
                'We could not send the verification email. Please try again in a few minutes. If an account was created, open the verify page and use “Resend code”.',
            );
        }

        return {
            message: 'Registration successful. Please check your email for the verification code.',
            user,
        };
    }

    private async findUserForLogin(raw: string) {
        const trimmed = raw.trim();
        if (!trimmed) return null;

        if (trimmed.includes('@')) {
            return this.prisma.user.findUnique({
                where: { email: trimmed.toLowerCase() },
                include: { role: true },
            });
        }

        const digits = trimmed.replace(/\D/g, '');
        const candidates = new Set<string>();
        const compact = trimmed.replace(/\s+/g, '');
        if (compact) candidates.add(compact);
        if (digits) {
            candidates.add(digits);
            if (digits.length === 10) {
                candidates.add(`91${digits}`);
                candidates.add(`+91${digits}`);
            }
            if (digits.length === 11 && digits.startsWith('0')) {
                candidates.add(digits.slice(1));
            }
            if (digits.length === 12 && digits.startsWith('91')) {
                candidates.add(digits.slice(2));
                candidates.add(`+${digits}`);
            }
        }

        const phones = [...candidates].filter((p) => p.length >= 8);
        if (phones.length === 0) return null;

        return this.prisma.user.findFirst({
            where: { OR: phones.map((phone) => ({ phone })) },
            include: { role: true },
        });
    }

    async login(dto: LoginDto) {
        let user = await this.findUserForLogin(dto.email);

        if (!user) throw new UnauthorizedException('Invalid credentials');

        // If user is pending verification (missed/expired OTP), send a fresh code on login attempt.
        if (!user.isActive && user.otpCode) {
            await this.issueFreshVerificationOtp(user.id, user.email);
            throw new UnauthorizedException({
                message: 'EMAIL_PENDING_VERIFICATION_OTP_RESENT',
                email: user.email,
            });
        }

        if (!user.isActive) throw new UnauthorizedException('Account is inactive');

        if (user.otpCode && user.otpExpiry && user.otpExpiry > new Date()) {
            throw new UnauthorizedException({
                message: 'EMAIL_PENDING_VERIFICATION_OTP_RESENT',
                email: user.email,
            });
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

        // Attach DELIVERY_PARTNER role if missing (single write; session fields updated below).
        if (!user.role) {
            const deliveryPartner = await this.prisma.deliveryPartner.findUnique({
                where: { userId: user.id },
            });
            if (deliveryPartner) {
                const role = await this.prisma.role.upsert({
                    where: { name: 'DELIVERY_PARTNER' },
                    update: {},
                    create: {
                        name: 'DELIVERY_PARTNER',
                        permissions: {},
                    },
                });
                user = await this.prisma.user.update({
                    where: { id: user.id },
                    data: { roleId: role.id },
                    include: { role: true },
                });
            }
        }

        const payload = { sub: user.id, email: user.email, role: user.role?.name };
        const accessToken = this.jwtService.sign(payload);
        const refreshToken = this.jwtService.sign(payload, {
            secret: this.config.get('JWT_REFRESH_SECRET'),
            expiresIn: '7d',
        });

        // SHA-256 is instant; bcrypt on refresh was adding ~50–150ms per login with no refresh flow using it yet.
        const refreshHash = createHash('sha256').update(refreshToken).digest('hex');

        const [sellerProfile] = await Promise.all([
            this.prisma.seller.findUnique({
                where: { userId: user.id },
                select: { id: true, storeName: true },
            }),
            this.prisma.user.update({
                where: { id: user.id },
                data: {
                    failedLoginAttempts: 0,
                    lastLogin: new Date(),
                    refreshTokenHash: refreshHash,
                },
            }),
        ]);

        return {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                phone: user.phone,
                firstName: user.firstName,
                lastName: user.lastName,
                role: user.role?.name,
                requirePasswordChange: user.requirePasswordChange,
                seller: sellerProfile,
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

        if (!this.mailService.isEnabled()) {
            throw new ServiceUnavailableException(
                'Cannot resend the code because email is not configured on the server.',
            );
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

        try {
            await this.mailService.sendVerificationEmail(user.email, code);
        } catch (err: any) {
            this.logger.error(`Resend verification email failed (${user.email}): ${err?.message || err}`);
            throw new ServiceUnavailableException(
                'We could not send the email. Please try again in a few minutes.',
            );
        }
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
                seller: { select: { id: true, storeName: true } },
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
                phone: true,
                firstName: true,
                lastName: true,
                createdAt: true,
                lastLogin: true,
                isActive: true,
                status: true,
                requirePasswordChange: true,
                walletBalance: true,
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
                    phone: u.phone ?? null,
                    firstName: u.firstName,
                    lastName: u.lastName,
                    name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
                    createdAt: u.createdAt,
                    lastLogin: u.lastLogin,
                    isActive: u.isActive,
                    accountStatus: u.status,
                    requirePasswordChange: u.requirePasswordChange,
                    walletBalance: Number(u.walletBalance),
                    orderCount: u._count.orders,
                    totalSpent: u.orders.reduce((sum, o) => sum + Number(o.payableAmount), 0),
                    verificationStatus,
                };
            });
    }

    /** Admin: in-app notification for all matching customers; optional email batch (SMTP). */
    async bulkCustomerAnnouncement(dto: BulkCustomerAnnouncementDto) {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const where: Prisma.UserWhereInput = {
            role: { name: 'CUSTOMER' },
        };
        if (dto.audience === 'verified') {
            where.isActive = true;
        }
        if (dto.audience === 'with_orders') {
            where.orders = { some: {} };
        }

        const users = await this.prisma.user.findMany({
            where,
            select: { id: true, email: true, isActive: true, otpCode: true, otpExpiry: true },
        });

        const now = new Date();
        const filtered = users.filter((u) => {
            if (!emailPattern.test(u.email)) return false;
            if (dto.audience === 'verified') {
                const hasActiveOtp = !!u.otpCode && !!u.otpExpiry && u.otpExpiry > now;
                return u.isActive && !hasActiveOtp;
            }
            return true;
        });

        if (!filtered.length) {
            return {
                notificationsCreated: 0,
                emailsSent: 0,
                emailsFailed: 0,
                message: 'No customers match the selected audience.',
            };
        }

        const title = dto.title.trim().slice(0, 200);
        const message = dto.message.trim().slice(0, 5000);

        await this.prisma.notification.createMany({
            data: filtered.map((u) => ({
                userId: u.id,
                title,
                message,
                type: 'STOCK_CLEARANCE',
            })),
        });

        const EMAIL_CAP = 200;
        let emailsSent = 0;
        let emailsFailed = 0;
        if (dto.sendEmail) {
            if (!this.mailService.isEnabled()) {
                throw new BadRequestException(
                    'Email sending is not configured (SMTP). Uncheck “Also send by email” or set SMTP_USER/SMTP_PASS on the server.',
                );
            }
            const slice = filtered.slice(0, EMAIL_CAP);
            for (const u of slice) {
                try {
                    await this.mailService.sendAnnouncementEmail(u.email, title, message);
                    emailsSent++;
                } catch (err: any) {
                    emailsFailed++;
                    this.logger.warn(`Announcement email failed for ${u.email}: ${err?.message || err}`);
                }
            }
        }

        return {
            notificationsCreated: filtered.length,
            emailsSent,
            emailsFailed,
            emailBatchCapped: !!dto.sendEmail && filtered.length > EMAIL_CAP,
            emailCap: EMAIL_CAP,
        };
    }

    async forgotPassword(dto: ForgotPasswordDto) {
        const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
        // Do not leak whether the email exists
        if (!user) {
            return { message: 'If this email exists, a reset code has been sent.' };
        }

        if (!this.mailService.isEnabled()) {
            throw new ServiceUnavailableException(
                'Cannot send a reset code because email is not configured on the server.',
            );
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

        try {
            await this.mailService.sendPasswordResetEmail(user.email, code);
        } catch (err: any) {
            this.logger.error(`Password reset email failed (${user.email}): ${err?.message || err}`);
            throw new ServiceUnavailableException(
                'We could not send the reset email. Please try again in a few minutes.',
            );
        }
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
                    // If the account was pending verification but the user
                    // successfully proved email ownership via reset code,
                    // treat it as verified.
                    isActive: true,
                    otpCode: null,
                    otpExpiry: null,
                },
            });
            await tx.otpLog.update({
                where: { id: otpLog.id },
                data: { verified: true },
            });
        });

        return { message: 'Password reset successful. You can now log in.' };
    }

    async changePassword(userId: string, dto: ChangePasswordDto) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new BadRequestException('User not found');
        }

        const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
        if (!valid) {
            throw new BadRequestException('Current password is incorrect');
        }

        const newHash = await bcrypt.hash(dto.newPassword, 12);

        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                passwordHash: newHash,
                requirePasswordChange: false,
            },
        });

        return { message: 'Password changed successfully.' };
    }
}
