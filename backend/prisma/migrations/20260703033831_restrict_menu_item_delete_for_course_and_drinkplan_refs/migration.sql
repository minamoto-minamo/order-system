-- DropForeignKey
ALTER TABLE "CourseFoodItem" DROP CONSTRAINT "CourseFoodItem_menuItemId_fkey";

-- DropForeignKey
ALTER TABLE "DrinkPlanItem" DROP CONSTRAINT "DrinkPlanItem_menuItemId_fkey";

-- AddForeignKey
ALTER TABLE "DrinkPlanItem" ADD CONSTRAINT "DrinkPlanItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseFoodItem" ADD CONSTRAINT "CourseFoodItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
