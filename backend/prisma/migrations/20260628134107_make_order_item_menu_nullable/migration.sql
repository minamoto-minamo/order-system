-- DropForeignKey
ALTER TABLE "CourseFoodItem" DROP CONSTRAINT "CourseFoodItem_menuItemId_fkey";

-- DropForeignKey
ALTER TABLE "DrinkPlanItem" DROP CONSTRAINT "DrinkPlanItem_menuItemId_fkey";

-- DropForeignKey
ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_menuItemId_fkey";

-- AlterTable
ALTER TABLE "OrderItem" ALTER COLUMN "menuItemId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "DrinkPlanItem" ADD CONSTRAINT "DrinkPlanItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseFoodItem" ADD CONSTRAINT "CourseFoodItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
