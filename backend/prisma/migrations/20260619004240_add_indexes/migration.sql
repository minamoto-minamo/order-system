-- CreateIndex
CREATE INDEX "Group_sessionId_idx" ON "Group"("sessionId");

-- CreateIndex
CREATE INDEX "Group_status_idx" ON "Group"("status");

-- CreateIndex
CREATE INDEX "GroupSeat_seatId_idx" ON "GroupSeat"("seatId");

-- CreateIndex
CREATE INDEX "MenuItem_categoryId_idx" ON "MenuItem"("categoryId");

-- CreateIndex
CREATE INDEX "MenuItem_subCategoryId_idx" ON "MenuItem"("subCategoryId");

-- CreateIndex
CREATE INDEX "OrderItem_groupId_idx" ON "OrderItem"("groupId");

-- CreateIndex
CREATE INDEX "OrderItem_status_idx" ON "OrderItem"("status");
