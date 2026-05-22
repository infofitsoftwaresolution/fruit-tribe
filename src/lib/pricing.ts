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

/** Best-effort sellable units (product-level or sum of variant availability). */
export function productAvailableStock(
  product: { availableStock?: number; stock?: number; variants?: Array<{ availableStock?: number; stock?: number }> },
): number {
  const variantTotal = (product.variants || []).reduce(
    (sum, v) => sum + Math.max(0, Number(v.availableStock ?? v.stock ?? 0)),
    0,
  );
  const productLevel = Math.max(0, Number(product.availableStock ?? product.stock ?? 0));
  return Math.max(productLevel, variantTotal);
}

export function isProductInStock(
  product: { availableStock?: number; stock?: number; variants?: Array<{ availableStock?: number; stock?: number }> },
): boolean {
  return productAvailableStock(product) > 0;
}

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
 * Bracket suffix such as " (10% off)" when the pack's implied unit price is below the retail unit baseline.
 */
export function formatPerUnitPackDiscountSuffix(
  retailUnitRef: number,
  packQty: number,
  packTotalPrice: number,
): string {
  const qty = Math.max(1, Math.abs(Number(packQty)) || 1);
  const total = Number(packTotalPrice);
  const retail = Number(retailUnitRef);
  if (!(retail > 0) || !Number.isFinite(total) || total <= 0) return '';
  const unitPrice = total / qty;
  if (!Number.isFinite(unitPrice) || unitPrice <= 0 || unitPrice >= retail) return '';
  const pct = Math.round(((retail - unitPrice) / retail) * 100);
  if (pct <= 0) return '';
  return ` (${pct}% off)`;
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

type CartLikeItem = {
  id: string | number;
  productId?: string | number;
  quantity: number;
  price: number;
  selectedVariantSku?: string;
  selectedVariantId?: string;
  selectedVariantName?: string;
  selectedVariantPackQty?: number;
};

type ProductLike = {
  id: string | number;
  price: number;
  bulkDiscountTiers?: Array<{ qty: number; totalPrice: number; unitPrice?: number }>;
};

function parsePackQtyFromCartItem(item: CartLikeItem): number {
  const direct = Number(item.selectedVariantPackQty);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const raw = String(item.selectedVariantName || '').trim().toLowerCase();
  const m = raw.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|kilogram|kilograms|g|gm|grams)\b/);
  if (!m) return 1;
  const q = Number(m[1]);
  if (!Number.isFinite(q) || q <= 0) return 1;
  return ['g', 'gm', 'grams'].includes(m[2]) ? q / 1000 : q;
}

export function estimateCartLineTotalsWithTierDiscount(
  items: CartLikeItem[],
  products: ProductLike[],
): { lineTotals: Record<string, number>; subtotal: number } {
  const lineTotals: Record<string, number> = {};
  if (!items.length) return { lineTotals, subtotal: 0 };

  const itemsByProduct = new Map<string, CartLikeItem[]>();
  for (const item of items) {
    const pid = String(item.productId ?? item.id);
    const list = itemsByProduct.get(pid) || [];
    list.push(item);
    itemsByProduct.set(pid, list);
  }

  for (const [pid, productItems] of itemsByProduct.entries()) {
    const product = products.find((p) => String(p.id) === pid);
    const baseUnit = Number(product?.price || 0);
    const inferredPackRows = productItems.map((item) => {
      const packQty = parsePackQtyFromCartItem(item);
      const packPrice = Number(item.price || 0);
      const unit = packQty > 0 ? packPrice / packQty : packPrice;
      return { item, packQty, packPrice, unit };
    });
    const inferredRetailUnit = Number.isFinite(baseUnit) && baseUnit > 0
      ? baseUnit
      : inferredPackRows
          .map((r) => r.unit)
          .filter((u) => Number.isFinite(u) && u > 0)
          .sort((a, b) => b - a)[0] || 0;
    const inferredVariantTiers = inferredPackRows
      .map((r) => {
        if (!(r.packQty > 0 && inferredRetailUnit > 0)) return null;
        const pct = ((inferredRetailUnit - r.unit) / inferredRetailUnit) * 100;
        if (!(Number.isFinite(pct) && pct > 0.0001)) return null;
        return { qty: r.packQty, totalPrice: r.packPrice, unitPrice: r.unit };
      })
      .filter((t): t is { qty: number; totalPrice: number; unitPrice: number } => Boolean(t))
      .sort((a, b) => a.qty - b.qty);
    const grossByLine = productItems.map((item) => {
      const packQty = parsePackQtyFromCartItem(item);
      const qty = Math.max(1, Number(item.quantity) || 1);
      const sourceUnit = inferredRetailUnit > 0 ? inferredRetailUnit : Number(item.price || 0);
      const gross = (sourceUnit * packQty) * qty;
      return { item, gross, weight: packQty * qty };
    });
    const grossSubtotal = grossByLine.reduce((sum, row) => sum + row.gross, 0);
    const totalWeight = grossByLine.reduce((sum, row) => sum + row.weight, 0);

    const tiers = normalizeBulkTiers({
      price: inferredRetailUnit,
      bulkDiscountTiers: product?.bulkDiscountTiers || [],
    });
    const effectiveTiers = tiers.length > 0 ? tiers : inferredVariantTiers;
    let bestDiscountPct = 0;
    for (const t of effectiveTiers) {
      if (totalWeight >= t.qty && inferredRetailUnit > 0) {
        const pct = ((inferredRetailUnit - t.unitPrice) / inferredRetailUnit) * 100;
        if (Number.isFinite(pct) && pct > bestDiscountPct) bestDiscountPct = pct;
      }
    }
    const totalDiscount = Math.round(grossSubtotal * (bestDiscountPct / 100) * 100) / 100;
    let allocated = 0;
    for (let i = 0; i < grossByLine.length; i++) {
      const row = grossByLine[i];
      const lineKey = `${String(row.item.id)}::${String(row.item.selectedVariantSku || row.item.selectedVariantId || '')}`;
      const lineDiscount =
        i === grossByLine.length - 1
          ? Math.max(0, Math.round((totalDiscount - allocated) * 100) / 100)
          : Math.round(((row.gross / Math.max(grossSubtotal, 1e-9)) * totalDiscount) * 100) / 100;
      allocated += lineDiscount;
      lineTotals[lineKey] = Math.max(0, Math.round((row.gross - lineDiscount) * 100) / 100);
    }
  }

  const subtotal = Object.values(lineTotals).reduce((sum, amount) => sum + amount, 0);
  return { lineTotals, subtotal: Math.round(subtotal * 100) / 100 };
}
