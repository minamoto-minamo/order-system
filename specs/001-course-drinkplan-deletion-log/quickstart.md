# Quickstart: Course/DrinkPlan削除時の会計済みグループ参照消失をログに記録する

## 前提

- ローカル環境でbackendが起動していること（`pnpm dev`）。
- `pnpm --filter backend db:seed`済みのDBに、`closed`状態のグループが特定の`courseId`/`drinkPlanId`を参照するテストデータが存在すること（Prisma Studio等で直接作成してもよい）。

## 1. 自動テスト

```bash
pnpm --filter backend test -- courses.test.ts
pnpm --filter backend test -- drinkPlans.test.ts
```

期待結果: `closed`グループ参照ありのケースでログ出力用のモック（`fastify.log.warn`）が呼ばれ、`closedGroupCount`が期待件数と一致すること。参照なしのケースでは呼ばれないこと。

## 2. 手動確認（任意、開発環境）

1. 管理画面で新規コースを作成し、テーブルに適用後、会計を確定（`closed`）する。
2. 同じコースを削除する（管理画面またはAPI直接呼び出し）。
3. backendの起動ログに`courseId`・`storeId`・`closedGroupCount`を含む警告ログが出力されることを確認する。
4. 削除自体が成功（204等の成功レスポンス）することを確認する（回帰なし）。
5. 飲み放題プランについても同様の手順で確認する。

## 3. 回帰確認（通常時）

- `closed`グループの参照がないコース・飲み放題プランを削除し、既存の成功レスポンス・挙動に変化がないこと、当該ログが出力されないことを確認する。
- 既存の`OrderItem`参照ログ（`referencedOrderItemCount`）が引き続き出力されることを確認する（本フィーチャーによる変更なし）。
- `active`/`bill_requested`グループが参照している場合は既存どおり`in_use`エラーで削除が拒否されることを確認する（本フィーチャーによる変更なし）。
