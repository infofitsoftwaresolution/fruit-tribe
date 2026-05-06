const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}

function parsePackQty(raw) {
  const text = String(raw || '').trim().toLowerCase();
  const m = text.match(/(\d+(?:\.\d+)?)\s*(kg|kgs|kilogram|kilograms|g|gm|grams)\b/);
  if (!m) return 1;
  const q = Number(m[1]);
  if (!Number.isFinite(q) || q <= 0) return 1;
  return ['g', 'gm', 'grams'].includes(String(m[2]).toLowerCase()) ? q / 1000 : q;
}

async function run() {
  loadEnvFile();
  const prisma = new PrismaClient();
  try {
    const result = await prisma.$transaction(async (tx) => {
      const orders = await tx.order.findMany({
        where: {
          status: { not: 'CANCELLED' },
          paymentStatus: { not: 'REFUNDED' },
        },
        select: {
          id: true,
          items: {
            select: {
              variantId: true,
              quantity: true,
              variant: { select: { attributeValue: true } },
            },
          },
          reservations: {
            where: { status: { in: ['PENDING', 'COMPLETED'] } },
            select: { id: true, variantId: true, quantity: true, status: true },
          },
        },
      });

      const variantAdjust = new Map();
      const reservationPatch = new Map();
      let touchedGroups = 0;
      let skippedMixedStatusGroups = 0;
      let totalDeltaUnits = 0;

      for (const order of orders) {
        const expectedByVariant = new Map();
        for (const item of order.items) {
          const variantId = String(item.variantId || '');
          if (!variantId) continue;
          const expected = Math.max(1, Number(item.quantity) || 1) * parsePackQty(item.variant?.attributeValue);
          expectedByVariant.set(variantId, (expectedByVariant.get(variantId) || 0) + expected);
        }

        const reservationsByVariant = new Map();
        for (const res of order.reservations) {
          const variantId = String(res.variantId || '');
          if (!variantId) continue;
          const list = reservationsByVariant.get(variantId) || [];
          list.push({ id: res.id, qty: Number(res.quantity) || 0, status: String(res.status || '').toUpperCase() });
          reservationsByVariant.set(variantId, list);
        }

        for (const [variantId, expectedUnits] of expectedByVariant.entries()) {
          const rows = reservationsByVariant.get(variantId) || [];
          if (!rows.length) continue;

          const statuses = [...new Set(rows.map((r) => r.status))];
          if (statuses.length !== 1) {
            skippedMixedStatusGroups += 1;
            continue;
          }

          const reservationStatus = statuses[0];
          const reservationTotal = rows.reduce((s, r) => s + (Number(r.qty) || 0), 0);
          const delta = expectedUnits - reservationTotal;
          if (delta === 0) continue;

          touchedGroups += 1;
          totalDeltaUnits += delta;
          const first = rows[0];
          reservationPatch.set(first.id, Math.max(0, (Number(first.qty) || 0) + delta));

          const existing = variantAdjust.get(variantId) || { stock: 0, reserved: 0, available: 0 };
          if (reservationStatus === 'COMPLETED') {
            existing.stock -= delta;
            existing.available -= delta;
          } else if (reservationStatus === 'PENDING') {
            existing.reserved += delta;
            existing.available -= delta;
          } else {
            continue;
          }
          variantAdjust.set(variantId, existing);
        }
      }

      const variantIds = [...variantAdjust.keys()];
      if (variantIds.length) {
        const variants = await tx.productVariant.findMany({
          where: { id: { in: variantIds } },
          select: { id: true, stockQuantity: true, reservedQuantity: true, availableQuantity: true },
        });
        const byId = new Map(variants.map((v) => [String(v.id), v]));
        for (const [variantId, d] of variantAdjust.entries()) {
          const current = byId.get(variantId);
          if (!current) throw new Error(`Variant ${variantId} not found during reconciliation.`);
          if (
            Number(current.stockQuantity) + d.stock < 0 ||
            Number(current.reservedQuantity) + d.reserved < 0 ||
            Number(current.availableQuantity) + d.available < 0
          ) {
            throw new Error(`Reconciliation would make stock negative for variant ${variantId}.`);
          }
        }
      }

      for (const [reservationId, nextQty] of reservationPatch.entries()) {
        await tx.stockReservation.update({
          where: { id: reservationId },
          data: { quantity: nextQty },
        });
      }

      for (const [variantId, d] of variantAdjust.entries()) {
        await tx.productVariant.update({
          where: { id: variantId },
          data: {
            stockQuantity: { increment: d.stock },
            reservedQuantity: { increment: d.reserved },
            availableQuantity: { increment: d.available },
          },
        });
        await tx.inventoryLog.create({
          data: {
            variantId,
            changeAmount: d.stock,
            reason: `ADMIN_LEGACY_PACK_RECONCILE stock=${d.stock},reserved=${d.reserved},available=${d.available}`,
          },
        });
      }

      return {
        scannedOrders: orders.length,
        touchedGroups,
        updatedReservations: reservationPatch.size,
        updatedVariants: variantAdjust.size,
        skippedMixedStatusGroups,
        totalDeltaUnits,
      };
    }, { timeout: 120000 });

    console.log(JSON.stringify(result, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
