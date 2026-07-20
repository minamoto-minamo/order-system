# Implementation Plan: Course/DrinkPlan削除時の会計済みグループ参照消失をログに記録する

**Branch**: `001-course-drinkplan-deletion-log` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-course-drinkplan-deletion-log/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

コース削除（`DELETE /api/courses/:id`）・飲み放題プラン削除（`DELETE /api/drink-plans/:id`）の既存の削除トランザクション内に、`closed`（会計確定済み）状態の`Group`からの参照件数を集計するクエリを1件追加し、件数が1件以上なら既存の`OrderItem`参照ログと同じ形式で`fastify.log.warn`する。削除の成否判定ロジック自体は変更しない。

## Technical Context

**Language/Version**: TypeScript（Node.js）。既存の`backend`ワークスペースの構成に従う。

**Primary Dependencies**: Fastify、Prisma（`@prisma/client`）。新規依存の追加なし。

**Storage**: PostgreSQL（既存）。スキーマ変更なし。

**Testing**: Jest（`backend`ワークスペースの既存ユニットテスト構成）。

**Target Platform**: 既存バックエンド（Fastifyサーバー）。

**Project Type**: Web application（`frontend` + `backend` + `shared`のpnpmワークスペース構成、既存）。本フィーチャーは`backend`のみを変更する。

**Performance Goals**: 既存の削除処理と同じトランザクション内に集計クエリを1件追加するのみ。新規の性能目標はなし。

**Constraints**: 削除処理の成否判定・レスポンス内容に回帰を起こさない（spec.md FR-005）。新規エラーコード・APIスキーマ変更は行わない。

**Scale/Scope**: 変更対象は既存2関数（`courses.ts`の`DELETE /:id`、`drinkPlans.ts`の`DELETE /:id`）のみ。新規ファイル・新規モジュールの追加なし。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md`はプロジェクト固有の原則が未記入のテンプレート状態であり、本フィーチャーに適用可能な明文化されたgateは存在しない。代わりにリポジトリの`CLAUDE.md`の原則を判断基準とする。

- **シンプル第一**: 新規モジュール・抽象化を追加せず、既存2関数の内部に集計クエリとログ出力を1行ずつ追加するのみ。✅
- **影響を最小化する**: 変更範囲を指摘された2箇所に限定し、既存の削除可否判定ロジック・エラーコード体系は変更しない。既存の`OrderItem`参照ログと同じログ形式・命名規則を踏襲する。✅
- **手を抜かない**: 変更した関数それぞれに、`closed`グループ参照ありのケース・なしのケース（回帰確認）のユニットテストを追加する。✅

違反なし。Complexity Trackingへの記載は不要。

## Project Structure

### Documentation (this feature)

```text
specs/001-course-drinkplan-deletion-log/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

`contracts/`は生成しない。本フィーチャーはHTTPエンドポイントの入出力スキーマを変更せず（成功時レスポンス形状・エラーコードは既存のまま）、サーバーサイドのログ出力のみを追加するため、外部インターフェース契約の変更が存在しない。

### Source Code (repository root)

```text
backend/
├── src/
│   ├── routes/
│   │   ├── courses.ts     # 変更: DELETE /:id（削除トランザクション内、closedグループ参照件数の集計・ログ追加）
│   │   └── drinkPlans.ts  # 変更: DELETE /:id（同上）
└── tests/
    └── (courses.test.ts / drinkPlans.test.ts に対応するユニットテストを追加、既存のテスト配置規約に従う)
```

**Structure Decision**: 既存の`backend`ワークスペース（Fastify + Prisma）内、既存2ファイルの該当関数のみを変更する。新規ディレクトリ・新規ファイルの追加はない。`frontend`/`shared`への変更は不要（レスポンス形状・エラーコード体系を変更しないため）。

## Complexity Tracking

*Constitution Checkに違反なし。本セクションへの記載事項なし。*
