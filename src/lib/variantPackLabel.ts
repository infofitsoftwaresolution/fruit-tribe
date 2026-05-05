/**
 * Insert spaces between numeric quantities and common unit tokens (e.g. 4kg → 4 kg, 500g → 500 g).
 * Safe for labels that already contain spaces; avoids touching unrelated digits when possible.
 */
export function humanizePackLabelString(input: string): string {
  let s = String(input || '').trim();
  if (!s) return s;

  s = s.replace(
    /(\d+(?:\.\d+)?)\s*(kg|kgs|g|gm|gram|grams|lb|lbs|oz)\b/gi,
    (_, n, u) => `${n} ${u.toLowerCase()}`,
  );
  s = s.replace(
    /(\d+(?:\.\d+)?)(kg|kgs|g|gm)(?=pack)/gi,
    (_, n, u) => `${n} ${u.toLowerCase()} `,
  );
  s = s.replace(
    /(\d+(?:\.\d+)?)\s*(pc|pcs|piece|pieces|box|bx|doz|dozen|pkt|tray|roll|unit|units)\b/gi,
    (_, n, u) => `${n} ${u.toLowerCase()}`,
  );

  return s.replace(/\s{2,}/g, ' ').trim();
}

/**
 * Parse variant names like "4kg pack", "30 kg", or free-form admin text into a display label and pack qty.
 */
export function parseVariantPackDescriptor(
  rawName: string,
  fallbackUnit: string,
): { label: string; packQty: number; packUnit: string } {
  const cleaned = String(rawName || '').trim();
  const fallback = String(fallbackUnit || 'kg').trim().toLowerCase() || 'kg';
  if (!cleaned) return { label: `1 ${fallback}`, packQty: 1, packUnit: fallback };

  const humanized = humanizePackLabelString(cleaned);

  const parseCore = (source: string): { label: string; packQty: number; packUnit: string } | null => {
    const matched = source.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|kilogram|kilograms|g|gm|gram|grams|l|liter|litre|ml|pc|pcs|piece|pieces|unit|units)\b/i);
    if (!matched) return null;
    const qty = Number(matched[1]);
    const unit = String(matched[2] || fallback).toLowerCase();
    const normalizedQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
    return { label: `${normalizedQty} ${unit}`, packQty: normalizedQty, packUnit: unit };
  };

  const fromClean = parseCore(cleaned);
  if (fromClean) return fromClean;

  const fromHuman = humanized !== cleaned ? parseCore(humanized) : null;
  if (fromHuman) return fromHuman;

  // Avoid deriving pack size from SKU-like strings (e.g. SKU-1776-...-30).
  const startsWithQty = cleaned.match(/^\s*(\d+(?:\.\d+)?)(?:\s|$)/);
  if (startsWithQty) {
    const qty = Number(startsWithQty[1]);
    const normalizedQty = Number.isFinite(qty) && qty > 0 ? qty : 1;
    return { label: `${normalizedQty} ${fallback}`, packQty: normalizedQty, packUnit: fallback };
  }

  return {
    label: humanized || cleaned,
    packQty: 1,
    packUnit: fallback,
  };
}
