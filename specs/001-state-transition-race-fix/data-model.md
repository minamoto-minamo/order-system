# Phase 1 Data Model: 状態変更エンドポイントのレースコンディションをトランザクション内再検証で解消する

スキーマ変更は発生しない（`backend/prisma/schema.prisma`は無変更）。本フィーチャーが扱う既存エンティティのうち、並行制御に関わる部分のみを記載する。

## Group

- `status: GroupStatus`（`active` / `bill_requested` / `closed` 等）。会計依頼はこのフィールドの`active → bill_requested`遷移を扱う。
- `courseId: Int?` / `drinkPlanId: Int?`。コース適用・人数変更・解除で書き換わる。
- **本フィーチャーでの制約**:
  - 会計依頼: Serializableトランザクション内で「`status`が`active`であること」かつ「紐づく未提供`OrderItem`が0件であること（5-1統合）」の両方を再検証する。いずれかを満たさない場合は更新しない。対象は客用`POST /customer/groups/:id/bill`・スタッフ用`PUT /api/groups/:id`の両方。
  - コース適用/人数変更: 既存通り、トランザクション内で`status === 'active'`（および人数変更では`courseId`が一致すること）を再検証する。この検証自体は既存実装のままでよく、本フィーチャーで変更するのは「Course/DrinkPlanの再取得」の部分のみ。

## OrderItem

- `status: OrderItemStatus`（`pending` / `ready` / `served` / `cancelled`）。
- `group: Group`（多対一）。`Group.session: Session`（多対一）。
- `menuItemId: Int?`（コース・飲み放題の定額課金明細は`null`）。
- **本フィーチャーでの制約**:
  - `order:complete`: CAS条件は「`status === 'pending'`」かつ「`group.status !== 'closed'`」かつ「`group.session.status !== 'closed'`」。成功時のみ`status: 'ready'`に更新する。
  - `order:serve`: CAS条件は「`status === 'ready'`」かつ「`group.status !== 'closed'`」かつ「`group.session.status !== 'closed'`」。成功時のみ`status: 'served'`に更新する。
  - コース適用時に作成される`OrderItem`（定額課金明細・コース料理明細・飲み放題ゼロ化更新）は、トランザクション内で再取得した`Course`/`DrinkPlan`の値（`price`、`foodItems`、`drinkPlanId`等）に基づいて生成・更新する。
  - 会計依頼（5-1統合）: 「未提供」= `status IN ('pending', 'ready')`。`menuItemId`が`null`の定額課金明細も対象に含める。会計依頼のSerializableトランザクション内で`count({ where: { groupId, status: { in: ['pending', 'ready'] } } })`を実行し、`count > 0`なら遷移を拒否する。書き込みは行わない（参照のみ）。

## 新規エラーコード（`backend/src/lib/errors.ts`、5-1統合分）

| 名前空間 | キー | 値 | HTTPステータス | 用途 |
|---|---|---|---|---|
| `ErrorCodes.Groups` | `UnservedItemsExist` | `groups.update.unserved_items_exist` | 409 | スタッフ用`PUT /:id`で未提供注文が残っている場合の拒否 |
| `ErrorCodes.Customer` | `UnservedItemsExist` | `customer.bill.unserved_items_exist` | 409 | 客用`POST /groups/:id/bill`で未提供注文が残っている場合の拒否 |

グループ状態競合（`active`でなくなっていた場合）は既存の400エラー（客用: `BillRequestNotAllowed`、スタッフ用: 既存の状態遷移エラー）を再利用し、新規コードは追加しない。上記2件は未提供注文チェック専用。

## Course（参照系、コース適用/人数変更でのみ読み取り）

- `price: Int`、`foodItems: CourseFoodItem[]`（`menuItemId`, `qty`）、`drinkPlanId: Int?`。
- **本フィーチャーでの制約**: コース適用・人数変更のトランザクション内で再取得する。トランザクション開始前に取得した値をOrderItem作成・Group更新に使い回さない。

## DrinkPlan（参照系、コース適用でのみ読み取り）

- `price: Int`、対象商品（`DrinkPlanItem[]`経由の`menuItemId`）。
- **本フィーチャーでの制約**: コース適用のトランザクション内で（`course.drinkPlanId`に基づき）再取得する。

## 状態遷移まとめ（本フィーチャーが保護する遷移）

| エンティティ | 遷移 | ガード | 実現方式 |
|---|---|---|---|
| Group | `active` → `bill_requested` | 更新直前も`active`であること、かつ未提供`OrderItem`が0件であること（5-1統合） | Serializableトランザクション内再検証 |
| OrderItem | `pending` → `ready` | 更新直前も`pending`かつグループ/セッション非`closed` | `updateMany` CAS |
| OrderItem | `ready` → `served` | 更新直前も`ready`かつグループ/セッション非`closed` | `updateMany` CAS |
| Group + OrderItem（複数） | コース適用（`courseId`/`drinkPlanId`設定、明細作成） | 更新直前も`active`かつコース未適用、かつ使用するCourse/DrinkPlanが処理完了時点の最新値 | Serializableトランザクション内再取得 |
| Group + OrderItem（複数） | コース人数変更（数量再計算） | 更新直前も`active`かつコース適用中、かつ使用するCourseが処理完了時点の最新値 | Serializableトランザクション内再取得 |
