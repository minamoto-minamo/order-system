# backend/CLAUDE.md

Fastify + Socket.io + Prisma (PostgreSQL)。

## コマンド

```bash
pnpm --filter backend db:generate  # Prisma クライアント生成
pnpm --filter backend db:migrate   # マイグレーション実行（開発用）
pnpm --filter backend db:push      # スキーマを DB に直接反映（プロトタイプ用）
pnpm --filter backend db:studio    # GUI で DB を確認
pnpm --filter backend start        # ビルド済みサーバー起動
```

## ディレクトリ構成

```txt
src/
├── index.ts          # エントリポイント。dotenv ロード → buildApp() 起動
├── app.ts            # Fastify インスタンス生成・プラグイン登録・ルート登録
├── plugins/
│   ├── auth.ts       # JWT 検証プラグイン（fastify-jwt）
│   ├── cors.ts       # CORS 設定（CORS_ORIGIN env から動的に生成）
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
│   ├── config.ts     # requireEnv(), parseCorsOrigins()
│   ├── mappers.ts    # Prisma モデル → 共有型への変換関数
│   └── prisma.ts     # PrismaClient シングルトン
└── models/           # (予約ディレクトリ)
```

## Fastify 構成

- `index.ts` で HTTP サーバーを手動作成し `buildApp()` に渡す。Socket.io と HTTP サーバーを共有するため。
- プラグイン登録順: cors → auth → routes。

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

emit は各ルートハンドラ内で `fastify.io.emit(...)` を呼ぶ。
