# CLAUDE.md

## コマンド

パッケージマネージャは **pnpm**。ワークスペース定義は `pnpm-workspace.yaml`。

```bash
pnpm dev          # 開発サーバー起動（frontend: Vite / backend: tsx watch）
pnpm build        # ビルド（frontend → backend の順）
pnpm typecheck    # 全ワークスペースの型チェック
pnpm test:e2e           # Playwright E2E テスト実行
pnpm test:e2e:ui        # Playwright UI モード（要 X / WSLg）
pnpm test:e2e:ui:wsl    # Playwright UI モード（WSL2 ブラウザアクセス用）
```

```bash
pnpm setup                        # env ファイル生成・JWT_SECRET 自動生成
pnpm db:up                        # PostgreSQL コンテナ起動（Docker）
pnpm --filter backend db:migrate  # マイグレーション実行
pnpm --filter backend db:seed     # 初期データ投入
```

- frontend: `http://localhost:5173`（Vite dev server）
- backend: `http://localhost:3000`
- Vite は `/api` と `/socket.io` を `localhost:3000` にプロキシ。開発中は両サーバーを同時起動する。

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
