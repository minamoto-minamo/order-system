-- 飲み放題適用により price が 0 円へ書き換えられた既存の OrderItem には
-- originalPrice のスナップショットが存在しない（このマイグレーション以前は保存する仕組みがなかったため）。
-- 復元時に originalPrice が NULL のまま price(=0) にフォールバックすると恒久的に 0 円へ「復元」されてしまうため、
-- 現在の MenuItem.price で近似バックフィルする（注文時点の価格と完全一致する保証はないが、0円化されるより安全）。
UPDATE "OrderItem" oi
SET "originalPrice" = mi."price"
FROM "MenuItem" mi
WHERE oi."menuItemId" = mi."id"
  AND oi."price" = 0
  AND oi."originalPrice" IS NULL
  AND oi."isCourseCharge" = false
  AND oi."status" != 'cancelled';
