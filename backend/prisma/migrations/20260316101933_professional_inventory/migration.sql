/*
  Warnings:

  - Made the column `online_status` on table `delivery_partners` required. This step will fail if there are existing NULL values in that column.
  - Made the column `rating` on table `delivery_partners` required. This step will fail if there are existing NULL values in that column.
  - Made the column `completed_deliveries` on table `delivery_partners` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "cod_transactions" DROP CONSTRAINT "cod_transactions_delivery_partner_id_fkey";

-- DropForeignKey
ALTER TABLE "cod_transactions" DROP CONSTRAINT "cod_transactions_order_id_fkey";

-- DropForeignKey
ALTER TABLE "delivery_earnings" DROP CONSTRAINT "delivery_earnings_delivery_id_fkey";

-- DropForeignKey
ALTER TABLE "delivery_earnings" DROP CONSTRAINT "delivery_earnings_delivery_partner_id_fkey";

-- DropForeignKey
ALTER TABLE "delivery_earnings" DROP CONSTRAINT "delivery_earnings_order_id_fkey";

-- DropForeignKey
ALTER TABLE "delivery_partners" DROP CONSTRAINT "delivery_partners_user_id_fkey";

-- DropForeignKey
ALTER TABLE "delivery_tracking" DROP CONSTRAINT "delivery_tracking_delivery_id_fkey";

-- DropForeignKey
ALTER TABLE "delivery_tracking" DROP CONSTRAINT "delivery_tracking_delivery_partner_id_fkey";

-- AlterTable
ALTER TABLE "cod_transactions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "delivery_earnings" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "payout_date" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "delivery_partners" ALTER COLUMN "status" SET DEFAULT 'ACTIVE',
ALTER COLUMN "online_status" SET NOT NULL,
ALTER COLUMN "rating" SET NOT NULL,
ALTER COLUMN "completed_deliveries" SET NOT NULL;

-- AlterTable
ALTER TABLE "delivery_tracking" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "product_variants" ADD COLUMN     "available_quantity" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "low_stock_threshold" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "reserved_quantity" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "warehouses" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "stock_reservations" (
    "id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "user_id" UUID,
    "quantity" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_reservations_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "stock_reservations" ADD CONSTRAINT "stock_reservations_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_partners" ADD CONSTRAINT "delivery_partners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_tracking" ADD CONSTRAINT "delivery_tracking_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_tracking" ADD CONSTRAINT "delivery_tracking_delivery_partner_id_fkey" FOREIGN KEY ("delivery_partner_id") REFERENCES "delivery_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_earnings" ADD CONSTRAINT "delivery_earnings_delivery_partner_id_fkey" FOREIGN KEY ("delivery_partner_id") REFERENCES "delivery_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_earnings" ADD CONSTRAINT "delivery_earnings_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_earnings" ADD CONSTRAINT "delivery_earnings_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "deliveries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cod_transactions" ADD CONSTRAINT "cod_transactions_delivery_partner_id_fkey" FOREIGN KEY ("delivery_partner_id") REFERENCES "delivery_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cod_transactions" ADD CONSTRAINT "cod_transactions_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
