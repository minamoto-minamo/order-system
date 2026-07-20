# backend/CLAUDE.md

Fastify + Socket.io + Prisma (PostgreSQL)。

## コマンド

```bash
# 開発サーバー
pnpm --filter backend dev    # tsx watch で起動（ファイル変更時に自動再起動）
pnpm --filter backend start  # ビルド済み dist/index.js を起動（本番相当の動作確認用）
pnpm --filter backend build  # TypeScript をコンパイルして dist/ に出力

# DB 操作
pnpm --filter backend db:generate  # schema.prisma から Prisma クライアントを再生成（スキーマ変更後に実行）
pnpm --filter backend db:migrate   # schema.prisma の差分から SQL ファイルを生成して DB に適用（開発用）
pnpm --filter backend db:deploy    # migrations/ 内の未適用 SQL を順番に適用（本番・ECS 用）
pnpm --filter backend db:studio    # Prisma Studio（GUI）を起動して DB の中身をブラウザで確認
pnpm --filter backend db:seed      # prisma/seed.ts を実行して初期データを投入

# 検証
pnpm --filter backend typecheck  # 型チェックのみ（コンパイル出力なし）
pnpm --filter backend test       # Jest でユニットテストを実行
```

## ディレクトリ構成

```txt
src/
├── index.ts          # エントリポイント。dotenv ロード → buildApp() 起動
├── app.ts            # Fastify インスタンス生成・プラグイン登録・ルート登録
├── plugins/
│   ├── auth.ts       # JWT 検証・アクセストークン失効時のリフレッシュトークンローテーション（fastify-jwt）
│   ├── cors.ts       # CORS 設定（BASE_DOMAIN env から動的に生成。*.BASE_DOMAIN を許可）
│   ├── store.ts      # Host からサブドメインを解決し storeId を request にセット
│   └── socket.ts     # Socket.io を同一 HTTP サーバーに載せる初期化。Host 解決と JWT 検証を個別に行う
├── routes/           # 1ファイル = 1リソース
│   ├── auth.ts           # POST /auth/login, /auth/logout, GET /auth/me（スタッフ用）
│   ├── platformAuth.ts   # POST /platform/auth/login, /platform/auth/logout, GET /platform/auth/me
│   ├── platformStores.ts # プラットフォーム管理者による店舗（Store）CRUD
│   ├── sessions.ts       # GET/POST /sessions, GET /sessions/current, GET /sessions/:id/report
│   ├── seats.ts          # GET/POST /seats, GET/PUT/DELETE /seats/:id
│   ├── seatLayout.ts     # GET/PUT /seat-layout（座席レイアウトのキャンバス・テーブル配置）
│   ├── groups.ts         # GET/POST /groups, GET/PUT /groups/:id, コース適用/解除
│   ├── orders.ts         # POST /orders, PUT /orders/:id/cancel（スタッフ用）
│   ├── customer.ts        # 客用ゲスト向け API（レート制限あり、JWT 認証なし。group:id で範囲を限定）
│   ├── menus.ts          # CRUD /menus
│   ├── categories.ts     # CRUD /categories
│   ├── subcategories.ts
│   ├── courses.ts        # CRUD /courses
│   ├── drinkPlans.ts     # CRUD /drink-plans
│   ├── settings.ts       # GET/PUT /settings
│   └── staff.ts          # GET/POST/PUT/DELETE /staff
├── lib/
│   ├── config.ts       # requireEnv(), getBaseDomain(), extractSubdomainLabel(), corsOriginValidator()
│   ├── store.ts        # resolveStoreContext(host) — サブドメインから store/platform/apex/unknown を判定
│   ├── mappers.ts      # Prisma モデル → 共有型への変換関数
│   ├── prisma.ts       # PrismaClient シングルトン
│   ├── errors.ts       # ErrorCodes 定義・errorBody()/sendError() ヘルパー（下記「エラーハンドリング」参照）
│   ├── refreshToken.ts # リフレッシュトークンの発行・検証・ローテーション（使い回し検知含む）
│   └── taxSetting.ts   # getTaxSettingOrThrow(storeId) — 店舗の税率設定取得の共通処理
├── services/ / ws/    # (予約ディレクトリ、現状未使用)
└── models/            # (予約ディレクトリ、現状未使用)
```

## Fastify 構成

- `index.ts` で HTTP サーバーを手動作成し `buildApp()` に渡す。Socket.io と HTTP サーバーを共有するため。
- プラグイン登録順: cors → store → socket → auth → routes。`store` が Host から `storeId` を解決して以降のフックに供給する。

## 状態変更エンドポイントのガード条件

同一リソースに対する複数の状態変更エンドポイント（作成・更新・削除・部分操作）は、ガード条件（ステータスチェック等）を横並びで揃える。1つのエンドポイントにガードを実装した後、別のエンドポイントへの追加を忘れやすい。

実例: `groups.ts` の `POST /:id/course` と `PUT /:id/course` は `group.status !== 'active'` を検査するが、`DELETE /:id/course` にはこのチェックが漏れていた。結果、会計後（`closed`/`bill_requested`）のグループでもコース解除ができ、料金の遡及書き換えが可能になっていた。

