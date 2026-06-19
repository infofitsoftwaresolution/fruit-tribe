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

type WhatsappProvider = 'meta' | 'aisensy';

/**
 * WhatsApp delivery via Meta Cloud API or AiSensy API campaigns.
 *
 * Provider: WHATSAPP_PROVIDER = meta (default) | aisensy
 *
 * Meta OTP:
 *   WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN
 *   WHATSAPP_TEMPLATE_NAME (default: otp_verification)
 *
 * AiSensy OTP (requires a Live API Campaign in the AiSensy dashboard):
 *   AISENSY_API_KEY, AISENSY_CAMPAIGN_NAME
 *   WHATSAPP_TEMPLATE_NAME is ignored — the campaign binds the template (e.g. login_otp)
 *
 * Order alerts:
 *   WHATSAPP_ORDER_NOTIFY_PHONE – override store notify number (10 digits or +91…)
 *   WHATSAPP_ORDER_TEMPLATE_NAME / AISENSY_ORDER_CAMPAIGN_NAME – optional template/campaign
 *   WHATSAPP_ORDER_TEMPLATE_LANG – template language for Meta (default: en)
 */
@Injectable()
export class WhatsappService {
    private readonly logger = new Logger(WhatsappService.name);

    constructor(private readonly config: ConfigService) { }

    private getProvider(): WhatsappProvider {
        const raw = (this.config.get<string>('WHATSAPP_PROVIDER') || process.env.WHATSAPP_PROVIDER || 'meta')
            .trim()
            .toLowerCase();
        return raw === 'aisensy' ? 'aisensy' : 'meta';
    }

    isEnabled(): boolean {
        if (this.getProvider() === 'aisensy') {
            const apiKey = this.getAisensyApiKey();
            const campaignName = this.getAisensyOtpCampaignName();
            const enabled = Boolean(apiKey && campaignName);
            this.logger.debug(
                `WhatsApp Service (AiSensy) enabled: ${enabled} (API key: ${apiKey ? 'SET' : 'MISSING'}, campaign: ${campaignName ? 'SET' : 'MISSING'})`,
            );
            return enabled;
        }

        const phoneNumberId = (this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID') || process.env.WHATSAPP_PHONE_NUMBER_ID)?.trim();
        const accessToken = (this.config.get<string>('WHATSAPP_ACCESS_TOKEN') || process.env.WHATSAPP_ACCESS_TOKEN)?.trim();

        const enabled = Boolean(phoneNumberId && accessToken);
        this.logger.debug(`WhatsApp Service (Meta) enabled: ${enabled} (ID: ${phoneNumberId ? 'SET' : 'MISSING'}, Token: ${accessToken ? 'SET' : 'MISSING'})`);

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
        if (this.getProvider() === 'aisensy') {
            await this.sendAisensyCampaign(phone10, this.getAisensyOtpCampaignName()!, [code], 'OTP');
            return;
        }

        const templateName = this.config.get<string>('WHATSAPP_TEMPLATE_NAME') || 'otp_verification';
        const templateLang = this.config.get<string>('WHATSAPP_TEMPLATE_LANG') || 'en';

        if (templateName === 'hello_world') {
            await this.sendMetaTemplate(phone10, templateName, templateLang, []);
            return;
        }

        await this.sendMetaTemplate(phone10, templateName, templateLang, [code], [
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

        if (this.getProvider() === 'aisensy') {
            const orderCampaign = this.getAisensyOrderCampaignName();
            if (orderCampaign) {
                await this.sendAisensyCampaign(to, orderCampaign, [body], 'order alert');
            } else {
                this.logger.warn('AiSensy order alert skipped: set AISENSY_ORDER_CAMPAIGN_NAME or use Meta for plain-text alerts');
            }
            return;
        }

        if (templateName) {
            await this.sendMetaTemplate(to, templateName, templateLang, [body]);
        } else {
            await this.sendMetaText(to, body);
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

    private getAisensyApiKey(): string | undefined {
        return (this.config.get<string>('AISENSY_API_KEY') || process.env.AISENSY_API_KEY)?.trim() || undefined;
    }

    private getAisensyOtpCampaignName(): string | undefined {
        return (this.config.get<string>('AISENSY_CAMPAIGN_NAME') || process.env.AISENSY_CAMPAIGN_NAME)?.trim() || undefined;
    }

    private getAisensyOrderCampaignName(): string | undefined {
        return (
            this.config.get<string>('AISENSY_ORDER_CAMPAIGN_NAME')
            || process.env.AISENSY_ORDER_CAMPAIGN_NAME
            || this.config.get<string>('WHATSAPP_ORDER_TEMPLATE_NAME')
            || process.env.WHATSAPP_ORDER_TEMPLATE_NAME
        )?.trim() || undefined;
    }

    private async sendAisensyCampaign(
        phone10: string,
        campaignName: string,
        templateParams: string[],
        label: string,
    ): Promise<void> {
        const apiKey = this.getAisensyApiKey();
        if (!apiKey || !campaignName) {
            const err = new Error('AiSensy config missing: set AISENSY_API_KEY and AISENSY_CAMPAIGN_NAME in .env');
            this.logger.warn(`Cannot send AiSensy ${label} to 91${phone10}: ${err.message}`);
            throw err;
        }

        const destination = `+91${phone10}`;
        const payload = {
            apiKey,
            campaignName,
            destination,
            userName: 'Customer',
            templateParams,
        };

        const res = await fetch('https://backend.aisensy.com/campaign/t1/api/v2', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!res.ok) {
            const text = await res.text().catch(() => res.statusText);
            this.logger.error(`AiSensy API error (${res.status}) for ${destination} [${label}]: ${text}`);
            throw new Error(`WhatsApp delivery failed: ${text || res.statusText}`);
        }

        const data = await res.json().catch(() => ({}));
        this.logger.log(`AiSensy ${label} sent to ${destination} — response: ${JSON.stringify(data)}`);
    }

    private async sendMetaText(phone10: string, body: string): Promise<void> {
        const to = `91${phone10}`;
        await this.postMetaMessage({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body },
        }, to);
    }

    private async sendMetaTemplate(
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

        await this.postMetaMessage(payload, to);
    }

    private async postMetaMessage(payload: Record<string, unknown>, toLabel: string): Promise<void> {
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
