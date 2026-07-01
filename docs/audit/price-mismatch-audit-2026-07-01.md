# Price Mismatch Audit Report

**Report date:** 2026-07-01  
**Generated at:** 2026-07-01T18:47:51.386Z  
**Product:** Langra Mango Premium  
**Issue:** Stale tier pricing from archived variants caused checkout undercharging

## Executive summary

When variants were archived (removed from the catalog), their discount rules remained in `product_tier_pricing`. Checkout applied those tiers to **all** order weights — including active variants like **10 kg** and **5 kg** — even though no live **2 kg** option existed.

| Metric | Value |
|--------|-------|
| Total mismatched line items | 48 |
| Paid / fulfilled orders affected | 24 |
| Revenue shortfall (paid orders only) | ₹15,603.76 |
| Cancelled / test orders (excluded from shortfall) | 24 |

## Root cause

1. **Product save** derived `product_tier_pricing` from **all** variants, including `(Archived)` labels.
2. **Checkout** uses tier discounts on `base_price × weight`, not variant `price_override`, when tiers exist.
3. Archived **1 kg @ ₹1** (99.55% off) and **2 kg @ ₹360** (18.18% off) created phantom tiers.
4. Any order ≥ 2 kg received **18.18% off** regardless of the variant's listed price.

### Stale tiers (before fix)

| Min weight | Discount |
|------------|----------|
| 1 kg | 99.55% |
| 2 kg | 18.18% |

**Tier rows created:** 29 Jun 2026, 7:10 PM IST (product save after archiving variants)

### Current tiers (after fix)

_None — customers pay variant list price (e.g. 10 kg = ₹2,200.00)._

## Trigger order (investigation case)

| Field | Value |
|-------|-------|
| Order | **FT-1782752205945-524** |
| Date | 29 Jun 2026, 10:26 pm |
| Customer | Aditya Verma (adityaverma327@gmail.com) |
| Status | CONFIRMED |
| Variant | 10 kg × 1 |
| Charged | ₹1,800.04 |
| Variant list price | ₹2,200.00 |
| Stale discount applied | 18.18% |
| Revenue shortfall | **₹399.96** |

**Calculation:** ₹220/kg × 10 kg = ₹2,200 gross → 18.18% tier off = **₹1,800.04** charged.

## Paid / fulfilled orders with price mismatch

