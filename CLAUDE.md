# CLAUDE.md

## コマンド

パッケージマネージャは **pnpm**。ワークスペース定義は `pnpm-workspace.yaml`。

```bash
# 開発
pnpm dev          # frontend（Vite dev server）と backend（tsx watch）を同時起動
pnpm build        # 本番ビルド。frontend → backend の順でビルドする
pnpm typecheck    # 全ワークスペースの TypeScript 型チェック（エラーのみ、出力なし）
pnpm lint         # Biome によるリントチェック
pnpm lint:fix     # Biome によるリント自動修正
pnpm format       # Biome によるフォーマット自動修正
pnpm format:check # Biome によるフォーマットチェック（差分なし確認）

# テスト
pnpm test              # frontend + backend のユニットテスト（Jest）を並列実行
pnpm test:e2e          # Playwright E2E テスト実行（ヘッドレス）
pnpm test:e2e:ui       # Playwright UI モード（ブラウザ操作の可視化・デバッグ用。要 X / WSLg）
pnpm test:e2e:ui:wsl   # Playwright UI モード（WSL2 から Windows ブラウザでアクセスする場合）
```

```bash
# セットアップ
pnpm setup                        # env/*.env を example からコピーし JWT_SECRET を自動生成
pnpm --filter backend db:migrate  # schema.prisma の差分から SQL を生成して DB に適用（開発用）
pnpm --filter backend db:seed     # 初期データ投入（スタッフ・メニュー・席など）
```

- frontend: `http://localhost:5173`（Vite dev server）
- backend: `http://localhost:3000`
- Vite は `/api` と `/socket.io` を `localhost:3000` にプロキシ。開発中は両サーバーを同時起動する。
- PostgreSQL はローカルにインストールされたものを使用（`DATABASE_URL` を `env/backend.env` に設定）

## 構成

```txt
order-system/
├── frontend/   @order-system/frontend  — React 18 + Vite + React Router v6
├── backend/    @order-system/backend   — Fastify + Socket.io + Prisma
└── shared/     @order-system/shared    — 共有型定義のみ（ロジックなし）
```

各ワークスペースの詳細は `frontend/CLAUDE.md` / `backend/CLAUDE.md` / `shared/CLAUDE.md` を参照。

## Claude / Codex 分担

- Claude: 設計、仕様整理、観点別レビュー、Codexへの実装ハンドオフ作成、e2eテストの実行を担当する。
- Codex: 実行担当。開発、調査、Lint、単体テスト、テスト追加・改修（e2eのテストコード追加・改修を含む）、型チェック・ビルド、検証失敗の原因調査と修正、結果報告を担当する。e2eの実行はcompanion環境の制約でできないためClaude側が担う。
- Codexへ渡す時は `.claude/skills/codex-execution` を使う。設計済みの変更・開発要望・レビュー指摘のいずれも、この1つのSkillでhandoff形式に整理してから `codex@openai-codex` plugin の `/codex:rescue` へ委譲する。レビュー指摘は独立した指摘ごとに複数の `/codex:rescue --background --fresh` job として並列に渡す。
- 設計と現行コードが矛盾する場合は、Codexは実装を止めて差分を報告する。Claudeは設計を更新して再ハンドオフする。
- 進捗確認は `/codex:status`、結果取得は `/codex:result <job-id>` を使う。

### speckitを使う場合

- `speckit-specify` → `speckit-clarify` → `speckit-plan` → `speckit-tasks` はClaudeが設計担当として実行する。
- `speckit-implement` は使わない（Claude自身がタスクを実行する前提のスキルのため）。代わりに生成された `tasks.md` を `.claude/skills/codex-execution` でhandoffに変換し、`/codex:rescue` へ渡す。
- Codex実行後のtasks.md完了マークの反映はClaudeが結果を確認して手動更新するか、`speckit-converge` で未着手分を検出して補う。

## 環境設定

env ファイルは `env/` ディレクトリで管理。

```txt
env/backend.env.example  → env/backend.env   # NODE_ENV, DATABASE_URL, JWT_SECRET, BASE_DOMAIN など
env/frontend.env.example → env/frontend.env  # VITE_BACKEND_URL（本番ビルド時のみ）
```

- backend は起動時に `../env/backend.env` を dotenv で自動ロード
- Prisma CLI は dotenv-cli 経由でロード（`db:*` スクリプト）
- Vite は `../env/frontend.env` を `vite.config.ts` で `define` に注入

## ドキュメント

画面構成・API・データモデル・運用手順は `docs/` 配下で管理する。入口は `docs/index.md`。画面ごとの仕様は `docs/screens/index.md` を参照。
