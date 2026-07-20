# Research: Course/DrinkPlan削除時の会計済みグループ参照消失をログに記録する

Phase 0 output. NEEDS CLARIFICATION は spec.md の `/speckit-clarify` セッションで解消済みのため、本ドキュメントは技術的な実装方針の調査結果のみを記録する。

## R1: ログ集計の実装パターン

**Decision**: `courses.ts`の`DELETE /:id`と`drinkPlans.ts`の`DELETE /:id`の既存Serializableトランザクション内、`course.delete`/`drinkPlan.delete`実行の直前に、`tx.group.count({ where: { courseId, status: 'closed' } })`（`drinkPlans.ts`側は`drinkPlanId`）を追加し、件数が1件以上なら`fastify.log.warn`する。

**Rationale**:
- 既存の`referencedOrderItemCount`集計・ログ出力パターン（同ファイル内、直前の数行）と全く同じ構造で追加できる。新規ヘルパー関数・抽象化は不要。
- 集計をトランザクション内で行うことで、削除実行までの間に対象グループの状態が変化してもカウントの整合性が保たれる（`docs/data-model/concurrency-notes.md`の方針にも合致するが、本フィーチャーでは既存のSerializableトランザクションを流用するのみで新規の並行制御は導入しない）。

**Alternatives considered**:
- トランザクション外で事前集計する: 削除実行までの間に競合が起きるとログの件数が不正確になりうる。トランザクション内集計は既存パターンと同じコストで実装できるため不採用。
- 別テーブル（監査ログテーブル）への永続化: 指摘6-3（ログ・エラートラッキングの外部連携）のスコープであり、本フィーチャー（既存`fastify.log.warn`パターンの踏襲）を超える。不採用。

## R2: ログメッセージ・構造化フィールド

**Decision**: `courses.ts`は`{ courseId, storeId, closedGroupCount }`＋メッセージ「コース削除により過去の closed グループの courseId 参照が失われます」。`drinkPlans.ts`は`{ drinkPlanId, storeId, closedGroupCount }`＋メッセージ「飲み放題プラン削除により過去の closed グループの drinkPlanId 参照が失われます」。

**Rationale**: 既存の`referencedOrderItemCount`ログのフィールド命名規則（`<対象ID>`, `storeId`, `<カウント名>Count`）とメッセージの文体（「〜により過去の〜が失われます」）にそのまま合わせる。既存ログと区別できるよう対象を`OrderItem`ではなく`closed グループ`と明記する。

**Alternatives considered**: 既存の`referencedOrderItemCount`ログに`closedGroupCount`を追加フィールドとして統合する — 対象読者（削除操作の監査）が異なる可能性があり、既存ログの構造を変更すると既存の監視・アラート設定に影響しうるため、別ログとして追加する方が影響が小さい。

## R3: スキーマ・APIコントラクト変更の要否

**Decision**: 変更なし。

**Rationale**: 本フィーチャーはサーバーサイドのログ出力のみを追加し、`backend/prisma/schema.prisma`・レスポンス形状・エラーコードのいずれも変更しない。
