# Feature Specification: Course/DrinkPlan削除時の会計済みグループ参照消失をログに記録する

**Feature Branch**: `001-course-drinkplan-deletion-log`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "Course/DrinkPlan削除時、会計済み（closed）グループへの参照が失われる操作をログに残す（設計レビュー指摘2-4、データ整合性観点、Medium）。backend/src/routes/courses.tsのDELETE /:idとbackend/src/routes/drinkPlans.tsのDELETE /:idは、使用中判定をstatus: { in: ['active', 'bill_requested'] }のグループに限定しており、closed（会計確定済み）のグループが同じcourseId/drinkPlanIdを保持していても検査しない。Group.courseId/Group.drinkPlanIdのFKはON DELETE SET NULLのため、削除すると過去のclosedグループのcourseId/drinkPlanIdが黙ってnullに書き換わる。両ファイルには既にOrderItem.courseId（またはdrinkPlanId経由のOrderItem）のnull化についてfastify.log.warnで警告する既存パターンがあるが、Group.courseId/Group.drinkPlanId自体のnull化についてはログもチェックも存在しない。既存パターン（referencedOrderItemCountのログ）と同じ形で、closedグループへの参照件数もログに残す方針を軸に仕様化する。"

## Clarifications

### Session 2026-07-19

- Q: closedグループがcourseId/drinkPlanIdを参照している場合、削除自体をどう扱うか？（レビュー改善案は「ログに残す」を主案、「削除自体をブロックする」を将来検討案として提示） → A: ログのみ記録し、削除は許可する。既存の`OrderItem.courseId`パターンと一貫させ、影響を最小化する。削除自体のブロックは本フィーチャーのスコープ外とする。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - コース削除時に過去の会計済みグループへの参照消失を追跡可能にする (Priority: P1)

店舗管理者がコースメニューを削除する操作を行ったとき、そのコースを過去に利用していた会計確定済み（`closed`）グループが存在する場合、削除自体は現状どおり成立するが、サーバーログに「何件のclosedグループの参照が失われたか」が記録される。既存の`OrderItem.courseId`のnull化と同じ扱いにすることで、削除操作を監査・追跡できるようにする。

**Why this priority**: 過去に確定会計したグループがどのコースを利用していたかという履歴情報が、削除操作をトリガーに事後的に失われる。監査・問い合わせ対応時に追跡できなくなる問題への対処であり、本フィーチャーの主目的。

**Independent Test**: `closed`状態のグループが`courseId`を参照している状態でコース削除APIを呼び出し、削除が成功し、かつサーバーログに対象`courseId`・`storeId`・参照件数が記録されることを確認する。

**Acceptance Scenarios**:

1. **Given** `closed`状態のグループが1件以上、削除対象のコースを`courseId`として参照している、**When** 管理者がそのコースを削除する、**Then** 削除は成功し、サーバーログに`courseId`・`storeId`・参照件数を含む警告が記録される。
2. **Given** `closed`状態のグループがどれも削除対象のコースを参照していない、**When** 管理者がそのコースを削除する、**Then** 削除は成功し、closedグループ参照に関する警告ログは出力されない（回帰なし）。

---

### User Story 2 - 飲み放題プラン削除時も同様に会計済みグループへの参照消失を追跡可能にする (Priority: P1)

店舗管理者が飲み放題プランを削除する操作を行ったとき、そのプランを過去に利用していた会計確定済み（`closed`）グループが存在する場合、削除自体は現状どおり成立するが、サーバーログに参照件数が記録される。

**Why this priority**: コース削除と同一の問題が飲み放題プラン削除にも存在するため、同時に対処する。影響度・対処方針はUser Story 1と同一。

**Independent Test**: `closed`状態のグループが`drinkPlanId`を参照している状態で飲み放題プラン削除APIを呼び出し、削除が成功し、かつサーバーログに対象`drinkPlanId`・`storeId`・参照件数が記録されることを確認する。

**Acceptance Scenarios**:

1. **Given** `closed`状態のグループが1件以上、削除対象の飲み放題プランを`drinkPlanId`として参照している、**When** 管理者がそのプランを削除する、**Then** 削除は成功し、サーバーログに`drinkPlanId`・`storeId`・参照件数を含む警告が記録される。
2. **Given** `closed`状態のグループがどれも削除対象のプランを参照していない、**When** 管理者がそのプランを削除する、**Then** 削除は成功し、closedグループ参照に関する警告ログは出力されない（回帰なし）。

---

### Edge Cases

- コース削除時、`closed`グループの`courseId`参照件数と、既存の`OrderItem.courseId`参照件数の両方が存在する場合、両方のログが別々に（または1つのログエントリにまとめて）出力される。既存の`OrderItem`ログの挙動・件数には影響しない。
- 飲み放題プラン削除時、当該プランに紐づく`Course`が存在する場合（`referencedCourse`チェック）は既存どおり削除自体が拒否される。この既存のブロック処理より後（削除実行の直前）でclosedグループ参照ログを出力する。
- `active`/`bill_requested`状態のグループが参照している場合は、既存どおり削除自体が`in_use`エラーで拒否される（本フィーチャーでは変更しない）。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: コース削除処理（`DELETE /api/courses/:id`）は、削除トランザクション内で、対象コースを`courseId`として参照する`closed`状態の`Group`の件数を集計する。
- **FR-002**: コース削除処理は、FR-001で集計した件数が1件以上の場合、既存の`OrderItem.courseId`null化ログと同じ形式（`fastify.log.warn`、`courseId`・`storeId`・件数を含む構造化ログ）で警告を記録する。
- **FR-003**: 飲み放題プラン削除処理（`DELETE /api/drink-plans/:id`）は、削除トランザクション内で、対象プランを`drinkPlanId`として参照する`closed`状態の`Group`の件数を集計する。
- **FR-004**: 飲み放題プラン削除処理は、FR-003で集計した件数が1件以上の場合、既存の`OrderItem`参照ログと同じ形式で警告を記録する。
- **FR-005**: 本フィーチャーは削除処理の成否判定ロジック（`in_use`判定、`active`/`bill_requested`グループの存在チェック）を変更しない。`closed`グループの参照有無にかかわらず、削除自体は現状どおり成功する。ログの追加のみを行う。

### Key Entities *(include if feature involves data)*

- **Group**: 来店客のテーブル単位の注文セッション。`status`が`closed`（会計確定済み）のとき、`courseId`/`drinkPlanId`が過去に適用されたコース・飲み放題プランへの参照として残る。本フィーチャーはこの参照の削除時null化をログ対象とする。
- **Course**: コースメニューの定義。削除時、`closed`グループからの参照件数をログに記録する対象。
- **DrinkPlan**: 飲み放題プランの定義。削除時、`closed`グループからの参照件数をログに記録する対象。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `closed`グループが参照しているコース・飲み放題プランを削除した場合、100%のケースでサーバーログに参照件数が記録される。
- **SC-002**: `closed`グループの参照がない通常の削除操作では、既存の成功挙動・レスポンス内容に回帰がない。

## Assumptions

- 対象範囲は`courses.ts`の`DELETE /:id`と`drinkPlans.ts`の`DELETE /:id`の2箇所に限定する。
- ログの出力先・保存期間など、ログ基盤自体の変更（外部サービス連携等）は本フィーチャーのスコープ外とする（指摘6-3は別途扱う）。
- 削除処理の成否（成功/失敗）自体は変更しない（Clarificationsで確定）。
