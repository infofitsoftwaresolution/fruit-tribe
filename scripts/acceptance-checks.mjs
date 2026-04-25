import { readFileSync } from 'node:fs';

function assertContains(path, pattern, label) {
  const content = readFileSync(path, 'utf8');
  if (!content.includes(pattern)) {
    throw new Error(`Acceptance check failed: ${label} (${path})`);
  }
}

try {
  // KPI 1: frontend crash-safe startup guards
  assertContains('src/app/context/AuthContext.tsx', 'safeParseJson', 'safe storage parse guard');
  assertContains('src/app/context/AuthContext.tsx', 'isSessionChecked', 'session verification gating');

  // KPI 2: payment/order integrity checks against tampering
  assertContains('backend/src/modules/order/application/payment.service.ts', 'paymentContext', 'payment context integrity');
  assertContains('backend/src/modules/order/application/payment.service.ts', 'razorpayOrderId', 'razorpay order id validation');

  // KPI 3: deploy security hardening
  assertContains('.github/workflows/deploy-production.yml', 'StrictHostKeyChecking=yes', 'strict SSH host verification');
  assertContains('.github/workflows/deploy-production.yml', 'JWT_SECRET', 'required JWT secret in deployment');

  console.log('All acceptance KPI checks passed.');
} catch (error) {
  console.error(String(error instanceof Error ? error.message : error));
  process.exit(1);
}
