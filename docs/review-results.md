# コードレビュー結果

> 実施日: 2026-06-19  
> 対象: order-system（frontend / backend / shared）  
> 完了済み項目は随時削除済み

---

## Agent 1: セキュリティ

### Low

#### クエリパラメータ `status` が無検証で DB フィルタに渡る
`orders.ts`、`groups.ts`

存在しないステータス値を渡してもエラーにならない（body は schema 検証済み、querystring は未対応）。

---

#### 本番で `CORS_ORIGIN` 未設定時のデフォルトが `localhost:5173`
`backend/src/plugins/cors.ts:6`

設定漏れ時に意味のないオリジンが許可される。明示的なエラーで起動を止めることを推奨。

---

### 確認済み（問題なし）

- SQL インジェクション — Prisma raw クエリ未使用、全クエリがパラメータ化済み
- XSS — `dangerouslySetInnerHTML`、`innerHTML` 直接代入、`eval()` の使用なし
- 機密情報のログ出力 — パスワード・トークンのログ出力なし

---

## Agent 2: バックエンド

### High

#### グループ作成後にセッション確認が失われる可能性
`backend/src/routes/groups.ts:56–83`

セッション確認と `group.create` の間にセッションが `closed` になると、閉じたセッションにグループが紐付く。

**修正案:** `prisma.$transaction` でまとめる。

---

### Low

#### `PUT /api/orders/:id/cancel` の動詞が不適切
`backend/src/routes/orders.ts:74`

**修正案:** `POST /api/orders/:id/cancel` に変更する（フロント側も変更必要 — breaking change）。

---

#### `User.role` が `String` 型
`backend/prisma/schema.prisma:193`

**修正案:** `enum UserRole { admin staff }` を追加して `role UserRole` に変更する。

---

## Agent 3: フロントエンド

### Medium

#### emit 後の楽観的更新・エラーハンドリングなし
`frontend/src/pages/KitchenDashboard/KitchenDashboard.tsx:338–339`

`handleReady` / `handleServed` は Socket emit のみ。往復が遅延・失敗した場合 UI は変化しない。

**修正案:** emit と同時にローカルで楽観的更新するか、ACK コールバックでエラーを拾う。

---

#### non-null assertion `!` の多用
`frontend/src/pages/SeatLayoutEditor/SeatLayoutEditor.tsx:97, 101, 103, 117`

```ts
canvasRef.current!.getBoundingClientRect()
seats.find(s => s.id === id)!
tables.find(t => t.id === id)!
```

**修正案:** `find()` の結果に対しては早期 return でガード。`canvasRef.current` は null チェック後に使用。

---

### Low

#### `aria-label` がほぼ未設定（全画面共通）

「×」「←」「完了」などのボタンに `aria-label` がない。

---

## Agent 4: アーキテクチャ

### 良い点

- pnpm ワークスペース構成がシンプルで適切。`allowBuilds` でセキュリティ意識あり。
- ルート `package.json` に `dev` / `build` / `typecheck` / `test:e2e` を集約し、開発者体験が統一されている。
- `ServerToClientEvents` / `ClientToServerEvents` を shared に置き、フロント・バック両側で同一型を使う構成は正しい。
- E2E テストが `resetDb()` で DB 分離、ファイル名も仕様番号（`s01-` 等）に対応。

### 改善点

#### アプリコンテナなし・パスワードがハードコード
`docker-compose.yml`

本番・CI 用の構成が未定義。`POSTGRES_PASSWORD: password` がハードコード。

**修正案:** `docker-compose.prod.yml` または `Dockerfile` を追加。`setup-env.js` で `POSTGRES_PASSWORD` も乱数生成し `DATABASE_URL` に反映する。

---

#### バックエンドのルートが shared の DTO 型を使っていない
全ルート（`backend/src/routes/`）

`request.body as { ... }` で独自キャストしており、shared の型定義が片方向になっている。

**修正案:** zod で shared の型からスキーマを生成し、Fastify の `schema` オプションまたは preHandler で検証する。

---

#### `GroupDetail.tsx`（577行）・`KitchenDashboard.tsx`（406行）が肥大化
ロジックと UI が混在している。

**修正案:** `useGroupDetail.ts` のようなカスタムフックにデータフェッチと Socket 購読を切り出す。

---

#### `socket.ts` がモジュールレベルでシングルトン生成
`frontend/src/lib/socket.ts`

テストや Storybook 環境でのモックが困難。

**修正案:** ファクトリ関数またはコンテキストプロバイダ経由にする。

---


## Agent 5: UI/UX

### 全画面共通

#### [Medium] エラーハンドリングのレベルが不均一
`Login.tsx` はエラーを state に保持して表示するが、`HallSeatList` / `GroupDetail` 等は `.catch(console.error)` のみ。

