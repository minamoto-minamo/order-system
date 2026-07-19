# frontend/CLAUDE.md

React 18 + Vite + React Router v6 + Tailwind CSS v4。

## コマンド

```bash
# 開発サーバー
pnpm --filter frontend dev      # Vite dev server を起動（HMR あり）
pnpm --filter frontend build    # TypeScript 型チェック → Vite で本番ビルド（dist/ に出力）
pnpm --filter frontend preview  # dist/ をローカルで配信（本番ビルドの動作確認用）

# 検証
pnpm --filter frontend typecheck  # 型チェックのみ（コンパイル出力なし）
pnpm --filter frontend test       # Jest でユニットテストを実行
```

## ディレクトリ構成

```txt
src/
├── App.tsx                  # ルート定義の唯一の場所。Host がプラットフォーム管理者用サブドメインかどうかで
│                             # ルートツリーを丸ごと出し分ける（isPlatformAdminHost()、lib/platform.ts）
├── main.tsx
├── layouts/                  # 画面種別ごとの共通レイアウト（ヘッダー・ナビ等）
│   ├── PageLayout/            # スタッフ向け画面（ホール・キッチン・管理者）共通
│   ├── CustomerPageLayout/    # 客用注文画面（S103）用
│   └── PlatformPageLayout/    # プラットフォーム管理画面（S500/S501）用
├── pages/                   # 1ディレクトリ = 1画面。サブコンポーネントも同じディレクトリに置く
│   ├── home/Home/
│   ├── login/Login/
│   ├── hall/Hall/
│   ├── kitchen/Kitchen/
│   ├── group/GroupDetail/
│   ├── customer/CustomerOrder/               # S103 客用注文
│   ├── platform/{PlatformLogin,StoreList}/   # S500/S501
│   ├── error/NotFound.tsx
│   └── admin/{AdminMenu,Products,SeatLayout,DailyReport,Settings,Staff,Courses}/
├── features/                # 画面横断ではなくドメイン単位でまとまった機能コンポーネント
│   ├── auth/components/       # LoginForm など
│   ├── menu/components/       # SubCategorySidebar など
│   ├── navigation/components/ # AppHeader, NavDrawer, ActionBar, NavigationCard
│   └── order/components/      # OrderHistorySection など
├── components/              # 画面・機能に依存しない汎用コンポーネント
│   ├── primitives/           # Icon, QuantityPicker, ToggleButtonGroup, ZeroStartStepper, button
│   ├── composite/            # BottomSheet(Modal), FormSheetModal, InputModal, MenuConfirmModal, TabNavigation, SlideUpFooter
│   └── feedback/              # ErrorBoundary, NoticeBanner, RetryableLoadError, Toast
├── stores/
│   ├── auth.ts              # useAuthStore — ログインスタッフ管理
│   ├── platformAuth.ts      # usePlatformAuthStore — プラットフォーム管理者ログイン管理
│   ├── session.ts           # useSessionStore — 営業セッション管理
│   ├── banner.ts            # お知らせバナー state 管理
│   └── toast.ts             # トースト通知 state 管理
├── lib/
│   ├── routes.ts            # ROUTES 定数（全ルートパス）
│   ├── endpoints.ts         # EP 定数（全 API エンドポイント）
│   ├── events.ts            # SOCKET_EVENTS 定数（Socket.io イベント名）
│   ├── api.ts               # fetch ラッパー
│   ├── apiError.ts          # ApiErrorPayload（backend の ErrorCodes）の解釈ヘルパー
│   ├── socket.ts            # Socket.io クライアント初期化
│   ├── platform.ts          # isPlatformAdminHost() — Host からプラットフォーム管理者用かを判定
│   ├── taxTotals.ts         # 税額・合計金額の計算ユーティリティ
│   ├── partitionOrderItems.ts # 注文明細のステータス別振り分け
│   ├── brand.ts / icons.ts  # ブランド表示・アイコンマッピング
│   └── utils.ts             # 共通ユーティリティ（getSeatLabels, isGroupActive, isAdmin）
├── assets/
│   ├── fonts/               # NotoSansJP-Regular.woff2
│   └── img/icons/
│       ├── nav/             # 画面メニュー用PNG（home, hall, kitchen, setting など）
│       ├── action/          # 操作ボタン用SVG（close, gear, arrow-left など）
│       └── symbol/          # 状態・意味表示用SVG（beer, dining, takeout など）
├── hooks/
│   ├── useOverTimeWarning.ts
│   ├── useSocketListeners.ts   # Socket.io イベント登録・解除の共通フック
│   ├── useSessionActions.ts    # 営業セッション操作（開始・締め・再開）
│   ├── useForm.ts              # フォーム state 管理
│   └── useToast.ts             # トースト通知 state 管理（一定時間で自動消去）
├── i18n/
│   ├── index.ts
│   └── locales/ja.ts        # 日本語テキスト（UI 文言はすべてここ）
└── styles/
    ├── tailwind.css         # @theme ブロック（デザイントークン定義）
    └── index.scss           # グローバルスタイル・共通クラス（.tappable, .action-btn, .input-field）
```

