-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('open', 'closed');

-- CreateEnum
CREATE TYPE "SeatType" AS ENUM ('counter', 'table');

-- CreateEnum
CREATE TYPE "GroupStatus" AS ENUM ('active', 'bill_requested', 'closed');

-- CreateEnum
CREATE TYPE "OrderItemStatus" AS ENUM ('pending', 'ready', 'served', 'cancelled');

-- CreateEnum
CREATE TYPE "TakeoutType" AS ENUM ('dine_in', 'both', 'takeout');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('admin', 'staff');

-- CreateTable
CREATE TABLE "Session" (
    "id" SERIAL NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'open',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeatTable" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "w" INTEGER NOT NULL,
    "h" INTEGER NOT NULL,

    CONSTRAINT "SeatTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seat" (
    "id" SERIAL NOT NULL,
    "label" TEXT NOT NULL,
    "type" "SeatType" NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "tableId" INTEGER,

    CONSTRAINT "Seat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubCategory" (
    "id" SERIAL NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SubCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "subCategoryId" INTEGER NOT NULL,
    "soldOut" BOOLEAN NOT NULL DEFAULT false,
    "takeout" "TakeoutType" NOT NULL DEFAULT 'dine_in',

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrinkPlan" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "DrinkPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DrinkPlanItem" (
    "drinkPlanId" INTEGER NOT NULL,
    "menuItemId" INTEGER NOT NULL,

    CONSTRAINT "DrinkPlanItem_pkey" PRIMARY KEY ("drinkPlanId","menuItemId")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "drinkPlanId" INTEGER,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseFoodItem" (
    "courseId" INTEGER NOT NULL,
    "menuItemId" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "CourseFoodItem_pkey" PRIMARY KEY ("courseId","menuItemId")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "guestCount" INTEGER NOT NULL,
    "status" "GroupStatus" NOT NULL DEFAULT 'active',
    "sessionId" INTEGER NOT NULL,
    "courseId" INTEGER,
    "drinkPlanId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupSeat" (
    "groupId" TEXT NOT NULL,
    "seatId" INTEGER NOT NULL,

    CONSTRAINT "GroupSeat_pkey" PRIMARY KEY ("groupId","seatId")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "menuItemId" INTEGER NOT NULL,
    "menuItemName" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "status" "OrderItemStatus" NOT NULL DEFAULT 'pending',
    "isTakeout" BOOLEAN NOT NULL DEFAULT false,
    "courseId" INTEGER,
    "orderedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "storeName" TEXT NOT NULL,
    "closingTime" TEXT NOT NULL,
    "taxRateInHouse" DECIMAL(5,2) NOT NULL,
    "taxRateTakeout" DECIMAL(5,2) NOT NULL,
    "canvasCols" INTEGER NOT NULL DEFAULT 16,
    "canvasRows" INTEGER NOT NULL DEFAULT 12,
    "canvasColsMin" INTEGER NOT NULL DEFAULT 8,
    "canvasColsMax" INTEGER NOT NULL DEFAULT 32,
    "canvasRowsMin" INTEGER NOT NULL DEFAULT 6,
    "canvasRowsMax" INTEGER NOT NULL DEFAULT 24,
    "gridSize" INTEGER NOT NULL DEFAULT 48,
    "gridSizeMin" INTEGER NOT NULL DEFAULT 32,
    "gridSizeMax" INTEGER NOT NULL DEFAULT 80,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'staff',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Seat_tableId_idx" ON "Seat"("tableId");

-- CreateIndex
CREATE INDEX "SubCategory_categoryId_idx" ON "SubCategory"("categoryId");

-- CreateIndex
CREATE INDEX "MenuItem_categoryId_idx" ON "MenuItem"("categoryId");

-- CreateIndex
CREATE INDEX "MenuItem_subCategoryId_idx" ON "MenuItem"("subCategoryId");

-- CreateIndex
CREATE INDEX "Course_drinkPlanId_idx" ON "Course"("drinkPlanId");

-- CreateIndex
CREATE INDEX "Group_sessionId_idx" ON "Group"("sessionId");

-- CreateIndex
CREATE INDEX "Group_status_idx" ON "Group"("status");

-- CreateIndex
CREATE INDEX "GroupSeat_seatId_idx" ON "GroupSeat"("seatId");

-- CreateIndex
CREATE INDEX "OrderItem_groupId_idx" ON "OrderItem"("groupId");

-- CreateIndex
CREATE INDEX "OrderItem_status_idx" ON "OrderItem"("status");

-- CreateIndex
CREATE INDEX "OrderItem_orderedAt_idx" ON "OrderItem"("orderedAt");

-- CreateIndex
CREATE UNIQUE INDEX "staff_username_key" ON "staff"("username");

-- AddForeignKey
ALTER TABLE "Seat" ADD CONSTRAINT "Seat_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "SeatTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubCategory" ADD CONSTRAINT "SubCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_subCategoryId_fkey" FOREIGN KEY ("subCategoryId") REFERENCES "SubCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrinkPlanItem" ADD CONSTRAINT "DrinkPlanItem_drinkPlanId_fkey" FOREIGN KEY ("drinkPlanId") REFERENCES "DrinkPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrinkPlanItem" ADD CONSTRAINT "DrinkPlanItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_drinkPlanId_fkey" FOREIGN KEY ("drinkPlanId") REFERENCES "DrinkPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseFoodItem" ADD CONSTRAINT "CourseFoodItem_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseFoodItem" ADD CONSTRAINT "CourseFoodItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_drinkPlanId_fkey" FOREIGN KEY ("drinkPlanId") REFERENCES "DrinkPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSeat" ADD CONSTRAINT "GroupSeat_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupSeat" ADD CONSTRAINT "GroupSeat_seatId_fkey" FOREIGN KEY ("seatId") REFERENCES "Seat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE SET NULL ON UPDATE CASCADE;
