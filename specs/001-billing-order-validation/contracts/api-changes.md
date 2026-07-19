# API変更契約: 会計・注文可否のサーバー側検証見直し

既存1エンドポイントの挙動変更のみ。リクエストスキーマの変更はなし。指摘5-1（未提供注文チェック、`PUT /api/groups/:id`・`POST /api/customer/groups/:id/bill`）は001-state-transition-race-fixへ統合済みのため本ドキュメントからは削除した。

## `POST /api/customer/orders`（客用、`backend/src/routes/customer.ts`）

### 変更点

飲み放題プラン適用中のグループに対する注文リクエストで、プラン対象外商品が混在していても拒否しない。プラン対象商品は `price: 0`、対象外商品は `price: originalPrice` としてそれぞれ登録する。

### 削除されるレスポンス

**422 `customer.orders.drink_plan_mismatch`**（削除）— このエラーはもう発生しない。

### 既存レスポンスへの影響

- 201成功時のレスポンス形（`OrderItem[]`）は変更なし。プラン対象商品・対象外商品が同じ配列に混在して返る点が新しい（従来は対象外商品混在時点で201自体が発生しなかった）。
- `422 menu_items_not_found` / `409 sold_out` / `422 takeout_only` の既存バリデーションとその優先順位は変更なし（プラン整合性チェックの削除により、バリデーション順序は「品切れ→テイクアウト」で完結する）。
