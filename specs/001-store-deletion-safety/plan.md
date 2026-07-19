# Implementation Plan: 店舗削除・無効化の運用安全性（F7）

**Branch**: `001-store-deletion-safety` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-store-deletion-safety/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

`DELETE /api/platform/stores/:id`に2つの安全性改善を加える。(1) 営業中セッション（`Session.status === 'open'`）・アクティブなグループ（`Group.status IN ('active', 'bill_requested')`）が存在する店舗の削除を無条件に拒否する（409）。既存の配列形式`$transaction([...])`をインタラクティブトランザクションに変更し、判定とカスケード削除を同一の不可分な操作にする。(2) トランザクションの`timeout`オプションを既定値（5000ms）から30秒に延長し、データ量の多い店舗でもタイムアウトによる削除失敗を防ぐ。

## Technical Context

**Language/Version**: TypeScript（Node.js）。既存の`backend`ワークスペースの構成に従う。

**Primary Dependencies**: Fastify、Prisma（`@prisma/client` ^6.19.3）。新規依存の追加なし。

**Storage**: PostgreSQL（既存）。スキーマ変更なし。

**Testing**: Jest（`backend`ワークスペースの既存ユニットテスト構成）。プラットフォーム管理者向けAPIのためE2E（Playwright）は既存スイートの対象外（プラットフォーム管理画面自体が削除APIを呼んでいないため、Clarificationsの通りUIは対象外）。

**Target Platform**: 既存バックエンド（Fastifyサーバー、Linux/コンテナ環境）。

**Project Type**: Web application（`frontend` + `backend` + `shared`のpnpmワークスペース構成、既存）。本フィーチャーは`backend`のみを変更する。

**Performance Goals**: 既存のレスポンス性能を維持する。通常時（営業中データなし）は判定クエリ2件（`count`）が追加されるのみで、削除処理自体の性能に大きな影響はない。

**Constraints**: 通常時（削除拒否に該当しない場合）のレスポンス内容に回帰を起こさない（spec.md SC-002）。削除確認UIの新設は行わない（Clarifications）。force等による上書き手段は設けない（Clarifications）。

**Scale/Scope**: 変更対象は既存1ファイル（`backend/src/routes/platformStores.ts`の`DELETE /:id`ハンドラ）と`backend/src/lib/errors.ts`への新規エラーコード1件追加。新規ファイル・新規モジュールの追加なし。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md`はプロジェクト固有の原則が未記入のテンプレート状態であり、本フィーチャーに適用可能な明文化されたgateは存在しない。代わりにリポジトリの`CLAUDE.md`（プロジェクトルート・`backend/CLAUDE.md`）とユーザーのグローバル`CLAUDE.md`の原則を判断基準とする。

- **シンプル第一**: 新規モジュール・抽象化を追加せず、既存の`DELETE /:id`ハンドラ1関数の内部実装のみを変更する。✅
- **影響を最小化する**: 変更範囲を指摘された1エンドポイントに限定する。他のプラットフォーム管理API（一覧・詳細・更新）は変更しない。✅
- **状態変更エンドポイントのガード条件を揃える**（`backend/CLAUDE.md`）: 本フィーチャーは既存の唯一の削除エンドポイントへの新規ガード追加であり、他エンドポイントとの整合を取る対象は現状存在しない。✅
- **手を抜かない**: 営業中データ判定の追加（US1）とタイムアウト延長（US2）それぞれに、競合・回帰を再現するユニットテストを追加する（tasks.mdで具体化）。✅

違反なし。Complexity Trackingへの記載は不要。

## Project Structure

### Documentation (this feature)

```text
specs/001-store-deletion-safety/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md         # Phase 1 output (/speckit-plan command)
├── contracts/            # Phase 1 output (/speckit-plan command)
└── tasks.md              # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
backend/
├── src/
│   ├── routes/
│   │   └── platformStores.ts  # 変更: DELETE /:id（106-152行目付近）
│   └── lib/
│       └── errors.ts          # 変更: ErrorCodes.PlatformStores.ActiveDataExists を新規追加
└── tests/
    └── (platformStores.test.ts が存在しない場合は新規作成、既存のテスト配置規約に従う)
```

**Structure Decision**: 既存の`backend`ワークスペース（Fastify + Prisma）内、既存2ファイルのみを変更する。新規ディレクトリ・新規ファイルの追加はない。`frontend`/`shared`への変更は不要（プラットフォーム管理画面は削除APIを呼んでおらず、Clarificationsの通りUI新設は対象外のため）。

## Complexity Tracking

*Constitution Checkに違反なし。本セクションへの記載事項なし。*
