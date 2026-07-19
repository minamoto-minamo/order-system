# Implementation Plan: コース人数変更時の手動追加注文保護

**Branch**: `001-course-qty-overwrite-fix` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-course-qty-overwrite-fix/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

コース人数変更API（`PUT /:id/course`）が、コース由来の自動生成食事明細と、`courseId` 付きで追加注文された手動明細を区別できず、後者の数量を無条件に上書きしてしまう不具合を修正する。clarifyで確定した方針（方式B）に従い、`PUT /:id/course` 自体は変更せず、曖昧な明細が生成される入口である `POST /orders` 側に検証を追加する：コースが適用されているグループに対し、そのコースの `foodItems` に含まれる `menuItemId` を `courseId` 付きで追加注文しようとした場合、リクエスト全体を422エラーで拒否する。スキーマ変更・マイグレーションは行わない。

## Technical Context

**Language/Version**: TypeScript（Node.js、`backend` ワークスペース）

**Primary Dependencies**: Fastify, Prisma, Zod（既存の `POST /orders` ハンドラと同一スタック。新規依存追加なし）

**Storage**: PostgreSQL（Prisma経由）。本機能ではスキーマ変更なし（既存テーブル・カラムのみ使用）

**Testing**: Jest（`backend/src/__tests__/orders.test.ts` に既存のテストスイートあり）

**Target Platform**: Linux server（既存backend、変更なし）

**Project Type**: Web application（`backend` + `frontend` のpnpmワークスペース）。本機能は `backend` のみを変更する

**Performance Goals**: 追加のDBクエリは既に取得済みの `course.foodItems`（`POST /orders` の127-139行目付近で取得中のcourseレコード）を流用し、追加ラウンドトリップなしで判定する。既存のレイテンシ特性を維持する

**Constraints**: 既存の `POST /orders` の正常系（`courseId` なし追加注文、`courseId` ありでコース外商品の注文）に回帰を起こさないこと。トランザクション開始前に判定できる範囲は開始前に行い、無用なトランザクション開始を避ける

**Scale/Scope**: バックエンドの1エンドポイント（`POST /orders`）内のバリデーション追加のみ。エラーコード1件追加。既存データへの遡及処理なし

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` はテンプレートのままでプロジェクト固有の原則が未記入のため、代わりにプロジェクトの `CLAUDE.md`（グローバル・プロジェクト双方）の原則をゲートとして適用する。

- **シンプル第一**: 新規スキーマ・新規モデル・新規抽象化を追加しない。既存の検証パターン（`sendError` + `ErrorCodes`）を再利用する。→ 適合。
- **影響を最小化する**: 変更対象は `POST /orders` のバリデーションと `ErrorCodes` への1エントリ追加のみ。`PUT /:id/course`（人数変更処理）・Prismaスキーマ・フロントエンドには触れない。→ 適合。
- **手を抜かない**: 曖昧な追加注文を黙って無視/自動補正せず、明確な422エラーで拒否する（clarifyで確定済み）。正常系・異常系の両方にテストを追加する。→ 適合。
- **テストで検証する**: 変更対象（`POST /orders` のバリデーション分岐）に対するテストを新規追加し、既存テストがグリーンのまま保たれることを確認する。→ Phase 2 (tasks) で担保。

違反なし。Complexity Trackingへの記載は不要。

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── routes/
│   │   ├── orders.ts     # 変更: POST /orders にコース内商品の courseId 付き追加注文を禁止するバリデーションを追加
│   │   └── groups.ts     # 変更なし（PUT /:id/course の再計算処理はそのまま。念のため参照のみ）
│   └── lib/
│       └── errors.ts     # 変更: ErrorCodes.Orders に新規エラーコードを1件追加
└── src/__tests__/
    └── orders.test.ts    # 変更: 新規バリデーションの正常系・異常系テストケースを追加

frontend/   # 変更なし（本機能のスコープ外。spec.md の Assumptions を参照）
```

**Structure Decision**: 既存の `backend`（Fastify + Prisma）ワークスペース内、`routes/orders.ts` の `POST /orders` ハンドラにバリデーションを1箇所追加し、`lib/errors.ts` に対応する `ErrorCodes.Orders` エントリを1件追加する。`frontend`・Prismaスキーマ・`groups.ts`（人数変更処理）には変更を加えない。

## Complexity Tracking

> Constitution Check に違反なし。本セクションは適用対象なし。
