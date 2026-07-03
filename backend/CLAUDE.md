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
│   ├── auth.ts       # JWT 検証プラグイン（fastify-jwt）
│   ├── cors.ts       # CORS 設定（BASE_DOMAIN env から動的に生成。*.BASE_DOMAIN を許可）
│   ├── store.ts      # Host からサブドメインを解決し storeId を request にセット
│   └── socket.ts     # Socket.io を同一 HTTP サーバーに載せる初期化
├── routes/           # 1ファイル = 1リソース
│   ├── auth.ts       # POST /auth/login, GET /auth/me
│   ├── sessions.ts   # GET/POST /sessions, GET /sessions/current, GET /sessions/:id/report
│   ├── seats.ts      # GET/POST /seats, GET/PUT/DELETE /seats/:id
│   ├── groups.ts     # GET/POST /groups, GET/PUT /groups/:id
│   ├── orders.ts     # POST /orders, PUT /orders/:id/cancel
│   ├── menus.ts      # CRUD /menus
│   ├── categories.ts # CRUD /categories
│   ├── subcategories.ts
│   ├── courses.ts    # CRUD /courses
│   ├── drinkPlans.ts # CRUD /drink-plans
│   ├── settings.ts   # GET/PUT /settings
│   ├── staff.ts      # GET/POST/PUT/DELETE /staff
│   └── seatTables.ts # GET/POST/PUT/DELETE /seat-tables
├── lib/
│   ├── config.ts     # requireEnv(), getBaseDomain(), extractSubdomainLabel(), corsOriginValidator()
│   ├── store.ts      # resolveStoreContext(host) — サブドメインから store/platform/apex/unknown を判定
│   ├── mappers.ts    # Prisma モデル → 共有型への変換関数
│   └── prisma.ts     # PrismaClient シングルトン
└── models/           # (予約ディレクトリ)
```

## Fastify 構成

- `index.ts` で HTTP サーバーを手動作成し `buildApp()` に渡す。Socket.io と HTTP サーバーを共有するため。
- プラグイン登録順: cors → store → socket → auth → routes。`store` が Host から `storeId` を解決して以降のフックに供給する。

## 状態変更エンドポイントのガード条件

同一リソースに対する複数の状態変更エンドポイント（作成・更新・削除・部分操作）は、ガード条件（ステータスチェック等）を横並びで揃える。1つのエンドポイントにガードを実装した後、別のエンドポイントへの追加を忘れやすい。

実例: `groups.ts` の `POST /:id/course` と `PUT /:id/course` は `group.status !== 'active'` を検査するが、`DELETE /:id/course` にはこのチェックが漏れていた。結果、会計後（`closed`/`bill_requested`）のグループでもコース解除ができ、料金の遡及書き換えが可能になっていた。

新しいエンドポイントを追加・変更する際は、同一リソースの既存エンドポイント（同ファイル内の他メソッド）のガード条件を先に洗い出し、揃っているか確認する。

## 認証

- JWT（httpOnly cookie）。`plugins/auth.ts` で管理。
- JWT 検証は `preHandler` グローバルフックで全ルートに適用（`/api/auth/login` と `/api/auth/logout` は除外）。
- admin 限定ルートは `{ preHandler: requireAdmin }` を追加（`plugins/auth.ts` からインポート）。
- ログイン: `POST /auth/login` → JWT を Set-Cookie で返す。
- 認証確認: `GET /auth/me` → ユーザー情報を返す。

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
