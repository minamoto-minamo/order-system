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

- Prisma は自動ローリングバックを提供しない。ロールバック手順を用意する（マイグレーション前の DB バックアップを復元）。

## 注意点

- マイグレーションはスキーマだけでなく、既存データの移行スクリプトを含めること。
- `DATABASE_URL` の取り扱いに注意する（環境ごとに別設定）。デプロイ手順は [runbook](../ops/runbook.md)、環境変数は [env](../ops/env.md) を参照する。
