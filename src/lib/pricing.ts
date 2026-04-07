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

/** Unit price when ordering `quantity` units (bulk tier applies when qty ≥ bulk threshold). */
export function getEffectiveUnitPrice(product: ProductPricingInput, quantity: number): number {
  const q = Math.max(0, Math.floor(quantity));
  const bulkQ = product.bulkDiscountQty;
  const bulkP = product.bulkDiscountPrice;
  if (bulkQ && bulkQ > 0 && bulkP != null && Number(bulkP) > 0 && q >= bulkQ) {
    return Number(bulkP);
  }
  return product.price;
}

/** Recalculate unit price from cart line metadata (works without a live product in context). */
export function getEffectiveUnitPriceFromCartItem(item: CartPricingInput, quantity: number): number {
  const q = Math.max(0, Math.floor(quantity));
  const retail = item.retailUnitPrice ?? item.price;
  const bulkQ = item.bulkDiscountQty;
  const bulkP = item.bulkDiscountPrice;
  if (bulkQ && bulkQ > 0 && bulkP != null && Number(bulkP) > 0 && q >= bulkQ) {
    return Number(bulkP);
  }
  return retail;
}

export function productHasBulkPricing(product: ProductPricingInput | undefined | null): boolean {
  if (!product) return false;
  const q = product.bulkDiscountQty;
  const p = product.bulkDiscountPrice;
  return !!(q && q > 0 && p != null && Number(p) > 0);
}
