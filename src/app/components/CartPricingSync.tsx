import { useEffect, useRef } from 'react';
import { useStore } from '@/app/context/StoreContext';
import { useProducts } from '@/app/hooks/useProducts';

/** Keeps cart line retail/bulk pricing aligned with the live catalog after admin price changes. */
export function CartPricingSync() {
  const { products, loading } = useProducts({ limit: 500 });
  const { syncCartPricingFromCatalog, cartItems } = useStore();
  const prevSig = useRef<string>('');

  useEffect(() => {
    if (!cartItems.length) {
      prevSig.current = '';
      return;
    }
    if (loading || !products.length) return;
    const sig = products
      .map((p) => `${p.id}:${p.price}:${p.bulkDiscountQty ?? ''}:${p.bulkDiscountPrice ?? ''}:${p.availableStock ?? p.stock}`)
      .sort()
      .join('|');
    if (sig === prevSig.current) return;
    prevSig.current = sig;
    syncCartPricingFromCatalog(products);
  }, [loading, products, syncCartPricingFromCatalog, cartItems.length]);

  return null;
}
