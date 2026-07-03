---
type: Runbook
title: Runbook
description: ローカル開発の起動手順と日常運用手順。開発者・運用担当向け。
tags: [ops, runbook, development, operations]
---

# Runbook

開発・運用担当向けの起動手順と日常運用手順をまとめる。

## ローカル開発

前提として PostgreSQL がローカルにインストール済みであること。`env/backend.env` の `DATABASE_URL` / `BASE_DOMAIN` に接続先を設定しておく。環境変数の詳細は [Env Reference](env.md) を参照。

初回セットアップ:

```bash
pnpm install
pnpm setup                        # env ファイル生成・JWT_SECRET 自動生成
pnpm --filter backend db:migrate  # マイグレーション実行
pnpm --filter backend db:seed     # 初期データ投入（store1 / store2 の2店舗分 + platform admin）
```

起動:

```bash
pnpm dev   # backend: http://localhost:3000
```

マルチテナント化により、フロントエンドはサブドメイン経由でアクセスする（`BASE_DOMAIN=localhost` の場合）。

- 店舗（テナント）: `http://store1.localhost:5173`、`http://store2.localhost:5173`
- プラットフォーム管理者（予約サブドメイン `admin`）: `http://admin.localhost:5173`

詳細は [Platform エンドポイント](../api/endpoints/platform.md) を参照。

## `*.localhost` の名前解決について

- ブラウザ（Chrome / Edge 等）は RFC 6761 に従い `*.localhost` を OS の DNS 設定や `/etc/hosts` に頼らず自前でループバック解決する。そのため手動でのブラウザ確認では `/etc/hosts` への追記は不要。
- 一方、Node.js の `dns.lookup`（Playwright の `page.request.get()` 等が内部で使う）はこの特別扱いをせず OS 側の名前解決に委ねる。WSL2 環境の glibc 側リゾルバは `.localhost` を特別扱いしないため、`pnpm test:e2e` 等 Node 経由で新しいサブドメイン（新規店舗作成時など）へアクセスする場合は `/etc/hosts` への追記が必要。
- e2e テストは spec ファイルごとではなく **Playwright worker ごと**に固定サブドメイン名（`e2e-worker${parallelIndex}`）でテスト専用店舗を動的作成・削除する（`e2e/helpers/testWithStore.ts` 参照）。ランダム生成名だと事前登録できないため固定名にしているが、worker 単位にすることで `/etc/hosts` の必要件数は spec ファイル数ではなく `playwright.config.ts` の `workers` 設定値に比例する。同一 worker 内では spec ファイルが順番に実行される（前の spec の `afterAll` が完了してから次の spec の `beforeAll` が走る）ため、同じ worker 番号の名前を使い回しても衝突しない。
- `s11-multi-tenant-isolation.spec.ts` のみ、店舗間分離を検証するため 1 worker あたり 3 店舗（`-a` / `-b` / `-c` サフィックス）を必要とする。加えて「DB上に存在しないサブドメインへのアクセスは404になる」ことを検証するテストのため、`nosuchstore.localhost`（DNS解決だけできればよく、DB側に店舗を作る必要はないので worker 番号非依存の固定名）も必要。
- 現在の設定は `workers: 1` なので、`pnpm test:e2e` を実行する前に以下を `/etc/hosts` に追記しておくこと。

  ```
  127.0.0.1 store1.localhost
  127.0.0.1 store2.localhost
  127.0.0.1 admin.localhost
  127.0.0.1 e2e-worker0.localhost
  127.0.0.1 e2e-worker0-a.localhost
  127.0.0.1 e2e-worker0-b.localhost
  127.0.0.1 e2e-worker0-c.localhost
  127.0.0.1 nosuchstore.localhost
  ```

- `playwright.config.ts` の `workers` を N に増やす場合は、`e2e-worker0` 〜 `e2e-worker(N-1)` および各 `-a`/`-b`/`-c` サフィックスの分だけ追記する。
- 本番環境では `BASE_DOMAIN` にワイルドカード DNS レコード（`*.example.com`）を設定するため、店舗追加時にインフラ側の追記作業は不要。

## 日常運用コマンド

```bash
# ヘルスチェック
curl -f http://localhost:3000/api/health
```

## ログ・エラートラッキング

- 現状、ログは pino による stdout 出力のみで、Sentry 等の外部エラートラッキング・ログ集約サービスとの連携はない。
- そのため本番で例外が発生しても、ユーザーからの申告や手動でのログ確認まで気づけない。障害調査は事後的にホスト上の stdout ログを遡る形になる。
- TODO: Sentry 等を導入する場合は `backend/src/app.ts` の `setErrorHandler` から通知を送る形で連携する。導入時期・サービス選定は未定。
