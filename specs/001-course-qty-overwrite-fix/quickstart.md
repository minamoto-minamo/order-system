# Quickstart: コース人数変更時の手動追加注文保護

本機能の動作確認手順（バックエンドのみ、UI変更なし）。詳細な契約は [contracts/orders-post.md](./contracts/orders-post.md)、データ参照は [data-model.md](./data-model.md) を参照。

## 前提

- `pnpm --filter backend db:migrate` 済み、`pnpm --filter backend db:seed` 済みの開発環境（本機能はスキーマ変更を伴わないため、追加のマイグレーションは不要）。
- コースとコース内商品（`foodItems`）が設定済みの店舗・コースが存在すること（seedデータ、または `courses.ts` API で作成）。

## シナリオ1: 回帰確認（既存の正常系、courseIdなし追加注文）

1. コース適用済みのアクティブなグループを用意する。
2. `POST /orders` に `courseId` を指定せず、コース内商品と同一メニューを追加注文する。
3. **期待結果**: 201相当で明細が作成される（従来通り）。
4. `PUT /groups/:id/course` で人数変更を実行する。
5. **期待結果**: 追加注文した明細の数量は変化しない（従来通り、対応する `spec.md` の Edge Cases 参照）。

## シナリオ2: 新規バリデーション（courseId付き・コース内商品と同一メニュー）

1. コース適用済みのアクティブなグループを用意する。
2. `POST /orders` に、アクティブなコースの `courseId` と、そのコースの `foodItems` に含まれる `menuItemId` を持つ item を指定して追加注文する。
3. **期待結果**: 422 `orders.create.course_food_item_conflict` が返り、明細は作成されない（`GET /orders?groupId=...` で件数が増えていないことを確認）。

## シナリオ3: 新規バリデーションの境界確認（courseId付き・コース外商品）

1. コース適用済みのアクティブなグループを用意する。
2. `POST /orders` に、アクティブなコースの `courseId` と、そのコースの `foodItems` に含まれない `menuItemId` を指定して追加注文する。
3. **期待結果**: 従来通り成功する（新規バリデーションはコース外商品には影響しない）。

## 自動テスト

`backend/src/__tests__/orders.test.ts` に上記シナリオに対応するテストケースを追加し、`pnpm --filter backend test` で実行する。
