-- SeatTable に存在しない tableId を持つ席を NULL にする
UPDATE "Seat" SET "tableId" = NULL
WHERE "tableId" IS NOT NULL
  AND "tableId" NOT IN (SELECT "id" FROM "SeatTable");

ALTER TABLE "Seat" ADD CONSTRAINT "Seat_tableId_fkey"
  FOREIGN KEY ("tableId") REFERENCES "SeatTable"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
