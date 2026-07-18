ALTER TABLE "OrderItem" ADD COLUMN     "taxInclusive" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Setting" ADD COLUMN     "taxInclusive" BOOLEAN NOT NULL DEFAULT false;
