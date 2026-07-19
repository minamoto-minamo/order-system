# Implementation Plan: セキュリティ境界の強化（CORS越境許可・レート制限のプロキシ配下対応）

**Branch**: `001-security-boundary-hardening` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-security-boundary-hardening/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

CORS設定（`corsOriginValidator`）を、Originのホスト名とリクエスト先Hostのテナント種別（店舗サブドメイン or `admin`）が一致する場合のみ許可するよう狭める（指摘1-1）。あわせて、Fastifyインスタンスに`trustProxy: true`を設定し、リバースプロキシ配下でもログイン試行レート制限が実際のクライアントIPに基づいて機能するようにする（指摘1-2）。両者とも既存の`backend`ワークスペースの設定・ロジック変更のみで、スキーマ変更・新規エンドポイントの追加はない。

## Technical Context

**Language/Version**: TypeScript（Node.js）。既存の`backend`ワークスペースの構成に従う。

**Primary Dependencies**: Fastify、`@fastify/cors`（^10.0.0）、`@fastify/rate-limit`（^11.0.0）。新規依存の追加なし（`@fastify/cors`をそのまま使い続けられない場合は、同梱の`onRequest`フック機構で代替する。research.md R2参照）。

**Storage**: PostgreSQL（既存）。スキーマ変更なし。

**Testing**: Jest（`backend`ワークスペースの既存ユニットテスト構成）。CORS判定・レート制限のいずれもFastifyインスタンスへの`inject`（`fastify.inject`）を使ったユニットテストで検証する。

**Target Platform**: 既存バックエンド（Fastifyサーバー、ECS/リバースプロキシ配下を含む）。

**Project Type**: Web application（`frontend` + `backend` + `shared`のpnpmワークスペース構成、既存）。本フィーチャーは`backend`のみを変更する。

**Performance Goals**: 既存のレスポンス性能を維持する。CORS判定・IP解決はいずれもリクエストごとの軽量な文字列処理であり、新規の性能目標はなし。

**Constraints**: 通常時（同一テナント内、開発環境での直接接続）のレスポンス内容に回帰を起こさない（spec.md FR-005、SC-002/SC-004）。新規のAPIエンドポイント・リクエスト/レスポンススキーマの変更は行わない。

**Scale/Scope**: 変更対象は既存3ファイル（`backend/src/lib/config.ts`のCORS判定ロジック、`backend/src/plugins/cors.ts`または同等の新規実装、`backend/src/app.ts`のFastifyインスタンス生成）。新規ファイル追加は`@fastify/cors`を置き換える場合のみ発生しうる（research.md R2の要検証事項次第）。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md`はプロジェクト固有の原則が未記入のテンプレート状態であり、本フィーチャーに適用可能な明文化されたgateは存在しない。代わりにリポジトリの`CLAUDE.md`（プロジェクトルート・`backend/CLAUDE.md`）とユーザーのグローバル`CLAUDE.md`の原則を判断基準とする。

- **シンプル第一**: `trustProxy: true`という1行追加で完結させ、環境変数化・条件分岐は追加しない（research.md R3）。CORS判定もDB問い合わせを追加せず文字列比較のみで完結させる（research.md R2）。✅
- **影響を最小化する**: 変更範囲を指摘された2箇所（CORS判定、Fastifyインスタンス設定）に限定する。レート制限のkeyGenerator自体（`req.ip`参照）や監査ログ（`ipAddress: request.ip`）は変更しない（`trustProxy`設定により自動的に正しい値になるため、research.md R4）。✅
- **手を抜かない**: CORS判定・レート制限双方について、変更前後の挙動差分（許可/拒否が変わるケース）を再現するユニットテストを追加する（Phase構成のTesting節参照）。✅

違反なし。Complexity Trackingへの記載は不要。

## Project Structure

### Documentation (this feature)

```text
specs/001-security-boundary-hardening/
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
│   ├── lib/
│   │   └── config.ts     # 変更: corsOriginValidator をHost一致判定に変更（またはHost引数を受け取れる形に拡張）
│   ├── plugins/
│   │   └── cors.ts       # 変更: corsOriginValidator の呼び出し方法を見直す（@fastify/corsのAPI次第でonRequestフック化）
│   └── app.ts             # 変更: Fastify({ logger: true, trustProxy: true })
└── tests/
    └── (各変更ファイルに対応するユニットテストを追加、既存のテスト配置規約に従う)
```

**Structure Decision**: 既存の`backend`ワークスペース（Fastify）内、既存3ファイルのみを変更する。新規ディレクトリの追加はない。`frontend`/`shared`への変更は不要（CORS判定・レート制限はいずれもバックエンド内部の設定であり、APIのリクエスト/レスポンス形状を変更しないため）。

## Complexity Tracking

*Constitution Checkに違反なし。本セクションへの記載事項なし。*
