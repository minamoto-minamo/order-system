# Quickstart: 店舗削除・無効化の運用安全性（F7）

## 前提

- ローカルDB起動済み・マイグレーション適用済み（`pnpm --filter backend db:migrate`）
- プラットフォーム管理者アカウントでログイン済み（`POST /api/platform/auth/login`、`platform_token` cookie取得）

## 1. 営業中データがある店舗の削除拒否を確認する（US1）

1. テスト用店舗を作成し、`POST /api/sessions`でセッションをopenにする（またはseed済み店舗を使う）。
2. `DELETE /api/platform/stores/:id`を呼び出す。
3. **期待結果**: `409`、`error.code === 'platform_stores.delete.active_data_exists'`。店舗・セッション・グループのデータが削除前のまま残っていることをDBで確認する。

## 2. アクティブなグループがある店舗の削除拒否を確認する（US1）

1. セッションは`closed`だが、`active`または`bill_requested`状態のグループが残っている店舗を用意する。
2. `DELETE /api/platform/stores/:id`を呼び出す。
3. **期待結果**: 手順1と同じ409応答。

## 3. 営業中データがない店舗の削除成功を確認する（回帰確認）

1. セッション・グループがすべて`closed`（または0件）の店舗を用意する。
2. `DELETE /api/platform/stores/:id`を呼び出す。
3. **期待結果**: `204`。店舗・関連データがすべて削除されている。

## 4. タイムアウト延長の確認（US2、任意・開発環境）

1. `pnpm --filter backend test`でユニットテスト（トランザクション`timeout`オプションが30秒で呼ばれていることのモック検証）が通ることを確認する。
2. 実データでの大規模削除の検証は本番相当のデータ量を用意する必要があるため、ユニットテストでの検証に留める（Assumptions参照）。

## 回帰確認

- `pnpm --filter backend typecheck`
- `pnpm --filter backend test`
- 既存のプラットフォーム管理API（店舗一覧・詳細取得・更新）に回帰がないことを確認する。
