CREATE TABLE "product_tier_pricing" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "min_weight" DECIMAL(10,3) NOT NULL,
    "discount_percentage" DECIMAL(5,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_tier_pricing_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "product_tier_pricing_product_id_min_weight_key"
ON "product_tier_pricing"("product_id", "min_weight");

ALTER TABLE "product_tier_pricing"
ADD CONSTRAINT "product_tier_pricing_product_id_fkey"
FOREIGN KEY ("product_id")
REFERENCES "products"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;
