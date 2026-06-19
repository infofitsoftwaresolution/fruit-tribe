export const DEFAULT_PRODUCT_DELIVERY_TAG = 'Order now for next day delivery';

export function resolveProductDeliveryTag(
  product?: { deliveryTag?: string | null } | null,
  storeDefault?: string | null,
): string {
  const productTag = String(product?.deliveryTag ?? '').trim();
  if (productTag) return productTag;
  const storeTag = String(storeDefault ?? '').trim();
  if (storeTag) return storeTag;
  return DEFAULT_PRODUCT_DELIVERY_TAG;
}
