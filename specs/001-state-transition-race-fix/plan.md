# Implementation Plan: 状態変更エンドポイントのレースコンディションをトランザクション内再検証で解消する

**Branch**: `001-state-transition-race-fix` | **Date**: 2026-07-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-state-transition-race-fix/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

3箇所のcheck-then-actパターン（状態確認クエリと状態書き込みクエリの分離）を、確認と書き込みが不可分な操作となるよう置き換える。加えて、旧001-billing-order-validationから統合した指摘5-1（会計依頼時の未提供注文チェック欠如）を同じ会計依頼処理内で扱う。

- **会計依頼**（客用`POST /customer/groups/:id/bill`、スタッフ用`PUT /api/groups/:id`）: 未提供注文チェック（`OrderItem`の集計、別テーブル条件）を`updateMany`のwhere句だけでは表現できないため、Serializableトランザクション内でグループ状態の再検証（`active`であること）と未提供注文の集計（`pending`/`ready`が0件であること）を同時に行い、両方満たした場合のみ`bill_requested`へ更新する。
- **`order:complete`/`order:serve`**（Socket.io）: 単一行の条件付き更新のみのため、`updateMany`によるcompare-and-swap（`count === 1`のみ成功扱い）で実装する（変更なし）。
- **コース適用（`POST /:id/course`）とコース人数変更（`PUT /:id/course`）**: 複数行の作成・更新と参照系エンティティ（Course/DrinkPlan）の再取得を伴うため、既存のSerializableトランザクション内でCourse/DrinkPlanを再取得し、そのトランザクション内変数のみを使って書き込みを行う（既存の`unapplyCourse`と同じパターン）。あわせて`unapplyCourse`の既存コメントを実装と一致するよう修正する（指摘5-2）。

## Technical Context

**Language/Version**: TypeScript（Node.js）。既存の`backend`ワークスペースの構成に従う。

**Primary Dependencies**: Fastify、Socket.io、Prisma（`@prisma/client` ^6.19.3）。新規依存の追加なし。

**Storage**: PostgreSQL（既存）。スキーマ変更なし。

**Testing**: Jest（`backend`ワークスペースの既存ユニットテスト構成）。E2E（Playwright）は対象外— 競合状態の安定再現がE2Eでは困難なため、Prismaクライアントをモックしたユニットテストで代替する。

**Target Platform**: 既存バックエンド（Fastifyサーバー、Linux/コンテナ環境）。

**Project Type**: Web application（`frontend` + `backend` + `shared`のpnpmワークスペース構成、既存）。本フィーチャーは`backend`のみを変更する。

**Performance Goals**: 既存のレスポンス性能を維持する（追加クエリは競合検知時・成功時の後続fetchのみで、通常時のクエリ回数は最大1回増える程度）。新規の性能目標はなし。

**Constraints**: 通常時（競合が発生しない場合）のレスポンス内容・Socket.io通知内容に回帰を起こさない（spec.md FR-009）。グループ状態競合（FR-002）については新規エラーコードを追加しない（既存の400/`BillRequestNotAllowed`等を再利用）。未提供注文チェック（FR-002a、5-1統合分）は新規に409エラーコード2件（`ErrorCodes.Groups.UnservedItemsExist`、`ErrorCodes.Customer.UnservedItemsExist`）を追加する。APIのリクエスト/レスポンス形状自体の変更はない。

**Scale/Scope**: 変更対象は既存6箇所（`customer.ts`の1ハンドラ、`socket.ts`の2ハンドラ、`groups.ts`の3箇所＝`PUT /:id`・`POST /:id/course`・`PUT /:id/course`）と`errors.ts`への新規エラーコード2件追加。新規ファイル・新規モジュールの追加なし。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md`はプロジェクト固有の原則が未記入のテンプレート状態であり、本フィーチャーに適用可能な明文化されたgateは存在しない。代わりにリポジトリの`CLAUDE.md`（プロジェクトルート・`backend/CLAUDE.md`）とユーザーのグローバル`CLAUDE.md`の原則を判断基準とする。

- **シンプル第一**: 新規モジュール・抽象化を追加せず、既存4関数の内部実装のみを変更する。✅
- **影響を最小化する**: 変更範囲を指摘された3箇所（4エンドポイント/ハンドラ）に限定し、`docs/data-model/concurrency-notes.md`に記載の参考実装（`orders.ts`のcancel、`refreshToken.ts`、`unapplyCourse`）は変更しない。✅
- **状態変更エンドポイントのガード条件を揃える**（`backend/CLAUDE.md`）: 同一リソースの兄弟エンドポイント間でガード条件を揃える方針に従い、コース適用（POST）と人数変更（PUT）の両方に同じ再取得パターンを適用する（DELETE側の`unapplyCourse`は既に対応済み）。✅
- **手を抜かない**: 変更した関数それぞれに、競合シナリオを再現するユニットテストを追加する（Phase構成のTesting節参照）。✅

違反なし。Complexity Trackingへの記載は不要。

## Project Structure

### Documentation (this feature)

```text
specs/001-state-transition-race-fix/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command) — 5-1統合分の新規エラーレスポンスのみ
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

`contracts/`は5-1統合分（未提供注文チェックによる新規409エラーレスポンス、`groups.ts` `PUT /:id`・`customer.ts` `POST /groups/:id/bill`）のみ生成する。それ以外（`order:complete`/`order:serve`、コース適用・人数変更、会計依頼のグループ状態競合エラー）はHTTPエンドポイント・Socket.ioイベントの入出力スキーマを変更せず、内部の並行制御ロジックのみを変更するため契約変更はない。

### Source Code (repository root)

```text
backend/
├── src/
│   ├── routes/
│   │   ├── customer.ts   # 変更: POST /groups/:id/bill（111-141行目付近） — Serializableトランザクション化、未提供チェック追加
│   │   ├── groups.ts     # 変更: PUT /:id（active→bill_requested遷移、未提供チェック追加）, POST /:id/course（457-583行目付近）, PUT /:id/course（649-745行目付近）, unapplyCourse（コメント修正のみ、指摘5-2）
│   │   └── orders.ts     # 変更なし（参考実装として踏襲するのみ）
│   ├── plugins/
│   │   └── socket.ts     # 変更: order:complete / order:serve ハンドラ（150-202行目付近）
│   └── lib/
│       ├── errors.ts      # 変更: ErrorCodes.Groups.UnservedItemsExist / ErrorCodes.Customer.UnservedItemsExist を新規追加
│       ├── mappers.ts     # 変更なし（toGroup/toOrderItemをそのまま利用）
│       └── refreshToken.ts # 変更なし（参考実装として踏襲するのみ）
└── tests/
    └── (各変更ファイルに対応するユニットテストを追加、既存のテスト配置規約に従う)
```

**Structure Decision**: 既存の`backend`ワークスペース（Fastify + Prisma）内、既存5ファイルの該当関数のみを変更する。新規ディレクトリ・新規ファイルの追加はない。`frontend`/`shared`への変更は不要（グループ状態競合時のレスポンス形状は変更せず、未提供チェックの新規エラーコードもバックエンド内で完結するため）。

## Complexity Tracking

*Constitution Checkに違反なし。本セクションへの記載事項なし。*
