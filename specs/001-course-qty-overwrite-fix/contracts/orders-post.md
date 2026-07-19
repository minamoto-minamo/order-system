# Contract: POST /orders（変更差分）

対象: `backend/src/routes/orders.ts` の `POST /orders`（スタッフ用、認証必須）。

既存のリクエスト・レスポンススキーマ自体（`groupId` / `items[]` / `courseId`）は変更しない。追加されるのはリクエストの受理条件（バリデーション）のみ。

## リクエスト（既存、参考）

```jsonc
{
  "groupId": "string",
  "items": [
    { "menuItemId": 1, "qty": 1, "isTakeout": false }
  ],
  "courseId": 1 // optional | null
}
```

## 新規バリデーション

**条件**: `courseId` が指定されており（`null` でない）、かつ `items` の中に、`courseId` に対応する `Course.foodItems` の `menuItemId` のいずれかと一致する `menuItemId` を持つ item が1件以上含まれる場合。

**挙動**: リクエスト全体を拒否する（一部の item のみを許可する部分成功は行わない）。

**レスポンス（新規）**:

```jsonc
// 422 Unprocessable Entity
{
  "error": {
    "code": "orders.create.course_food_item_conflict",
    "message": "コース内商品と同じメニューは courseId 付きで追加注文できません",
    "details": {
      "courseId": 1,
      "conflictingMenuItemIds": [3, 7]
    }
  }
}
```

（実際のエラーボディ形式は `backend/src/lib/errors.ts` の `errorBody()` / `sendError()` の既存フォーマットに従う。`details` の形は既存の類似エラー、例えば `MenuItemsNotFound` の `{ menuItemIds: missing }` に倣う。）

## 既存バリデーションとの実行順序

1. `groupId` 存在チェック・`group.status === 'active'` チェック（既存、変更なし）
2. `menuItemId` の存在チェック（既存、変更なし）
3. 品切れチェック（既存、変更なし）
4. テイクアウト整合性チェック（既存、変更なし）
5. `courseId` 存在チェック（既存、`prisma.course.findFirst`、`foodItems` を include 済み）
6. **【新規】** コース内商品と `courseId` 付きitemsの衝突チェック（本機能で追加。5.で取得した `course.foodItems` を使用し、追加のDBクエリなし）
7. トランザクション開始（既存）：`currentGroup.status === 'active'` 再チェック、`currentGroup.courseId === body.courseId` 一致チェック（既存、変更なし）

新規チェックはトランザクション開始前、既存の `courseId` 存在チェック直後に配置する（詳細は `research.md` の Decision 1 を参照）。

## 影響を受けない既存の正常系

- `courseId` を指定しない追加注文（現行フロントエンドの通常経路）: 影響なし。
- `courseId` を指定し、コース外商品のみを注文する場合: 影響なし（衝突なしのため通過）。
- `courseId` を指定せず、コース内商品と同一メニューを注文する場合: 影響なし（`courseId` が `null` のため新規チェックの対象外）。

## 変更なしのエンドポイント

- `PUT /groups/:id/course`（`backend/src/routes/groups.ts` 692-727行目付近、人数変更・再計算処理）: 本機能では変更しない。新規バリデーションにより、このエンドポイントが再計算対象とする「`courseId === group.courseId && isCourseCharge === false && menuItemId が course.foodItems に含まれる`」明細は、今後は常にコース適用時の自動生成明細のみになる。
