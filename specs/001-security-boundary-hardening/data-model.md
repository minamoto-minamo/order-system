# Data Model: セキュリティ境界の強化（CORS越境許可・レート制限のプロキシ配下対応）

本機能はスキーマ変更を伴わない（[research.md](research.md) R5参照）。新規永続エンティティはない。判定に使う概念のみ記録する。

## Origin判定コンテキスト（永続化しない、リクエストごとに解決）

| 項目 | 由来 | 判定での扱い |
|---|---|---|
| Originテナント種別 | リクエストの`Origin`ヘッダーのホスト名を`extractSubdomainLabel`で解析（`store`/`platform`/`apex`/`unknown`相当） | CORS許可判定の入力の一方 |
| Hostテナント種別 | リクエストの`Host`ヘッダーを同じロジックで解析 | CORS許可判定の入力のもう一方 |
| 判定結果 | 両者のテナント種別（サブドメインラベル）が一致するか | 一致すれば許可、不一致・`Origin`ヘッダーなしは既存どおり許可、それ以外の不一致は拒否 |

## クライアントIP（永続化は既存のまま、解決方法のみ変更）

| フィールド | 所属 | 本機能での扱い |
|---|---|---|
| `request.ip`（Fastify組み込み） | リクエストごとに解決される値、DBに永続化されない | `trustProxy: true`設定により、`X-Forwarded-For`が存在する場合はそれを、存在しない場合はソケットの接続元IPを使う（変更なし） |
| `RefreshToken.ipAddress`（既存カラム、`backend/prisma/schema.prisma`） | DBに永続化 | 書き込み元は`request.ip`のまま変更なし。`trustProxy`設定により書き込まれる値の精度が向上する（research.md R4） |
