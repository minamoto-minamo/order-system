# Quickstart: Socket.io切断・エラー通知の一貫性

外部インターフェース（HTTPエンドポイントURL・レスポンス形状、Socket.ioイベント名・ペイロード形状）は変更しない。既存の`error`イベント・`ApiErrorPayload`・`disconnectSockets`メカニズムをそのまま使う。この文書は実装後に「ガード違反時にクライアントへ通知が届くこと」「店舗無効化時に既存接続が切断されること」「通常時に回帰がないこと」を確認する手順を示す。詳細な対象範囲は[data-model.md](./data-model.md)、実装方針は[research.md](./research.md)を参照。

## 前提

```bash
pnpm setup
pnpm --filter backend db:migrate
pnpm --filter backend db:seed
pnpm dev   # frontend + backend
```

## 1. ユニットテストでガード違反通知・強制切断を検証する

```bash
pnpm --filter backend test
```

以下のシナリオがテストされていることを確認する（[research.md](./research.md) Decision 3参照）。

- `order:complete`/`order:serve`: ガード違反（ステータス不一致、グループ/セッション`closed`）時に`socket.emit('error', ...)`が`ErrorCodes.Socket.OrderCompleteRejected`/`OrderServeRejected`付きで呼ばれること。正常系では呼ばれないこと。
- `platformStores.ts` `PUT /:id`: `isActive: false`への更新で`fastify.io.in('store:{id}').disconnectSockets(true)`が呼ばれること。`isActive: true`への更新・`isActive`を含まない更新では呼ばれないこと。
- `platformStores.ts` `DELETE /:id`: 削除処理でも同じ強制切断が呼ばれること。

## 2. 手動での動作確認（任意、開発環境）

2つのキッチン端末（ブラウザタブ）でホール画面にログインし、同一注文明細に対してほぼ同時に「調理完了」を操作する。後着の端末側にトースト通知（例:「操作を反映できませんでした。画面を更新してください」）が表示されることを確認する。先着の端末側には`order:updated`が届き、通常通り画面が更新されることを確認する。

プラットフォーム管理者画面（`admin.<BASE_DOMAIN>`）から任意の店舗を無効化し、その店舗にログイン中のスタッフ端末（別ブラウザ/別タブ）が直後に切断され、再接続もハンドシェイクで拒否される（ログイン画面等へのリダイレクトが発生する）ことを確認する。同時に、無効化していない別店舗のスタッフ端末が影響を受けないことを確認する。

## 3. 回帰確認（通常時）

```bash
pnpm --filter backend typecheck
pnpm --filter backend test
pnpm test:e2e   # 既存のE2Eスイートに回帰がないことを確認（新規E2Eは追加しない）
```

- ガード違反が発生しない通常の「調理完了」「提供完了」操作が、現状と同じ成功時レスポンス・`order:updated`通知を返すこと。
- 店舗の有効化・名称変更等、`isActive`を`false`にしない更新操作でスタッフ端末が切断されないこと。