#### [Low] `aria-label` がほぼ未設定
「×」「←」「完了」などのボタンに `aria-label` がない。

---

### S01 モード選択

| 重要度 | 種別 | 問題 |
|---|---|---|
| High | 実装漏れ | `handleNewSession` でAPIエラー時にフィードバックなし（`console.error` のみ） |
| High | 設計 | 管理者リンクが admin ロールのみ表示（仕様では「小さく配置」のみ、非表示とは書かれていない） |
| Medium | 設計 | 「営業を再開する」確認文が弱い（リスクが不明確） |
| Low | 実装漏れ | セッション取得中のローディング表示なし |

---

### S02 ホール席一覧

| 重要度 | 種別 | 問題 |
|---|---|---|
| High | 実装漏れ | 席ステータスカラーが仕様と不一致（「提供待ち=黄」が席セル背景に未反映） |
| Medium | 設計 | 複数選択解除の手段が不明瞭（「選択解除」ボタンなし） |
| Medium | 設計 | 席セルのタッチターゲットが `G-8px`（44px 推奨を下回る） |
| Low | 実装漏れ | `seats.length === 0` 時の空状態表示なし |

---

### S03 キッチンダッシュボード

| 重要度 | 種別 | 問題 |
|---|---|---|
| High | 設計 | カードビューに「提供待ち」エリアなし（ready 注文が操作不可） |
| High | 設計 | 品切れ登録 UI が未実装（仕様 S03 UI要素 #7） |
| Medium | 実装漏れ | 経過時間の更新間隔が 60 秒（最大 1 分の遅延） |

---

### S04 グループ詳細

| 重要度 | 種別 | 問題 |
|---|---|---|
| High | 設計 | 退店ボタンに未提供注文チェックなし（pending/ready が残っていても退店可能） |
| High | 設計 | 注文追加後に自動でタブが「注文履歴」に切り替わる（連続注文が不便） |
| Medium | 実装漏れ | isTakeout が 🥡 絵文字（9px）のみ（仕様では `[TO] 商品名` テキスト形式） |
| Medium | 設計 | コース適用後もタブが自動切替（意図しない遷移に見える） |
| Medium | 設計 | `bill_requested` 時に次の操作（退店）への誘導がない |
| Low | 設計 | `¥{total}（参考）` の「参考」理由が未説明 |
| Low | 設計 | `max-w-[480px]` 固定（仕様のタブレット用サイドパネル表示が未実装） |

---

### S05 ログイン

| 重要度 | 種別 | 問題 |
|---|---|---|
| Medium | 設計 | 仕様では「パスワード認証のみ」だが実装は `username` + `password` の 2 フィールド |
| Low | 実装漏れ | 認証確認中に真っ白画面（ローディング表示なし） |

---

### S06 商品設定

| 重要度 | 種別 | 問題 |
|---|---|---|
| High | 実装漏れ | バックエンド API 未接続（ダミーデータのみ、保存が永続化されない） |
| High | 実装漏れ | 飲み放題プラン・コース管理 UI が未実装（仕様 S06 UI要素 #7, #8） |
| High | 実装漏れ | カテゴリ削除に確認ステップなし（配下の商品も消えるが警告なし） |

---

### S07 席レイアウト設定

| 重要度 | 種別 | 問題 |
|---|---|---|
| High | 実装漏れ | バックエンド API 未接続（ダミーデータのみ、「保存」が `setSaved(true)` のみ） |
| High | 実装漏れ | 使用中席の削除ガードなし（仕様「使用中の席は削除不可」未実装） |
| Medium | 設計 | ドラッグが `mousedown/mousemove/mouseup` のみ（タッチデバイス非対応） |
| Low | 設計 | キャンバスサイズが `768×576px` 固定（大規模店舗では収まらない可能性） |

---

### S08 日時レポート

| 重要度 | 種別 | 問題 |
|---|---|---|
| High | 実装漏れ | バックエンド API 未接続（ダミーデータのみ） |
| Low | 設計 | セッション切り替え時にアニメーションなし |

---

### S09 詳細設定

| 重要度 | 種別 | 問題 |
|---|---|---|
| High | 実装漏れ | バックエンド API 未接続（保存しても永続化されない）— バックエンド B08 未実装に連動 |
| Medium | 設計 | 営業終了時刻の入力 UI で type=number に `padStart` 等の文字列操作が混在（バグリスク） |

---

## 横断的な優先課題（残）

| 順位 | 問題 | 分類 |
|---|---|---|
| 1 | 管理画面 4 つが API 未接続（商品設定・席設定・レポート・詳細設定） | UI/UX High |
