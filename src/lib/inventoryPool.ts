/** Parse pack weight from variant label (e.g. "10kg" → 10). */
export function parsePackQtyKg(rawValue: string | null | undefined): number {
  const label = String(rawValue ?? '').trim().toLowerCase();
  if (!label || label === 'default') return 1;
  const m = label.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|kilogram|kilograms|g|gm|grams)\b/);
  if (!m) return 1;
  const rawQty = Number(m[1]);
  const unit = m[2];
  let kg = ['g', 'gm', 'grams'].includes(unit) ? rawQty / 1000 : rawQty;
  if (!Number.isFinite(kg) || kg <= 0) kg = 1;
  return kg;
}

export function variantPacksAvailable(productAvailableKg: number, packKg: number): number {
  const pack = Math.max(0.001, packKg);
  return Math.floor(Math.max(0, productAvailableKg) / pack);
}
