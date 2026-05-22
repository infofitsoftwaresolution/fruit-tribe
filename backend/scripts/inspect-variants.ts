import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const count = await prisma.product.count();
  console.log('product count:', count);

  const products = await prisma.product.findMany({
    include: {
      variants: {
        orderBy: [{ attributeValue: 'asc' }],
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  for (const prod of products) {
    const active = prod.variants.filter(
      (v) => !String(v.attributeValue || '').toLowerCase().includes('(archived)'),
    );
    if (active.length < 2) continue;
    console.log('\n---', prod.name, prod.id);
    for (const v of active) {
      console.log(
        `  ${v.attributeValue} | sku=${v.sku} | stock=${v.stockQuantity} | avail=${v.availableQuantity} | bulk=${v.isBulkVariant}`,
      );
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
