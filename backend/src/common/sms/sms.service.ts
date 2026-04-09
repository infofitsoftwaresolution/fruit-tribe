import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
    private readonly logger = new Logger(SmsService.name);

    constructor(private readonly config: ConfigService) { }

    isEnabled(): boolean {
        const enabled = (this.config.get<string>('SMS_ENABLED') || '').toLowerCase();
        if (enabled === 'false' || enabled === '0') return false;
        const authKey = this.config.get<string>('MSG91_AUTH_KEY');
        const senderId = this.config.get<string>('MSG91_SENDER_ID');
        const templateId = this.config.get<string>('MSG91_OTP_TEMPLATE_ID');
        return Boolean(authKey && senderId && templateId);
    }

    /** Send OTP SMS using MSG91 India template flow. */
    async sendVerificationOtp(phone10: string, code: string): Promise<void> {
        const authKey = this.config.get<string>('MSG91_AUTH_KEY');
        const senderId = this.config.get<string>('MSG91_SENDER_ID');
        const templateId = this.config.get<string>('MSG91_OTP_TEMPLATE_ID');
        const route = this.config.get<string>('MSG91_ROUTE') || '4';

        if (!authKey || !senderId || !templateId) {
            const err = new Error('MSG91 SMS config missing (MSG91_AUTH_KEY, MSG91_SENDER_ID, MSG91_OTP_TEMPLATE_ID).');
            this.logger.warn(`Cannot send verification SMS to ${phone10}: ${err.message}`);
            throw err;
        }

        const to = phone10.startsWith('91') ? phone10 : `91${phone10}`;
        const payload = {
            template_id: templateId,
            sender: senderId,
            short_url: '0',
            mobiles: to,
            VAR1: code,
        };

        const res = await fetch(`https://api.msg91.com/api/v5/flow/?route=${encodeURIComponent(route)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                authkey: authKey,
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => res.statusText);
            this.logger.error(`Failed to send SMS OTP to ${to}: ${text || res.statusText}`);
            throw new Error(text || res.statusText);
        }

        this.logger.log(`Verification SMS sent to ${to}`);
    }
}

