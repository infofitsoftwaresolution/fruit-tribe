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

    async sendVerificationEmail(to: string, code: string): Promise<void> {
        if (!this.transporter) {
            this.logger.warn(`Cannot send verification email to ${to}: transporter not configured.`);
            return;
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
        }
    }
}

