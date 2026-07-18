-- AlterTable: nullable で追加 → 既存行を埋める → NOT NULL 化
ALTER TABLE "OrderItem" ADD COLUMN "taxRate" DECIMAL(5,2);
UPDATE "OrderItem" SET "taxRate" = 10 WHERE "taxRate" IS NULL;
ALTER TABLE "OrderItem" ALTER COLUMN "taxRate" SET NOT NULL;
