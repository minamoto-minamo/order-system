# ── Stage 1: Build ──────────────────────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app

RUN npm install -g pnpm

# 依存関係インストール（package.json と lockfile を先にコピーしてキャッシュ活用）
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY frontend/package.json ./frontend/
COPY backend/package.json  ./backend/
COPY shared/package.json   ./shared/
RUN pnpm install --frozen-lockfile

# ソースコードをコピーしてビルド
COPY shared/   ./shared/
COPY frontend/ ./frontend/
COPY backend/  ./backend/

# TypeScript ビルド前に Prisma クライアントを生成
RUN pnpm --filter @order-system/backend exec prisma generate

RUN pnpm --filter @order-system/frontend build
RUN pnpm --filter @order-system/backend  build

# 本番用スタンドアロンパッケージを生成
# dist/ は .gitignore 対象のため pnpm deploy がスキップする → 明示的にコピー
# Prisma クライアントは @prisma/client の postinstall で自動生成される
RUN pnpm --filter @order-system/backend deploy --prod --legacy /prod/backend && \
    cp -r /app/backend/dist /prod/backend/dist

# ── Stage 2: Production ─────────────────────────────────────────────────────────
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl netcat-openbsd && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# バックエンド（API サーバー + Prisma）とフロントエンド静的ファイルをコピー
# app.ts で resolve(__dirname, '../../frontend/dist') = /app/frontend/dist になるよう配置
COPY --from=builder /prod/backend      ./backend
COPY --from=builder /app/frontend/dist ./frontend/dist

# pnpm deploy --prod が prisma の .bin/ シンボリックリンクを作成しないため手動で補完
RUN ln -sf /app/backend/node_modules/.pnpm/node_modules/.bin/prisma \
           /app/backend/node_modules/.bin/prisma

ENV NODE_ENV=production
EXPOSE 3000
WORKDIR /app/backend
CMD ["node", "dist/index.js"]
