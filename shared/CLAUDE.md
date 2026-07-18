# shared/CLAUDE.md

frontend・backend 共通の型定義のみ。ロジックは一切含めない。

エントリポイント: `types/index.ts`（TypeScript ソースをそのまま参照）

## ルール

- 型定義・インターフェース・`type` エイリアスのみ追加可。関数・クラス・定数は書かない。
- frontend / backend どちらかにしか使わない型もここに置いてよい（import の一元化のため）。

## 主要な型

| 型 | 概要 |
|---|---|
| `SeatTable` | テーブル（席を束ねる矩形領域。座標・サイズを持つ） |
| `Seat` | 席（カウンター / テーブル） |
| `Group` | グループ（ステータス: `active` → `bill_requested` → `closed`） |
| `OrderItem` | 注文明細（ステータス: `pending` → `ready` → `served`。`cancelled` は上記いずれからも遷移可。提供済み商品の作り直し・クレーム対応のため `served` からのキャンセルも許容） |
| `MenuItem` | メニュー品目 |
| `Category` / `SubCategory` | カテゴリ階層 |
| `Course` / `DrinkPlan` | コース・ドリンクプラン |
| `Session` | 営業セッション（`open` / `closed`。管理者の「締め」で確定） |
| `Setting` | 店舗設定（店名・締め時刻・税率） |
| `Store` | 店舗（サブドメインでテナントを識別。プラットフォーム管理者が作成・編集） |
| `PlatformAdmin` | プラットフォーム管理者（店舗横断の管理者） |

## Socket.io イベント型

- `ServerToClientEvents`: サーバーからクライアントへの emit 型
- `ClientToServerEvents`: クライアントからサーバーへの emit 型

## API DTO 型

各リソースの Request 型（`CreateGroupRequest`, `UpdateGroupRequest`, `CreateOrderBatchRequest` など）もここで定義。
