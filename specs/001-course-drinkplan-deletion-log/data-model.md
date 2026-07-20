# Phase 1 Data Model: Course/DrinkPlan削除時の会計済みグループ参照消失をログに記録する

スキーマ変更は発生しない（`backend/prisma/schema.prisma`は無変更）。本フィーチャーが扱う既存エンティティのうち、ログ集計に関わる部分のみを記載する。

## Group（既存）

- `status: GroupStatus`（`active` / `bill_requested` / `closed`）。
- `courseId: Int?` / `drinkPlanId: Int?`。コース削除・飲み放題プラン削除時、`ON DELETE SET NULL`によりnull化される。
- **本フィーチャーでの扱い**: コース/飲み放題プラン削除トランザクション内で、`status === 'closed'`かつ対象`courseId`/`drinkPlanId`を参照する件数を集計する（参照のみ、書き込みなし）。

## Course（既存）

- 削除処理（`DELETE /:id`）は既存どおり。トランザクション内、削除実行前に`closed`グループからの参照件数を追加集計する。

## DrinkPlan（既存）

- 削除処理（`DELETE /:id`）は既存どおり。トランザクション内、削除実行前に`closed`グループからの参照件数を追加集計する。

## ログ出力（新規、永続化なし）

| 発生箇所 | 条件 | フィールド |
|---|---|---|
| `courses.ts` `DELETE /:id` | `closed`グループの`courseId`参照が1件以上 | `courseId`, `storeId`, `closedGroupCount` |
| `drinkPlans.ts` `DELETE /:id` | `closed`グループの`drinkPlanId`参照が1件以上 | `drinkPlanId`, `storeId`, `closedGroupCount` |

いずれも`fastify.log.warn`によるアプリケーションログ出力のみで、DBへの永続化は行わない。
