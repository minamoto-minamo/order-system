# 居酒屋注文システム

## システム構成

```txt
order-system/
├── frontend/   React 18 + Vite + React Router v6
├── backend/    Fastify + Socket.io + Prisma
└── shared/     共有型定義
```

### アーキテクチャ

```txt
ブラウザ(:5173)
  └─ Vite dev server          ← HMR、/api は :3000 にプロキシ
       └─ Fastify(:3000)      ← tsx watch
            └─ PostgreSQL(:5432)  ← ローカルインストール
```

---

## ローカル開発

### 前提

- PostgreSQL がローカルにインストール済み
- `env/backend.env` の `DATABASE_URL` に接続先を設定済み

### 初回セットアップ

```bash
pnpm install
pnpm setup                        # env ファイル生成・JWT_SECRET 自動生成
pnpm --filter backend db:migrate  # マイグレーション実行
pnpm --filter backend db:seed     # 初期データ投入
```

### 起動

```bash
pnpm dev   # frontend: http://localhost:5173 / backend: http://localhost:3000
```

---

## ドキュメント

`docs/DOCUMENTS.md` を参照。
