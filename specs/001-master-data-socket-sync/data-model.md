# Data Model: マスタデータ変更のSocket同期漏れ解消

スキーマ変更は発生しない（`backend/prisma/schema.prisma`は無変更）。既存エンティティとSocket.io room構成への追加のみを記録する。

## Category（既存: `shared/types/index.ts`）

`id`, `name`, `sort`。CRUD自体は変更なし。新規: `POST`/`PUT`/`DELETE`時に配信イベントを追加（下記「新規イベント」参照）。

## SubCategory（既存）

`id`, `categoryId`, `name`, `sort`。同上。

## MenuItem（既存、`soldOut`フィールドのみ関与）

変更なし。既存の`menu:soldout`イベントの配信先ルームを拡張する（新規`customer-store:${storeId}`を追加）。

## Socket.io Room構成（更新）

| Room | 参加者 | 用途（本フィーチャーでの変更） |
|---|---|---|
| `store:${storeId}` | 認証済みスタッフ（自動join） | 変更なし。カテゴリ・サブカテゴリの新規イベントもここに配信。 |
| `group:${groupId}` | 客用ゲスト（`group:join`で検証後join） | 変更なし。 |
| `customer-store:${storeId}`（新規） | 客用ゲスト（`group:join`成功時に自動join） | 新設。客用ゲストが受信してよい店舗単位イベント（現状は品切れ変更のみ）専用。 |
| `user:${userId}` | 認証済みスタッフ | 変更なし（本フィーチャー対象外）。 |

## 新規イベント（`shared/types/index.ts` `ServerToClientEvents`に追加）

| イベント | ペイロード | 配信先 | 発火箇所 |
|---|---|---|---|
| `category:created` | `Category` | `store:${storeId}` | `backend/src/routes/categories.ts` `POST /` |
| `category:updated` | `Category` | `store:${storeId}` | `categories.ts` `PUT /:id` |
| `category:deleted` | `categoryId: number` | `store:${storeId}` | `categories.ts` `DELETE /:id` |
| `subCategory:created` | `SubCategory` | `store:${storeId}` | `backend/src/routes/subcategories.ts` `POST /` |
| `subCategory:updated` | `SubCategory` | `store:${storeId}` | `subcategories.ts` `PUT /:id` |
| `subCategory:deleted` | `subCategoryId: number` | `store:${storeId}` | `subcategories.ts` `DELETE /:id` |

## 既存イベントの配信先拡張

| イベント | 変更前の配信先 | 変更後の配信先 | 発火箇所 |
|---|---|---|---|
| `menu:soldout` | `store:${storeId}` | `store:${storeId}` + `customer-store:${storeId}` | `backend/src/routes/menus.ts:203` |
