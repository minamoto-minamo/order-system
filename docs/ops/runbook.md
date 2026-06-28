# Runbook

## Purpose

開発・運用担当向けの起動手順と日常運用手順。

## Audience

開発者、運用担当

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

## 日常運用コマンド

```bash
# ヘルスチェック
curl -f http://localhost:3000/api/health
```
