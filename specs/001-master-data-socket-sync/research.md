# Research: マスタデータ変更のSocket同期漏れ解消

## R1: カテゴリ・サブカテゴリ変更イベントの配信パターン（4-4）

**Decision**: `backend/src/routes/categories.ts`・`subcategories.ts`の`POST`/`PUT`/`DELETE`ハンドラに、既存`menus.ts`と同じパターンで`fastify.io.to(\`store:${request.storeId}\`).emit(...)`を追加する。イベント名は`category:created`/`category:updated`/`category:deleted`、`subCategory:created`/`subCategory:updated`/`subCategory:deleted`。

**Rationale**:
- `menus.ts`が既に`menu:created`/`menu:updated`/`menu:deleted`を同じ`store:${storeId}`ルームへemitしており、`categories.ts`/`subcategories.ts`だけがこのパターンから漏れている（指摘4-4の内容そのもの）。
- ペイロード形式も`menu:*`に倣う: 作成・更新は変更後のエンティティ全体、削除はID（`menu:deleted`が`menuItemId: number`のみを渡すパターンと同型）。

**Alternatives considered**: カテゴリ変更を既存の`menu:updated`に相乗りさせる（メニュー側の再取得を促す） — カテゴリ名・並び順の変更でメニュー自体は変わらないため、意味的に誤ったイベントを発火することになり不採用。

## R2: 品切れ変更を客用ゲストへ配信する経路（4-5）

**Decision**: 客用ゲスト専用の店舗共有ルーム`customer-store:${storeId}`を新設する。`group:join`ハンドラで、既存の`group:${groupId}`join成功時にあわせてこのルームにも自動joinさせる。`menus.ts`の`menu:soldout`emit箇所に、既存の`store:${storeId}`に加えて`customer-store:${storeId}`への配信を追加する。

**Rationale**:
- 既存のSocket.io room設計は「スタッフ＝`store:${storeId}`」「客用ゲスト＝`group:${groupId}`のみ」という明確な権限境界を持つ（`docs/api/websockets.md`、`backend/CLAUDE.md`）。客用ゲストを直接`store:${storeId}`ルームに参加させると、スタッフ限定の`order:*`/`group:*`/`session:updated`/`settings:updated`等の全イベントが客に露出し、指摘4-4/4-5のAssumptionsで明示的に禁止された設計（テナント・権限分離の維持）に反する。
- 新規ルーム`customer-store:${storeId}`は「客用ゲストが受信してよい店舗単位のイベント（現状は品切れ変更のみ）」専用の配信経路として分離することで、既存の権限境界を壊さずに新しい配信ニーズに対応できる。
- `group:join`は既に`group`が`socket.data.storeId`に属することを検証してから`join`しているため、同じ検証後に`customer-store:${storeId}`へのjoinを追加するだけで済み、新規の検証ロジックは不要。

**Alternatives considered**:
- 客用ゲストを`store:${storeId}`ルームに直接参加させる — 上記の理由で不採用（過剰な情報露出）。
- 品切れ変更のたびに、その店舗の全アクティブグループの`group:${groupId}`ルームへ個別emitする（アクティブグループ一覧をDBから取得） — 品切れ更新のたびに追加クエリが発生し、対象グループ数に比例してemit回数が増える。新規ルーム方式より複雑でパフォーマンス上も不利なため不採用。

## R3: `customer-store`ルームのクリーンアップ

**Decision**: 明示的な`leave`処理は追加しない。Socket.io接続の`disconnect`時に全room membershipは自動的にクリアされる既存動作に委ねる（`group:${groupId}`と同様）。

**Rationale**: 既存の`group:${groupId}`joinにも対応する明示的なleave処理はなく、disconnect時の自動クリーンアップに委ねる設計が既に確立されている。一貫性を優先し新しい概念を持ち込まない。

## R4: カテゴリ・サブカテゴリのペイロード形式

**Decision**: `Category`/`SubCategory`（`shared/types/index.ts`で定義済みの既存型）をそのままemitペイロードとする。DTO変換等の追加処理は不要（`categories.ts`/`subcategories.ts`のPrismaレスポンスは既にこの型と一致する形状）。

**Rationale**: `menus.ts`の`MenuItem`ペイロードも同様にPrismaモデルをそのまま返している。新しい変換層を追加する理由がない。

## R5: DBスキーマ変更の要否

**Decision**: スキーマ変更なし。

**Rationale**: 本フィーチャーは配信（Socket.io emit・room参加）の追加のみで、`Category`/`SubCategory`/`MenuItem`のデータモデル自体に変更はない。
