-- AlterTable
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
