---
type: Index
title: データモデル ドキュメント一覧
description: order-system のデータモデル関連ドキュメントの目次。
tags: [data-model, index]
---

# データモデル ドキュメント

order-system のドメインモデル・スキーマ・会計・マイグレーションに関するドキュメント一覧。実装の一次ソースは [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma)。

- [データモデル概要](overview.md) — 主要モデル・リレーション・マルチテナンシー方針と ER 図
- [Prisma スキーマ要約](prisma-summary.md) — モデル別のフィールド・インデックス・カスケード規則
- [会計・売上集計の設計ノート](accounting-notes.md) — 金額の保持方法・税率スナップショット・集計方針
- [並行処理・トランザクション設計ノート](concurrency-notes.md) — check-then-act回避・compare-and-swapパターン
- [Prisma マイグレーション運用](migrations.md) — マイグレーション適用手順・ロールバック方針
