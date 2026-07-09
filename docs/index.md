---
type: Index
title: order-system ドキュメント
description: order-system のドキュメント全体の入口。screens / api / data-model / ops / frontend の5領域を管理する。
tags: [index]
---

order-system のドキュメント全体の入口。Open Knowledge Format (OKF) に準拠し、各ファイルは1コンセプトを表す Markdown（YAML front matter + 本文）として管理する。

- [画面仕様](screens/index.md) — 画面ごとの目的・UI要素・アクション・連携API/Socketイベントを1画面＝1ファイルで管理する。
- [API ドキュメント](api/index.md) — REST API 全体仕様、エンドポイント一覧、WebSocket イベントを格納する。
- [データモデル](data-model/index.md) — DB スキーマ（Prisma）の解説、ER図、主要モデル説明、会計・集計・マイグレーションに関する注意点を格納する。
- [運用](ops/index.md) — 起動手順、環境変数一覧、デプロイ手順、Runbook、バックアップ/復旧手順を格納する。
- [Frontend ガイド](frontend/index.md) — レイアウト（基底ページ）と共通コンポーネントの推奨利用場面を格納する。

## 運用上の注意

- 各ファイルの front matter には `type` を必須で設定する。他コンセプトへの参照は Markdown リンクで行う。
- ドキュメントの削除・移動は PR で管理することを推奨する。
