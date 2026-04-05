import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
    private readonly logger = new Logger(MailService.name);
    private transporter: nodemailer.Transporter | null = null;

    constructor(private readonly config: ConfigService) {
        const host = this.config.get<string>('SMTP_HOST') || 'smtp.gmail.com';
        const port = Number(this.config.get<string>('SMTP_PORT') || 587);
        const user = this.config.get<string>('SMTP_USER');
        const pass = this.config.get<string>('SMTP_PASS');

        if (!user || !pass) {
            this.logger.warn('SMTP_USER/SMTP_PASS not configured; email sending is disabled.');
            return;
        }

        this.transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,
            auth: { user, pass },
        });
    }

    /** True when SMTP_USER/SMTP_PASS were set and a transporter was created. */
    isEnabled(): boolean {
        return this.transporter !== null;
    }

    async sendVerificationEmail(to: string, code: string): Promise<void> {
        if (!this.transporter) {
            const err = new Error('SMTP is not configured (missing SMTP_USER/SMTP_PASS).');
            this.logger.warn(`Cannot send verification email to ${to}: ${err.message}`);
            throw err;
        }
        const from =
            this.config.get<string>('SMTP_FROM') ||
            `"The Fruit Tribe" <${this.config.get<string>('SMTP_USER')}>`;

        const subject = 'Verify your email for The Fruit Tribe';
        const text = `Welcome to The Fruit Tribe!\n\nYour verification code is: ${code}\n\nEnter this code in the app to complete your registration. This code will expire in 15 minutes.\n\nIf you did not request this, you can ignore this email.`;
        const html = `<p>Welcome to <strong>The Fruit Tribe</strong>!</p>
<p>Your verification code is:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p>
<p>This code will expire in 15 minutes.</p>
<p>If you did not request this, you can safely ignore this email.</p>`;

        try {
            await this.transporter.sendMail({ from, to, subject, text, html });
            this.logger.log(`Verification email sent to ${to}`);
        } catch (err: any) {
            this.logger.error(`Failed to send verification email to ${to}: ${err?.message || err}`);
            throw err;
        }
    }

    /** Admin broadcast (e.g. stock clearance). Body is plain text; HTML is escaped. */
    async sendAnnouncementEmail(to: string, subject: string, bodyText: string): Promise<void> {
        if (!this.transporter) {
            const err = new Error('SMTP is not configured (missing SMTP_USER/SMTP_PASS).');
            this.logger.warn(`Cannot send announcement to ${to}: ${err.message}`);
            throw err;
        }
        const esc = (s: string) =>
            s
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;');
        const from =
            this.config.get<string>('SMTP_FROM') ||
            `"The Fruit Tribe" <${this.config.get<string>('SMTP_USER')}>`;
        const safeSubject = subject.trim().slice(0, 200);
        const text = `${safeSubject}\n\n${bodyText}`;
        const html = `<p><strong>${esc(safeSubject)}</strong></p><p>${esc(bodyText).split('\n').join('<br/>')}</p>`;
        try {
            await this.transporter.sendMail({
                from,
                to,
                subject: safeSubject,
                text,
                html,
            });
            this.logger.log(`Announcement email sent to ${to}`);
        } catch (err: any) {
            this.logger.error(`Failed to send announcement email to ${to}: ${err?.message || err}`);
            throw err;
        }
    }

    async sendPasswordResetEmail(to: string, code: string): Promise<void> {
        if (!this.transporter) {
            const err = new Error('SMTP is not configured (missing SMTP_USER/SMTP_PASS).');
            this.logger.warn(`Cannot send password reset email to ${to}: ${err.message}`);
            throw err;
        }
        const from =
            this.config.get<string>('SMTP_FROM') ||
            `"The Fruit Tribe" <${this.config.get<string>('SMTP_USER')}>`;

        const subject = 'Reset your password for The Fruit Tribe';
        const text = `We received a request to reset your password for The Fruit Tribe.\n\n` +
            `Your password reset code is: ${code}\n\n` +
            `Enter this code in the app to choose a new password. This code will expire in 15 minutes.\n\n` +
            `If you did not request this, you can ignore this email and your password will stay the same.`;
        const html = `<p>We received a request to reset your password for <strong>The Fruit Tribe</strong>.</p>
<p>Your password reset code is:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:4px">${code}</p>
<p>This code will expire in 15 minutes.</p>
<p>If you did not request this, you can safely ignore this email and your password will remain unchanged.</p>`;

        try {
            await this.transporter.sendMail({ from, to, subject, text, html });
            this.logger.log(`Password reset email sent to ${to}`);
        } catch (err: any) {
            this.logger.error(`Failed to send password reset email to ${to}: ${err?.message || err}`);
            throw err;
        }
    }

    async sendDeliveryStaffWelcomeEmail(to: string, tempPassword: string): Promise<void> {
        if (!this.transporter) {
            this.logger.warn(`Cannot send delivery staff welcome email to ${to}: transporter not configured.`);
            return;
        }
        const from =
            this.config.get<string>('SMTP_FROM') ||
            `"The Fruit Tribe" <${this.config.get<string>('SMTP_USER')}>`;

        const subject = 'Your delivery account for The Fruit Tribe';
        const loginUrl = this.config.get<string>('APP_LOGIN_URL') || 'https://thefruittribe.com/#/login';
        const text =
            `Welcome to The Fruit Tribe delivery network!\n\n` +
            `An admin has created a delivery staff account for you.\n\n` +
            `Login email: ${to}\n` +
            `Temporary password: ${tempPassword}\n\n` +
            `Please log in at ${loginUrl} and you will be asked to change this password immediately.\n\n` +
            `If you did not expect this email, please contact the store owner.`;

        const html = `<p>Welcome to <strong>The Fruit Tribe</strong> delivery network!</p>
<p>An admin has created a delivery staff account for you.</p>
<p><strong>Login email:</strong> ${to}<br/>
<strong>Temporary password:</strong> ${tempPassword}</p>
<p>Please log in at <a href="${loginUrl}" target="_blank" rel="noopener noreferrer">${loginUrl}</a> and you will be asked to change this password immediately.</p>
<p>If you did not expect this email, please contact the store owner.</p>`;

        try {
            await this.transporter.sendMail({ from, to, subject, text, html });
            this.logger.log(`Delivery staff welcome email sent to ${to}`);
        } catch (err: any) {
            this.logger.error(`Failed to send delivery staff welcome email to ${to}: ${err?.message || err}`);
        }
    }

    async sendDeliveryAssignmentEmail(
        to: string,
        payload: { orderNumber: string; customerName?: string; deliverySlot?: string | null; address?: string },
    ): Promise<void> {
        if (!this.transporter) {
            this.logger.warn(`Cannot send delivery assignment email to ${to}: transporter not configured.`);
            return;
        }
        const from =
            this.config.get<string>('SMTP_FROM') ||
            `"The Fruit Tribe" <${this.config.get<string>('SMTP_USER')}>`;

        const subject = `New delivery assigned: #${payload.orderNumber}`;
        const text =
            `You have a new delivery assignment.\n\n` +
            `Order: #${payload.orderNumber}\n` +
            `Customer: ${payload.customerName || 'Customer'}\n` +
            `Delivery slot: ${payload.deliverySlot || 'Anytime'}\n` +
            `Address: ${payload.address || 'Address available in delivery app'}\n\n` +
            `Please open your delivery dashboard to start this assignment.`;
        const html = `<p>You have a new delivery assignment.</p>
<p><strong>Order:</strong> #${payload.orderNumber}<br/>
<strong>Customer:</strong> ${payload.customerName || 'Customer'}<br/>
<strong>Delivery slot:</strong> ${payload.deliverySlot || 'Anytime'}<br/>
<strong>Address:</strong> ${payload.address || 'Address available in delivery app'}</p>
<p>Please open your delivery dashboard to start this assignment.</p>`;

        try {
            await this.transporter.sendMail({ from, to, subject, text, html });
            this.logger.log(`Delivery assignment email sent to ${to}`);
        } catch (err: any) {
            this.logger.error(`Failed to send delivery assignment email to ${to}: ${err?.message || err}`);
        }
    }

    async sendDeliveryOtpToCustomerEmail(
        to: string,
        payload: { orderNumber: string; otp: string; expiresInMinutes: number },
    ): Promise<void> {
        if (!this.transporter) {
            this.logger.warn(`Cannot send delivery OTP email to ${to}: transporter not configured.`);
            return;
        }
        const from =
            this.config.get<string>('SMTP_FROM') ||
            `"The Fruit Tribe" <${this.config.get<string>('SMTP_USER')}>`;

        const subject = `Delivery OTP for order #${payload.orderNumber}`;
        const text =
            `Your delivery OTP for order #${payload.orderNumber} is: ${payload.otp}\n\n` +
            `Share this OTP with the delivery partner at handover.\n` +
            `This OTP expires in ${payload.expiresInMinutes} minutes.`;
        const html = `<p>Your delivery OTP for order <strong>#${payload.orderNumber}</strong> is:</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:4px">${payload.otp}</p>
<p>Share this OTP with the delivery partner at handover.</p>
<p>This OTP expires in ${payload.expiresInMinutes} minutes.</p>`;

        try {
            await this.transporter.sendMail({ from, to, subject, text, html });
            this.logger.log(`Delivery OTP email sent to ${to}`);
        } catch (err: any) {
            this.logger.error(`Failed to send delivery OTP email to ${to}: ${err?.message || err}`);
        }
    }
}

