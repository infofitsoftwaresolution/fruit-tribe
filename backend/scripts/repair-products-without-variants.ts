/**
 * Creates a default variant for active products that have none (fixes empty storefront lists).
 * Usage: npx ts-node scripts/repair-products-without-variants.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    include: { variants: true },
  });

  let repaired = 0;
  for (const product of products) {
    const activeVariants = product.variants.filter(
      (v) => !String(v.attributeValue || '').toLowerCase().includes('(archived)'),
    );
    if (activeVariants.length > 0) continue;

    const sku = `${product.slug}-1KG`.toUpperCase().replace(/[^A-Z0-9-]+/g, '-');
    await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku,
        attributeName: 'Quantity',
        attributeValue: '1 kg',
        stockQuantity: 100,
        availableQuantity: 100,
        lowStockThreshold: 5,
      },
    });
    await prisma.product.update({
      where: { id: product.id },
      data: { stock: 100 },
    });
    console.log(`Repaired: ${product.name} (${product.id})`);
    repaired += 1;
  }

  console.log(`Done. Repaired ${repaired} product(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
