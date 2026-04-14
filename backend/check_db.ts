import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function run() {
  const p = await prisma.product.findFirst({ where: { name: 'Langra' } });
  if (p) {
    console.log('bulkQty:', p.bulkDiscountQty);
    console.log('bulkPrice:', p.bulkDiscountPrice);
  }
}
run().finally(() => prisma.$disconnect());
