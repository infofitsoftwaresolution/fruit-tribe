/** Product fields needed for bulk / retail unit pricing. */
export type ProductPricingInput = {
  price: number;
  bulkDiscountQty?: number;
  bulkDiscountPrice?: number;
  bulkDiscountTiers?: Array<{ qty: number; totalPrice: number; unitPrice?: number }>;
  variants?: Array<{ name?: string; attributeValue?: string; price?: number; isBulkVariant?: boolean }>;
};

/** Cart line fields for recalculating unit price when quantity changes. */
export type CartPricingInput = {
  price: number;
  retailUnitPrice?: number;
  bulkDiscountQty?: number;
  bulkDiscountPrice?: number;
  bulkDiscountTiers?: Array<{ qty: number; totalPrice: number; unitPrice?: number }>;
};

/** Product shape for bulk display & pricing (includes variants + stock when available). */
export type ProductLikeForBulk = ProductPricingInput & {
  availableStock?: number;
  stock?: number;
  variants?: { price: number; availableStock?: number; stock?: number }[];
};

function normalizeBulkTiers(input: {
  bulkDiscountQty?: number;
  bulkDiscountPrice?: number;
  bulkDiscountTiers?: Array<{ qty: number; totalPrice: number; unitPrice?: number }>;
  variants?: Array<{ name?: string; attributeValue?: string; price?: number; isBulkVariant?: boolean }>;
  price?: number;
}): Array<{ qty: number; totalPrice: number; unitPrice: number }> {
  const tiers: Array<{ qty: number; totalPrice: number; unitPrice: number }> = [];
  for (const t of input.bulkDiscountTiers || []) {
    const qty = Number(t.qty);
    const totalPrice = Number(t.totalPrice);
    const unitPrice = Number.isFinite(Number(t.unitPrice)) && Number(t.unitPrice) > 0 ? Number(t.unitPrice) : (totalPrice / qty);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(totalPrice) || totalPrice <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) continue;
    tiers.push({ qty, totalPrice, unitPrice });
  }
  const legacyQty = Number(input.bulkDiscountQty);
  const legacyTotal = Number(input.bulkDiscountPrice);
  if (Number.isFinite(legacyQty) && legacyQty > 0 && Number.isFinite(legacyTotal) && legacyTotal > 0) {
    const hasSame = tiers.some((t) => t.qty === legacyQty);
    if (!hasSame) tiers.push({ qty: legacyQty, totalPrice: legacyTotal, unitPrice: legacyTotal / legacyQty });
  }
  // Fallback derivation from variant rows so bulk tab still works
  // even when precomputed tiers are absent in cached payloads.
  const retailUnit = Number(input.price ?? NaN);
  for (const v of input.variants || []) {
    const labelRaw = String(v?.name || v?.attributeValue || '').trim();
    const label = labelRaw.toLowerCase();
    if (!labelRaw || label.includes('(archived)')) continue;
    const m = label.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|kilogram|kilograms|g|gm|grams)\b/);
    if (!m) continue;
    const rawQty = Number(m[1]);
    const qty = ['g', 'gm', 'grams'].includes(m[2]) ? rawQty / 1000 : rawQty;
    const totalPrice = Number((v as any)?.price);
    if (!Number.isFinite(qty) || qty <= 0 || !Number.isFinite(totalPrice) || totalPrice <= 0) continue;
    const retailTotal = Number.isFinite(retailUnit) && retailUnit > 0 ? retailUnit * qty : NaN;
    const isDiscountTier = Number.isFinite(retailTotal) && retailTotal > 0 && totalPrice < retailTotal;
    if (!Boolean((v as any)?.isBulkVariant) && !isDiscountTier) continue;
    if (!tiers.some((t) => t.qty === qty)) {
      tiers.push({ qty, totalPrice, unitPrice: totalPrice / qty });
    }
  }
  tiers.sort((a, b) => a.qty - b.qty);
  return tiers;
}

export function getBestEligibleBulkTier(
  input: {
    bulkDiscountQty?: number;
    bulkDiscountPrice?: number;
    bulkDiscountTiers?: Array<{ qty: number; totalPrice: number; unitPrice?: number }>;
  },
  quantity: number,
): { qty: number; totalPrice: number; unitPrice: number } | null {
  const q = Math.max(0, Number(quantity) || 0);
  const tiers = normalizeBulkTiers(input);
  let best: { qty: number; totalPrice: number; unitPrice: number } | null = null;
  for (const t of tiers) {
    if (q >= t.qty) best = t;
  }
  return best;
}

/**
 * Normal retail unit price for display and non-bulk lines.
 * Ignores outlier variant prices far below the rest (e.g. ₹1 typo next to ₹400) so `Math.min`
 * cannot pick a bogus low value.
 */
export function getRetailUnitReference(
  product: ProductPricingInput & { variants?: { price: number; name?: string; attributeValue?: string }[] },
): number {
  const base = Number(product.price);
  if (Number.isFinite(base) && base > 0) {
    // Admin-updated base price should be the default storefront retail price.
    // Variant pricing is applied only when that variant is explicitly selected.
    return base;
  }
  const vars = product.variants;
  if (!vars?.length) {
    return Number.isFinite(base) && base > 0 ? base : 0;
  }
  const vp = vars.map((v) => Number(v.price)).filter((x) => Number.isFinite(x) && x > 0);
  if (vp.length === 0) return Number.isFinite(base) ? base : 0;
  return Math.min(...vp);
}

/**
 * True when admin saved a bulk rule (min qty + price per unit). Storefront shows these values exactly.
 * No comparison to retail and no stock gate — those are business choices left to the admin.
 */
export function productHasAdminBulkOffer(product: ProductLikeForBulk | undefined | null): boolean {
  if (!product) return false;
  return normalizeBulkTiers(product).length > 0;
}

/** @alias Same as {@link productHasAdminBulkOffer} — bulk block visible whenever admin configured qty + price. */
export function productHasBulkPricing(product: ProductLikeForBulk | undefined | null): boolean {
  return productHasAdminBulkOffer(product);
}

/** @deprecated Kept for compatibility. */
export function isBulkTierValid(
  retailUnitPrice: number,
  bulkQty?: number | null,
  bulkUnitPrice?: number | null,
): boolean {
  const retail = Number(retailUnitPrice);
  if (!Number.isFinite(retail) || retail <= 0) return false;
  const q = bulkQty != null ? Number(bulkQty) : 0;
  const p = bulkUnitPrice != null ? Number(bulkUnitPrice) : NaN;
  return q > 0 && Number.isFinite(p) && p > 0 && p <= retail;
}

/**
 * When quantity meets admin threshold, unit price is exactly {@link ProductPricingInput.bulkDiscountPrice}.
 * Otherwise retail reference (cheapest normal unit).
 */
export function getEffectiveUnitPrice(product: ProductLikeForBulk, quantity: number): number {
  const bestTier = getBestEligibleBulkTier(product, quantity);
  if (bestTier) return bestTier.unitPrice;
  return getRetailUnitReference(product);
}

/** Recalculate unit price from cart line metadata. */
export function getEffectiveUnitPriceFromCartItem(item: CartPricingInput, quantity: number): number {
  const retail = item.retailUnitPrice ?? item.price;
  const bestTier = getBestEligibleBulkTier(item, quantity);
  if (bestTier) return bestTier.unitPrice;
  return Number(retail);
}
