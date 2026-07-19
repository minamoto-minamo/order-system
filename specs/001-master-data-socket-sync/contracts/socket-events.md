# Socket.io契約変更: マスタデータ変更のSocket同期漏れ解消

`shared/types/index.ts`の`ServerToClientEvents`への追加。HTTPエンドポイントのリクエスト/レスポンス形状の変更はない。

## 新規イベント（`ServerToClientEvents`）

```ts
'category:created': (category: Category) => void
'category:updated': (category: Category) => void
'category:deleted': (categoryId: number) => void
'subCategory:created': (subCategory: SubCategory) => void
'subCategory:updated': (subCategory: SubCategory) => void
'subCategory:deleted': (subCategoryId: number) => void
```

配信先: `store:${storeId}`（既存の`menu:*`と同一パターン）。

## 既存イベントの配信先拡張

`menu:soldout`（型定義は変更なし）を、既存の`store:${storeId}`に加えて新規`customer-store:${storeId}`ルームにも配信する。

## Room参加の追加

`group:join`（`ClientToServerEvents`、型定義は変更なし）のサーバー側ハンドラ実装を変更する。既存の`group:${groupId}`join検証成功時に、あわせて`customer-store:${socket.data.storeId}`へもjoinさせる。クライアント側の呼び出し方・ペイロードに変更はない。

## 影響を受けないイベント

`order:*`, `group:created`/`updated`, `seat:*`, `course:*`, `drinkPlan:*`, `seatLayout:updated`, `session:updated`, `settings:updated`, `staff:called`, `order:complete`/`order:serve` は本フィーチャーの対象外で変更なし。
