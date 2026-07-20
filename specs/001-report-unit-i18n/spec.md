# Feature Specification: 数量単位・レポート単位表記のi18n集約

**Feature Branch**: `001-report-unit-i18n`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "数量単位・レポート単位表記のi18n集約: order-systemの設計レビュー（work/review-arch-2026-07-18.md、UI/UXデザイン観点、いずれもMedium）で以下2件が指摘された。(1) 指摘8-4: 数量単位「名」が`frontend/src/pages/group/GroupDetail/components/CourseConfirmModal.tsx:40`、`CourseTab.tsx:122`、`frontend/src/pages/hall/Hall/components/CreateGroupSheet.tsx:59`の3箇所で`<QuantityPicker unit="名" />`のように直接日本語文字列として渡されており、`i18n/locales/ja.ts`を経由していない。(2) 指摘8-5: 日次レポートの単位表記「時」「件」が`frontend/src/pages/admin/DailyReport/components/HourlyChart.tsx:46`（`{h.hour}時`）と`RankingSection.tsx:133,153`（`${item.qty}件`）でテンプレートリテラルに直接埋め込まれており、同じくi18nを経由していない。根本原因は共通で、`frontend/CLAUDE.md`の「UI文言はすべてi18n/locales/ja.tsに定義」ルールに反している。既存の`i18n/locales/ja.ts`には`common`（2行目〜）・`report`（292行目〜）の名前空間が既にある。改善案: `common`に`personUnit: '名'`を追加し3箇所を`t('common.personUnit')`に置き換える。`report`配下に`hourLabel: '{{hour}}時'`・`countUnit: '{{qty}}件'`のようなキーを追加し`t()`経由に置き換える。表示上の見た目・文言内容自体は変更しない（ハードコード文字列をi18nキー経由に置き換えるのみ）。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 人数単位表記が多言語対応の仕組みに乗る (Priority: P1)

コース人数の確認・変更・グループ作成画面で表示される「名」という単位表記が、i18nの仕組みを経由して表示される。将来他言語に対応する際、この単位表記も他の画面文言と同様に翻訳ファイルを差し替えるだけで切り替えられる。

**Why this priority**: `CourseConfirmModal`・`CourseTab`・`CreateGroupSheet`の3箇所が同じ文言をそれぞれ個別にハードコードしており、多言語化時に見落としが最も起きやすい。指摘の中でも影響箇所数が多い。

**Independent Test**: `frontend/src/i18n/locales/ja.ts`の`common.personUnit`キーを変更し、コース人数確認モーダル・コースタブの人数変更・グループ作成シートの3箇所すべてで表示される単位が新しい値に切り替わることを確認する。

**Acceptance Scenarios**:

1. **Given** コース人数確認モーダルを開いた状態、**When** 人数の数量ピッカーを表示する、**Then** 単位表記は`i18n/locales/ja.ts`の`common.personUnit`キーの値（現行「名」）がそのまま表示される。
2. **Given** コースタブで人数を変更する画面、**When** 数量ピッカーを表示する、**Then** 同じく`common.personUnit`の値が表示される。
3. **Given** グループ作成シート、**When** 人数の数量ピッカーを表示する、**Then** 同じく`common.personUnit`の値が表示される。
4. **Given** `common.personUnit`の値を変更した状態、**When** 上記3画面のいずれかを表示する、**Then** 変更後の値が反映される（個別のハードコード文字列が残っていない）。

---

### User Story 2 - 日次レポートの単位表記が多言語対応の仕組みに乗る (Priority: P2)

日次レポート画面の時間帯別グラフ・ランキングセクションで表示される「時」「件」という単位表記が、i18nの仕組みを経由して表示される。

**Why this priority**: 対象箇所が日次レポート画面（管理者向け）に限定され、User Story 1（複数画面・複数ユーザー向け操作画面）より影響範囲が狭い。

**Independent Test**: `frontend/src/i18n/locales/ja.ts`の`report.hourLabel`・`report.countUnit`キーを変更し、日次レポートの時間帯別グラフの時刻表記とランキングセクションの件数表記が新しい値に切り替わることを確認する。

