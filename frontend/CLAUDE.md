# frontend/CLAUDE.md

React 18 + Vite + React Router v6 + Tailwind CSS v4。

## ディレクトリ構成

```txt
src/
├── App.tsx                  # ルート定義の唯一の場所
├── main.tsx
├── pages/                   # 1ディレクトリ = 1画面。サブコンポーネントも同じディレクトリに置く
│   ├── home/Home/
│   ├── login/Login/
│   ├── hall/Hall/
│   ├── kitchen/Kitchen/
│   ├── group/GroupDetail/
│   └── admin/{AdminMenu,Products,SeatLayout,DailyReport,Settings,Staff}/
├── components/              # 複数画面で使う共通コンポーネント
│   ├── controls/            # QuantityControl, ToggleButtonGroup, Button, IconButton, NavButton
│   ├── display/             # StatusBadge, TabNavigation
│   ├── layout/              # AppHeader, SubHeader, NavDrawer
│   └── modal/               # BottomSheetModal, ConfirmModal, InputModal
├── stores/
│   ├── auth.ts              # useAuthStore — ログインユーザー管理
│   └── session.ts           # useSessionStore — 営業セッション管理
├── lib/
│   ├── routes.ts            # ROUTES 定数（全ルートパス）
│   ├── endpoints.ts         # EP 定数（全 API エンドポイント）
│   ├── events.ts            # SOCKET_EVENTS 定数（Socket.io イベント名）
│   ├── api.ts               # fetch ラッパー
│   ├── socket.ts            # Socket.io クライアント初期化
│   └── utils.ts             # 共通ユーティリティ（getSeatLabels, isGroupActive, isAdmin）
├── assets/
│   ├── fonts/               # NotoSansJP-Regular.woff2
│   └── icons/               # hall.png, home.png, kitchen.png, logout.png, setting.png
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

認証ガード:

- 未認証 → `/login` にリダイレクト
- admin ロール以外 → `/admin/*` にアクセス不可

## 状態管理

- `useAuthStore`（`stores/auth.ts`）: ログインユーザー。`App.tsx` 起動時に `GET /api/auth/me` で初期化。
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
| order    | `order-pending` / `-bg` / `order-ready` / `-bg`           | 注文ステータスバッジ   |
| rank     | `gold` / `-bg` / `-border` / `bronze` / `-bg` / `-border` | ランキング表示         |

フォントサイズ: `text-nano`(8px) / `text-micro`(9px) / `text-caption`(10px) / `text-label`(11px) / `text-note`(13px) / `text-sub`(15px)

**ルール**:

- ハードコードカラー（`#xxx`）は書かない。必ずトークンを使う。
- 低頻度・セマンティックカラーはトークンに追加してから使う。

## i18n

UI 文言はすべて `i18n/locales/ja.ts` に定義し、`useTranslation` フックで参照する。コンポーネントに直接日本語文字列を書かない。
