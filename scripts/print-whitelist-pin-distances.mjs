#!/usr/bin/env node
/**
 * Print each serviceable whitelist PIN with distance (km) to the nearest active warehouse,
 * using the same backend geocode proxy as checkout: GET /v1/geocode/search?postalcode=…
 *
 * Usage:
 *   node scripts/print-whitelist-pin-distances.mjs
 *   node scripts/print-whitelist-pin-distances.mjs http://localhost:3000/v1
 *
 * Requires the API reachable (local Nest or deployed). Adds a short delay between PINs
 * to reduce Nominatim rate-limit issues.
 */

const API_BASE = process.argv[2]?.replace(/\/$/, '') || 'http://localhost:3000/v1';
/** Nominatim is strict about burst traffic; increase if you see many empty hit rows. */
const DELAY_MS = Number(process.env.PIN_GEOCODE_DELAY_MS || 1100);

const R = 6371;
function haversineKm(lat1, lon1, lat2, lon2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function json(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status}`);
  return res.json();
}

function warehousesFromPayload(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.value)) return data.value;
  return [];
}

/** Prefer highest Nominatim importance among hits with finite lat/lon. */
function pickHit(hits) {
  if (!Array.isArray(hits) || hits.length === 0) return null;
  let best = null;
  let bestImp = -Infinity;
  for (const h of hits) {
    const lat = parseFloat(h.lat);
    const lon = parseFloat(h.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    const imp = h.importance != null ? Number(h.importance) : 0;
    if (imp >= bestImp) {
      bestImp = imp;
      best = { lat, lon, display_name: h.display_name || '', importance: imp };
    }
  }
  return best;
}

function minDistanceKm(lat, lon, warehouses) {
  let min = Infinity;
  for (const w of warehouses) {
    const la = Number(w.latitude);
    const lo = Number(w.longitude);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) continue;
    const d = haversineKm(la, lo, lat, lon);
    if (d < min) min = d;
  }
  if (!Number.isFinite(min)) return null;
  return Math.round(min * 10) / 10;
}

async function main() {
  const [areas, whRaw] = await Promise.all([
    json(`${API_BASE}/settings/serviceable-areas`),
    json(`${API_BASE}/warehouses?active=true`),
  ]);
  const pins = [...(areas.pincodes || [])].sort();
  const warehouses = warehousesFromPayload(whRaw);
  if (!pins.length) {
    console.error('No pincodes in serviceable-areas response.');
    process.exit(1);
  }
  if (!warehouses.length) {
    console.error('No warehouses returned — cannot compute distance.');
    process.exit(1);
  }

  console.log(`API: ${API_BASE}`);
  console.log(`Warehouses: ${warehouses.map((w) => `${w.name} (${w.latitude},${w.longitude})`).join(' | ')}`);
  console.log('');
  console.log('| PIN | km (nearest WH) | hits | label (best hit) |');
  console.log('|-----|-----------------|------|------------------|');

  for (const pin of pins) {
    await sleep(DELAY_MS);
    let hits = [];
    try {
      hits = await json(`${API_BASE}/geocode/search?${new URLSearchParams({ postalcode: pin, limit: '12' })}`);
      if (!Array.isArray(hits) || hits.length === 0) {
        await sleep(400);
        hits = await json(`${API_BASE}/geocode/search?${new URLSearchParams({ q: `${pin}, India`, limit: '12' })}`);
      }
    } catch (e) {
      console.log(`| ${pin} | — | — | **fetch error:** ${e.message} |`);
      continue;
    }
    const pick = pickHit(hits);
    if (!pick) {
      console.log(`| ${pin} | — | 0 | no geocode hits (Nominatim empty / blocked) |`);
      continue;
    }
    const km = minDistanceKm(pick.lat, pick.lon, warehouses);
    const label = pick.display_name.replace(/\|/g, '/').slice(0, 80);
    console.log(`| ${pin} | ${km ?? '—'} | ${hits.length} | ${label} |`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
