/** Product fields needed for bulk / retail unit pricing. */
export type ProductPricingInput = {
  price: number;
  bulkDiscountQty?: number;
  bulkDiscountPrice?: number;
};

/** Cart line fields for recalculating unit price when quantity changes. */
export type CartPricingInput = {
  price: number;
  retailUnitPrice?: number;
  bulkDiscountQty?: number;
  bulkDiscountPrice?: number;
};

/** Product shape for bulk display & pricing (includes variants + stock when available). */
export type ProductLikeForBulk = ProductPricingInput & {
  availableStock?: number;
  stock?: number;
  variants?: { price: number; availableStock?: number; stock?: number }[];
};

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
  const bulkQ = product.bulkDiscountQty;
  const bulkP = product.bulkDiscountPrice;
  const q = bulkQ != null ? Number(bulkQ) : 0;
  const p = bulkP != null ? Number(bulkP) : NaN;
  return q > 0 && Number.isFinite(p) && p > 0;
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
  const q = Math.max(0, Math.floor(quantity));
  const bulkQ = product.bulkDiscountQty;
  const bulkP = product.bulkDiscountPrice;
  if (bulkQ && bulkQ > 0 && q >= bulkQ && bulkP != null && Number(bulkP) > 0) {
    return Number(bulkP) / Number(bulkQ);
  }
  return getRetailUnitReference(product);
}

/** Recalculate unit price from cart line metadata. */
export function getEffectiveUnitPriceFromCartItem(item: CartPricingInput, quantity: number): number {
  const q = Math.max(0, Math.floor(quantity));
  const retail = item.retailUnitPrice ?? item.price;
  const bulkQ = item.bulkDiscountQty;
  const bulkP = item.bulkDiscountPrice;
  if (bulkQ && bulkQ > 0 && q >= bulkQ && bulkP != null && Number(bulkP) > 0) {
    return Number(bulkP) / Number(bulkQ);
  }
  return Number(retail);
}
