import type { Product } from '@/lib/api';

/** Normalize for comparison (lowercase, collapse spaces). */
function normName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function namesSimilar(a: string, b: string): boolean {
  const x = normName(a);
  const y = normName(b);
  if (x === y) return true;
  if (x.length < 5 || y.length < 5) return false;
  if (!x.startsWith(y.slice(0, 3)) && !y.startsWith(x.slice(0, 3))) return false;
  if (Math.abs(x.length - y.length) > 2) return false;
  // Keep dedupe strict so distinct catalog items are never hidden.
  // We only merge near-identical typo rows.
  return levenshtein(x, y) <= 1;
}

/**
 * Merges likely duplicate catalog rows (e.g. "LITCHI" vs "LITHCI") per seller for storefront lists only.
 * Keeps the row with higher available stock; ties prefer the longer product name.
 */
export function dedupeSimilarCatalogProducts(products: Product[]): Product[] {
  if (products.length < 2) return products;

  const bySeller = new Map<string, Product[]>();
  for (const p of products) {
    const k = String(p.sellerId ?? '_store');
    if (!bySeller.has(k)) bySeller.set(k, []);
    bySeller.get(k)!.push(p);
  }

  const out: Product[] = [];
  for (const list of bySeller.values()) {
    const n = list.length;
    const adj: Set<number>[] = Array.from({ length: n }, () => new Set());
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (namesSimilar(list[i].name, list[j].name)) {
          adj[i].add(j);
          adj[j].add(i);
        }
      }
    }
    const visited = new Array(n).fill(false);
    for (let i = 0; i < n; i++) {
      if (visited[i]) continue;
      const clusterIdx: number[] = [];
      const stack = [i];
      visited[i] = true;
      while (stack.length) {
        const u = stack.pop()!;
        clusterIdx.push(u);
        for (const v of adj[u]) {
          if (!visited[v]) {
            visited[v] = true;
            stack.push(v);
          }
        }
      }
      const cluster = clusterIdx.map((idx) => list[idx]);
      const best = cluster.reduce((acc, cur) => {
        const as = acc.availableStock ?? 0;
        const cs = cur.availableStock ?? 0;
        if (cs !== as) return cs > as ? cur : acc;
        return normName(acc.name).length >= normName(cur.name).length ? acc : cur;
      });
      out.push(best);
    }
  }
  return out;
}
