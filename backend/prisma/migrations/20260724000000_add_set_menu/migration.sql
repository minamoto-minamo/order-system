-- AlterTable
ALTER TABLE "MenuItem" ADD COLUMN "isSet" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN "isSetCharge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "setOrderItemId" TEXT;

-- CreateTable
CREATE TABLE "SetFrame" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "menuItemId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SetFrame_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SetFrameChoice" (
    "id" SERIAL NOT NULL,
    "frameId" INTEGER NOT NULL,
    "menuItemId" INTEGER NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SetFrameChoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderItem_setOrderItemId_idx" ON "OrderItem"("setOrderItemId");

-- CreateIndex
CREATE INDEX "SetFrame_menuItemId_idx" ON "SetFrame"("menuItemId");

-- CreateIndex
CREATE INDEX "SetFrame_storeId_idx" ON "SetFrame"("storeId");

-- CreateIndex
CREATE INDEX "SetFrameChoice_frameId_idx" ON "SetFrameChoice"("frameId");

-- CreateIndex
CREATE INDEX "SetFrameChoice_menuItemId_idx" ON "SetFrameChoice"("menuItemId");

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_setOrderItemId_fkey" FOREIGN KEY ("setOrderItemId") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetFrame" ADD CONSTRAINT "SetFrame_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "store"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetFrame" ADD CONSTRAINT "SetFrame_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetFrameChoice" ADD CONSTRAINT "SetFrameChoice_frameId_fkey" FOREIGN KEY ("frameId") REFERENCES "SetFrame"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SetFrameChoice" ADD CONSTRAINT "SetFrameChoice_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
