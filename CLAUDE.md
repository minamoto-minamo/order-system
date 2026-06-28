# CLAUDE.md

## コマンド

パッケージマネージャは **pnpm**。ワークスペース定義は `pnpm-workspace.yaml`。

```bash
# 開発
pnpm dev          # frontend（Vite dev server）と backend（tsx watch）を同時起動
pnpm build        # 本番ビルド。frontend → backend の順でビルドする
pnpm typecheck    # 全ワークスペースの TypeScript 型チェック（エラーのみ、出力なし）

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

## 環境設定

env ファイルは `env/` ディレクトリで管理。

```txt
env/backend.env.example  → env/backend.env   # NODE_ENV, DATABASE_URL, JWT_SECRET, CORS_ORIGIN など
env/frontend.env.example → env/frontend.env  # VITE_API_BASE_URL（本番ビルド時のみ）
```

- backend は起動時に `../env/backend.env` を dotenv で自動ロード
- Prisma CLI は dotenv-cli 経由でロード（`db:*` スクリプト）
- Vite は `../env/frontend.env` を `vite.config.ts` で `define` に注入

## 画面構成

| ID   | 画面名               | パス                                      | アクター   |
|------|----------------------|-------------------------------------------|------------|
| S100 | ホーム               | `/`                                       | 全員       |
| S101 | ログイン             | `/login`                                  | 全員       |
| S102 | グループ詳細         | `/hall/group/:id` `/kitchen/group/:id`    | 共通       |
| S200 | ホール               | `/hall`                                   | ホール店員 |
| S300 | キッチン             | `/kitchen`                                | キッチン   |
| S400 | 管理者メニュー       | `/admin`                                  | 管理者     |
| S401 | 商品設定             | `/admin/products`                         | 管理者     |
| S402 | 席レイアウト設定     | `/admin/seats`                            | 管理者     |
| S403 | 日次レポート         | `/admin/report`                           | 管理者     |
| S404 | 詳細設定             | `/admin/settings`                         | 管理者     |
| S405 | スタッフ管理         | `/admin/staff`                            | 管理者     |

詳細仕様は `docs/screens/`、ドキュメント一覧は `docs/DOCUMENTS.md` を参照。
