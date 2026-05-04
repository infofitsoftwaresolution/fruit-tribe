import { useState, useEffect, useCallback, useRef } from 'react';
import {
    getProductsCached,
    hasProductsCache,
    getProduct,
    mapApiProductToProduct,
    type ProductFilters,
    type Product,
} from '@/lib/api';
import { dedupeSimilarCatalogProducts } from '@/lib/catalogDedupe';
import { getUserErrorMessage } from '@/lib/userError';

export function useProducts(filters: ProductFilters = {}) {
    const [data, setData] = useState<Product[]>([]);
    const [meta, setMeta] = useState<{ total: number; page: number; limit: number; totalPages: number } | null>(null);
    const [loading, setLoading] = useState(() => !hasProductsCache(filters));
    const [error, setError] = useState<string | null>(null);

    const fetchProducts = useCallback(async () => {
        const isCached = hasProductsCache(filters);
        if (!isCached) {
            setLoading(true);
        }
        setError(null);
        try {
            const res = await getProductsCached({ ...filters, limit: filters.limit ?? 24 });
            const mapped = (res.data || []).map(mapApiProductToProduct);
            const seen = new Set<string>();
            const idDeduped = mapped.filter((p) => {
                const k = String(p.id);
                if (seen.has(k)) return false;
                seen.add(k);
                return true;
            });
            setData(dedupeSimilarCatalogProducts(idDeduped));
            setMeta(res.meta ?? null);
        } catch (e: any) {
            setError(getUserErrorMessage(e, 'Failed to load products'));
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [filters.page, filters.limit, filters.search, filters.categoryId, filters.sortBy, filters.sortOrder, filters.showOutOfSeason]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    return { products: data, meta, loading, error, refetch: fetchProducts };
}

export function useProduct(id: string | null) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(!!id);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setProduct(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    getProduct(id)
      .then((api) => (api ? setProduct(mapApiProductToProduct(api)) : setProduct(null)))
      .catch((e: any) => {
        setError(getUserErrorMessage(e, 'Failed to load product'));
        setProduct(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  return { product, loading, error };
}
