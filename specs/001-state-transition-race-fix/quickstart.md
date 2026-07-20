# Quickstart: 状態変更エンドポイントのレースコンディションをトランザクション内再検証で解消する

外部インターフェース（エンドポイントURL、Socket.ioイベント名、リクエスト/レスポンス形状）は変更しない。この文書は実装後に「競合が解消されたこと」と「通常時の回帰がないこと」を確認する手順を示す。詳細な状態遷移条件は[data-model.md](./data-model.md)、実装方針は[research.md](./research.md)を参照。

## 前提

```bash
pnpm setup
pnpm --filter backend db:migrate
pnpm --filter backend db:seed
pnpm dev   # frontend + backend
```

## 1. ユニットテストで競合シナリオを検証する

```bash
pnpm --filter backend test
```

各対象関数について、以下のシナリオがテストされていることを確認する（[research.md](./research.md) Decision 5参照）。

- 会計依頼: 事前チェック通過後に対象グループが`closed`へ変化していた場合、`prisma.group.updateMany`のCAS条件（`status: 'active'`）に一致せず`count === 0`となり、グループが`bill_requested`に書き換わらないこと。
- `order:complete`/`order:serve`: 事前条件を満たしていても、`updateMany`のCAS条件（ステータス・グループ/セッション非`closed`）に一致しなければ更新が発生せず、`order:updated`イベントも発火しないこと。
- コース適用/人数変更: トランザクション内で再取得した`Course`/`DrinkPlan`が、トランザクション開始前に取得した値と異なる場合、生成・更新される`OrderItem`が再取得後の値（新しい価格・構成）を反映していること。

## 2. 手動での競合再現（任意、開発環境）

Prisma Studio（`pnpm --filter backend db:studio`）またはAPIクライアントを2つ用意し、以下を素早く連続実行して競合を再現できる。

- **会計依頼 vs 会計確定**: あるグループに対して (a) `POST /api/customer/groups/:id/bill` と (b) スタッフ側の会計確定操作（`PUT /groups/:id`でstatusを`closed`へ）をほぼ同時に実行する。実装後は、(b)が先にコミットした場合、(a)は成功してもグループが`closed`のまま維持される（または(a)がエラーになる）ことを確認する。
- **提供完了 vs キャンセル**: ある`pending`の注文明細に対して、キッチン端末で「調理完了」、ホール/レジで「キャンセル」をほぼ同時に操作する。実装後は、キャンセルが先にコミットした場合、明細は`cancelled`のまま維持され、`ready`へ復活しないことを確認する。
- **コース適用 vs コース編集**: 店舗管理者がコースの価格を変更する操作と、ホールスタッフが同コースをテーブルへ適用する操作をほぼ同時に実行する。実装後は、適用処理が完了時点の価格で明細を作成することを確認する（Prisma Studioで`OrderItem.price`を確認）。

## 3. 回帰確認（通常時）

競合が発生しない通常操作について、既存の挙動と差異がないことを確認する。

```bash
pnpm --filter backend typecheck
pnpm --filter backend test
pnpm test:e2e   # 既存のE2Eスイートに回帰がないことを確認（新規E2Eは追加しない）
```

- 会計依頼が成功時に`group:updated`イベントを配信すること。
- `order:complete`/`order:serve`が成功時に`order:updated`イベントを配信すること。
- コース適用・人数変更が成功時に、既存と同じ内容の`OrderItem`・`Group`を返すこと。
