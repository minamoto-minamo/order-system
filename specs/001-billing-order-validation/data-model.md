# Data Model: 会計・注文可否のサーバー側検証見直し

本機能はスキーマ変更を伴わない（[research.md](research.md) R4参照）。既存エンティティのうち、本機能（3-2: 飲み放題プラン部分受理）が扱う部分のみを記録する。指摘5-1（未提供注文チェック）関連のGroup状態遷移ルール・新規エラーコードは001-state-transition-race-fixへ統合済みのため本ドキュメントからは削除した。

## OrderItem（既存: `backend/prisma/schema.prisma`）

| フィールド | 型 | 本機能での扱い |
|---|---|---|
| `price` | `Int` | 客用注文作成時、飲み放題プラン対象商品は `0`、対象外商品は `originalPrice` をそのまま使う（**変更なし**、既存ロジックを維持。全体拒否の削除により、この価格計算ロジックがすべてのケースで実行されるようになる）。 |

## DrinkPlan / DrinkPlanItem（既存）

変更なし。`customer.ts` の `POST /orders` における `DrinkPlanItem` からの対象商品集合（`planMenuItemIds`）の取得方法（トランザクション外での事前取得を維持）は [research.md R2](research.md#r2-planmenuitemids-のトランザクション内再取得要否) を参照。

## 削除されるロジック（新規エンティティ・フィールドではないが記録）

- `customer.ts` `POST /orders` の `outOfPlan` チェック＋ `422 DrinkPlanMismatch` 全体拒否ブロック（該当箇所は削除。エラーコード定義自体は `errors.ts` に残置、[research.md R3](research.md#r3-フロントエンドのdrinkplanmismatchエラー分岐) 参照）。
