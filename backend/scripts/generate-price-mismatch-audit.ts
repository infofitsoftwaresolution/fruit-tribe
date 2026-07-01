import { PrismaClient } from '@prisma/client';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { parsePackQtyKg, isArchivedVariantLabel } from '../src/modules/catalog/application/inventory-pool.util';

const prisma = new PrismaClient();
const REPORT_DATE = '2026-07-01';

interface TierRow {
  minWeight: number;
  discountPercentage: number;
}

interface OrderRow {
  orderNumber: string;
  orderDate: string;
  status: string;
  customer: string;
  email: string;
  variant: string;
  quantity: number;
  chargedPrice: number;
  variantListPrice: number;
  staleTierDiscountApplied: string;
  correctPriceAfterFix: number;
  revenueShortfall: number;
  explanation: string;
}

function calcExpectedPrice(
  basePrice: number,
  packKg: number,
  qty: number,
  tiers: TierRow[],
) {
  const totalWeight = packKg * qty;
  const gross = basePrice * totalWeight;
  let bestPct = 0;
  for (const t of tiers) {
    if (totalWeight >= t.minWeight) bestPct = t.discountPercentage;
  }
  const net = Math.round(gross * (1 - bestPct / 100) * 100) / 100;
  return { gross, discountPct: bestPct, net, totalWeight };
}

function deriveStaleTiersFromArchived(
  basePrice: number,
  archivedVariants: Array<{ attributeValue: string | null; priceOverride: unknown }>,
): TierRow[] {
  const byWeight = new Map<number, number>();
  for (const v of archivedVariants) {
    const w = parsePackQtyKg(v.attributeValue);
    const price = Number(v.priceOverride);
    if (!(w > 0 && price > 0)) continue;
    const retail = basePrice * w;
    const pct = ((retail - price) / retail) * 100;
    if (pct > 0) {
      const cur = byWeight.get(w);
      if (cur == null || pct > cur) byWeight.set(w, Math.round(pct * 100) / 100);
    }
  }
  return Array.from(byWeight.entries())
    .map(([minWeight, discountPercentage]) => ({ minWeight, discountPercentage }))
    .sort((a, b) => a.minWeight - b.minWeight);
}

