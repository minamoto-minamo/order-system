---
type: Notes
title: 並行処理・トランザクション設計ノート
description: 状態遷移を伴うAPI実装における競合状態（race condition）の防止方針。
resource: ../../backend/prisma/schema.prisma
tags: [concurrency, transaction, race-condition]
---

# 並行処理・トランザクション設計ノート

複数クライアントの同時操作（Socket.io経由を含む）による競合状態を防ぐための設計上の注意点をまとめる。

## check-then-actを避ける

状態を確認するクエリ（`findFirst`等）と状態を書き換えるクエリ（`update`等）を分離した実装は、確認と書き込みの間に他のリクエストが割り込むレースコンディションを防げない。

- 確認と書き込みは同一のSerializableトランザクション内で行う（`prisma.$transaction`、トランザクション内で再度対象行を取得・検証してから更新する）
- 参照系エンティティ（Course/DrinkPlan等）の値を書き込みに使う場合も、トランザクション開始前に取得した値をそのまま使い回さず、トランザクション内で再取得する
- 対象行数を確認する compare-and-swap パターン（`updateMany({ where: { id, status: '...' } })` で `count` を見る）も選択肢。ロック取得のコストを避けたい場合はこちらを優先する

## 参考実装

- Serializableトランザクション内での再検証: `backend/src/routes/orders.ts` の `PUT /:id/cancel`
- compare-and-swap: `backend/src/lib/refreshToken.ts` の `rotateRefreshToken`
- 参照系エンティティのトランザクション内再取得: `backend/src/routes/groups.ts` の `unapplyCourse`

## Socket.ioハンドラも対象

`backend/src/plugins/socket.ts` のイベントハンドラ（`order:complete`/`order:serve`等）もHTTPエンドポイントと同様、状態変更を伴うものは上記のガードを適用する。REST APIのみを保護してSocket.io側を素通しにしない。
