# Quickstart: 数量単位・レポート単位表記のi18n集約

## 前提

- `pnpm --filter frontend dev`（または`pnpm dev`）でフロントエンドが起動していること。

## 1. 人数単位表記の確認（User Story 1）

1. コース人数確認モーダル・コースタブの人数変更・グループ作成シートをそれぞれ開く。
2. 数量ピッカーの単位表記が「名」のまま変わっていないことを目視確認する。
3. `frontend/src/i18n/locales/ja.ts`の`common.personUnit`の値を一時的に別の文字列（例: `'人'`）に変更し、上記3画面すべてで表示が切り替わることを確認する（3箇所とも同じキーを参照していることの確認）。確認後は`'名'`に戻す。

## 2. 日次レポート単位表記の確認（User Story 2）

1. 管理者ログインし、日次レポート画面（`report`）を開く。
2. 時間帯別グラフの各バーのラベルが「◯時」のまま変わっていないこと、ランキングセクションの件数が「◯件」のまま変わっていないことを目視確認する。
3. `frontend/src/i18n/locales/ja.ts`の`report.hourLabel`・`report.countUnit`の値を一時的に変更し、表示が切り替わることを確認する。確認後は元に戻す。

## 3. 回帰確認

- `pnpm --filter frontend typecheck`: 型エラーがないこと。
- `pnpm --filter frontend test`: 既存テストが全て通ること（表示文字列に依存するテストがあれば、変更前と同じ文字列が得られることを確認）。
- `pnpm --filter frontend lint`: リントエラーがないこと。

## 期待結果

- すべての画面で表示される文字列（「名」「時」「件」を含む）は変更前と完全に一致する。
- `frontend/src/pages/group/GroupDetail/components/CourseConfirmModal.tsx`・`CourseTab.tsx`・`frontend/src/pages/hall/Hall/components/CreateGroupSheet.tsx`・`frontend/src/pages/admin/DailyReport/components/HourlyChart.tsx`・`RankingSection.tsx`のいずれにも、単位を表す日本語文字列リテラルの直書きが残っていない。
