-- Add actor metadata to order_status_logs so we can show
-- whether a status change was performed by an admin or seller.

ALTER TABLE "order_status_logs"
ADD COLUMN IF NOT EXISTS "changed_by_role" TEXT,
ADD COLUMN IF NOT EXISTS "changed_by_name" TEXT;

