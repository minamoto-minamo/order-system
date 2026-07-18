---
type: Env Reference
title: Env Reference
description: 環境変数一覧（開発・本番）と説明。開発者・運用担当向け。
tags: [ops, env, configuration]
---

# Env Reference

環境変数の一覧（開発・本番）とその説明をまとめる。

- `NODE_ENV`: development|production
- `PORT`: Listen port (default 3000)
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: Secret for JWT signing
- `BASE_DOMAIN`: サブドメインルーティングの基準ドメイン（例: `localhost`、本番は `example.com`）。CORS の許可オリジンもこの値から動的に導出される（`*.BASE_DOMAIN` を許可）
- `ACCESS_TOKEN_EXPIRES_IN`: e.g. 15m
- `REFRESH_TOKEN_REUSE_GRACE_SECONDS`: リフレッシュトークン再利用検知の猶予秒数（default 8）
- `VITE_BACKEND_URL`（frontend, 本番ビルド時のみ）: フロントエンドが呼び出すバックエンドAPIのベースURL。開発環境はViteプロキシ経由でlocalhost:3000に転送するため不要

`.env` は VCS にコミットしない。本番環境では secrets manager を使用する。
