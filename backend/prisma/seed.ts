import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1) Roles
  const roleNames = ['ADMIN', 'SELLER', 'CUSTOMER'];
  const roles: Record<string, string> = {};

  for (const name of roleNames) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: {
        name,
        permissions: {},
      },
    });
    roles[name] = role.id;
  }

  // 2) Admin user
  const adminEmail = 'admin@fruittribe.com';
  const adminPassword = 'Admin@1234';

  const adminPasswordHash = await bcrypt.hash(adminPassword, 12);

  const adminUser = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      roleId: roles['ADMIN'],
      isActive: true,
    },
    create: {
      email: adminEmail,
      passwordHash: adminPasswordHash,
      firstName: 'Admin',
      lastName: 'User',
      roleId: roles['ADMIN'],
      isActive: true,
    },
  });

  // 3) Seller user + seller profile
  const sellerEmail = 'seller@fruittribe.com';
  const sellerPassword = 'Seller@1234';

  const sellerPasswordHash = await bcrypt.hash(sellerPassword, 12);

  const sellerUser = await prisma.user.upsert({
    where: { email: sellerEmail },
    update: {
      roleId: roles['SELLER'],
      isActive: true,
    },
    create: {
      email: sellerEmail,
      passwordHash: sellerPasswordHash,
      firstName: 'Prime',
      lastName: 'Seller',
      roleId: roles['SELLER'],
      isActive: true,
    },
  });

  await prisma.seller.upsert({
    where: { userId: sellerUser.id },
    update: {
      storeName: 'Prime Orchard',
      status: 'APPROVED',
      isOpen: true,
      vacationMode: false,
    },
    create: {
      userId: sellerUser.id,
      storeName: 'Prime Orchard',
      description: 'Trusted multi-vendor orchard partner.',
      status: 'APPROVED',
      kycStatus: 'approved',
      commissionRate: 10.0,
      isOpen: true,
      vacationMode: false,
    },
  });

  const seller = await prisma.seller.findUnique({
    where: { userId: sellerUser.id },
  });
  if (!seller) throw new Error('Seller not created');

  // 4) Category: Fruits
  const categoryFruits = await prisma.category.upsert({
    where: { slug: 'fruits' },
    update: {},
    create: {
      name: 'Fruits',
      slug: 'fruits',
      description: 'Fresh seasonal fruits',
    },
  });

  // 5) Alphonso Mango product (admin can manage via Admin → Products)
  const alphonsoSlug = 'alphonso-mango';
  const existingAlphonso = await prisma.product.findUnique({
    where: { slug: alphonsoSlug },
  });
  if (!existingAlphonso) {
    const alphonso = await prisma.product.create({
      data: {
        name: 'Alphonso Mango',
        slug: alphonsoSlug,
        description: 'Premium Alphonso mangoes from Ratnagiri. Sweet, fibre-less, and perfect for summer.',
        basePrice: 299,
        currency: 'INR',
        unit: 'kg',
        tags: ['mango', 'alphonso', 'seasonal', 'premium'],
        sellerId: seller.id,
        categoryId: categoryFruits.id,
        isActive: true,
        isSeasonal: true,
        seasonalStart: new Date(new Date().getFullYear(), 2, 1),   // March
        seasonalEnd: new Date(new Date().getFullYear(), 5, 30),    // June
        stock: 100,
        status: 'active',
      },
    });
    await prisma.productVariant.createMany({
      data: [
        { productId: alphonso.id, sku: 'ALPHONSO-1KG', attributeName: 'Weight', attributeValue: '1 kg', stockQuantity: 100 },
        { productId: alphonso.id, sku: 'ALPHONSO-2KG', attributeName: 'Weight', attributeValue: '2 kg', priceOverride: 549, stockQuantity: 50 },
      ],
    });
    console.log('✅ Alphonso Mango product created');
  }

  // 6) Sample promo coupon (for checkout testing)
  await prisma.coupon.upsert({
    where: { code: 'SAVE10' },
    update: { isActive: true },
    create: {
      code: 'SAVE10',
      discountType: 'PERCENTAGE',
      discountValue: 10,
      minOrderValue: 500,
      maxDiscount: 100,
      expiryDate: new Date(new Date().getFullYear() + 1, 11, 31),
      usageLimit: 1000,
      isActive: true,
    },
  });
  console.log('✅ Sample coupon SAVE10 (10% off, min ₹500, max ₹100 off)');

  console.log('✅ Seeding complete.');
  console.log('Admin ->', adminEmail, adminPassword);
  console.log('Seller ->', sellerEmail, sellerPassword);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

