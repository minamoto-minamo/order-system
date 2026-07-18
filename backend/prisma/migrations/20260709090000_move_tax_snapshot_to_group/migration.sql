ALTER TABLE "Group" ADD COLUMN "billedTaxRateInHouse" DECIMAL(5,2);
ALTER TABLE "Group" ADD COLUMN "billedTaxRateTakeout" DECIMAL(5,2);
ALTER TABLE "Group" ADD COLUMN "billedTaxInclusive" BOOLEAN;

ALTER TABLE "OrderItem" DROP COLUMN "taxRate";
ALTER TABLE "OrderItem" DROP COLUMN "taxInclusive";