function formatInr(n: number) {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatIst(iso: string) {
  return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
}

function buildMarkdown(report: {
  generatedAt: string;
  triggerOrder: OrderRow | undefined;
  affectedOrders: OrderRow[];
  financialImpact: { paidOrderCount: number; totalRevenueShortfall: number };
  product: { name: string; basePrice: number; staleTiers: TierRow[]; currentTiers: TierRow[] };
}) {
  const paid = report.affectedOrders.filter((o) =>
    ['CONFIRMED', 'DELIVERED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY'].includes(o.status),
  );
  const cancelled = report.affectedOrders.filter((o) => o.status === 'CANCELLED');

  let md = `# Price Mismatch Audit Report\n\n`;
  md += `**Report date:** ${REPORT_DATE}  \n`;
  md += `**Generated at:** ${report.generatedAt}  \n`;
  md += `**Product:** ${report.product.name}  \n`;
  md += `**Issue:** Stale tier pricing from archived variants caused checkout undercharging\n\n`;

  md += `## Executive summary\n\n`;
  md += `When variants were archived (removed from the catalog), their discount rules remained in \`product_tier_pricing\`. `;
  md += `Checkout applied those tiers to **all** order weights — including active variants like **10 kg** and **5 kg** — `;
  md += `even though no live **2 kg** option existed.\n\n`;
  md += `| Metric | Value |\n|--------|-------|\n`;
  md += `| Total mismatched line items | ${report.affectedOrders.length} |\n`;
  md += `| Paid / fulfilled orders affected | ${paid.length} |\n`;
  md += `| Revenue shortfall (paid orders only) | ${formatInr(report.financialImpact.totalRevenueShortfall)} |\n`;
  md += `| Cancelled / test orders (excluded from shortfall) | ${cancelled.length} |\n\n`;

  md += `## Root cause\n\n`;
  md += `1. **Product save** derived \`product_tier_pricing\` from **all** variants, including \`(Archived)\` labels.\n`;
  md += `2. **Checkout** uses tier discounts on \`base_price × weight\`, not variant \`price_override\`, when tiers exist.\n`;
  md += `3. Archived **1 kg @ ₹1** (99.55% off) and **2 kg @ ₹360** (18.18% off) created phantom tiers.\n`;
  md += `4. Any order ≥ 2 kg received **18.18% off** regardless of the variant's listed price.\n\n`;

  md += `### Stale tiers (before fix)\n\n`;
  md += `| Min weight | Discount |\n|------------|----------|\n`;
  for (const t of report.product.staleTiers) {
    md += `| ${t.minWeight} kg | ${t.discountPercentage}% |\n`;
  }
  md += `\n**Tier rows created:** 29 Jun 2026, 7:10 PM IST (product save after archiving variants)\n\n`;

  md += `### Current tiers (after fix)\n\n`;
  if (report.product.currentTiers.length === 0) {
    md += `_None — customers pay variant list price (e.g. 10 kg = ${formatInr(2200)})._\n\n`;
  } else {
    md += `| Min weight | Discount |\n|------------|----------|\n`;
    for (const t of report.product.currentTiers) {
      md += `| ${t.minWeight} kg | ${t.discountPercentage}% |\n`;
    }
    md += `\n`;
  }

  if (report.triggerOrder) {
    const t = report.triggerOrder;
    md += `## Trigger order (investigation case)\n\n`;
    md += `| Field | Value |\n|-------|-------|\n`;
    md += `| Order | **${t.orderNumber}** |\n`;
    md += `| Date | ${formatIst(t.orderDate)} |\n`;
    md += `| Customer | ${t.customer} (${t.email}) |\n`;
    md += `| Status | ${t.status} |\n`;
    md += `| Variant | ${t.variant} × ${t.quantity} |\n`;
    md += `| Charged | ${formatInr(t.chargedPrice)} |\n`;
    md += `| Variant list price | ${formatInr(t.variantListPrice)} |\n`;
    md += `| Stale discount applied | ${t.staleTierDiscountApplied} |\n`;
    md += `| Revenue shortfall | **${formatInr(t.revenueShortfall)}** |\n\n`;
    md += `**Calculation:** ₹220/kg × 10 kg = ₹2,200 gross → 18.18% tier off = **${formatInr(t.chargedPrice)}** charged.\n\n`;
  }

  md += `## Paid / fulfilled orders with price mismatch\n\n`;
  md += `| Order | Date (IST) | Customer | Variant | Charged | Should be | Shortfall | Status |\n`;
  md += `|-------|------------|----------|---------|---------|-------------|-----------|--------|\n`;
  for (const o of paid) {
    md += `| ${o.orderNumber} | ${formatIst(o.orderDate)} | ${o.customer} | ${o.variant} | ${formatInr(o.chargedPrice)} | ${formatInr(o.variantListPrice)} | ${formatInr(o.revenueShortfall)} | ${o.status} |\n`;
  }
  md += `\n`;

  if (cancelled.length > 0) {
    md += `## Cancelled / test orders (reference only)\n\n`;
    md += `${cancelled.length} cancelled orders also show mismatches — mostly admin/test checkouts at very low prices (e.g. ₹4.5). Excluded from revenue shortfall.\n\n`;
  }

  md += `## Remediation completed\n\n`;
  md += `### Code changes\n`;
  md += `- \`product.service.ts\` — skip archived variants when deriving tier pricing\n`;
  md += `- \`order.service.ts\` — skip archived variants in checkout fallback tier logic\n`;
  md += `- \`inventory-pool.util.ts\` — shared \`isArchivedVariantLabel()\` helper\n`;
  md += `- \`scripts/recalculate-tier-pricing.ts\` — rebuild tiers from active variants only\n\n`;
  md += `### Data fixes (tier recalculation run)\n\n`;
  md += `| Product | Before | After |\n|---------|--------|-------|\n`;
  md += `| Langra Mango Premium | 1kg: 99.55%, 2kg: 18.18% | **none** |\n`;
  md += `| Dudhiya Malda | 2kg: 27.27% (from archived variant) | **none** |\n`;
  md += `| Alphonso Mango | none | 2kg: 8.19% (from active variant) |\n\n`;

  md += `## Recommendations\n\n`;
  md += `1. Review **${paid.length} paid orders** above for possible customer follow-up or revenue recovery.\n`;
  md += `2. Priority: **FT-1782752205945-524** (Aditya Verma) — ${formatInr(399.96)} undercharged, order still CONFIRMED.\n`;
  md += `3. Re-run \`npx ts-node scripts/recalculate-tier-pricing.ts\` after any bulk variant archive.\n`;
  md += `4. Consider adding \`audit_logs\` entries on product price/tier changes for future traceability.\n`;

  return md;
}

async function main() {
  const langra = await prisma.product.findFirst({
    where: { slug: 'langra-mango-premium' },
    include: {
      variants: true,
      tierPricing: { orderBy: { minWeight: 'asc' } },
      orderItems: {
        include: {
          order: {
            select: {
              orderNumber: true,
              createdAt: true,
              status: true,
              user: { select: { email: true, firstName: true, lastName: true } },
            },
          },
          variant: true,
        },
        orderBy: { order: { createdAt: 'asc' } },
      },
    },
  });

  if (!langra) throw new Error('Langra Mango Premium not found');

  const basePrice = Number(langra.basePrice);
  const archivedVariants = langra.variants.filter((v) => isArchivedVariantLabel(v.attributeValue));
  const staleTiers = deriveStaleTiersFromArchived(basePrice, archivedVariants);
  const currentTiers = langra.tierPricing.map((t) => ({
    minWeight: Number(t.minWeight),
    discountPercentage: Number(t.discountPercentage),
  }));

  const affectedOrders: OrderRow[] = [];
  const PAID_STATUSES = new Set(['CONFIRMED', 'DELIVERED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY']);

  for (const item of langra.orderItems) {
    const packKg = parsePackQtyKg(item.variant.attributeValue);
    const qty = item.quantity;
    const charged = Number(item.pricePerUnit);
    const variantListPrice = Number(item.variant.priceOverride || 0);
    const withStale = calcExpectedPrice(basePrice, packKg, qty, staleTiers);
    const expectedFromVariant = variantListPrice > 0 ? variantListPrice : withStale.net;
    const overDiscount = Math.max(0, Math.round((expectedFromVariant - charged) * 100) / 100);

    if (overDiscount > 0.01 && withStale.discountPct > 0) {
      affectedOrders.push({
        orderNumber: item.order.orderNumber,
        orderDate: item.order.createdAt.toISOString(),
        status: item.order.status,
        customer: `${item.order.user.firstName || ''} ${item.order.user.lastName || ''}`.trim(),
        email: item.order.user.email,
        variant: item.variant.attributeValue || '',
        quantity: qty,
        chargedPrice: charged,
        variantListPrice: expectedFromVariant,
        staleTierDiscountApplied: `${withStale.discountPct}%`,
        correctPriceAfterFix: withStale.net,
        revenueShortfall: overDiscount,
        explanation: `Paid ${formatInr(charged)} due to stale ${withStale.discountPct}% tier; variant list ${formatInr(expectedFromVariant)}.`,
      });
    }
  }

  const paidOrders = affectedOrders.filter((o) => PAID_STATUSES.has(o.status));
  const totalPaidShortfall = paidOrders.reduce((s, o) => s + o.revenueShortfall, 0);
  const triggerOrder = affectedOrders.find((o) => o.orderNumber === 'FT-1782752205945-524');

  const report = {
    reportId: `price-mismatch-audit-${REPORT_DATE}`,
    generatedAt: new Date().toISOString(),
    summary:
      'Stale product_tier_pricing from archived variants undercharged Langra Mango Premium orders at checkout.',
    rootCause:
      'Tier pricing was derived from archived variants; checkout applied 18.18% discount to all orders ≥2kg.',
    product: {
      id: langra.id,
      name: langra.name,
      slug: langra.slug,
      basePrice,
      staleTiers,
      currentTiers,
      activeVariants: langra.variants
        .filter((v) => !isArchivedVariantLabel(v.attributeValue))
        .map((v) => ({ label: v.attributeValue, priceOverride: Number(v.priceOverride) })),
      archivedVariantsThatCausedStaleTiers: archivedVariants
        .filter((v) => {
          const w = parsePackQtyKg(v.attributeValue);
          const p = Number(v.priceOverride);
          return p > 0 && p < basePrice * w;
        })
        .map((v) => ({
          label: v.attributeValue,
          priceOverride: Number(v.priceOverride),
        })),
    },
    triggerOrder,
    affectedOrders,
    financialImpact: {
      totalLineItems: affectedOrders.length,
      paidOrderLineItems: paidOrders.length,
      cancelledOrTestLineItems: affectedOrders.length - paidOrders.length,
      totalRevenueShortfallPaidOrders: Math.round(totalPaidShortfall * 100) / 100,
      currency: 'INR',
    },
    remediation: {
      codeFiles: [
        'backend/src/modules/catalog/application/product.service.ts',
        'backend/src/modules/order/application/order.service.ts',
        'backend/src/modules/catalog/application/inventory-pool.util.ts',
        'backend/scripts/recalculate-tier-pricing.ts',
      ],
      dataRecalculation: [
        { product: 'Langra Mango Premium', before: '1kg:99.55%, 2kg:18.18%', after: 'none' },
        { product: 'Dudhiya Malda', before: '2kg:27.27%', after: 'none' },
        { product: 'Alphonso Mango', before: 'none', after: '2kg:8.19%' },
      ],
      fixedAt: '2026-06-29',
    },
  };

  const outDir = resolve(__dirname, '../../docs/audit');
  mkdirSync(outDir, { recursive: true });

  const jsonPath = resolve(outDir, `price-mismatch-audit-${REPORT_DATE}.json`);
  const mdPath = resolve(outDir, `price-mismatch-audit-${REPORT_DATE}.md`);

  writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8');
  writeFileSync(
    mdPath,
    buildMarkdown({
      generatedAt: report.generatedAt,
      triggerOrder,
      affectedOrders,
      financialImpact: {
        paidOrderCount: paidOrders.length,
        totalRevenueShortfall: totalPaidShortfall,
      },
      product: { name: langra.name, basePrice, staleTiers, currentTiers },
    }),
    'utf8',
  );

  console.log(`Wrote ${mdPath}`);
  console.log(`Wrote ${jsonPath}`);
  console.log(`Paid orders affected: ${paidOrders.length}`);
  console.log(`Revenue shortfall (paid): ${formatInr(totalPaidShortfall)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
