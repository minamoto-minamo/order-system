# Implementation Plan: セットメニュー機能

**Branch**: `004-set-menu` | **Date**: 2026-07-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-set-menu/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

商品（MenuItem）にセット種別フラグ（`isSet`）と、内訳の分類（`SetFrame`）・選択肢（`SetFrameChoice`、既存商品への参照）を追加する。注文確定時、セットの親明細（セット価格・数量、即時`served`）と各枠の子明細（0円・厨房調理対象）を同一トランザクションで作成し、`setOrderItemId`自己参照FKで紐付ける。既存の`003-product-options`（ProductOptionGroup/ProductOptionChoiceの親子パターン）と`Course`（親の定額課金明細＋子の付属料理明細というOrderItem構造）の2つの既存パターンを組み合わせて設計する。

## Technical Context

**Language/Version**: TypeScript（backend: Node.js + tsx、frontend: Vite）

**Primary Dependencies**: Fastify + Socket.io + Prisma（backend）、React 18 + React Router v6 + Tailwind CSS v4（frontend）

**Storage**: PostgreSQL（Prisma ORM、schema.prismaで管理）

**Testing**: Jest（frontend/backend単体テスト）、Playwright（e2e、Claude側で実行）

**Target Platform**: Linuxサーバー（backend）、モバイル/タブレットブラウザ（frontend、既存のホール・キッチン・管理画面と同様）

**Project Type**: Web application（pnpm workspaceによるfrontend/backend/sharedのmonorepo構成、既存踏襲）

**Performance Goals**: 既存機能と同等（特別な性能要求なし）

**Constraints**: 既存のマルチテナンシー（storeId分離、Host解決）、JWT認証（admin限定操作はrequireAdmin）、既存Socket.ioイベント体系（`menu:*`/`order:*`関連イベント）との整合を保つ。003-product-optionsとの併用禁止（`isSet: true`の商品は`optionGroups`を持たない）

**Scale/Scope**: 1セットあたりの枠数・枠あたりの選択肢数は無制限（既存の`ProductOptionGroup`/`ProductOptionChoice`と同様、上限を設けない）。既存店舗規模に準ずる

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md`はプレースホルダーのまま未設定（プロジェクト固有のgateなし）。代わりにプロジェクトのグローバル/リポジトリCLAUDE.mdのコーディング原則をgateとして適用する。

- **シンプル第一**: 新規モデルはCourse/CourseFoodItemおよびProductOptionGroup/ProductOptionChoiceパターンを踏襲した最小構成（`SetFrame`/`SetFrameChoice`の2テーブル＋`MenuItem.isSet`＋`OrderItem.isSetCharge`/`setOrderItemId`）とし、枠のtakeout整合性チェック等のスコープ外機能は追加しない（research.md Decision 7）。→ PASS
- **影響を最小化する**: 既存の`menus.ts`（MenuItem CRUD）・`orders.ts`/`customer.ts`（注文作成・キャンセル）・`OrderHistory.tsx`/`CustomerOrderHistory.tsx`（履歴表示）に対する拡張のみとし、無関係なリファクタリングは行わない。→ PASS
- **手を抜かない**: 子明細単独のキャンセルを許すとFR違反になるため、バックエンド側で明示的に409拒否する（research.md Decision 5）。枠選択の過不足・重複・品切れはfrontend/backend双方でバリデーションする（003と同じ理由でAPI直叩き対策が必須）。→ Phase 1設計に反映済み
- **テストで検証する**: 新規ロジック（親子明細の価格・数量・状態の作り分け、枠選択バリデーション、セットキャンセルのカスケード、子明細単独キャンセル拒否）にunit testを書く。→ Phase 2 tasksで計画

### Post-Phase 1 再評価

Phase 1設計（data-model.md, contracts/set-menu.md）完了後も違反なし。

- 新規テーブルは2つのみ（`SetFrame`, `SetFrameChoice`）。`MenuItem`/`OrderItem`への追加フィールドも既存の`isCourseCharge`等と対称的な最小構成。独自の抽象化は導入していない。→ PASS
- `SetFrameChoice.menuItemId`を`onDelete: Cascade`にする判断（Course/DrinkPlanの`Restrict`パターンからの意図的な逸脱）はresearch.md Decision 3で理由を明記済み。→ PASS（手を抜かない：既存パターンの機械的踏襲ではなくspec要件に基づき判断）
- `OrderItem`への`setOrderItemId`自己参照FK追加は、Course方式（`courseId`によるテンプレート単位の紐付け）では「同じセットの複数回注文」を区別できないという具体的な制約に基づく最小限の追加。→ PASS（影響最小化しつつ要件を満たす必要最小限の変更）
- テスト対象はcontracts記載のバリデーション・親子明細作成ロジック・キャンセルカスケードに限定し、既存の未変更コード（例: 既存のGroup状態チェック等）はテスト対象に含めない。→ Phase 2 tasksで反映

## Project Structure

### Documentation (this feature)

```text
specs/004-set-menu/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
│   └── set-menu.md
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── prisma/
│   ├── schema.prisma          # MenuItem.isSet / SetFrame / SetFrameChoice / OrderItem.isSetCharge, setOrderItemId を追加
│   └── migrations/            # 新規マイグレーション（YYYYMMDDHHMMSS_add_set_menu）
├── src/
│   ├── routes/
│   │   ├── menus.ts            # MenuItem CRUD拡張：isSet/setFrames の nested write（作成・全置換更新）、isSet×optionGroups併用禁止バリデーション
│   │   ├── orders.ts           # 注文作成拡張：枠選択バリデーション・親子明細作成。キャンセル拡張：セット単位カスケード・子明細単独拒否
│   │   └── customer.ts         # 注文作成拡張（orders.tsと同様の枠選択バリデーション・親子明細作成）
│   └── lib/
│       ├── mappers.ts          # toMenuItem に isSet/setFrames、toOrderItem に isSetCharge/setOrderItemId を追加
│       └── errors.ts           # Orders/Customer/Menus 配下にセット関連エラーコードを追加
└── src/__tests__/               # Jest単体テスト（既存踏襲）

