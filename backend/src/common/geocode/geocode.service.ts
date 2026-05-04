import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

/** Public Nominatim asks for a descriptive UA; override via env in production. */
const DEFAULT_UA =
    process.env.NOMINATIM_USER_AGENT?.trim() ||
    'TheFruitTribe/1.0 (checkout geocode; contact: support via site admin)';

/** In-memory cache: fewer duplicate Nominatim calls under checkout typing + many concurrent users. */
const GEOCODE_CACHE_MAX = Math.min(5000, Math.max(200, Number(process.env.GEOCODE_CACHE_MAX_ENTRIES) || 2000));
const GEOCODE_CACHE_TTL_HIT_MS = Math.max(
    60_000,
    Number(process.env.GEOCODE_CACHE_TTL_HIT_MS) || 86_400_000,
);
/** Short TTL for empty arrays (often rate-limit / transient); avoids hammering OSM. */
const GEOCODE_CACHE_TTL_EMPTY_MS = Math.max(10_000, Number(process.env.GEOCODE_CACHE_TTL_EMPTY_MS) || 120_000);

type GeocodeCacheRow = { expiresAt: number; data: unknown[] };

type MapboxGeocodeFeature = {
    place_type?: string[];
    text?: string;
    place_name?: string;
    center?: [number, number];
    context?: Array<{ id?: string; text?: string }>;
};

@Injectable()
export class GeocodeService {
    private readonly logger = new Logger(GeocodeService.name);
    private readonly geocodeCache = new Map<string, GeocodeCacheRow>();

    constructor(private readonly config: ConfigService) {}

    private nominatimHeaders(): HeadersInit {
        return { 'Accept-Language': 'en', 'User-Agent': DEFAULT_UA };
    }

    private cacheGet(key: string): unknown[] | undefined {
        const row = this.geocodeCache.get(key);
        if (!row) return undefined;
        if (Date.now() > row.expiresAt) {
            this.geocodeCache.delete(key);
            return undefined;
        }
        return row.data;
    }

    private cacheSet(key: string, data: unknown[]): void {
        const ttl = Array.isArray(data) && data.length > 0 ? GEOCODE_CACHE_TTL_HIT_MS : GEOCODE_CACHE_TTL_EMPTY_MS;
        this.geocodeCache.set(key, { expiresAt: Date.now() + ttl, data });
        while (this.geocodeCache.size > GEOCODE_CACHE_MAX) {
            const first = this.geocodeCache.keys().next().value;
            if (first === undefined) break;
            this.geocodeCache.delete(first);
        }
    }

    private qCacheKey(trimmed: string, lim: number): string {
        const h = createHash('sha1').update(trimmed).digest('hex');
        return `q:${lim}:${h}`;
    }

    private mapboxFeaturesToNominatimLike(features: MapboxGeocodeFeature[]): unknown[] {
        const out: unknown[] = [];
        for (const f of features) {
            const c = f.center;
            if (!Array.isArray(c) || c.length < 2) continue;
            const lon = Number(c[0]);
            const lat = Number(c[1]);
            if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
            const types = f.place_type ?? [];
            let postcode = '';
            if (types.includes('postcode') && f.text) {
                postcode = String(f.text).replace(/\D/g, '').slice(0, 6);
            }
            const address: Record<string, string> = {};
            if (f.context) {
                for (const ctx of f.context) {
                    const id = ctx.id ?? '';
                    if (!postcode && id.startsWith('postcode.')) {
                        postcode = String(ctx.text ?? '').replace(/\D/g, '').slice(0, 6);
                    }
                    if (id.startsWith('region.')) address.state = ctx.text ?? address.state;
                    if (id.startsWith('place.') || id.startsWith('district.')) {
                        address.city = address.city || (ctx.text ?? '');
                    }
                    if (id.startsWith('country.')) address.country = ctx.text ?? address.country;
                }
            }
            if (postcode) address.postcode = postcode;
            out.push({
                lat: String(lat),
                lon: String(lon),
                display_name: f.place_name ?? `${lat}, ${lon}`,
                address,
            });
        }
        return out;
    }

