# Phase 0 Research: 商品管理画面の削除操作に確認ステップを追加する

Technical Context に `NEEDS CLARIFICATION` は残っていない（spec.mdのClarificationsで確定済み）。本ドキュメントは実装方式決定の根拠を記録する。

## Decision 1: 確認ステップの実装パターン

**Decision**: `frontend/src/pages/admin/Staff/Staff.tsx` が既に採用しているパターン（ページ状態としての `deleteTarget` ＋ 独立した `BottomSheetModal` による確認）をそのまま踏襲する。新規の共有コンポーネント（例: `DeleteConfirmModal`）は作成しない。

**Rationale**:
- 同一リポジトリ内に確立されたパターンが既に存在する（`Staff.tsx:35,100-109,186-192`）。同じ問題への解決策が2通り存在する状態を避ける。
- `frontend/src/components/composite/MenuConfirmModal` は注文確認用の専用コンポーネントであり、汎用の削除確認コンポーネントではない。削除確認向けに再利用・汎用化するのは過剰実装（YAGNI）。3画面（Products/Staff/GroupDetail）でパターンが重複しているが、現時点でこれを共通化するのはスコープ外（依頼されていない抽象化を追加しない）。
- `BottomSheetModal` は既に `primaryAction`/`secondaryAction`/`show`/`onClose` という汎用APIを持っており、確認ダイアログとして直接利用できる。追加のラッパーは不要。

**Alternatives considered**:
- 新規共有コンポーネント `ConfirmModal` を作成し、Staff/Products/GroupDetailで共通化する: 3画面の重複を解消できるが、本タスクのスコープ（Products画面の1指摘への対応）を超える横断リファクタリングになり、「影響を最小化する」原則に反する。将来的な改善提案として指摘に留め、今回は実施しない。
- `InputModal`/`ProductModal` 自体に確認ステップを内蔵する（`onDelete` 実行前に内部状態で2段階表示に切り替える）: clarify Q1で「編集モーダルを閉じてから確認シートを表示する」方式が確定したため、編集モーダルコンポーネント自身が確認状態を持つ必要はない。呼び出し元（Products.tsx）で制御する方が既存の `Staff.tsx` パターンと一貫する。

## Decision 2: 削除対象の状態表現

**Decision**: Products.tsx に判別可能なユニオン型 `DeleteTarget`（`{ type: 'cat', id, label } | { type: 'sub', catId, id, label } | { type: 'product', id, label }`）を1つの state として持つ。3種類の削除操作を個別の3つの state（`deleteCatTarget`/`deleteSubTarget`/`deleteProductTarget`）に分けない。

**Rationale**:
- 同時に複数の削除確認ステップが開くことはない（1つの編集モーダルからしか削除操作は開始できないため、排他的）。ユニオン型で1状態にまとめる方が「同時に2つ以上開ける」という誤った状態を型レベルで排除でき、シンプル。
- 既存の `ModalState`（`type: 'editCat' | 'editSub' | ...` の判別ユニオン）と同じ設計パターンをこのファイル内で踏襲でき、一貫性がある。

**Alternatives considered**:
- 種別ごとに個別のstateを持つ（Staff.tsxの `deleteTarget: StaffMember | null` に倣う）: Staff.tsxは削除対象の型が1種類（StaffMember）のみなのでシンプルなnull許容stateで足りるが、Products.tsxは3種類の削除対象があるため、個別state化すると「同時に複数の確認ステップが開き得る」という不要な自由度が生まれる。ユニオン型1つの方が適切。

## Decision 3: 確認文言のi18nキー設計

**Decision**: `frontend/src/i18n/locales/ja.ts` の `productSettings` 配下に3つの独立したキーを追加する。
- `deleteProductConfirm: '{{name}} を削除しますか？'`
- `deleteSubCategoryConfirm: '{{name}} を削除しますか？配下の商品もすべて削除されます'`
- `deleteCategoryConfirm: '{{name}} を削除しますか？配下の小分類・商品もすべて削除されます'`

**Rationale**:
- spec.md FR-006（clarify Q2）で、カテゴリ・小分類はカスケード削除の警告を含め、商品はシンプルな文言に留めることが確定している。3種類の文言は内容が異なるため、テンプレート化・共通化するとかえって条件分岐が増え複雑になる。独立したキーの方がシンプルで、翻訳ファイル上でも意味が明確。
- 既存の `staff.deleteConfirm: '{{name}} を削除しますか？'` と同じ `{{name}}` 補間形式を踏襲し、用語・実装パターンの一貫性を保つ。

**Alternatives considered**: 単一キー＋オプションのサフィックス文言を動的結合する方式は、文言の組み立てロジックがコンポーネント側に漏れ出し、i18nファイルを見ただけで実際の表示文言がわからなくなるため採用しない。
