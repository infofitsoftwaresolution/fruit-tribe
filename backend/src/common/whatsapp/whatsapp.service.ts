import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * WhatsApp OTP delivery via Meta WhatsApp Cloud API.
 *
 * Required env vars:
 *   WHATSAPP_PHONE_NUMBER_ID   – Phone Number ID from Meta Developer Console
 *   WHATSAPP_ACCESS_TOKEN      – Permanent (System User) or temporary access token
 *   WHATSAPP_TEMPLATE_NAME     – Approved OTP template name (default: "otp_verification")
 *   WHATSAPP_TEMPLATE_LANG     – Template language code (default: "en")
 *   WHATSAPP_API_VERSION       – Graph API version (default: "v19.0")
 */
@Injectable()
export class WhatsappService {
    private readonly logger = new Logger(WhatsappService.name);

    constructor(private readonly config: ConfigService) { }

    isEnabled(): boolean {
        const phoneNumberId = (this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID') || process.env.WHATSAPP_PHONE_NUMBER_ID)?.trim();
        const accessToken = (this.config.get<string>('WHATSAPP_ACCESS_TOKEN') || process.env.WHATSAPP_ACCESS_TOKEN)?.trim();
        
        const enabled = Boolean(phoneNumberId && accessToken);
        this.logger.debug(`WhatsApp Service enabled check: ${enabled} (ID: ${phoneNumberId ? 'SET' : 'MISSING'}, Token: ${accessToken ? 'SET' : 'MISSING'})`);
        
        return enabled;
    }

    /**
     * Send a 6-digit OTP via a WhatsApp template message.
     * @param phone10 10-digit Indian mobile (without country code)
     * @param code    6-digit numeric OTP
     */
    async sendOtp(phone10: string, code: string): Promise<void> {
        const phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');
        const accessToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
        const templateName = this.config.get<string>('WHATSAPP_TEMPLATE_NAME') || 'otp_verification';
        const templateLang = this.config.get<string>('WHATSAPP_TEMPLATE_LANG') || 'en';
        const apiVersion = this.config.get<string>('WHATSAPP_API_VERSION') || 'v19.0';

        if (!phoneNumberId || !accessToken) {
            const err = new Error(
                'WhatsApp config missing: set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN in .env',
            );
            this.logger.warn(`Cannot send WhatsApp OTP to ${phone10}: ${err.message}`);
            throw err;
        }

        // Always send with 91 country code (India)
        const to = `91${phone10}`;

        /**
         * Template body component has one variable: {{1}} = the OTP code.
         * This matches a typical OTP template like:
         *   "Your The Fruit Tribe OTP is {{1}}. Valid for 10 minutes."
         */
        const payload: any = {
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: {
                name: templateName,
                language: { code: templateLang },
            },
        };

        // Only add components/parameters if it's NOT the hello_world test template
        if (templateName !== 'hello_world') {
            payload.template.components = [
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: code },
                    ],
                },
                {
                    type: 'button',
                    sub_type: 'url',
                    index: '0',
                    parameters: [{ type: 'text', text: code }],
                },
            ];
        }

        const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

        this.logger.log(`Sending WhatsApp OTP to ${to} via ${url}`);

        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => res.statusText);
            this.logger.error(`WhatsApp Cloud API error (${res.status}) for ${to}: ${text}`);
            throw new Error(`WhatsApp delivery failed: ${text || res.statusText}`);
        }

        const data = await res.json().catch(() => ({}));
        this.logger.log(
            `WhatsApp OTP sent to ${to} — message_id: ${(data as any)?.messages?.[0]?.id ?? 'unknown'}`,
        );
    }
}