| Order | Date (IST) | Customer | Variant | Charged | Should be | Shortfall | Status |
|-------|------------|----------|---------|---------|-------------|-----------|--------|
| FT-1778052986292-891 | 6 May 2026, 1:06 pm | Akash Test User | 3 kg (Archived) | ₹1.00 | ₹660.00 | ₹659.00 | DELIVERED |
| FT-1778055653138-136 | 6 May 2026, 1:50 pm | Admin User | 3 kg (Archived) | ₹1.00 | ₹660.00 | ₹659.00 | CONFIRMED |
| FT-1778056318555-514 | 6 May 2026, 2:01 pm | Akash2 | 5 kg | ₹4.50 | ₹1,100.00 | ₹1,095.50 | DELIVERED |
| FT-1778056318555-514 | 6 May 2026, 2:01 pm | Akash2 | 3 kg (Archived) | ₹0.90 | ₹660.00 | ₹659.10 | DELIVERED |
| FT-1778074066984-327 | 6 May 2026, 6:57 pm | Akash2 | 5 kg | ₹4.50 | ₹1,100.00 | ₹1,095.50 | CONFIRMED |
| FT-1778074066984-327 | 6 May 2026, 6:57 pm | Akash2 | 3 kg (Archived) | ₹0.90 | ₹660.00 | ₹659.10 | CONFIRMED |
| FT-1778074327286-47 | 6 May 2026, 7:02 pm | Akash2 | 5 kg | ₹4.50 | ₹1,100.00 | ₹1,095.50 | CONFIRMED |
| FT-1778079801765-129 | 6 May 2026, 8:33 pm | Admin User | 5 kg | ₹4.50 | ₹1,100.00 | ₹1,095.50 | CONFIRMED |
| FT-1778080419643-393 | 6 May 2026, 8:43 pm | Admin User | 3 kg (Archived) | ₹1.00 | ₹660.00 | ₹659.00 | CONFIRMED |
| FT-1778131982210-144 | 7 May 2026, 11:03 am | Admin User | 3 kg (Archived) | ₹1.00 | ₹660.00 | ₹659.00 | SHIPPED |
| FT-1778132462027-754 | 7 May 2026, 11:11 am | Shubham Singh | 3 kg (Archived) | ₹1.00 | ₹660.00 | ₹659.00 | DELIVERED |
| FT-1778236594281-471 | 8 May 2026, 4:06 pm | Ashish Ranjan | 3 kg (Archived) | ₹1.00 | ₹660.00 | ₹659.00 | CONFIRMED |
| FT-1778428578311-626 | 10 May 2026, 9:26 pm | Admin User | 3 kg (Archived) | ₹1.00 | ₹660.00 | ₹659.00 | CONFIRMED |
| FT-1779035573497-148 | 17 May 2026, 10:02 pm | Ashish Ranjan | 3 kg (Archived) | ₹640.20 | ₹660.00 | ₹19.80 | DELIVERED |
| FT-MN-1779456788940-111 | 22 May 2026, 7:03 pm | Chandra Singh | 10 kg | ₹220.00 | ₹2,200.00 | ₹1,980.00 | CONFIRMED |
| FT-MN-1779456799162-367 | 22 May 2026, 7:03 pm | Chandra Singh | 10 kg | ₹220.00 | ₹2,200.00 | ₹1,980.00 | CONFIRMED |
| FT-1779950601317-281 | 28 May 2026, 12:13 pm | Thores | 2 kg (Archived) | ₹2.00 | ₹440.00 | ₹438.00 | DELIVERED |
| FT-1780933809408-91 | 8 Jun 2026, 9:20 pm | Siddhant Srivastava | 3 kg (Archived) | ₹640.20 | ₹660.00 | ₹19.80 | DELIVERED |
| FT-1781253530071-46 | 12 Jun 2026, 2:08 pm | Dr. Ashok Kumar Singh | 5 kg | ₹950.00 | ₹1,100.00 | ₹150.00 | DELIVERED |
| FT-1781255566812-835 | 12 Jun 2026, 2:42 pm | Kumar Sunny | 3 kg (Archived) | ₹582.00 | ₹660.00 | ₹78.00 | DELIVERED |
| FT-1781510362471-519 | 15 Jun 2026, 1:29 pm | Rahul Mishra | 3 kg (Archived) | ₹582.00 | ₹660.00 | ₹78.00 | DELIVERED |
| FT-1781700006821-867 | 17 Jun 2026, 6:10 pm | Neha Kumari | 3 kg (Archived) | ₹523.80 | ₹660.00 | ₹136.20 | DELIVERED |
| FT-1781857749959-803 | 19 Jun 2026, 1:59 pm | Md Farhan Khan | 2 kg (Archived) | ₹349.20 | ₹360.00 | ₹10.80 | DELIVERED |
| FT-1782752205945-524 | 29 Jun 2026, 10:26 pm | Aditya Verma | 10 kg | ₹1,800.04 | ₹2,200.00 | ₹399.96 | CONFIRMED |

## Cancelled / test orders (reference only)

24 cancelled orders also show mismatches — mostly admin/test checkouts at very low prices (e.g. ₹4.5). Excluded from revenue shortfall.

## Remediation completed

### Code changes
- `product.service.ts` — skip archived variants when deriving tier pricing
- `order.service.ts` — skip archived variants in checkout fallback tier logic
- `inventory-pool.util.ts` — shared `isArchivedVariantLabel()` helper
- `scripts/recalculate-tier-pricing.ts` — rebuild tiers from active variants only

### Data fixes (tier recalculation run)

| Product | Before | After |
|---------|--------|-------|
| Langra Mango Premium | 1kg: 99.55%, 2kg: 18.18% | **none** |
| Dudhiya Malda | 2kg: 27.27% (from archived variant) | **none** |
| Alphonso Mango | none | 2kg: 8.19% (from active variant) |

## Recommendations

1. Review **24 paid orders** above for possible customer follow-up or revenue recovery.
2. Priority: **FT-1782752205945-524** (Aditya Verma) — ₹399.96 undercharged, order still CONFIRMED.
3. Re-run `npx ts-node scripts/recalculate-tier-pricing.ts` after any bulk variant archive.
4. Consider adding `audit_logs` entries on product price/tier changes for future traceability.
