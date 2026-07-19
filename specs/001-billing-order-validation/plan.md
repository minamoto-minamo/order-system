# Implementation Plan: 会計・注文可否のサーバー側検証見直し

**Branch**: `001-billing-order-validation` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-billing-order-validation/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

飲み放題プラン適用中のグループへの客用注文リクエスト（`POST /api/customer/orders`）で、プラン対象外商品が混在すると全体を422で拒否している現状を、スタッフ用`POST /orders`と同じ部分受理ロジック（プラン対象商品は0円、対象外商品は通常価格でそれぞれ登録）に揃える。`customer.ts`の`outOfPlan`チェック＋全体拒否ブロックを削除するのみで、既存の価格計算ロジック自体は変更しない。

## Technical Context

**Language/Version**: TypeScript（Node.js）。既存の`backend`ワークスペースの構成に従う。

**Primary Dependencies**: Fastify、Prisma（`@prisma/client` ^6.19.3）。新規依存の追加なし。

**Storage**: PostgreSQL（既存）。スキーマ変更なし（research.md R4）。

**Testing**: Jest（`backend`ワークスペースの既存ユニットテスト構成）。

**Target Platform**: 既存バックエンド（Fastifyサーバー、Linux/コンテナ環境）。

**Project Type**: Web application（`frontend` + `backend` + `shared`のpnpmワークスペース構成、既存）。本フィーチャーは`backend`のみを変更する。

**Performance Goals**: 既存のレスポンス性能を維持する。新規の性能目標はなし。

**Constraints**: `422 customer.orders.drink_plan_mismatch`は本フィーチャー適用後は発生しなくなるが、`ErrorCodes.Customer.DrinkPlanMismatch`自体の定義は削除しない（research.md R3）。既存のバリデーション優先順位（品切れ→テイクアウト）は変更しない。

**Scale/Scope**: 変更対象は既存1関数（`customer.ts`の`POST /orders`ハンドラ、`outOfPlan`チェック＋422拒否ブロックの削除のみ）。新規ファイル・新規モジュールの追加なし。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md`はプロジェクト固有の原則が未記入のテンプレート状態であり、本フィーチャーに適用可能な明文化されたgateは存在しない。代わりにリポジトリの`CLAUDE.md`（プロジェクトルート・`backend/CLAUDE.md`）とユーザーのグローバル`CLAUDE.md`の原則を判断基準とする。

- **シンプル第一**: 新規モジュール・抽象化を追加せず、既存の事前バリデーションブロックを削除するのみ。✅
- **影響を最小化する**: 変更範囲を`customer.ts`の`POST /orders`の1ブロックに限定する。フロントエンド（`CustomerOrder.tsx`）・エラーコード定義（`errors.ts`）は変更しない（research.md R3）。✅
- **手を抜かない**: プラン対象商品・対象外商品混在時の部分受理を検証するユニットテストを追加する（Phase構成のTesting節参照）。✅

違反なし。Complexity Trackingへの記載は不要。

## Project Structure

### Documentation (this feature)

```text
specs/001-billing-order-validation/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

`quickstart.md`は生成しない。本フィーチャーは既存バリデーションブロックの削除のみで、開発環境セットアップ手順に変更がないため。

### Source Code (repository root)

```text
backend/
├── src/
│   ├── routes/
│   │   ├── customer.ts   # 変更: POST /orders（219-236行目付近、outOfPlanチェック＋422拒否ブロックを削除）
│   │   └── orders.ts     # 変更なし（参考実装として踏襲するのみ、isPlanItem判定ロジック）
│   └── lib/
│       └── errors.ts     # 変更なし（DrinkPlanMismatch定義は残置、research.md R3）
└── tests/
    └── (customer.tsに対応するユニットテストを追加、既存のテスト配置規約に従う)
```

**Structure Decision**: 既存の`backend`ワークスペース（Fastify + Prisma）内、既存1ファイルの該当ブロックのみを変更する。新規ディレクトリ・新規ファイルの追加はない。`frontend`/`shared`への変更は不要（`DrinkPlanMismatch`エラー分岐がフロント側で個別処理されていないため、research.md R3）。

## Complexity Tracking

*Constitution Checkに違反なし。本セクションへの記載事項なし。*
