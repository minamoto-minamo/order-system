# Research: セキュリティ境界の強化（CORS越境許可・レート制限のプロキシ配下対応）

## R1: クロスサブドメイン呼び出しの実在有無（1-1）

**Decision**: 現状のフロントエンドコードに、あるサブドメインから別サブドメインのAPIへ認証情報付きでアクセスするケースは存在しない。Host一致判定への変更は既存機能を壊さない。

**Rationale**: `frontend/src/lib/api.ts`は`BASE = (import.meta.env.VITE_BACKEND_URL ?? '') + '/api'`で、`VITE_BACKEND_URL`は本番ビルド時に自ホストのURLを指す想定（`env/frontend.env`）。フロントエンド全体を`grep`した結果、絶対URLでの`fetch`呼び出しやcrossサブドメイン宛のリクエストは見つからなかった。`credentials`を使用するのは`frontend/src/lib/api.ts`（同一オリジンAPI呼び出し）と`backend/src/plugins/cors.ts`（CORS設定自体）のみ。

**Alternatives considered**: なし（調査結果がAssumptionsの前提を裏付けたため代替案の検討は不要）。

## R2: Host一致判定の実装方法（1-1）

**Decision**: `corsOriginValidator`の判定に、Originのホスト名から抽出したテナント種別（`store`/`platform`/`apex`/`unknown`）と、リクエストのHostヘッダーから`lib/store.ts`の`resolveStoreContext`と同じロジックで解決したテナント種別を比較する。両者が一致する場合のみ許可する。判定ロジックは`extractSubdomainLabel`を再利用し、`resolveStoreContext`のようなDB問い合わせ（店舗の存在・アクティブ確認）は行わない（サブドメインラベルの文字列一致で十分。存在しない店舗のサブドメインからのOriginは、後続の`store`プラグインが`storeId`を解決できず`unknown`として404になるため、CORS層でDB問い合わせを追加する必要はない）。

**Rationale**: `backend/CLAUDE.md`に記載のプラグイン登録順は「cors → store → socket → auth → routes」。CORSプラグインは`store`プラグインより先に登録されるため、`request.storeId`はCORS判定時点では未確定。よってCORS層では`resolveStoreContext`をそのまま呼ぶのではなく、軽量な文字列比較（Originのホスト名からのラベル抽出とHostヘッダーからのラベル抽出を比較）で完結させる。

**要検証（実装時）**: `@fastify/cors`（`^10.0.0`）の`origin`オプションに関数を渡す場合のコールバックシグネチャが`(origin, callback)`のみか、リクエスト情報（Hostヘッダー）にアクセスできる拡張シグネチャをサポートするかは、インストール済みパッケージの型定義（`node_modules/@fastify/cors`）で実装時に確認する。アクセスできない場合は、`@fastify/cors`の使用をやめ、`corsPlugin`内で`onRequest`フックとして自前のCORS処理（Origin検証・`Access-Control-Allow-*`ヘッダー設定・プリフライト`OPTIONS`応答）に置き換える。既存の`credentials: true`相当の`Access-Control-Allow-Credentials: true`ヘッダー、および許可時の`Access-Control-Allow-Origin`（リクエストのOriginをそのまま返す、ワイルドカード不可）は維持する。

**Alternatives considered**: CORSプラグインを`store`プラグインより後に登録し直し`request.storeId`を参照する — プラグイン登録順の変更は`store`が`storeId`解決の起点として他の複数プラグイン（`socket`、`auth`）の前提になっており、影響範囲が本フィーチャーのスコープ（CORS判定のみ）を超えるため不採用。

## R3: レート制限のプロキシ配下対応（1-2）

**Decision**: `backend/src/app.ts`の`Fastify({ logger: true })`に`trustProxy: true`を追加する。開発・本番で条件分岐はしない。

**Rationale**: `trustProxy: true`は、`X-Forwarded-For`ヘッダーが存在する場合のみそれを`request.ip`の解決に使う。開発環境（直接接続、プロキシなし、ヘッダーなし）では、ヘッダーが送られてこないため`request.ip`は従来どおりソケットの接続元IPになり、挙動は変わらない（FR-005の回帰なし要件を満たす）。ECS環境では、ALB/NLBが`X-Forwarded-For`を正しく設定するため、`trustProxy: true`だけで実際のクライアントIPを解決できる。本番でのみ有効化する条件分岐（`NODE_ENV === 'production'`）は、開発環境でプロキシ経由の動作を確認したい場合に対応できず、かつ`trustProxy: true`自体が開発環境で副作用を持たないため不要と判断する。

**Alternatives considered**: 信頼するプロキシのIPレンジを`trustProxy`に明示指定する（例: ECSのVPC CIDR）— ECS環境のネットワーク構成（VPC CIDR、ALBの配置）は本フィーチャーの外部情報であり、環境変数化するとインフラ側の追加設定が必要になる。`trustProxy: true`（Fastifyインスタンスへの直接到達を防ぐのはインフラ側の責務、ALB配下でのみ稼働する前提は既存のAssumptionsで明記済み）で十分と判断し、シンプル第一の原則により不採用。

## R4: 監査ログ用ipAddressとの整合（Edge Cases）

**Decision**: `backend/src/routes/auth.ts:74`の`ipAddress: request.ip`は変更不要。`trustProxy: true`により`request.ip`自体がプロキシ配下で正しいクライアントIPを返すようになるため、レート制限（`keyGenerator: (req) => req.ip`）と監査ログ（`ipAddress: request.ip`）は同じ`request.ip`を参照しており、自然に同じ解決方法に揃う。

**Rationale**: 両者とも`request.ip`を参照している既存実装のため、`trustProxy`設定の変更だけで両方に反映される。追加のコード変更は不要。

**Alternatives considered**: なし。

## R5: DBスキーマ変更の要否

**Decision**: スキーマ変更なし。

**Rationale**: 本機能はCORS設定とFastifyインスタンス設定（`trustProxy`）の変更のみで、データモデルへの影響はない。
