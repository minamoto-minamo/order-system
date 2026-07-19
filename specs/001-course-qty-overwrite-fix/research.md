# Phase 0 Research: コース人数変更時の手動追加注文保護

Technical Context に NEEDS CLARIFICATION は残っていない（既存スタックの範囲内の変更であり、技術選定上の不明点はない）。以下は実装方針上の主要な決定事項を記録する。

## Decision 1: バリデーションの実施箇所

- **Decision**: `backend/src/routes/orders.ts` の `POST /orders` ハンドラ内、既存の `courseId` 存在チェック（127-139行目付近、`course` を `prisma.course.findFirst` で取得している箇所）の直後、トランザクション開始前に新規バリデーションを追加する。
- **Rationale**: `course`（`foodItems` を含む）をトランザクション外で取得済みであり、追加のクエリなしで判定できる。トランザクション開始前に弾けるリクエストをトランザクション外で弾くことで、無用なトランザクション開始・ロック取得を避けられる（既存の `SoldOut` / `TakeoutMismatch` チェックと同じ設計方針）。
- **Alternatives considered**:
  - トランザクション内（`currentGroup.courseId === body.courseId` チェックの直後）に判定する: `currentGroup.courseId` を再取得する必要があり、`course.foodItems` はすでにトランザクション外で取得済みのため、トランザクション内で再度取得するのは冗長。トランザクション外判定で十分（`courseId` の一致自体はグループの状態に依存しないため、TOCTOU上の懸念は既存の他のバリデーション項目と同等でリスクは増えない）。

## Decision 2: 判定条件

- **Decision**: `body.courseId != null` の場合、`body.items` の中に `menuItemId` が `course.foodItems` の `menuItemId` 一覧に含まれるものが1件でもあれば、リクエスト全体を拒否する。
- **Rationale**: FR-003（コース内商品と同一メニューを `courseId` 付きで追加注文することを禁止）を素直に実装する条件。`course` は既に取得済みで `foodItems` を include 済み（`groups.ts` の類似実装と同じデータ形状）。
- **Alternatives considered**: 該当する item のみを拒否し、他の item は許可する部分成功: FR-004（リクエスト全体を明確なエラーで拒否）に反するため不採用。他のバッチ系バリデーション（`MenuItemsNotFound`, `SoldOut`, `TakeoutMismatch`）も同様に全体拒否方式であり、一貫性がある。

## Decision 3: エラーコードの命名

- **Decision**: `ErrorCodes.Orders.CourseFoodItemConflict = 'orders.create.course_food_item_conflict'` を追加する。
- **Rationale**: 既存の `Orders` エラーコードの命名規約（`orders.<action>.<snake_case_reason>`）に一致させる。`CourseNotFound` / `CourseMismatch` に続く命名として自然。
- **Alternatives considered**: `DuplicateCourseFoodItem` — 「重複」という語は同一リクエスト内の重複と誤解されやすいため、"conflict"（コースの自動生成対象と追加注文が衝突する）の方が実態に近いとして不採用。

## Decision 4: 既存データへの遡及対応

- **Decision**: 行わない（FR-005 / clarify で確定済み）。
- **Rationale**: 現行フロントエンドは追加注文時に `courseId` を送信しないため、該当する曖昧な既存データは実質存在しないと推定される。存在した場合も、`PUT /:id/course` の既存の再計算ロジックは変更しないため、挙動は本機能適用前と変わらない（悪化しない）。
