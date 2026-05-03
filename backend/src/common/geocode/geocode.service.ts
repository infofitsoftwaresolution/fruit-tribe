import { Injectable } from '@nestjs/common';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

/** Public Nominatim asks for a descriptive UA; override via env in production. */
const DEFAULT_UA =
    process.env.NOMINATIM_USER_AGENT?.trim() ||
    'TheFruitTribe/1.0 (checkout geocode; contact: support via site admin)';

@Injectable()
export class GeocodeService {
    private nominatimHeaders(): HeadersInit {
        return { 'Accept-Language': 'en', 'User-Agent': DEFAULT_UA };
    }

    /**
     * Proxies to Nominatim without an artificial global queue so checkout distance can update
     * as soon as OSM responds. (Haversine on the client stays unchanged.)
     * Heavy parallel use may hit Nominatim rate limits — prefer own geocoder in production.
     */
    async searchIndia(q: string, limit: number): Promise<unknown[]> {
        const trimmed = q.trim();
        if (!trimmed) return [];
        const lim = Math.min(12, Math.max(1, Math.floor(limit) || 12));
        /** `postalcode=` resolves Indian PINs much more reliably than `q=5600xx, India`. */
        const pinOnly = trimmed.match(/^(\d{6})(\s*,\s*India)?$/i);
        if (pinOnly) {
            const pc = pinOnly[1];
            const urlPc = `${NOMINATIM_BASE}/search?format=json&addressdetails=1&postalcode=${encodeURIComponent(pc)}&countrycodes=in&limit=${lim}`;
            const resPc = await fetch(urlPc, { headers: this.nominatimHeaders() });
            if (resPc.ok) {
                const dataPc = await resPc.json();
                if (Array.isArray(dataPc) && dataPc.length > 0) return dataPc;
            }
        }
        const url = `${NOMINATIM_BASE}/search?format=json&addressdetails=1&q=${encodeURIComponent(trimmed)}&limit=${lim}&countrycodes=in`;
        const res = await fetch(url, { headers: this.nominatimHeaders() });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    }

    /**
     * Structured PIN lookup — used when phrase/street search returns nothing.
     * Prefer this over embedding the PIN only inside `q=`.
     */
    async searchIndiaByPostalCode(postalcode: string, limit: number): Promise<unknown[]> {
        const pc = postalcode.replace(/\D/g, '').slice(0, 6);
        if (pc.length !== 6) return [];
        const lim = Math.min(12, Math.max(1, Math.floor(limit) || 12));
        const urlPc = `${NOMINATIM_BASE}/search?format=json&addressdetails=1&postalcode=${encodeURIComponent(pc)}&countrycodes=in&limit=${lim}`;
        const resPc = await fetch(urlPc, { headers: this.nominatimHeaders() });
        if (!resPc.ok) return [];
        const dataPc = await resPc.json();
        if (Array.isArray(dataPc) && dataPc.length > 0) return dataPc;
        const urlQ = `${NOMINATIM_BASE}/search?format=json&addressdetails=1&q=${encodeURIComponent(`${pc}, India`)}&limit=${lim}&countrycodes=in`;
        const resQ = await fetch(urlQ, { headers: this.nominatimHeaders() });
        if (!resQ.ok) return [];
        const dataQ = await resQ.json();
        return Array.isArray(dataQ) ? dataQ : [];
    }

    async reverse(lat: number, lon: number): Promise<unknown> {
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return {};
        const url = `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
        const res = await fetch(url, { headers: this.nominatimHeaders() });
        if (!res.ok) return {};
        return res.json();
    }
}
