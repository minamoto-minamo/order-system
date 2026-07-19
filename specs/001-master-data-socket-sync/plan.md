# Implementation Plan: マスタデータ変更のSocket同期漏れ解消

**Branch**: `001-master-data-socket-sync` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-master-data-socket-sync/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

カテゴリ・サブカテゴリのCRUDに、既存`menu:*`と同じパターンでSocket.io配信を追加する（4-4）。あわせて、品切れ変更（既存の`menu:soldout`イベント）を客用ゲストにも届けるため、客用ゲスト専用の店舗共有ルーム`customer-store:${storeId}`を新設し、`menu:soldout`の配信先に追加する（4-5）。カテゴリ・サブカテゴリ変更は客用画面には拡張しない（spec.md Clarifications参照）。

## Technical Context

**Language/Version**: TypeScript（Node.js）。既存の`backend`/`frontend`ワークスペースの構成に従う。

**Primary Dependencies**: Fastify、Socket.io、Prisma、React（フロントエンド側のイベント購読）。新規依存の追加なし。

**Storage**: PostgreSQL（既存）。スキーマ変更なし。

**Testing**: Jest（`backend`/`frontend`ワークスペースの既存ユニットテスト構成）。E2E（Playwright）で複数クライアント間のリアルタイム反映をquickstart.mdの手動確認と合わせて検証する。

**Target Platform**: 既存バックエンド（Fastify + Socket.ioサーバー）・既存フロントエンド（Vite/React）。

**Project Type**: Web application（`frontend` + `backend` + `shared`のpnpmワークスペース構成、既存）。

**Performance Goals**: 既存のSocket.io配信性能を維持する。新規イベントは既存`menu:*`と同頻度・同規模のemitであり、追加の性能目標はなし。

**Constraints**: 客用ゲストへの新規配信（`customer-store:${storeId}`）は、既存のスタッフ／客用ゲスト間の権限境界（店舗ルームの完全分離）を壊さない（spec.md FR-007/FR-008）。カテゴリ・サブカテゴリ変更は客用画面には配信しない（Clarifications）。

**Scale/Scope**: 変更対象は既存4ファイル（`backend/src/routes/categories.ts`、`subcategories.ts`、`menus.ts`、`backend/src/plugins/socket.ts`）、共有型定義1ファイル（`shared/types/index.ts`）、フロントエンドのイベント購読箇所（`frontend/src/hooks/useSocketListeners.ts`等）。新規ファイル・新規モジュールの追加なし（新規roomは既存`socket.ts`内の追加join処理のみ）。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md`はプロジェクト固有の原則が未記入のテンプレート状態であり、本フィーチャーに適用可能な明文化されたgateは存在しない。代わりにリポジトリの`CLAUDE.md`（プロジェクトルート・`backend/CLAUDE.md`）とユーザーのグローバル`CLAUDE.md`の原則を判断基準とする。

- **シンプル第一**: 新規モジュール・抽象化を追加せず、既存の`menu:*`emitパターンをカテゴリ・サブカテゴリに横展開するのみ。品切れ配信のための新規roomも、既存の`group:join`ハンドラへの追加join処理として最小限で実装する。✅
- **影響を最小化する**: 変更範囲を指摘された2箇所（カテゴリ・サブカテゴリのSocket配信漏れ、品切れの客用配信漏れ）に限定する。他の未配信マスタデータ（`courses.ts`/`drinkPlans.ts`は`course:*`/`drinkPlan:*`が既に存在し対象外）には触れない。✅
- **状態変更エンドポイントのガード条件を揃える**（`backend/CLAUDE.md`）: 同一リソースの兄弟操作（作成・更新・削除）間でemitパターンを揃える。カテゴリの3操作、サブカテゴリの3操作すべてに同じパターンでemitを追加する。✅
- **手を抜かない**: 新規emit・新規room参加それぞれに、対象ルームへの配信/非配信を検証するユニットテストを追加する（Phase構成のTesting節参照）。✅

違反なし。Complexity Trackingへの記載は不要。

## Project Structure

### Documentation (this feature)

```text
specs/001-master-data-socket-sync/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── routes/
│   │   ├── categories.ts     # 変更: POST/PUT/DELETE に category:* emit を追加
│   │   ├── subcategories.ts  # 変更: POST/PUT/DELETE に subCategory:* emit を追加
│   │   └── menus.ts          # 変更: menu:soldout の配信先に customer-store:${storeId} を追加（203行目付近）
│   └── plugins/
│       └── socket.ts         # 変更: group:join ハンドラで customer-store:${storeId} への自動 join を追加
└── tests/
    └── (各変更ファイルに対応するユニットテストを追加)

shared/
└── types/
    └── index.ts    # 変更: ServerToClientEvents に category:*/subCategory:* を追加

frontend/
└── src/
    ├── lib/events.ts             # 変更: SOCKET_EVENTS 定数に category:*/subCategory:* を追加（イベント名は直接文字列を書かない既存規約に従う）
    └── pages/{hall,kitchen,group}/**  # 変更: カテゴリ・サブカテゴリ一覧を参照する画面で useSocketListeners に category:*/subCategory:* ハンドラを追加し、対応するstateを更新する
```

**Structure Decision**: 既存の`backend`/`shared`/`frontend`ワークスペース内、既存ファイルへの追加のみ。新規ディレクトリ・新規ファイルの追加はない。フロントエンドはSocket.ioイベント購読箇所（`useSocketListeners.ts`等）にハンドラを追加し、既存のカテゴリ・サブカテゴリ一覧stateを更新する。

## Complexity Tracking

*Constitution Checkに違反なし。本セクションへの記載事項なし。*