**Acceptance Scenarios**:

1. **Given** 日次レポート画面の時間帯別グラフ、**When** 各時間帯のラベルを表示する、**Then** `report.hourLabel`キー（`{{hour}}時`形式、現行）を介して整形された文字列が表示される。
2. **Given** 日次レポート画面のランキングセクション、**When** 各項目の件数を表示する、**Then** `report.countUnit`キー（`{{qty}}件`形式、現行）を介して整形された文字列が表示される。
3. **Given** `report.hourLabel`または`report.countUnit`の値を変更した状態、**When** 日次レポート画面を表示する、**Then** 変更後の値が反映される。

---

### Edge Cases

- 数量が0または複数桁になる場合も、既存の表示ロジック（`{{hour}}`/`{{qty}}`のプレースホルダー展開）が正しく数値を埋め込む。
- 既存のスナップショットテスト・UIテストが「名」「時」「件」という文字列に直接依存している場合、i18nキー経由への置き換え後も同じ表示結果になるため、テスト内容の変更は不要（表示結果は変わらない）。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: システムは`frontend/src/i18n/locales/ja.ts`の`common`名前空間に、人数単位を表す翻訳キー（`personUnit`、現行値「名」）を持たなければならない。
- **FR-002**: `CourseConfirmModal.tsx`・`CourseTab.tsx`・`CreateGroupSheet.tsx`の3箇所の`QuantityPicker`の`unit`プロパティは、直接の日本語文字列リテラルではなく、FR-001の翻訳キーを`t()`経由で参照しなければならない。
- **FR-003**: システムは`frontend/src/i18n/locales/ja.ts`の`report`名前空間に、時間帯ラベル（`hourLabel`、現行値`{{hour}}時`）と件数ラベル（`countUnit`、現行値`{{qty}}件`）の翻訳キーを持たなければならない。
- **FR-004**: `HourlyChart.tsx`の時間帯ラベル表示と`RankingSection.tsx`の件数表示は、テンプレートリテラルへの直接埋め込みではなく、FR-003の翻訳キーを`t()`経由（プレースホルダー展開）で参照しなければならない。
- **FR-005**: 本機能による変更は、表示される文字列の内容・レイアウト・見た目を変更してはならない（現行の「名」「時」「件」という表示結果を完全に維持する）。

### Key Entities *(include if feature involves data)*

本機能はUI表示文言の参照方法の変更のみであり、データエンティティの追加・変更はない。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `frontend/src/pages/group/GroupDetail/components/CourseConfirmModal.tsx`・`CourseTab.tsx`・`frontend/src/pages/hall/Hall/components/CreateGroupSheet.tsx`の3箇所すべてで、`unit`プロパティに日本語文字列リテラルが直接渡されているコードが存在しない。
- **SC-002**: `frontend/src/pages/admin/DailyReport/components/HourlyChart.tsx`・`RankingSection.tsx`で、単位文字を含むテンプレートリテラルが直接埋め込まれているコードが存在しない。
- **SC-003**: 変更後も対象5箇所（3+2）すべてで、変更前と同一の表示結果（「名」「時」「件」を含む文字列）がユーザーに表示される（回帰なし）。

## Assumptions

- 対象は指摘された5箇所（`CourseConfirmModal.tsx`、`CourseTab.tsx`、`CreateGroupSheet.tsx`、`HourlyChart.tsx`、`RankingSection.tsx`）に限定する。他にも同様のハードコードが存在する可能性はあるが、本機能のスコープ外とする。
- キー名は`common.personUnit`・`report.hourLabel`・`report.countUnit`とする（ユーザー説明で明示された案をそのまま採用）。
- バックエンド・データモデルへの変更はなく、フロントエンドの表示ロジックのみが対象。
- 既存の`i18next`の`t()`関数とプレースホルダー構文（`{{hour}}`/`{{qty}}`）は、リポジトリの既存パターン（`report`名前空間の他キー等）と同じ方式が使える前提とする。
