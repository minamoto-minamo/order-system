---
type: Migration Log
title: Prisma マイグレーション運用
description: ローカル・本番でのマイグレーション適用手順、ロールバック方針、注意点。
resource: ../../backend/prisma/schema.prisma
tags: [migration, prisma, ops, deployment]
---

# Prisma マイグレーション運用

Prisma マイグレーションの運用手順と注意点。スキーマ定義は [prisma-summary.md](prisma-summary.md) を参照する。

## ローカル / 開発

- schema 変更後: `pnpm --filter backend db:migrate` を実行してローカルを更新する。
- マイグレーションは必ずレビューを経て main へマージする。

## ステージング / 本番

- CI で `prisma migrate deploy` を実行してマイグレーションを適用する。
- 事前にバックアップ（スナップショット）を取る。
- 破壊的変更は段階的に行い、トラフィックが低い時間帯を選定する。

## ロールバック

Prisma は自動ローリングバックを提供しない。マイグレーション適用が途中で失敗した場合は以下の手順で対応する。

1. `pnpm --filter backend db:deploy` の実行結果、または `prisma migrate status` で `_prisma_migrations` テーブルの適用状態を確認する。`failed` 状態のマイグレーションがあれば手順2以降に進む。
2. DB に一部だけ適用された変更が残っていないか確認する（失敗したマイグレーション SQL のどこまでが実行済みかを見る）。
3. 手動で巻き戻せる場合: 該当スキーマ変更を手動 SQL で戻し、`prisma migrate resolve --rolled-back <migration_name>` を実行して未適用としてマークする。
4. 手動修正で解決済みの場合: `prisma migrate resolve --applied <migration_name>` を実行して適用済みとしてマークし、`prisma migrate deploy` を再実行する。
5. 手動での巻き戻しが困難、または判断がつかない場合は、マイグレーション前に取得したバックアップから DB を復元する（[Backup and Restore](../ops/backup-and-restore.md)）。

## 注意点

- マイグレーションはスキーマだけでなく、既存データの移行スクリプトを含めること。
- `DATABASE_URL` の取り扱いに注意する（環境ごとに別設定）。デプロイ手順は [runbook](../ops/runbook.md)、環境変数は [env](../ops/env.md) を参照する。