## ルーティング

`App.tsx` がルート定義の唯一の場所。パスの追加・変更は必ずここで行う。

パス文字列は `lib/routes.ts` の `ROUTES` 定数を使う。直接文字列を書かない。

`isPlatformAdminHost()`（`lib/platform.ts`）で Host を判定し、プラットフォーム管理者用サブドメインならプラットフォーム系ルート（`PlatformLogin` / `StoreList`）のみを、それ以外なら通常の店舗向けルートツリーをレンダリングする。この分岐は backend の `resolveStoreContext` による store/platform 判定（`backend/CLAUDE.md` 参照）とペアになっている。

認証ガード（`RequireAuth`、店舗向けルート）:

- 未認証 → `/login` にリダイレクト
- admin ロール以外 → `/admin/*` にアクセス不可
- `requireSession` 指定時（ホール・キッチン系）に営業セッションが `open` でなければアクセス不可

プラットフォーム系ルートは `RequirePlatformAuth` で別途ガードする（未ログイン → `/platform/login`）。

## 状態管理

- `useAuthStore`（`stores/auth.ts`）: ログインスタッフ。`App.tsx` 起動時に `GET /api/auth/me` で初期化。
- `usePlatformAuthStore`（`stores/platformAuth.ts`）: プラットフォーム管理者。`GET /api/platform/auth/me` で初期化。
- `useSessionStore`（`stores/session.ts`）: 現在の営業セッション。

## API / Socket.io

- API 呼び出しは `lib/api.ts` のラッパーを使う。エンドポイントは `EP` 定数（`lib/endpoints.ts`）。
- Socket.io イベント名は `SOCKET_EVENTS` 定数（`lib/events.ts`）。直接文字列を書かない。
- パスエイリアス `@/` → `src/`

## スタイリング

**基本方針**: Tailwind ユーティリティクラスを優先。コンポーネント固有のインタラクション（hover/active/scroll）のみ `.scss` ファイルを同ディレクトリに置く。

**デザイントークン** (`styles/tailwind.css` の `@theme` で定義):

ニュートラル:

| トークン       | 値      | 用途                               |
| -------------- | ------- | ---------------------------------- |
| `ink`          | #111    | 本文・アクションボタン             |
| `secondary`    | #333    | サブラベル・ナビ                   |
| `dim`          | #666    | キャプション・アイコン             |
| `muted`        | #888    | ミュートラベル                     |
| `faint`        | #aaa    | 非活性・極薄                       |
| `line`         | #c8c8c8 | カード・入力ボーダー・アウトライン |
| `divider`      | #d8d8d8 | レイアウト区切り                   |
| `surface-deep` | #f0f0f0 | ホバー・押下・グリッド背景         |
| `surface`      | #f5f5f5 | ページ・セクション背景             |

セマンティック:

| グループ | トークン                                                  | 用途                   |
| -------- | --------------------------------------------------------- | ---------------------- |
| amber    | `amber` / `-bg` / `-border` / `-fg`                       | 提供待ち・テイクアウト |
| bill     | `bill` / `-bg` / `-border` / `-glow`                      | 会計リクエスト         |
| danger   | `danger` / `-bg` / `-border` / `-glow`                    | エラー・削除           |
| info     | `info` / `-bg` / `-border` / `-glow` / `-dark`            | 選択・フォーカス       |
| open     | `open` / `-border` / `-fg`                                | 営業中                 |
| course   | `course` / `-bg`                                          | フードカテゴリ         |
| success  | `success-bg` / `success-fg`                               | 保存完了               |
| order    | `order-pending` / `-bg` / `-fg` / `order-ready` / `-bg` / `-fg` | 注文ステータスバッジ   |
| rank     | `gold` / `-bg` / `-border` / `bronze` / `-bg` / `-border` | ランキング表示         |

フォントサイズ: `text-nano`(8px) / `text-micro`(9px) / `text-caption`(10px) / `text-label`(11px) / `text-note`(13px) / `text-sub`(15px)

**ルール**:

- ハードコードカラー（`#xxx`）は書かない。必ずトークンを使う。
- 低頻度・セマンティックカラーはトークンに追加してから使う。

## i18n

UI 文言はすべて `i18n/locales/ja.ts` に定義し、`useTranslation` フックで参照する。コンポーネントに直接日本語文字列を書かない。
