<!--
Sync Impact Report
- Version change: (template, unratified) → 1.0.0
- Rationale: Initial ratification. No prior concrete version existed; all
  placeholders in the template were undefined. First filled version is
  MAJOR (1.0.0) per semantic versioning bootstrap convention.
- Modified principles: n/a (first ratification, no renames)
- Added sections:
  - I. マルチテナント分離（非交渉）
  - II. 会計・金額の正確性
  - III. 状態遷移とガード条件の一貫性
  - IV. リアルタイム同期の完全性
  - V. セキュリティと認可境界
  - VI. データ整合性
  - VII. UI/UXの一貫性
  - VIII. テスト規律
  - IX. ドキュメントの同期
  - Technology Constraints
  - Development Workflow
  - Governance
- Removed sections: none (template placeholders only)
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md — Constitution Check section is
    generic ("[Gates determined based on constitution file]"); no textual
    change needed, gates are derived at plan time from this file.
  - ✅ .specify/templates/spec-template.md — no constitution-specific
    references found; no change needed.
  - ✅ .specify/templates/tasks-template.md — no constitution-specific
    references found; no change needed.
  - ✅ .claude/skills/speckit-*/SKILL.md — reviewed for outdated
    agent-specific references; none found requiring edits.
  - ✅ docs/index.md — already describes the OKF front-matter/type and
    PR-managed deletion rules that principle IX codifies; no contradiction,
    no edit needed.
- Follow-up TODOs: none. All placeholders resolved from repository context
  (CLAUDE.md, frontend/CLAUDE.md, backend/CLAUDE.md, shared/CLAUDE.md,
  docs/index.md), from the existing review-arch skill's eight review
  perspectives (mirrored by principles I–VIII), and from the documented
  post-implementation doc-sync convention seen in this repo's commit
  history (principle IX).
-->

# order-system Constitution

## Core Principles

### I. マルチテナント分離（非交渉）

店舗はHostのサブドメインで識別する。すべてのDBクエリは `storeId` でスコープする。`storeId` によるフィルタを省略したクエリは禁止する。店舗系ルートとプラットフォーム系ルートはHost解決の時点で完全に分離する。一方から他方のリソースへ越境するコードを書かない。Socket.ioのルーム参加も店舗（`store:${storeId}`）・グループ（`group:${groupId}`）単位で分離し、範囲を越えたemitやjoinを行わない。

**Rationale**: 本システムは複数店舗が同一インフラを共有するマルチテナント構成。テナント分離の破れは他店舗の顧客データ・売上データの漏洩に直結し、被害の検出も遅れる。境界はコードレビューで毎回確認できるよう、Host解決とstoreIdスコープの2点に集約している。

### II. 会計・金額の正確性

税率・料金は発生時点の値をスナップショットとして保持し、後から遡って再計算しない。キャンセルによる再計算は、会計が確定していない状態（`closed` / `bill_requested` になっていないグループ）に対してのみ許可する。コース・ドリンクプランの同時適用時の料金計算ロジックを変更する際は、既存の確定済み注文の金額に影響しないことを確認する。

**Rationale**: 会計金額は店舗の売上そのものであり、誤りは金銭トラブルに直結する。過去の実インシデント（`backend/CLAUDE.md` 記載）で、ガード漏れにより会計後のコース解除・料金遡及書き換えが可能になっていた。金額計算は「その場で確定し、後から変えない」を原則とする。

### III. 状態遷移とガード条件の一貫性

同一リソースに対する複数の状態変更エンドポイント（作成・更新・削除・部分操作）は、ガード条件（ステータスチェック等）を横並びで揃える。新しいエンドポイントを追加・変更する際は、同一リソース内の既存エンドポイントのガード条件を先に洗い出し、揃っているかを確認してから実装する。

**Rationale**: `groups.ts` の `POST/PUT /:id/course` にはステータスチェックがあり `DELETE /:id/course` に漏れていた実例がある。1つのエンドポイントにガードを実装しても、横のエンドポイントへの追加を忘れやすい構造的な弱点であり、原則として明示しておく必要がある。

### IV. リアルタイム同期の完全性

サーバー側の状態変更（注文・グループ・席・品切れ・セッション・設定の作成/更新/削除）は、影響を受ける全クライアントへSocket.ioのemitで即座に反映する。emit先ルームは対象範囲（`store` / `group` / `user`）を状態変更の性質に応じて正しく選択する。新しいAPIエンドポイントが既存のSocket.ioイベント種別に該当する状態を変更する場合、対応するemitを追加する。

**Rationale**: ホール・キッチン・客用注文画面はSocket.ioのリアルタイム更新に依存する。emit漏れは「APIは成功したが画面に反映されない」不整合を生み、原因調査が難しい。

### V. セキュリティと認可境界

認証・認可は `plugins/auth.ts` の既存機構（スタッフ用JWT・プラットフォーム管理者用JWT・客用ゲストのレート制限）に従う。ルートハンドラ内で認証ロジックを個別に再実装しない。非認証エンドポイント（客用ゲスト向け等）は、リソースID（`group:id` 等）で参照範囲を必ず限定し、無関係なリソースへのアクセスを防ぐ。admin限定ルートは `requireAdmin` を明示的に付与する。

**Rationale**: 認証機構が複数並存する構成（スタッフ／プラットフォーム管理者／客用ゲスト）は個別実装によるガード漏れが起きやすい。既存プリハンドラへの集約が唯一の防御線になる。

### VI. データ整合性

関連レコードの作成・削除時はCASCADE設定・孤立レコードの有無を確認する。並行書き込みが起こりうる操作（同一グループ・同一席への同時更新等）はトランザクションまたは適切なロック戦略で保護する。nullableな外部キーを追加する場合は、参照先が欠落した状態が業務上意味を持つかを明示する。

