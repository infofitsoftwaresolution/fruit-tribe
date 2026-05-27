/** Shown when a product has no image or the image URL fails to load. */
export const PRODUCT_PLACEHOLDER_IMAGE = '/images/mango-placeholder.jpg';

/** Use catalog image when present; otherwise the mango placeholder. */
export function resolveProductImageSrc(src?: string | null): string {
  const trimmed = String(src ?? '').trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') {
    return PRODUCT_PLACEHOLDER_IMAGE;
  }
  return trimmed;
}
