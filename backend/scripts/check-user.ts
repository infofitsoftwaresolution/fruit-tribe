import { PrismaClient } from '@prisma/client';

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error('Usage: npx ts-node scripts/check-user.ts <email>');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      phone: true,
      isActive: true,
      otpCode: true,
      otpExpiry: true,
      firstName: true,
      lastName: true,
      createdAt: true,
      lastLogin: true,
      role: { select: { name: true } },
    },
  });

  if (!user) {
    console.log(JSON.stringify({ found: false, email }, null, 2));
    return;
  }

  const now = new Date();
  const hasActiveOtp = !!user.otpCode && !!user.otpExpiry && user.otpExpiry > now;
  const verificationStatus = user.isActive && !hasActiveOtp ? 'Verified' : 'Unverified';

  console.log(
    JSON.stringify(
      {
        found: true,
        email: user.email,
        name: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email,
        phone: user.phone,
        role: user.role?.name,
        isActive: user.isActive,
        verificationStatus,
        hasPendingOtp: hasActiveOtp,
        otpExpiry: user.otpExpiry,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
