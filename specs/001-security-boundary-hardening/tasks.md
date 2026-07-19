---

description: "Task list template for feature implementation"
---

# Tasks: セキュリティ境界の強化（CORS越境許可・レート制限のプロキシ配下対応）

**Input**: Design documents from `/specs/001-security-boundary-hardening/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md, contracts/behavior-changes.md

**Tests**: plan.mdでユニットテストの追加が明示的に要求されているため、各ユーザーストーリーにテストタスクを含む。

**Organization**: タスクはユーザーストーリー単位でグループ化する。各ストーリーは独立して実装・検証可能。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（別ファイル・依存関係なし）
- **[Story]**: 対応するユーザーストーリー（US1, US2）
- ファイルパスは絶対パスではなくリポジトリルートからの相対パスで記載する

## Setup / Foundational フェーズについて

本フィーチャーは既存3ファイル（`backend/src/lib/config.ts`, `backend/src/plugins/cors.ts`, `backend/src/app.ts`）の変更のみで、新規インフラ・新規共有基盤は不要。US1（CORS）とUS2（レート制限）は変更ファイルが独立しているため、Setup / Foundationalフェーズは省略し、ユーザーストーリーのフェーズから開始する。

---

## Phase 1: User Story 1 - 1店舗の管理画面が侵害されても他店舗・プラットフォーム管理者へ被害が波及しない (Priority: P1) 🎯 MVP

**Goal**: CORS許可判定を、Originのホスト名とリクエスト先Hostのテナント種別が一致する場合のみ許可するよう狭める。

**Independent Test**: `storeA.<BASE_DOMAIN>`をOriginとして`storeB.<BASE_DOMAIN>`・`admin.<BASE_DOMAIN>`のAPIへ直接リクエストし、CORSエラーで拒否されることを確認する。`storeA.<BASE_DOMAIN>`から自分自身へのアクセスは従来どおり成功することを確認する。

### Tests for User Story 1 ⚠️

> **NOTE: 先にテストを書き、実装前に FAIL することを確認する**

- [ ] T001 [P] [US1] `backend/src/__tests__/config.test.ts`（新規または既存拡張）に、`corsOriginValidator`（またはHost引数を受け取る新シグネチャ）のユニットテストを追加する: (a) Origin `storeA.<BASE_DOMAIN>` / Host `storeA.<BASE_DOMAIN>` → 許可、(b) Origin `storeA.<BASE_DOMAIN>` / Host `storeB.<BASE_DOMAIN>` → 拒否、(c) Origin `storeA.<BASE_DOMAIN>` / Host `admin.<BASE_DOMAIN>` → 拒否、(d) Origin `admin.<BASE_DOMAIN>` / Host `storeA.<BASE_DOMAIN>` → 拒否、(e) Origin `admin.<BASE_DOMAIN>` / Host `admin.<BASE_DOMAIN>` → 許可、(f) Originヘッダーなし → 許可（既存挙動維持）。
- [ ] T002 [US1] `backend/src/__tests__/`に、`fastify.inject`を使った統合テストを追加する。任意の`/api/*`エンドポイント（例: `GET /api/health`相当かCORS対象の実エンドポイント）に対し、`Origin: storeA.<BASE_DOMAIN>` + `Host: storeB.<BASE_DOMAIN>`でリクエストし、レスポンスに`access-control-allow-origin`ヘッダーが付与されないことを検証する。（T001完了後、実装のインターフェースが固まってから追加）

### Implementation for User Story 1

- [ ] T003 [US1] `node_modules/@fastify/cors`の型定義を確認し、`origin`オプションの関数コールバックがリクエスト情報（Hostヘッダー）にアクセスできるシグネチャをサポートするか判定する（research.md R2の要検証事項）。サポートする場合はT004a、サポートしない場合はT004bに進む。
- [ ] T004a [US1] （T003でサポート確認できた場合）`backend/src/lib/config.ts`の`corsOriginValidator`を、Hostヘッダー相当の引数を受け取れるシグネチャに変更し、Originのサブドメインラベルと渡されたHostのサブドメインラベルを`extractSubdomainLabel`で比較する判定に置き換える。`backend/src/plugins/cors.ts`の`@fastify/cors`登録をこの新シグネチャに合わせて更新する。（Depends on: T001, T003）
- [ ] T004b [US1] （T003でサポート不可と判定した場合）`backend/src/plugins/cors.ts`を`@fastify/cors`の使用をやめ、`onRequest`フックで自前のCORS処理（Origin検証・`Access-Control-Allow-Origin`/`Access-Control-Allow-Credentials`ヘッダー設定、`OPTIONS`プリフライト応答）に置き換える。判定ロジックは`backend/src/lib/config.ts`に`corsOriginValidator`相当の新関数として実装し、`request.headers.host`と`origin`ヘッダーの両方からサブドメインラベルを`extractSubdomainLabel`で抽出して比較する。（Depends on: T001, T003）
- [ ] T005 [US1] 削除: 置き換え後に不要となった旧`corsOriginValidator`（Host一致判定を行わない版）を`backend/src/lib/config.ts`から削除する（T004a/T004bのどちらを採用したかに応じて、旧実装の残骸を残さない）。（Depends on: T004a or T004b）

**Checkpoint**: この時点でUser Story 1は独立して動作・検証可能。

---

## Phase 2: User Story 2 - 本番運用でログイン試行レート制限が意図どおり機能する (Priority: P2)

**Goal**: Fastifyインスタンスにプロキシ配下でのクライアントIP解決を設定し、レート制限・監査ログの双方が実際のクライアントIPに基づいて動作するようにする。

**Independent Test**: `X-Forwarded-For`ヘッダーで異なるクライアントIPを装ったログイン失敗リクエストをそれぞれ制限回数まで送り、各IPのレート制限が独立してカウントされることを確認する。

### Tests for User Story 2 ⚠️

> **NOTE: 先にテストを書き、実装前に FAIL することを確認する**

- [ ] T006 [P] [US2] `backend/src/__tests__/auth.test.ts`に、`fastify.inject`で`X-Forwarded-For`ヘッダーを付けたログイン失敗リクエストを異なる2つのIPからそれぞれ制限回数まで送り、両IPのレート制限が独立してカウントされる（一方の制限到達が他方に影響しない）ことを検証するテストを追加する。`trustProxy`設定前は失敗する（両IPが同一キーに集約される）ことを確認してから実装に進む。
- [ ] T007 [US2] 同様のテストを`backend/src/__tests__/platformAuth.test.ts`にも追加する（`POST /platform/auth/login`）。（T006と同一観点のため直列で追加）

### Implementation for User Story 2

- [ ] T008 [US2] `backend/src/app.ts`の`Fastify({ logger: true })`を`Fastify({ logger: true, trustProxy: true })`に変更する。（Depends on: T006, T007）

**Checkpoint**: この時点でUser Story 1・2すべてが独立して動作・検証可能。

---

## Phase 3: Polish & Cross-Cutting Concerns

**Purpose**: 全ストーリーの回帰確認

- [ ] T009 [P] `pnpm --filter backend typecheck` を実行し、型エラーがないことを確認する。
- [ ] T010 [P] `pnpm --filter backend test` を実行し、T001/T002/T006/T007で追加したテストを含む全テストが通ることを確認する。
- [ ] T011 `specs/001-security-boundary-hardening/quickstart.md`の手順に従い、開発環境での手動確認（CORS越境拒否、レート制限のプロキシ配下対応）を行う。同一テナント内の通信・開発環境でのログイン試行に回帰がないことを確認する。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (US1)**: 依存なし。単独で開始・完了できる。
- **Phase 2 (US2)**: 依存なし。Phase 1と並行して開始できる（別ファイル: `app.ts`）。
- **Phase 3 (Polish)**: Phase 1〜2完了後に行う。

### User Story Dependencies

- US1・US2は互いに独立（変更ファイルが重複しない: `lib/config.ts`・`plugins/cors.ts` / `app.ts`）。優先度順（P1→P2）に進めてもよいし、並行して進めてもよい。

### Within Each User Story

- テストを先に追加し、実装前にFAILすることを確認してから実装タスクに進む。
- T003→T004a/T004b→T005、T006→T007→T008は直列で行う（同一ファイル・同一調査結果への依存のため）。

### Parallel Opportunities

- T001（US1）とT006（US2）はそれぞれ別ファイルのテスト追加であり並行実行できる。
- US1・US2の実装タスク（T003-T005 / T008）は別ファイルのため、ストーリー単位で並行して進められる。
- T009・T010（Polish）は並行実行できる。

---

## Parallel Example: 2ストーリー同時着手

```bash
# 各ストーリーのテストを並行して追加:
Task: "T001 backend/src/__tests__/config.test.ts に CORS越境拒否のケースを追加"
Task: "T006 backend/src/__tests__/auth.test.ts にプロキシ配下レート制限のケースを追加"
```

---

## Implementation Strategy

### MVP First (User Story 1 のみ)

1. Phase 1（US1: CORS越境拒否）を完了する。
2. **STOP and VALIDATE**: User Story 1を独立して検証する（`pnpm --filter backend test`、該当テストのみ実行可）。
3. 必要であればここでリリース判断する（Mediumの指摘1件のみを先行修正するケース）。

### Incremental Delivery

1. Phase 1（US1）→ 独立検証 → リリース可能な単位。
2. Phase 2（US2）を追加 → 独立検証 → リリース可能な単位。
3. Phase 3（Polish）で全体の回帰確認を行う。

### Codexへのハンドオフについて

`speckit-implement`は使用しない。本`tasks.md`は`.claude/skills/codex-execution`でhandoff形式に変換し、`/codex:rescue`へ委譲する（`CLAUDE.md`「speckitを使う場合」参照）。ストーリー単位（US1 / US2）でhandoffを分けることを推奨する（変更ファイルが独立しているため並列実行可能）。T003（`@fastify/cors`のAPI調査）はCodex実行時に必ず先に完了させ、その結果（T004a採用かT004bか）をhandoffの指示に反映する。

---

## Notes

- [P] タスク = 別ファイル・依存関係なし
- [Story] ラベルはタスクをユーザーストーリーに対応付けるためのトレーサビリティ用
- 各ユーザーストーリーは独立して完了・検証可能であること
- 実装前にテストがFAILすることを確認する
- 論理的な区切りごとにコミットする
- T003の調査結果次第でT004a/T004bのどちらか一方のみを実施する（両方は行わない）