**Rationale**: 飲食店の営業時間中はホール・キッチン・客用端末から同時に同じグループ・席が更新される。整合性の欠如は二重注文・二重会計につながる。

### VII. UI/UXの一貫性

ハードコードカラー（`#xxx`）を書かず、`styles/tailwind.css` の `@theme` で定義されたデザイントークンを使う。低頻度・セマンティックカラーが必要な場合はトークンに追加してから使う。UI文言は `i18n/locales/ja.ts` に一元化し、コンポーネントに直接日本語文字列を書かない。

**Rationale**: 画面数が多く複数の担当が並行して触るため、トークンとi18nへの集約がなければ表記・配色のばらつきが蓄積し、後からの一括修正が困難になる。

### VIII. テスト規律

新規ロジック・変更箇所には意味のあるテストを書く。テスト対象は変更した関数・メソッドの入出力に限り、その関数が呼び出す既存の未変更コードまではテスト対象に含めない。状態変更エンドポイントの追加・変更時は、III（ガード条件の一貫性）に関するテストを含める。バグ修正では、まずそのバグを再現するテストを書き、それが通ることを確認する。

**Rationale**: カバレッジ数値を目標にすると形骸化する。変更箇所に対応した検証があることが、レビューと将来の回帰防止の両方にとって最小十分な担保になる。

### IX. ドキュメントの同期

仕様に影響する変更（画面構成、API、データモデル、運用手順）を行った場合、`docs/` 配下の該当ファイルを同じ変更の中、または変更直後の別コミットで更新する。画面仕様は `docs/screens/`、API仕様は `docs/api/`、データモデルは `docs/data-model/`、運用手順は `docs/ops/` に反映する。各ファイルのfront matterには `type` を必須で設定し、他コンセプトへの参照はMarkdownリンクで行う（Open Knowledge Format準拠）。ドキュメントの削除・移動はPRで管理する。

**Rationale**: `docs/` は画面・API・データモデルの一次情報源であり、実装との乖離はレビューアと将来の開発者を誤誘導する。本リポジトリでは機能実装後にドキュメント反映を別コミットで行う運用が既に定着している（例: `3f536fe docs: 003-product-options・004-set-menuの実装内容をドキュメントに反映する`）。これを明文化し、反映漏れを防ぐ。

## Technology Constraints

- パッケージマネージャは pnpm、ワークスペースは `pnpm-workspace.yaml` で管理する。ワークスペース構成（`frontend` / `backend` / `shared`）を変更する場合は影響範囲が大きいため、事前に設計判断として扱う。
- `shared` ワークスペースは型定義のみを置く。関数・クラス・定数などのロジックを追加しない。
- PostgreSQL・Prismaを永続化層とする。マイグレーションは `schema.prisma` の差分から生成し、`prisma/migrations/` の適用順を崩す変更（手動SQL編集・過去マイグレーションの書き換え）は行わない。
- 新しい外部ライブラリ・SaaS依存を追加する場合は、既存のBiome/Jest/Playwright/Prisma/Fastify/Socket.ioの構成で代替できないことを確認してから導入する。

## Development Workflow

- 設計判断（新しいファイル・モジュールの追加、既存public APIの変更、データモデル・スキーマの変更）は、実装着手前にClaudeが設計担当として確定させる。speckitを使う機能開発では `speckit-specify` → `speckit-clarify` → `speckit-plan` → `speckit-tasks` の順で設計成果物を作る。
- 実装・調査・Lint・単体テスト・型チェック・ビルド・検証失敗の原因調査はCodex（`/codex:rescue`）が担当する。`speckit-implement` は使わず、生成された `tasks.md` を `.claude/skills/codex-execution` でhandoff形式に変換してから委譲する。
- レビューは観点別に行う。既存の `review-arch` skillが提供するセキュリティ／データ整合性／会計／リアルタイム同期／ビジネスロジック／運用・障害耐性／マルチテナンシー／UI・UXデザインの8観点は、本憲章のI〜VIII原則に対応する。レビューは指摘のみを行い、修正はCodexへの再依頼で行う。
- e2eテストの実行はCompanion環境の制約でCodex側ができないため、Claudeが実行を担当する。
- 設計と現行コードが矛盾する場合、Codexは実装を止めて差分を報告する。Claudeが設計を更新し再ハンドオフする。

## Governance

本憲章は、`CLAUDE.md`（グローバル・プロジェクト双方）に記載されたコーディングガイドラインの上位に位置し、矛盾する場合は本憲章の原則（I〜IX）を優先する。ただし影響最小化・シンプル第一などグローバルCLAUDE.mdの一般原則は、本憲章が明示していない事項に引き続き適用される。

**改訂手続き**: 原則の追加・削除・再定義は `/speckit-constitution` で行う。改訂案は変更理由（Rationale）を明記し、影響を受ける `.specify/templates/*` および `docs/` 配下のファイルを同じ変更の中で更新する。

**バージョニング**: セマンティックバージョニングに従う。
- MAJOR: 既存原則の後方互換性のない削除・再定義
- MINOR: 新しい原則・セクションの追加、既存原則の実質的な拡張
- PATCH: 文言の明確化・誤字修正・非意味的な調整

**コンプライアンスレビュー**: 機能追加・変更のPRは、該当する原則（特にI〜IV、金銭・テナント・リアルタイムに関わる変更）についてレビュー時に準拠を確認する。`review-arch` skillの観点別レビューを通じて確認することを推奨する。複雑さの追加（新規抽象化・新規依存）は本憲章のTechnology Constraintsに照らして正当化を要する。

**Version**: 1.0.0 | **Ratified**: 2026-07-26 | **Last Amended**: 2026-07-26
