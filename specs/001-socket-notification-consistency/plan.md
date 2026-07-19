# Implementation Plan: Socket.io切断・エラー通知の一貫性

**Branch**: `001-socket-notification-consistency` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-socket-notification-consistency/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

2箇所の独立した通知・接続管理の欠落を埋める。(1) `order:complete`/`order:serve`がガード違反（ステータス不整合、グループ・セッション会計済み等）で状態変更を行わなかった場合、既存の`error`イベント経路（`socket.emit('error', errorBody(...))` → フロントの`PageLayout`がトースト表示）に乗せて操作元クライアントへ単一の汎用メッセージで通知する。サーバー側の状態変更判断（no-opにするかどうか）自体は変更しない。(2) プラットフォーム管理者が店舗を`isActive: false`に更新した直後、対象店舗の`store:${storeId}`ルームへ`fastify.io.in(...).disconnectSockets(true)`を呼び、既存スタッフ接続を強制切断する。既存の`staff.ts`（ロール変更・削除時）、`auth.ts`（ログアウト時）と同じ`disconnectSockets`パターンをルーム粒度だけ変えて踏襲する。

## Technical Context

**Language/Version**: TypeScript（Node.js）。既存の`backend`ワークスペースの構成に従う。

**Primary Dependencies**: Fastify、Socket.io、Prisma（`@prisma/client`）。新規依存の追加なし。

**Storage**: PostgreSQL（既存）。スキーマ変更なし。

**Testing**: Jest（`backend`ワークスペースの既存ユニットテスト構成）。`socket.test.ts`（`order:complete`/`order:serve`）と`platformStores.test.ts`（`PUT /:id`）に既存のSocket.ioモックパターン（`authRoutes.test.ts`/`staff.test.ts`の`io.in(room).disconnectSockets`モック）を踏襲してテストを追加する。E2E（Playwright）は対象外。

**Target Platform**: 既存バックエンド（Fastifyサーバー）。フロントエンドの変更は不要（既存の`error`イベント購読・トースト表示をそのまま利用する）。

**Project Type**: Web application（`frontend` + `backend` + `shared`のpnpmワークスペース構成、既存）。本フィーチャーは`backend`のみを変更する。

**Performance Goals**: 既存のレスポンス性能を維持する。ガード違反時の追加処理は`socket.emit`1回のみ。強制切断は店舗無効化という低頻度操作にのみ追加される。新規の性能目標はなし。

**Constraints**: 通常時（ガード違反が発生しない、店舗が無効化されない場合）の成功時レスポンス・Socket.io通知内容・接続維持動作に回帰を起こさない（spec.md FR-005, SC-003）。`order:complete`/`order:serve`のno-op自体の判断ロジックは変更しない（spec.md Assumptions）。新規のHTTP APIスキーマ変更は行わない。

**Scale/Scope**: 変更対象は既存2ファイルの該当箇所（`socket.ts`の2ハンドラのガード分岐、`platformStores.ts`の`PUT /:id`）と、エラーコード定義への追加1箇所（`lib/errors.ts`）。新規ファイル・新規モジュールの追加なし。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md`はプロジェクト固有の原則が未記入のテンプレート状態であり、本フィーチャーに適用可能な明文化されたgateは存在しない。代わりにリポジトリの`CLAUDE.md`（プロジェクトルート・`backend/CLAUDE.md`）とユーザーのグローバル`CLAUDE.md`の原則を判断基準とする。

- **シンプル第一**: 新規モジュール・抽象化を追加せず、既存2ファイルの該当箇所のみを変更する。既存の`error`イベント経路・`disconnectSockets`パターンをそのまま再利用し、新しい通知メカニズムを作らない。✅
- **影響を最小化する**: 変更範囲を指摘された2件（`order:complete`/`order:serve`のガード違反通知、店舗無効化時の強制切断）に限定する。ガード条件自体・店舗削除の業務フロー（プリコンディション等、指摘6-1/6-2）は変更しない。✅
- **手を抜かない**: ガード違反の3パターン（ステータス不一致、グループ会計済み、セッション会計済み）と、店舗無効化・再有効化・別店舗非干渉の各ケースにテストを追加する。✅
- **既存パターンの踏襲**（`backend/CLAUDE.md`「Socket.io」節）: `auth.ts`/`staff.ts`の`fastify.io.in(room).disconnectSockets(true)`パターンをルーム粒度（`user:${id}` → `store:${storeId}`）だけ変えて踏襲する。✅

違反なし。Complexity Trackingへの記載は不要。

## Project Structure

### Documentation (this feature)

```text
specs/001-socket-notification-consistency/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

`contracts/`は生成しない。本フィーチャーはSocket.ioイベント名・ペイロード形状、HTTPエンドポイントのリクエスト/レスポンス形状を変更しない（既存の`error`イベント・`errorBody()`の形状をそのまま使い、`PUT /platform/stores/:id`のレスポンスも変更なし）ため、外部インターフェース契約の変更が存在しない。

### Source Code (repository root)

```text
backend/
├── src/
│   ├── plugins/
│   │   └── socket.ts       # 変更: order:complete（150-175行目付近）/ order:serve（177-202行目付近）の
│   │                       #      ガード分岐（if (...) return）に socket.emit('error', ...) を追加
│   ├── routes/
│   │   └── platformStores.ts # 変更: PUT /:id（96-104行目付近）で isActive:false 更新確定後に
│   │                         #      fastify.io.in(`store:${id}`).disconnectSockets(true) を追加
│   └── lib/
│       └── errors.ts       # 変更: ErrorCodes.Socket に、ガード違反用のコードを1件追加
│                            #      （既存の OrderCompleteFailed/OrderServeFailed は例外catch節専用のため転用しない）
└── src/__tests__/
    ├── socket.test.ts        # 変更: ガード違反時に socket.emit('error', ...) が呼ばれることを検証するケースを追加
    └── platformStores.test.ts # 変更: PUT /:id で disconnectSockets(true) が呼ばれる／isActive:true復帰時は呼ばれないことを検証するケースを追加
```

**Structure Decision**: 既存の`backend`ワークスペース内、既存3ファイル（`socket.ts`、`platformStores.ts`、`errors.ts`）の該当箇所のみを変更する。`frontend`/`shared`への変更は不要——`error`イベントの型（`ApiErrorPayload`）・購読ロジック（`PageLayout`）は既存のまま流用できるため。新規ディレクトリ・新規ファイルの追加はない。

## Complexity Tracking

*Constitution Checkに違反なし。本セクションへの記載事項なし。*
