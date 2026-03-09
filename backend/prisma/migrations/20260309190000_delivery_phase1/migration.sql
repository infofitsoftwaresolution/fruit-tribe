-- Phase 1: Delivery partner support tables

-- Extend delivery_partners with operational fields
ALTER TABLE "delivery_partners"
ADD COLUMN IF NOT EXISTS "online_status" TEXT DEFAULT 'OFFLINE',
ADD COLUMN IF NOT EXISTS "current_lat" DECIMAL(9,6),
ADD COLUMN IF NOT EXISTS "current_lng" DECIMAL(9,6),
ADD COLUMN IF NOT EXISTS "rating" DECIMAL(3,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS "completed_deliveries" INTEGER DEFAULT 0;

-- delivery_tracking: fine-grained status + location logs
CREATE TABLE IF NOT EXISTS "delivery_tracking" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "delivery_id" UUID NOT NULL REFERENCES "deliveries"("id") ON DELETE CASCADE,
  "delivery_partner_id" UUID REFERENCES "delivery_partners"("id") ON DELETE SET NULL,
  "status" TEXT NOT NULL,
  "lat" DECIMAL(9,6),
  "lng" DECIMAL(9,6),
  "note" TEXT,
  "source" TEXT NOT NULL DEFAULT 'APP',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- delivery_earnings: per-order earning breakdown for partners
CREATE TABLE IF NOT EXISTS "delivery_earnings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "delivery_partner_id" UUID NOT NULL REFERENCES "delivery_partners"("id") ON DELETE CASCADE,
  "order_id" UUID NOT NULL REFERENCES "orders"("id") ON DELETE CASCADE,
  "delivery_id" UUID REFERENCES "deliveries"("id") ON DELETE SET NULL,
  "base_fee" DECIMAL(10,2) NOT NULL,
  "distance_fee" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "incentive" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "penalty" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "total" DECIMAL(10,2) NOT NULL,
  "payout_status" TEXT NOT NULL DEFAULT 'PENDING',
  "payout_date" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- cod_transactions: track COD collection and deposit
CREATE TABLE IF NOT EXISTS "cod_transactions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "delivery_partner_id" UUID NOT NULL REFERENCES "delivery_partners"("id") ON DELETE CASCADE,
  "order_id" UUID REFERENCES "orders"("id") ON DELETE SET NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "type" TEXT NOT NULL,
  "payment_mode" TEXT,
  "reference" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