    /** Mapbox Places forward (India). Empty if `MAPBOX_API_KEY` unset or request fails. */
    private async mapboxForwardIndia(query: string, limit: number): Promise<unknown[]> {
        const token = this.config.get<string>('MAPBOX_API_KEY')?.trim();
        if (!token || !query.trim()) return [];
        const lim = Math.min(12, Math.max(1, Math.floor(limit) || 12));
        const path = encodeURIComponent(query.trim());
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${path}.json?${new URLSearchParams({
            access_token: token,
            country: 'IN',
            limit: String(lim),
            language: 'en',
        })}`;
        try {
            const res = await fetch(url, { headers: { Accept: 'application/json' } });
            if (!res.ok) {
                const text = await res.text().catch(() => '');
                this.logger.warn(`Mapbox geocode HTTP ${res.status}: ${text.slice(0, 160)}`);
                return [];
            }
            const data = (await res.json()) as { features?: MapboxGeocodeFeature[] };
            const feats = Array.isArray(data?.features) ? data.features : [];
            return this.mapboxFeaturesToNominatimLike(feats);
        } catch (e) {
            this.logger.warn(`Mapbox geocode failed: ${e instanceof Error ? e.message : String(e)}`);
            return [];
        }
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
        const ck = this.qCacheKey(trimmed, lim);
        const cached = this.cacheGet(ck);
        if (cached !== undefined) return cached;

        /** `postalcode=` resolves Indian PINs much more reliably than `q=5600xx, India`. */
        const pinOnly = trimmed.match(/^(\d{6})(\s*,\s*India)?$/i);
        if (pinOnly) {
            const pc = pinOnly[1];
            const mb = await this.mapboxForwardIndia(pc, lim);
            if (mb.length > 0) {
                this.cacheSet(ck, mb);
                return mb;
            }
            const urlPc = `${NOMINATIM_BASE}/search?format=json&addressdetails=1&postalcode=${encodeURIComponent(pc)}&countrycodes=in&limit=${lim}`;
            const resPc = await fetch(urlPc, { headers: this.nominatimHeaders() });
            if (resPc.ok) {
                const dataPc = await resPc.json();
                if (Array.isArray(dataPc) && dataPc.length > 0) {
                    this.cacheSet(ck, dataPc);
                    return dataPc;
                }
            }
        }
        const url = `${NOMINATIM_BASE}/search?format=json&addressdetails=1&q=${encodeURIComponent(trimmed)}&limit=${lim}&countrycodes=in`;
        const res = await fetch(url, { headers: this.nominatimHeaders() });
        if (!res.ok) {
            this.cacheSet(ck, []);
            return [];
        }
        const data = await res.json();
        let out = Array.isArray(data) ? data : [];
        if (out.length === 0) {
            const mb = await this.mapboxForwardIndia(trimmed, lim);
            out = mb;
        }
        this.cacheSet(ck, out);
        return out;
    }

    /**
     * Structured PIN lookup — used when phrase/street search returns nothing.
     * Prefer this over embedding the PIN only inside `q=`.
     */
    async searchIndiaByPostalCode(postalcode: string, limit: number): Promise<unknown[]> {
        const pc = postalcode.replace(/\D/g, '').slice(0, 6);
        if (pc.length !== 6) return [];
        const lim = Math.min(12, Math.max(1, Math.floor(limit) || 12));
        const ck = `pc:${pc}:${lim}`;
        const cached = this.cacheGet(ck);
        if (cached !== undefined) return cached;

        const mb = await this.mapboxForwardIndia(pc, lim);
        if (mb.length > 0) {
            this.cacheSet(ck, mb);
            return mb;
        }

        const urlPc = `${NOMINATIM_BASE}/search?format=json&addressdetails=1&postalcode=${encodeURIComponent(pc)}&countrycodes=in&limit=${lim}`;
        const resPc = await fetch(urlPc, { headers: this.nominatimHeaders() });
        if (!resPc.ok) {
            this.cacheSet(ck, []);
            return [];
        }
        const dataPc = await resPc.json();
        if (Array.isArray(dataPc) && dataPc.length > 0) {
            this.cacheSet(ck, dataPc);
            return dataPc;
        }
        const urlQ = `${NOMINATIM_BASE}/search?format=json&addressdetails=1&q=${encodeURIComponent(`${pc}, India`)}&limit=${lim}&countrycodes=in`;
        const resQ = await fetch(urlQ, { headers: this.nominatimHeaders() });
        if (!resQ.ok) {
            this.cacheSet(ck, []);
            return [];
        }
        const dataQ = await resQ.json();
        const out = Array.isArray(dataQ) ? dataQ : [];
        this.cacheSet(ck, out);
        return out;
    }

    async reverse(lat: number, lon: number): Promise<unknown> {
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return {};
        const url = `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
        const res = await fetch(url, { headers: this.nominatimHeaders() });
        if (!res.ok) return {};
        return res.json();
    }
}
