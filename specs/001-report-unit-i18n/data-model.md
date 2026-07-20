# Phase 1 Data Model: 数量単位・レポート単位表記のi18n集約

本フィーチャーはデータエンティティの追加・変更を伴わない。UI表示文言（翻訳リソース）の参照方法の変更のみを記載する。

## 翻訳キー（`frontend/src/i18n/locales/ja.ts`）

| 名前空間 | キー | 値（現行表示を維持） | 用途 |
|---|---|---|---|
| `common` | `personUnit` | `'名'` | コース人数確認・変更・グループ作成時の人数単位表記（3箇所で共有） |
| `report` | `hourLabel` | `'{{hour}}時'` | 日次レポート時間帯別グラフの時刻ラベル |
| `report` | `countUnit` | `'{{qty}}件'` | 日次レポートランキングセクションの件数表記 |

## 変更対象コンポーネント（既存、スキーマ変更なし）

| ファイル | 変更内容 |
|---|---|
| `frontend/src/pages/group/GroupDetail/components/CourseConfirmModal.tsx` | `QuantityPicker`の`unit="名"` → `unit={t('common.personUnit')}` |
| `frontend/src/pages/group/GroupDetail/components/CourseTab.tsx` | 同上 |
| `frontend/src/pages/hall/Hall/components/CreateGroupSheet.tsx` | 同上 |
| `frontend/src/pages/admin/DailyReport/components/HourlyChart.tsx` | `` `${h.hour}時` `` → `t('report.hourLabel', { hour: h.hour })` |
| `frontend/src/pages/admin/DailyReport/components/RankingSection.tsx` | `` `${item.qty}件` `` → `t('report.countUnit', { qty: item.qty })`（2箇所） |

`QuantityPicker`コンポーネント自体（`unit: string`プロパティ）・`HourlyChart`/`RankingSection`のデータ取得ロジックは変更しない。
