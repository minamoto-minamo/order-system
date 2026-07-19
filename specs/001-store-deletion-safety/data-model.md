# Phase 1 Data Model: 店舗削除・無効化の運用安全性（F7）

スキーマ変更は発生しない（`backend/prisma/schema.prisma`は無変更）。本フィーチャーが扱う既存エンティティのうち、削除ガードに関わる部分のみを記載する。

## Store

- `isActive: Boolean`。削除処理の先頭で`false`に更新し、以降のリクエストをHost解決時点で`unknown`（404）にする（既存実装、変更なし）。
- **本フィーチャーでの制約**: 営業中データ判定（Session/Group）に失敗した場合、`isActive`を`true`に復元してからエラー応答する。

## Session

- `status: SessionStatus`（`open` / `closed`）。`storeId`で店舗に紐づく。
- **本フィーチャーでの制約**: 削除トランザクション内で`status === 'open'`のレコードが1件でも存在すれば削除を拒否する。

## Group

- `status: GroupStatus`（`active` / `bill_requested` / `closed`）。`storeId`で店舗に紐づく。
- **本フィーチャーでの制約**: 削除トランザクション内で`status IN ('active', 'bill_requested')`のレコードが1件でも存在すれば削除を拒否する。

## 新規エラーコード（`backend/src/lib/errors.ts`）

| 名前空間 | キー | 値 | HTTPステータス | 用途 |
|---|---|---|---|---|
| `ErrorCodes.PlatformStores` | `ActiveDataExists` | `platform_stores.delete.active_data_exists` | 409 | 営業中セッション・アクティブグループが存在する店舗の削除拒否 |

## 削除ガード判定まとめ

| 判定対象 | 条件 | 満たさない場合 |
|---|---|---|
| Session | `status === 'open'`が0件 | 409 `platform_stores.delete.active_data_exists` |
| Group | `status IN ('active', 'bill_requested')`が0件 | 409 `platform_stores.delete.active_data_exists` |

両判定とカスケード削除は同一のインタラクティブトランザクション内で実施する（詳細は[research.md R1](research.md#r1-プリコンディションチェックfr-001005の実装パターン)参照）。
