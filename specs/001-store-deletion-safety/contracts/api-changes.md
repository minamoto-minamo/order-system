# API変更契約: 店舗削除・無効化の運用安全性（F7）

## `DELETE /api/platform/stores/:id`（プラットフォーム管理者用、`backend/src/routes/platformStores.ts`）

### 変更点

削除実行前に、対象店舗に`Session.status === 'open'`または`Group.status IN ('active', 'bill_requested')`のレコードが存在するかを判定する。存在する場合は削除を拒否する。判定とカスケード削除は同一のインタラクティブトランザクション内で行う。また、トランザクションの`timeout`を既定値から30秒に延長する。

### レスポンス（新規追加分のみ）

**409 Conflict**（新規）

```json
{
  "error": {
    "code": "platform_stores.delete.active_data_exists",
    "message": "営業中のセッションまたはアクティブなグループが存在するため削除できません",
    "details": { "openSessionCount": 1, "activeGroupCount": 2 }
  }
}
```

### 既存レスポンスへの影響

- `404 platform_stores.detail.not_found`（店舗自体が存在しない）: 変更なし。
- 営業中データが存在しない店舗の削除（`204`）: 変更なし。
- カスケード削除中の予期しないDB例外時の挙動（`isActive`を`true`に復元してエラーをthrow、`app.ts`の`setErrorHandler`が処理）: 変更なし。営業中データ検出時（新規409）も同じ復元パスを通る。
