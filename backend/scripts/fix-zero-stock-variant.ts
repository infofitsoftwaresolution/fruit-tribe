/**
 * One-off: restore 5 kg variant stock for Langra Mango (or pass product id).
 * Usage: npx ts-node scripts/fix-zero-stock-variant.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const product = await prisma.product.findFirst({
    where: { name: { contains: 'Langra', mode: 'insensitive' } },
    include: { variants: true },
  });
  if (!product) {
    console.log('No Langra product found');
    return;
  }

  for (const v of product.variants) {
    const label = String(v.attributeValue || '');
    if (isFiveKg(label)) {
      const stock = 9999;
      await prisma.productVariant.update({
        where: { id: v.id },
        data: { stockQuantity: stock, availableQuantity: stock },
      });
      console.log('Updated', label, v.sku, 'to stock', stock);
    }
  }
}

function isFiveKg(label: string): boolean {
  const m = label.toLowerCase().match(/(\d+(?:\.\d+)?)\s*(kg|kgs)\b/);
  return m ? Number(m[1]) === 5 : false;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