新しいエンドポイントを追加・変更する際は、同一リソースの既存エンドポイント（同ファイル内の他メソッド）のガード条件を先に洗い出し、揃っているか確認する。

## マルチテナンシー

- 店舗は Host のサブドメインで識別する（例: `xxx.BASE_DOMAIN`）。`plugins/store.ts` の `onRequest` フックが `lib/store.ts` の `resolveStoreContext(host)` を呼び、店舗コンテキストの結果を `request.storeId` にセットする。
- `resolveStoreContext` の判定結果は4種類: `store`（通常店舗）/ `platform`（サブドメイン `admin`）/ `apex`（ベースドメインそのもの。`/api/health` 以外は 404）/ `unknown`（該当店舗なしまたは非アクティブ）。
- `platform` コンテキストは `/api/platform/*` 以外へのアクセスを 404 にし、`store` コンテキストは `/api/platform/*` へのアクセスを 404 にする。店舗系とプラットフォーム系のルートは Host の時点で完全に分離される。
- ルートハンドラ内で他店舗のデータに触れないよう、Prisma クエリは必ず `where: { storeId: request.storeId }` 等で絞り込む。

## 認証

3種類の認証が並存する。いずれも JWT（httpOnly cookie）で `plugins/auth.ts` が管理する。

- **スタッフ認証**: `POST /auth/login` → アクセストークン（`token` cookie、既定15分）を発行。`preHandler` グローバルフックで全ルートに適用（ログイン/ログアウト、`/api/health`、`/api/platform/*`、`/api/customer/*` は除外）。
  - アクセストークン失効時は `refresh_token` cookie（`lib/refreshToken.ts`）を使って透過的にローテーションし、新しいアクセストークンを発行し直す（使い回し検知＝再利用済みトークンでの再試行時はセッション全体を無効化）。
  - Host 由来の `storeId` と JWT 内の `storeId` が一致しない場合はトークン再生・誤用とみなし、cookie をクリアして 401 を返す。
  - admin 限定ルートは `{ preHandler: requireAdmin }` を追加（`plugins/auth.ts` からインポート）。
  - 認証確認: `GET /auth/me` → ユーザー情報を返す。
- **プラットフォーム管理者認証**: `POST /platform/auth/login` → `platform_token` cookie（既定8時間、リフレッシュなし）を発行。ルートは `requirePlatformAdmin` プリハンドラで個別に検証する（グローバルフック対象外）。
- **客用ゲスト**: 認証なし。`customer.ts` のルートは `group:id` で参照範囲を限定し、レート制限（1分60リクエスト）で保護する。

## エラーハンドリング

- `lib/errors.ts` の `ErrorCodes`（リソース別にネストした定数オブジェクト）でエラーコード文字列を一元管理する。新しいエラーケースを追加する際は既存リソースのグループに倣って追加する。
- レスポンスは `sendError(reply, statusCode, code, message, details?)` で返す。`errorBody()` はレスポンスボディ生成のみ（Socket.io の emit 等、`reply` を使わない場面で使用）。
- バリデーションエラー（Fastify JSON Schema）と未捕捉例外は `app.ts` の `setErrorHandler` が一括処理する。ルートハンドラ内で個別に try/catch する必要があるのは、分岐によってステータスコード・エラーコードを変える場合のみ。

## Prisma

- スキーマ: `prisma/schema.prisma`
- マイグレーション実行済み・シードデータ投入済み。
- Prisma モデルと共有型の変換は `lib/mappers.ts` に集約。ルートハンドラ内で直接整形しない。

## Socket.io

`plugins/socket.ts` で初期化。イベント型は `@order-system/shared` の `ServerToClientEvents` / `ClientToServerEvents` を使う。

| 方向            | イベント                          | 発火タイミング         |
| --------------- | --------------------------------- | ---------------------- |
| Server → Client | `order:created/updated/cancelled` | 注文 CRUD 時           |
| Server → Client | `group:created/updated`           | グループ CRUD 時       |
| Server → Client | `seat:updated`                    | 席更新時               |
| Server → Client | `menu:soldout`                    | 品切れ更新時           |
| Server → Client | `session:updated`                 | セッション開閉時       |
| Server → Client | `settings:updated`                | 設定更新時             |
| Client → Server | `order:complete` / `order:serve`  | キッチンからの状態変更 |
| Client → Server | `group:join`                      | 客用ゲスト接続が自グループの更新を受信するための join |

emit は各ルートハンドラ内で `fastify.io.to(room).emit(...)` を呼ぶ。認証済みスタッフは `store:${storeId}` ルームに自動 join するが、未認証の客用ゲスト接続は `group:join` で検証済みの `group:${groupId}` ルームにのみ join する。注文・グループ関連の emit は原則 `store` と `group` の両ルームへ配信する（`group:created` と `staff:called` は例外でスタッフのみ）。

認証済みスタッフは `user:${userId}` ルームにも自動 join する。`POST /auth/logout` はこのルームに対して `fastify.io.in(\`user:${userId}\`).disconnectSockets(true)` を呼び、同一ユーザーの全 Socket.io 接続を強制切断する（共有端末でログアウト後も操作が継続できてしまう問題への対策）。
