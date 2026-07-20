# Implementation Plan: 商品オプション機能

**Branch**: `003-product-options` | **Date**: 2026-07-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-product-options/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

商品（MenuItem）ごとにオプション分類（ProductOptionGroup）と選択肢（ProductOptionChoice）を設定できるようにし、注文時に選択した内容と追加課金額（マイナス値の割引も可）をOrderItemに紐づけてスナップショット記録する。既存のCourse+CourseFoodItemの「親エンティティ+子エンティティ配列をnested writeで全置換更新する」パターンと、注文作成時にMenuItemの価格をOrderItemへコピーするスナップショット手法を踏襲する。

## Technical Context

**Language/Version**: TypeScript（backend: Node.js + tsx、frontend: Vite）

**Primary Dependencies**: Fastify + Socket.io + Prisma（backend）、React 18 + React Router v6 + Tailwind CSS v4（frontend）

**Storage**: PostgreSQL（Prisma ORM、schema.prismaで管理）

**Testing**: Jest（frontend/backend単体テスト）、Playwright（e2e、Claude側で実行）

**Target Platform**: Linuxサーバー（backend）、モバイル/タブレットブラウザ（frontend、既存のホール・キッチン・管理画面と同様）

**Project Type**: Web application（pnpm workspaceによるfrontend/backend/sharedのmonorepo構成、既存踏襲）

**Performance Goals**: 既存機能と同等（特別な性能要求なし）

**Constraints**: 既存のマルチテナンシー（storeId分離、Host解決）、JWT認証（admin限定操作はrequireAdmin）、既存Socket.ioイベント体系（`menu:*`関連イベント）との整合を保つ

**Scale/Scope**: 1商品あたりのオプション分類数・選択肢数は無制限（spec Assumptions参照）。既存店舗規模に準ずる

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md`はプレースホルダーのまま未設定（プロジェクト固有のgateなし）。代わりにプロジェクトのグローバル/リポジトリCLAUDE.mdのコーディング原則をgateとして適用する。

- **シンプル第一**: 新規モデルはCourse/CourseFoodItemパターンを踏襲した最小構成（ProductOptionGroup/ProductOptionChoice/OrderItemOptionの3テーブル）とし、テンプレート共有・複数選択・選択肢単位品切れ等のスコープ外機能は追加しない。→ PASS
- **影響を最小化する**: 既存のmenus.ts（MenuItem CRUD）・orders.ts（注文作成）に対する拡張のみとし、無関係なリファクタリングは行わない。→ PASS
- **手を抜かない**: FR-004（必須オプション未選択時の注文拒否）はfrontend/backend双方でバリデーションする（backend未検証だとAPI直叩きで必須違反が可能なため）。→ Phase 1で設計に反映
- **テストで検証する**: 新規ロジック（価格スナップショット、必須バリデーション、0円下限クランプ）にunit testを書く。→ Phase 2 tasksで計画

### Post-Phase 1 再評価

Phase 1設計（data-model.md, contracts/menu-options.md）完了後も違反なし。

- 新規テーブルは3つのみ（ProductOptionGroup, ProductOptionChoice, OrderItemOption）。既存の`Course`/`CourseFoodItem`と対称的な構成で、独自の抽象化は導入していない。→ PASS
- `OrderItem`へのフィールド追加なし（`price`/`originalPrice`の既存意味論のみで表現可能と判断、research.md Decision 3）。→ PASS（影響最小化）
- 必須バリデーションはcontracts/menu-options.mdの「POST /orders」節でサーバー側の3項目（choiceId実在性・択一制約・必須網羅）として明文化済み。→ PASS（手を抜かない）
- テスト対象はcontracts記載のバリデーションロジックと価格計算ロジックに限定し、既存の未変更コード（例: 既存のGroup状態チェック等）はテスト対象に含めない。→ Phase 2 tasksで反映

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
├── prisma/
│   ├── schema.prisma          # ProductOptionGroup / ProductOptionChoice / OrderItemOption を追加
│   └── migrations/            # 新規マイグレーション（YYYYMMDDHHMMSS_add_product_options）
├── src/
│   ├── routes/
│   │   ├── menus.ts            # MenuItem CRUD拡張：optionGroups の nested write（作成・全置換更新）
│   │   └── orders.ts           # 注文作成拡張：選択オプションの必須バリデーション・価格スナップショット
│   └── lib/
│       └── mappers.ts          # toMenuItem/toOrderItem にoptionGroups/selectedOptionsを追加
└── tests/                      # Jest単体テスト（backend/src/**/*.test.ts 想定、既存踏襲）

frontend/
├── src/
│   ├── pages/admin/Products/   # ProductModal.tsx にオプション分類・選択肢の編集UIを追加
│   ├── features/order/         # 注文時のオプション選択ボトムシート（新規コンポーネント）
│   └── pages/{group/GroupDetail,customer/CustomerOrder}/
│       └── components/         # MenuAdd.tsx / CustomerMenuList.tsx にオプション選択導線を追加
└── tests/                      # Jest単体テスト（既存踏襲）

shared/
└── types/index.ts              # MenuItem/OrderItem/UpsertMenuItemRequest/OrderItemInput 型拡張
```

**Structure Decision**: 既存のfrontend/backend/shared 3ワークスペース構成をそのまま踏襲する。新規ディレクトリは作らず、既存ファイル（menus.ts, orders.ts, mappers.ts, ProductModal.tsx, MenuAdd.tsx, CustomerMenuList.tsx, shared/types/index.ts）への機能追加とする。オプション選択UIのみ新規コンポーネントが必要（既存に商品ごとの詳細モーダルを挟む仕組みがないため）。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Constitution Checkに違反なし。本セクションは対象外。
