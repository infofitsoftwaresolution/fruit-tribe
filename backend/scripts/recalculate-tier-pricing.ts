/**
 * One-off maintenance: rebuild product_tier_pricing from active (non-archived) variants only.
 * Run: npx ts-node scripts/recalculate-tier-pricing.ts
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import {
  isArchivedVariantLabel,
  parsePackQtyKg,
} from '../src/modules/catalog/application/inventory-pool.util';

const prisma = new PrismaClient();

function deriveTierPricingRows(
  basePrice: number,
  variants: Array<{
    attributeValue?: string | null;
    priceOverride?: number | null;
    isBulkVariant?: boolean | null;
  }>,
  productBulk?: { qty: number | null; price: number | null },
): Array<{ minWeight: number; discountPercentage: number }> {
  const byWeight = new Map<number, number>();
  for (const variant of variants) {
    if (isArchivedVariantLabel(variant.attributeValue)) continue;
    const minWeight = parsePackQtyKg(variant.attributeValue);
    const totalPrice = Number(variant.priceOverride);
    if (
      !(
        Number.isFinite(minWeight) &&
        minWeight > 0 &&
        Number.isFinite(totalPrice) &&
        totalPrice > 0 &&
        Number.isFinite(basePrice) &&
        basePrice > 0
      )
    ) {
      continue;
    }
    const retailTotal = basePrice * minWeight;
    const discountPercentage = ((retailTotal - totalPrice) / retailTotal) * 100;
    const eligible = Boolean(variant.isBulkVariant) || discountPercentage > 0;
    if (!eligible || !(discountPercentage > 0)) continue;
    const current = byWeight.get(minWeight);
    if (current == null || discountPercentage > current) {
      byWeight.set(minWeight, discountPercentage);
    }
  }
  if (productBulk?.qty && productBulk.price && Number.isFinite(basePrice) && basePrice > 0) {
    const minWeight = Number(productBulk.qty);
    const retailTotal = basePrice * minWeight;
    const discountPercentage =
      ((retailTotal - Number(productBulk.price)) / retailTotal) * 100;
    if (Number.isFinite(discountPercentage) && discountPercentage > 0) {
      const current = byWeight.get(minWeight);
      if (current == null || discountPercentage > current) {
        byWeight.set(minWeight, discountPercentage);
      }
    }
  }
  return Array.from(byWeight.entries())
    .map(([minWeight, discountPercentage]) => ({
      minWeight: Math.round(minWeight * 1000) / 1000,
      discountPercentage: Math.round(discountPercentage * 100) / 100,
    }))
    .filter((row) => row.minWeight > 0 && row.discountPercentage > 0)
    .sort((a, b) => a.minWeight - b.minWeight);
}

async function replaceTierPricingRows(
  productId: string,
  rows: Array<{ minWeight: number; discountPercentage: number }>,
): Promise<void> {
  await prisma.$executeRawUnsafe(
    `DELETE FROM product_tier_pricing WHERE product_id = $1::uuid`,
    productId,
  );
  for (const row of rows) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO product_tier_pricing (id, product_id, min_weight, discount_percentage, created_at, updated_at)
       VALUES ($1::uuid, $2::uuid, $3::numeric, $4::numeric, NOW(), NOW())`,
      randomUUID(),
      productId,
      row.minWeight,
      row.discountPercentage,
    );
  }
}

async function main() {
  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      basePrice: true,
      bulkDiscountQty: true,
      bulkDiscountPrice: true,
      variants: {
        select: {
          attributeValue: true,
          priceOverride: true,
          isBulkVariant: true,
        },
      },
      tierPricing: { select: { minWeight: true, discountPercentage: true } },
    },
  });

  let updated = 0;
  for (const p of products) {
    const rows = deriveTierPricingRows(
      Number(p.basePrice),
      p.variants.map((v) => ({
        attributeValue: v.attributeValue,
        priceOverride: v.priceOverride != null ? Number(v.priceOverride) : null,
        isBulkVariant: v.isBulkVariant,
      })),
      {
        qty: p.bulkDiscountQty,
        price: p.bulkDiscountPrice != null ? Number(p.bulkDiscountPrice) : null,
      },
    );
    const before = p.tierPricing
      .map((t) => `${t.minWeight}kg:${t.discountPercentage}%`)
      .join(', ');
    const after = rows.map((t) => `${t.minWeight}kg:${t.discountPercentage}%`).join(', ');
    if (before !== after) {
      await replaceTierPricingRows(p.id, rows);
      console.log(`${p.name}: [${before || 'none'}] → [${after || 'none'}]`);
      updated += 1;
    }
  }
  console.log(`\nDone. Updated ${updated} of ${products.length} products.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
