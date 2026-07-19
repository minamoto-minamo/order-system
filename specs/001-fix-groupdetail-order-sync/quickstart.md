# Quickstart: GroupDetailの初期ロードとSocketイベントの競合による注文消失を修正する

本フィーチャーの完了確認は主にユニットテストで行う（純粋関数`applyQueuedOrderEvents`の入出力検証）。加えて、実際のブラウザ操作で手動確認する手順を以下に示す。

## 前提

- `pnpm setup` 済み、`env/backend.env` / `env/frontend.env` が設定済み。
- `pnpm --filter backend db:migrate` / `pnpm --filter backend db:seed` 実行済み。

## 1. ユニットテスト（自動）

```bash
pnpm --filter frontend test -- applyQueuedOrderEvents
```

`frontend/src/__tests__/applyQueuedOrderEvents.test.ts` が以下を検証する（詳細は tasks.md 参照）:
- REST スナップショットに存在しない`created`イベントの注文が追加される。
- 既にRESTスナップショットに含まれる同一idの`created`イベントは重複追加されない。
- `updated`イベントが対象idの内容を置換する。
- `cancelled`イベントが対象idのstatusを`'cancelled'`にする。
- 複数イベントが受信順に適用される（例: 同一idへの`created`→`updated`が正しく反映される）。

## 2. 手動確認（2クライアントでの競合再現）

**Given** ホールスタッフ用アカウントで2つのブラウザセッション（クライアントA・B）を用意し、両方で同一グループのGroupDetail画面（`/groups/:id`相当）を開ける状態にする。

1. `pnpm dev` でfrontend/backendを起動する。
2. クライアントAでグループ詳細画面を開く。
3. クライアントAのブラウザのDevToolsでネットワークをオフラインに切り替え、数秒後に再度オンラインに戻す（Socket再接続を発生させる）。
4. オフライン→オンライン復帰の間（再接続処理が進行中とみられるタイミング）に、クライアントBから同じグループへ新規注文を1件追加する。
5. クライアントAの画面に、手順4で追加した注文がステップ完了後も表示され続けていることを確認する（**期待結果**: 消えない。修正前は消えることがある）。
6. 続けてクライアントBから、手順4で追加した注文のステータスを変更する（例: 提供済みにする）。
7. クライアントAの画面で、その注文のステータス表示が更新されることを確認する。

## 3. 回帰確認

```bash
pnpm --filter frontend typecheck
pnpm --filter frontend test
pnpm lint
```

すべて成功すること。既存のGroupDetail関連テスト（`frontend/src/__tests__/groupDetailOrderHistory.test.tsx`等）に回帰がないことを確認する。
