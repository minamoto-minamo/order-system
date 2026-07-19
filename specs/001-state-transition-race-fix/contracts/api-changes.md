# API変更契約: 会計依頼の未提供注文チェック（5-1統合分）

本フィーチャーの他の変更（`order:complete`/`order:serve`のcompare-and-swap化、コース適用・人数変更のトランザクション内再取得、会計依頼のグループ状態競合対応）はリクエスト/レスポンス形状を変更しないため契約書は作成しない。ここでは旧001-billing-order-validationから統合した、未提供注文チェックによる新規エラーレスポンスのみを記載する。

## 1. `PUT /api/groups/:id`（スタッフ用、`backend/src/routes/groups.ts`）

### 変更点

`body.status`が`'bill_requested'`かつ現在の`Group.status`が`'active'`の場合、対象グループに`OrderItem.status IN ('pending', 'ready')`が1件でも存在すれば拒否する。

### レスポンス（新規追加分のみ）

**409 Conflict**（新規）

```json
{
  "error": {
    "code": "groups.update.unserved_items_exist",
    "message": "未提供の注文が残っているため会計待ちにできません",
    "details": { "count": 2 }
  }
}
```

### 既存レスポンスへの影響

未提供注文が存在しない場合の挙動（200での更新成功）は変更なし。他の`InvalidTransition`/`SeatConflict`/`GroupStatusError`等の既存エラー分岐との優先順位: 状態遷移の妥当性チェック（`validTransitions`）を先に行い、遷移自体が有効な場合にのみ未提供注文チェックを行う（無効な遷移はこれまでどおり`InvalidTransition`を返す）。

## 2. `POST /api/customer/groups/:id/bill`（客用、`backend/src/routes/customer.ts`）

### 変更点

現在の`Group.status`が`'active'`であることの確認と、`OrderItem.status IN ('pending', 'ready')`の存在チェックを、新規導入するSerializableトランザクション内で同時に行う。

### レスポンス（新規追加分のみ）

**409 Conflict**（新規）

```json
{
  "error": {
    "code": "customer.bill.unserved_items_exist",
    "message": "未提供の注文が残っているため会計を依頼できません",
    "details": { "count": 2 }
  }
}
```

### 既存レスポンスへの影響

- `400 customer.bill.not_allowed`（`group.status !== 'active'`）は、トランザクション内での再検証に置き換わる（レスポンス自体の形は維持、check-then-actからSerializableトランザクション内チェックに変更）。
- 未提供注文が存在しない場合の挙動（204成功）は変更なし。
