# Implementation Plan: GroupDetailの初期ロードとSocketイベントの競合による注文消失を修正する

**Branch**: `001-fix-groupdetail-order-sync` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-fix-groupdetail-order-sync/spec.md`

## Summary

`GroupDetail.tsx` の `fetchAll`（REST一括取得）が完了時に `items` stateを丸ごと置換するため、取得実行中に届いた注文関連Socketイベント（`order:created`/`order:updated`/`order:cancelled`）がRESTスナップショットで上書きされ消失する。

解決方式はclarifyでキュー方式に確定した: フェッチ実行中は注文関連Socketイベントをrefベースの一時キューに保留し、フェッチ完了時にRESTスナップショットへ受信順で再適用してから`setItems`する。あわせて、フェッチの世代（generation）カウンタで多重フェッチ（再接続連打）を管理し、最新でなくなったフェッチの完了結果とその保留キューは破棄する。

イベント再適用ロジックは既存の3ハンドラ（created/updated/cancelled）と同一の合成規則を持つ純粋関数として切り出し、`GroupDetail.tsx`本体からもテストからも同じ関数を参照する。

## Technical Context

**Language/Version**: TypeScript 5.5（frontendワークスペース）

**Primary Dependencies**: React 18（`useEffect`/`useRef`/`useState`）、既存の `useSocketListeners` フック、`socket.io-client`（`@/lib/socket`）

**Storage**: N/A（本フィーチャーはフロントエンドのstate管理のみを変更。バックエンドAPI・スキーマは変更しない）

**Testing**: Jest 30 + ts-jest（`pnpm --filter frontend test`）。既存の `frontend/src/__tests__/*.test.ts(x)` 配下に配置する規約に従う。

**Target Platform**: ブラウザ（Vite製React SPA）。対象画面はスタッフ向けGroupDetail画面（ホール/キッチンから遷移）。

**Project Type**: Web application（frontend + backend の既存pnpmワークスペース構成。本フィーチャーはfrontendのみに変更を加える）

**Performance Goals**: N/A（本フィーチャーは既存の同期処理に保留キューの再適用を追加するのみで、追加のネットワーク呼び出しや重い計算は発生しない）

**Constraints**: 既存の正常系（通常時のRESTスナップショット反映・リアルタイム反映）に回帰を起こさないこと（SC-004）。`items`以外のstate（`group`/`menus`/`courses`等）は本フィーチャーのスコープ外（FR-005）。

**Scale/Scope**: `frontend/src/pages/group/GroupDetail/GroupDetail.tsx` 内の `fetchAll` と `useSocketListeners` 呼び出し（既存78-144行目付近）に閉じた変更。新規の純粋関数1つを `frontend/src/lib/` に追加する。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md` はテンプレートのまま（プロジェクト固有の原則が未設定）のため、本フィーチャー固有のゲート判定はない。プロジェクトの実効的な設計原則は `CLAUDE.md`（影響を最小化する ＞ 手を抜かない ＞ シンプル第一 ＞ テストカバレッジ）を適用する。

- **影響を最小化する**: 変更を `GroupDetail.tsx` の該当箇所と新規純粋関数1ファイルに限定する。他画面（Hall/Kitchen等）や`items`以外のstateには触れない（FR-005準拠）。
- **手を抜かない**: キュー方式を選んだのは、マージ方式が「更新イベントとRESTスナップショットの鮮度比較ができない」という未解決の正しさの欠陥を残すため（Clarifications参照）。多重フェッチの世代管理（FR-008）も省略しない。
- **シンプル第一**: イベント再適用ロジックのみを純粋関数として切り出し、それ以外（世代カウンタ・キュー・isFetchingフラグ）は`GroupDetail.tsx`内のrefで完結させ、新規フックや状態管理ライブラリは導入しない。

Gate: PASS（違反なし。Complexity Trackingは不要）

## Project Structure

### Documentation (this feature)

```text
specs/001-fix-groupdetail-order-sync/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

（本フィーチャーは新規の外部インターフェース・APIコントラクトを持たないため `contracts/` は生成しない）

### Source Code (repository root)

```text
order-system/
├── frontend/
│   ├── src/
│   │   ├── pages/group/GroupDetail/
│   │   │   └── GroupDetail.tsx          # 変更対象: fetchAll・useSocketListeners呼び出し
│   │   ├── lib/
│   │   │   └── applyQueuedOrderEvents.ts # 新規: 保留イベント再適用の純粋関数
│   │   └── __tests__/
│   │       └── applyQueuedOrderEvents.test.ts # 新規: 純粋関数のユニットテスト
│   └── ...
├── backend/    # 変更なし
└── shared/     # 変更なし（既存のOrderItem型をそのまま使用）
```

**Structure Decision**: 既存の `frontend/src/lib/`（純粋ユーティリティ関数置き場。`partitionOrderItems.ts`等と同じ配置規約）に新規関数を1つ追加し、`GroupDetail.tsx`から参照する。対応するユニットテストは既存規約どおり `frontend/src/__tests__/` に配置する。新規ディレクトリ・新規レイヤーは作らない。

## Phase 0: Outline & Research

→ [research.md](./research.md)

## Phase 1: Design & Contracts

→ [data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

外部インターフェース（REST API・Socket.ioイベントスキーマ）の変更はないため `contracts/` は生成しない。

## Constitution Check（Post-Design再評価）

Phase 1設計後も、変更範囲は「`GroupDetail.tsx`内のrefベースの制御ロジック」＋「`frontend/src/lib/applyQueuedOrderEvents.ts`という1つの純粋関数」に収まっており、Phase 0時点の判定から変化なし。

Gate: PASS
