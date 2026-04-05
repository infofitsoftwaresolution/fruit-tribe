export type OsmPoint = { lat: number; lng: number };

/**
 * Build OpenStreetMap embed URLs (same tile source as checkout / profile).
 * Always uses a bounding box so the iframe reliably zooms to the area (center+zoom alone often shows a world view).
 */
export function buildOpenStreetMapEmbedSrc(
  points: OsmPoint[],
  opts?: { paddingDeg?: number }
): string | null {
  const valid = points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
  if (valid.length === 0) return null;

  const pad =
    opts?.paddingDeg ??
    (valid.length === 1 ? 0.012 : 0.02);

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const p of valid) {
    minLat = Math.min(minLat, p.lat);
    maxLat = Math.max(maxLat, p.lat);
    minLng = Math.min(minLng, p.lng);
    maxLng = Math.max(maxLng, p.lng);
  }
  if (maxLat - minLat < 0.002) {
    minLat -= pad;
    maxLat += pad;
  }
  if (maxLng - minLng < 0.002) {
    minLng -= pad;
    maxLng += pad;
  }
  const bbox = `${minLng - pad},${minLat - pad},${maxLng + pad},${maxLat + pad}`;
  const bboxParam = encodeURIComponent(bbox);
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bboxParam}&layer=mapnik`;
}

type OpenStreetMapEmbedProps = {
  title: string;
  src: string;
  className?: string;
};

export function OpenStreetMapEmbed({ title, src, className }: OpenStreetMapEmbedProps) {
  return (
    <iframe
      title={title}
      src={src}
      className={className ?? 'w-full h-52 border-0'}
      loading="lazy"
      referrerPolicy="no-referrer"
    />
  );
}
