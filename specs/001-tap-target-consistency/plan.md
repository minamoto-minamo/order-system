# Implementation Plan: タップ領域サイズの不整合を解消する

**Branch**: `001-tap-target-consistency` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-tap-target-consistency/spec.md`

## Summary

4ファイル・6箇所のアイコンボタン/ステッパーボタンについて、視覚サイズを変更せずタップ可能領域のみを44×44px（`min-w-11 min-h-11`）に拡張する。実装パターンは既存の`ZeroStartStepper`が採用している「外側の当たり判定用要素に`min-w-11 min-h-11`＋`flex items-center justify-center`を付与し、内側に視覚要素（アイコン・テキスト・円）をそのまま配置する」方式に統一する。新規コンポーネント・新規抽象化は導入しない。

## Technical Context

**Language/Version**: TypeScript（React 18 + Vite）。既存の`frontend`ワークスペースの構成に従う。

**Primary Dependencies**: Tailwind CSS v4（`min-w-11 min-h-11`はデフォルトスケールの`2.75rem`=44px）、既存の`IconButton`/`BaseButton`コンポーネント。新規依存の追加なし。

**Storage**: N/A（UIスタイル変更のみ）。

**Testing**: Jest（`frontend`ワークスペースの既存ユニットテスト構成）。当たり判定サイズは`getBoundingClientRect`または算出スタイル（`min-width`/`min-height`）の検証で確認する。

**Target Platform**: 既存フロントエンド（ブラウザ、タブレット/スマホのタッチ操作を含む）。

**Project Type**: Web application（`frontend` + `backend` + `shared`のpnpmワークスペース構成、既存）。本フィーチャーは`frontend`のみを変更する。

**Performance Goals**: 変更なし（CSSクラスの調整のみ、追加の描画コストなし）。

**Constraints**: ボタンの視覚的な見た目（サイズ・色・アイコン・配置）を変更しない（spec.md FR-005）。既存の`disabled`状態・クリックハンドラの挙動を変更しない（spec.md FR-006）。

**Scale/Scope**: 変更対象は既存4ファイル（`AppHeader/index.tsx`、`GroupDetail.tsx`、`CustomerOrder.tsx`、`QuantityPicker/index.tsx`）、計6箇所のボタン。新規ファイル・新規モジュールの追加なし。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md`はプロジェクト固有の原則が未記入のテンプレート状態であり、本フィーチャーに適用可能な明文化されたgateは存在しない。代わりにリポジトリの`CLAUDE.md`（プロジェクトルート・`frontend/CLAUDE.md`）とユーザーのグローバル`CLAUDE.md`の原則を判断基準とする。

- **シンプル第一**: 新規コンポーネント・新規抽象化を追加せず、既存`ZeroStartStepper`が持つ当たり判定拡張パターンを他4箇所へ適用するのみ。✅
- **影響を最小化する**: 変更範囲を指摘された6箇所（4ファイル）に限定する。隣接するコード・視覚デザインは変更しない。✅
- **デザイントークンのルール**（`frontend/CLAUDE.md`）: ハードコードカラーは書かない、既存トークンを使う——本フィーチャーは寸法（`min-w-11 min-h-11`）のみの変更でカラートークンには触れないため該当なし。✅
- **手を抜かない**: 変更した4ファイルそれぞれに、当たり判定サイズを検証するユニットテストを追加する（Phase構成参照）。✅

違反なし。Complexity Trackingへの記載は不要。

## Project Structure

### Documentation (this feature)

```text
specs/001-tap-target-consistency/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # N/A — 本フィーチャーはデータエンティティを扱わないため生成しない
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

`contracts/`・`data-model.md`は生成しない。本フィーチャーはUIコンポーネントのCSSクラス調整のみであり、API契約・データモデルの変更が存在しない。

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── features/navigation/components/AppHeader/
│   │   └── index.tsx         # 変更: ハンバーガーメニューボタン（53行目付近、w-8 h-8 → 当たり判定拡張）
│   ├── pages/group/GroupDetail/
│   │   └── GroupDetail.tsx   # 変更: QR表示・席変更ボタン（314-327行目付近）
│   ├── pages/customer/CustomerOrder/
│   │   └── CustomerOrder.tsx # 変更: 店員呼び出し・お会計ボタン（250-264行目付近）
│   └── components/primitives/
│       ├── QuantityPicker/
│       │   └── index.tsx     # 変更: −・＋ボタン（19, 27行目付近）
│       └── ZeroStartStepper/
│           └── index.tsx     # 変更なし（参考実装として踏襲するのみ）
└── src/__tests__/
    └── (各変更ファイルに対応するユニットテストを追加、既存のテスト配置規約に従う)
```

**Structure Decision**: 既存の`frontend`ワークスペース内、既存4ファイルの該当箇所のみを変更する。新規ディレクトリ・新規ファイルの追加はない。`backend`/`shared`への変更は不要（UIスタイルのみの変更のため）。

## Complexity Tracking

*Constitution Checkに違反なし。本セクションへの記載事項なし。*
