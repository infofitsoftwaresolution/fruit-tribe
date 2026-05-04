import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const MAPBOX_MATRIX_BASE_URL = 'https://api.mapbox.com/directions-matrix/v1/mapbox';
const MAPBOX_DIRECTIONS_BASE_URL = 'https://api.mapbox.com/directions/v5/mapbox';

type MapboxMatrixResponse = {
    distances?: Array<Array<number | null>>;
};

type MapboxDirectionsResponse = {
    routes?: Array<{ distance?: number }>;
};

@Injectable()
export class GeoapifyService {
    private readonly logger = new Logger(GeoapifyService.name);

    constructor(private readonly config: ConfigService) {}

    /**
     * Minimum driving distance (km) from any source to destination using Mapbox Matrix API.
     * Returns null if MAPBOX_API_KEY is unset or the API does not return usable distances.
     */
    async minDrivingDistanceKm(
        sources: { latitude: number; longitude: number }[],
        destination: { latitude: number; longitude: number },
    ): Promise<number | null> {
        const apiKey = this.config.get<string>('MAPBOX_API_KEY')?.trim();
        if (!apiKey) {
            return null;
        }

        const validSources = sources
            .map((s) => ({ latitude: Number(s.latitude), longitude: Number(s.longitude) }))
            .filter((s) => Number.isFinite(s.latitude) && Number.isFinite(s.longitude));
        const dest = { latitude: Number(destination.latitude), longitude: Number(destination.longitude) };
        if (!Number.isFinite(dest.latitude) || !Number.isFinite(dest.longitude) || validSources.length === 0) {
            return null;
        }

        // Matrix API rejects a 1x1 matrix; use Directions API for single fixed warehouse.
        if (validSources.length === 1) {
            const src = validSources[0];
            const coords = `${src.longitude},${src.latitude};${dest.longitude},${dest.latitude}`;
            const dirUrl = `${MAPBOX_DIRECTIONS_BASE_URL}/driving/${coords}?${new URLSearchParams({
                access_token: apiKey,
                alternatives: 'false',
                overview: 'false',
                geometries: 'geojson',
            })}`;
            try {
                const res = await fetch(dirUrl, { method: 'GET', headers: { Accept: 'application/json' } });
                if (!res.ok) {
                    const text = await res.text().catch(() => '');
                    this.logger.warn(`Mapbox directions HTTP ${res.status}: ${text.slice(0, 200)}`);
                    return null;
                }
                const data = (await res.json()) as MapboxDirectionsResponse;
                const m = data?.routes?.[0]?.distance;
                if (!Number.isFinite(m) || (m as number) < 0) return null;
                return Math.round(((m as number) / 1000) * 10) / 10;
            } catch (e) {
                this.logger.warn(`Mapbox directions failed: ${e instanceof Error ? e.message : String(e)}`);
                return null;
            }
        }

        /** Mapbox allows at most 25 coordinates per matrix request (sources + destinations). */
        const MAX_SOURCES_PER_REQUEST = 24;
        let minMeters = Infinity;

        try {
            for (let off = 0; off < validSources.length; off += MAX_SOURCES_PER_REQUEST) {
                const chunk = validSources.slice(off, off + MAX_SOURCES_PER_REQUEST);
                const points = [...chunk, dest];
                const destinationIndex = points.length - 1;
                const coordinates = points.map((p) => `${p.longitude},${p.latitude}`).join(';');
                const sourceIndices = chunk.map((_, i) => String(i)).join(';');
                const url = `${MAPBOX_MATRIX_BASE_URL}/driving/${coordinates}?${new URLSearchParams({
                    annotations: 'distance',
                    sources: sourceIndices,
                    destinations: String(destinationIndex),
                    access_token: apiKey,
                })}`;

                const res = await fetch(url, {
                    method: 'GET',
                    headers: { Accept: 'application/json' },
                });
                if (!res.ok) {
                    const text = await res.text().catch(() => '');
                    this.logger.warn(`Mapbox matrix HTTP ${res.status}: ${text.slice(0, 200)}`);
                    continue;
                }
                const data = (await res.json()) as MapboxMatrixResponse;
                const matrix = data.distances;
                if (!Array.isArray(matrix) || matrix.length === 0) {
                    continue;
                }

                for (const row of matrix) {
                    if (!Array.isArray(row) || row.length === 0) continue;
                    const d = row[0];
                    if (Number.isFinite(d) && d >= 0 && d < minMeters) {
                        minMeters = d;
                    }
                }
            }
            if (!Number.isFinite(minMeters)) {
                return null;
            }
            return Math.round((minMeters / 1000) * 10) / 10;
        } catch (e) {
            this.logger.warn(`Mapbox matrix failed: ${e instanceof Error ? e.message : String(e)}`);
            return null;
        }
    }
}
