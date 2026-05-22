import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface OrderWhatsAppAlertPayload {
    orderNumber: string;
    payableAmount: number;
    paymentLabel: string;
    deliverySlot?: string | null;
    customerName: string;
    customerPhone?: string | null;
    customerEmail?: string | null;
    shippingAddress: Record<string, unknown>;
    itemLines: string[];
}

/**
 * WhatsApp delivery via Meta WhatsApp Cloud API.
 *
 * OTP env vars:
 *   WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN
 *   WHATSAPP_TEMPLATE_NAME (default: otp_verification)
 *
 * Order alerts:
 *   WHATSAPP_ORDER_NOTIFY_PHONE – override store notify number (10 digits or +91…)
 *   WHATSAPP_ORDER_TEMPLATE_NAME – approved template (body uses {{1}} = full message)
 *   WHATSAPP_ORDER_TEMPLATE_LANG – template language (default: en)
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

    /** Normalize to 10-digit Indian mobile (no country code). */
    normalizeIndianPhone10(raw: string | null | undefined): string | null {
        const digits = String(raw ?? '').replace(/\D/g, '');
        if (digits.length < 10) return null;
        return digits.slice(-10);
    }

    /**
     * Send a 6-digit OTP via a WhatsApp template message.
     * @param phone10 10-digit Indian mobile (without country code)
     * @param code    6-digit numeric OTP
     */
    async sendOtp(phone10: string, code: string): Promise<void> {
        const templateName = this.config.get<string>('WHATSAPP_TEMPLATE_NAME') || 'otp_verification';
        const templateLang = this.config.get<string>('WHATSAPP_TEMPLATE_LANG') || 'en';

        if (templateName === 'hello_world') {
            await this.sendTemplate(phone10, templateName, templateLang, []);
            return;
        }

        await this.sendTemplate(phone10, templateName, templateLang, [code], [
            {
                type: 'button',
                sub_type: 'url',
                index: '0',
                parameters: [{ type: 'text', text: code }],
            },
        ]);
    }

    /**
     * Notify the store of a new customer order (fire-and-forget safe).
     * Uses WHATSAPP_ORDER_TEMPLATE_NAME when set; otherwise sends a plain text message.
     */
    async sendOrderAlert(storePhone10: string, payload: OrderWhatsAppAlertPayload): Promise<void> {
        if (!this.isEnabled()) {
            this.logger.debug('WhatsApp order alert skipped: API not configured');
            return;
        }

        const to = this.normalizeIndianPhone10(storePhone10);
        if (!to) {
            this.logger.warn('WhatsApp order alert skipped: invalid store phone');
            return;
        }

        const body = this.formatOrderAlertMessage(payload);
        const templateName = (this.config.get<string>('WHATSAPP_ORDER_TEMPLATE_NAME') || process.env.WHATSAPP_ORDER_TEMPLATE_NAME)?.trim();
        const templateLang = this.config.get<string>('WHATSAPP_ORDER_TEMPLATE_LANG') || process.env.WHATSAPP_ORDER_TEMPLATE_LANG || 'en';

        if (templateName) {
            await this.sendTemplate(to, templateName, templateLang, [body]);
        } else {
            await this.sendText(to, body);
        }
    }

    formatOrderAlertMessage(payload: OrderWhatsAppAlertPayload): string {
        const addr = payload.shippingAddress;
        const street = String(addr.streetAddress ?? addr.street ?? addr.line1 ?? '').trim();
        const city = String(addr.city ?? '').trim();
        const zip = String(addr.zipCode ?? addr.pincode ?? addr.postalCode ?? '').trim();
        const addressLine = [street, city, zip].filter(Boolean).join(', ') || '—';

        const lines = [
            `🛒 New order *${payload.orderNumber}*`,
            '',
            `Customer: ${payload.customerName}`,
        ];
        if (payload.customerPhone) lines.push(`Phone: +91 ${payload.customerPhone}`);
        if (payload.customerEmail) lines.push(`Email: ${payload.customerEmail}`);
        lines.push(`Payment: ${payload.paymentLabel}`);
        lines.push(`Total: ₹${Number(payload.payableAmount).toFixed(2)}`);
        if (payload.deliverySlot) lines.push(`Slot: ${payload.deliverySlot}`);
        lines.push('', 'Items:', ...payload.itemLines.map((l) => `• ${l}`));
        lines.push('', `Address: ${addressLine}`);
        return lines.join('\n');
    }

    /** Resolve store notify phone: env override, then theme/preferences contactPhone. */
    resolveStoreNotifyPhone(themePhone?: string | null, preferencesPhone?: string | null): string | null {
        const envPhone = (this.config.get<string>('WHATSAPP_ORDER_NOTIFY_PHONE') || process.env.WHATSAPP_ORDER_NOTIFY_PHONE)?.trim();
        return (
            this.normalizeIndianPhone10(envPhone)
            ?? this.normalizeIndianPhone10(themePhone)
            ?? this.normalizeIndianPhone10(preferencesPhone)
        );
    }

    private async sendText(phone10: string, body: string): Promise<void> {
        const to = `91${phone10}`;
        await this.postMessage({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body },
        }, to);
    }

    private async sendTemplate(
        phone10: string,
        templateName: string,
        templateLang: string,
        bodyParams: string[],
        extraComponents?: Array<Record<string, unknown>>,
    ): Promise<void> {
        const to = `91${phone10}`;
        const payload: Record<string, unknown> = {
            messaging_product: 'whatsapp',
            to,
            type: 'template',
            template: {
                name: templateName,
                language: { code: templateLang },
            },
        };

        if (templateName !== 'hello_world' && bodyParams.length > 0) {
            const components: Array<Record<string, unknown>> = [
                {
                    type: 'body',
                    parameters: bodyParams.map((text) => ({ type: 'text', text })),
                },
            ];
            if (extraComponents?.length) {
                components.push(...extraComponents);
            }
            (payload.template as Record<string, unknown>).components = components;
        }

        await this.postMessage(payload, to);
    }

    private async postMessage(payload: Record<string, unknown>, toLabel: string): Promise<void> {
        const phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID') || process.env.WHATSAPP_PHONE_NUMBER_ID;
        const accessToken = this.config.get<string>('WHATSAPP_ACCESS_TOKEN') || process.env.WHATSAPP_ACCESS_TOKEN;
        const apiVersion = this.config.get<string>('WHATSAPP_API_VERSION') || process.env.WHATSAPP_API_VERSION || 'v19.0';

        if (!phoneNumberId || !accessToken) {
            const err = new Error(
                'WhatsApp config missing: set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN in .env',
            );
            this.logger.warn(`Cannot send WhatsApp message to ${toLabel}: ${err.message}`);
            throw err;
        }

        const url = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

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
            this.logger.error(`WhatsApp Cloud API error (${res.status}) for ${toLabel}: ${text}`);
            throw new Error(`WhatsApp delivery failed: ${text || res.statusText}`);
        }

        const data = await res.json().catch(() => ({}));
        this.logger.log(
            `WhatsApp message sent to ${toLabel} — message_id: ${(data as { messages?: Array<{ id?: string }> })?.messages?.[0]?.id ?? 'unknown'}`,
        );
    }
}