frontend/
├── src/
│   ├── pages/admin/Products/
│   │   ├── Products.tsx                    # isSet/setFrames のフォーム状態管理を追加
│   │   └── components/
│   │       ├── ProductModal.tsx             # isSetトグル・枠編集UIを追加（optionGroups編集UIと排他）
│   │       └── types.ts                     # ProductFormData 等に isSet/setFrames を追加
│   ├── pages/group/GroupDetail/components/
│   │   ├── MenuAdd.tsx                      # セット商品タップ時にSetFrameSelectSheetを開く分岐を追加
│   │   └── OrderHistory.tsx                 # setCharges/setDishes によるセット親子グルーピング表示を追加
│   ├── pages/customer/CustomerOrder/components/
│   │   ├── CustomerMenuList.tsx             # MenuAdd.tsxと同様の分岐を追加
│   │   └── CustomerOrderHistory.tsx         # groupItemsのセット対応（setOrderItemIdによるグルーピング）
│   ├── pages/kitchen/Kitchen/               # 変更なし（子明細は既存のOrderItemとして自動的に個別チケット表示される）
│   ├── features/order/components/
│   │   └── SetFrameSelectSheet.tsx          # 新規。OptionSelectSheet.tsxと同型のボトムシート
│   ├── components/composite/MenuConfirmModal/
│   │   └── index.tsx                        # 変更なし（既存のoptions表示ロジックをセット内訳表示に再利用）
│   └── lib/partitionOrderItems.ts            # setCharges/setDishesの分類を追加
└── src/__tests__/                             # Jest単体テスト（既存踏襲）

e2e/
└── s14-set-menu.spec.ts   # 新規（既存のe2e命名規則を踏襲）
```

**Structure Decision**: 既存のpnpm workspace構成（`backend`/`frontend`/`shared`）をそのまま使う。新規ディレクトリは作らず、003-product-optionsで確立された「既存の商品CRUD・注文作成ルートを拡張する」「Courseパターンを踏襲した親子OrderItem構造にする」という2つの既存パターンの延長線上に実装する。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

違反なし。記載事項なし。
