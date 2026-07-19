# Research: 会計・注文可否のサーバー側検証見直し

Phase 0 output. NEEDS CLARIFICATION は spec.md の `/speckit-clarify` セッションで解消済みのため、本ドキュメントは技術的な実装方針の調査結果のみを記録する。指摘5-1（未提供注文チェック）に関する調査（旧R1/R2）は001-state-transition-race-fixへ統合済みのため本ドキュメントからは削除した。

## R1: 飲み放題プラン部分受理（3-2）の実装パターン

**Decision**: `customer.ts` の `POST /orders` から `outOfPlan` チェック＋422全体拒否ブロック（219-236行目）を削除し、`orders.ts`（スタッフ用 `POST /`）が既に持つ `isPlanItem` 判定・0円化ロジック（`orders.ts:153-184`）と同じ考え方をそのまま適用する。customer.ts は `isTakeout` 概念を持たない（客用注文は常に店内注文）ため、`orders.ts` の `!isTakeout && ...` 部分は不要で、`planMenuItemIds?.has(item.menuItemId) ?? false` のみで判定する。既存の240-269行目のトランザクション構造・`isPlanItem` を使った価格計算（250-259行目）自体は変更しない。

**Rationale**: スタッフ用と客用で挙動を一致させるというユーザー確定方針（`/speckit-clarify` Q2）に直接対応する。既存の価格計算ロジック（`price: isPlanItem ? 0 : originalPrice`）は既にこの部分受理を前提に書かれており、削除するのは「全アイテムがプラン対象内であることを強制する事前バリデーション」のみで済む。実装差分が最小。

**Alternatives considered**: 全体拒否を維持しエラーメッセージのみ改善 — ユーザーが不採用と判断済み（Q2で部分受理を選択）。

## R2: `planMenuItemIds` のトランザクション内再取得要否

**Decision**: `customer.ts` の `POST /orders` において、`DrinkPlanItem` の取得（現状219-226行目、トランザクション開始前）はトランザクション内に移動しない。トランザクション開始前の取得を維持する。

**Rationale**:
- `docs/data-model/concurrency-notes.md` が要求する「トランザクション内再取得」は、取得した値を**書き込みデータとして使う**参照系エンティティ（例: `unapplyCourse` の `course.price` をそのまま `OrderItem.price` に書き込むケース）が対象。指摘2-3で問題視されたのも「古いコース価格スナップショットで課金額が確定してしまう」という**金額計算の正しさ**に関わるケースだった。
- `planMenuItemIds` は「0円化するかどうかの判定材料」であり、`DrinkPlanItem` の構成が注文の直前直後で変わったとしても、実際に書き込まれる金額は `originalPrice`（`MenuItem.price`、常にトランザクション内で取得済みの `menuItemMap` から取る）か `0` のいずれかで、どちらも安全な値である。トランザクション内で再取得しても判定結果が変わるタイミングウィンドウ（管理者がプラン構成をまさに同時編集している間）はごく稀であり、かつ結果が「0円になるはずが通常価格になる」または逆になる程度の誤差に留まり、コース価格スナップショット問題（2-3）のような二重課金・整合性崩壊には至らない。
- `orders.ts`（スタッフ用）は既にトランザクション内で `planMenuItemIds` を取得しているが（154-160行目）、これは同ファイル内で `currentGroup.drinkPlanId` もトランザクション内で再取得しているため、取得の起点となる `drinkPlanId` 自体の変化（コース解除等によるプラン変更）に対応するための設計であり、`DrinkPlanItem` 一覧のみを再取得する意図とは別。
- customer.ts 側も `drinkPlanId` はトランザクション外の `group`（113行目相当）ではなく、事前チェックの `group.drinkPlanId`（219行目）を使っている。もし `drinkPlanId` 自体の変化に対しても厳密性を求めるなら、`orders.ts` と同様にトランザクション内で `currentGroup.drinkPlanId` を再取得し、それを使って `DrinkPlanItem` を引き直す設計に揃えるべきだが、これは本機能（3-2の部分受理化）のスコープを超える別の整合性改善（`orders.ts` と `customer.ts` の対称性）であり、独立した論点として `docs/data-model/concurrency-notes.md` の対象候補にメモを残すに留め、本feature未実装とする。

**Alternatives considered**: `orders.ts` に完全に合わせてトランザクション内で `currentGroup.drinkPlanId` および `DrinkPlanItem` を再取得する — 一貫性の観点では望ましいが、customer.ts の既存トランザクション構造（`current.status` のみ再取得、242-246行目）に対する変更範囲が広がり、「触るべき箇所だけ触る」（影響最小化）原則との兼ね合いで今回は見送り、影響コメントとして記録するに留める。

## R3: フロントエンドの `DrinkPlanMismatch` エラー分岐

**Decision**: フロントエンド（`frontend/src/pages/customer/CustomerOrder/CustomerOrder.tsx`）は変更しない。

**Rationale**: `customer.orders.drink_plan_mismatch` は `CustomerOrder.tsx` のコード中で個別分岐されておらず（`grep` で該当箇所なし）、汎用エラートースト（`apiErrorMessage(e, t('customerOrder.orderFailed'))`）で処理されるのみ。バックエンドがこのエラーコードを返さなくなっても、フロントの動作に影響はない。`ErrorCodes.Customer.DrinkPlanMismatch` の定義自体は、他のAPIバージョンや将来の再利用に備えて `errors.ts` に残置し、本機能では削除しない（未使用エラーコードの削除は本機能のスコープ外の整理作業であり、「触るべき箇所だけ触る」原則に従い見送る）。

## R4: DBスキーマ変更の要否

**Decision**: スキーマ変更なし。

**Rationale**: 本機能は既存の `OrderItem.price` 計算ロジック（`isPlanItem ? 0 : originalPrice`）を、事前バリデーションを外すことで全ケースに適用させるのみ。新規カラム・新規テーブル・マイグレーションは不要。
