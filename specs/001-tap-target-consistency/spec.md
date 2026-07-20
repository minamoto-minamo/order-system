# Feature Specification: タップ領域サイズの不整合を解消する

**Feature Branch**: `001-tap-target-consistency`

**Created**: 2026-07-19

**Status**: Draft

**Input**: User description: "タップ領域（touch target）サイズの不整合を解消する。設計レビュー（work/review-arch-2026-07-18.md、UI/UXデザイン観点）で以下2件が指摘された。(1) 指摘8-6[Medium]: ヘッダーのアイコンボタン（AppHeaderのハンバーガーメニュー、GroupDetailのQR表示・席変更ボタン、CustomerOrderの店員呼び出し・お会計ボタン）がいずれもw-8 h-8（32×32px）で、Apple/Googleが推奨する44px/48dp目安を下回る。特に客が自分のスマホで操作する「店員を呼ぶ」「お会計」ボタンや、忙しい厨房でタブレットを素早く操作する場面で誤タップ・タップ漏れが起きやすい。(2) 指摘8-7[Low]: 個数±ボタンの共通コンポーネントが2種類存在し、タップ領域の設計方針が不揃い。QuantityPicker（CancelModal・CourseTab等で使用）はw-10 h-10(40px)でパディングなしの当たり判定だが、ZeroStartStepperはmin-w-11 min-h-11(44px)の当たり判定＋内側に視覚的に小さい円という「見た目は小さいまま当たり判定だけ広げる」パターンを既に採用している。根本原因は共通で、タップ領域のサイズ方針（44px/min-w-11 min-h-11当たり判定パターン）が一部のコンポーネントに未適用であること。改善方針はZeroStartStepperの既存パターン（視覚サイズを維持しつつmin-w-11 min-h-11で当たり判定だけ拡張する）への統一。対象: frontend/src/features/navigation/components/AppHeader/index.tsx（ハンバーガーメニュー）、frontend/src/pages/group/GroupDetail/GroupDetail.tsx（QR表示・席変更ボタン）、frontend/src/pages/customer/CustomerOrder/CustomerOrder.tsx（店員呼び出し・お会計ボタン）、frontend/src/components/primitives/QuantityPicker/index.tsx（±ボタン）。"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 客が自分のスマホでヘッダー操作ボタンを確実にタップできる (Priority: P1)

来店客が自分のスマホの客用注文画面（CustomerOrder）で「店員を呼ぶ」「お会計」ボタンを操作するとき、指先の大きさや持ち方に関わらず、意図したボタンを誤タップ・タップ漏れなく押せる。

**Why this priority**: 客用画面は誤操作時のリカバリ手段が乏しく（隣に店員がいない）、業務影響が最も直接的。3指摘中で最も優先度が高い（Medium指摘の中でも客対応チャネルへの影響が大きい）。

**Independent Test**: 客用注文画面（CustomerOrder）の「店員を呼ぶ」「お会計」ボタンのDOM上のタップ可能領域（クリック判定を持つ要素の実寸）が44×44px以上であることを、レンダリング結果に対する寸法検証で確認する。

**Acceptance Scenarios**:

1. **Given** 客用注文画面が表示されている、**When** 「店員を呼ぶ」ボタンの周辺44px四方のいずれかの位置をタップする、**Then** ボタンのクリックハンドラが発火する。
2. **Given** 客用注文画面が表示されている、**When** 「お会計」ボタンの周辺44px四方のいずれかの位置をタップする、**Then** ボタンのクリックハンドラが発火する。
3. **Given** 客用注文画面が表示されている、**When** ボタンを視覚的に確認する、**Then** 見た目のサイズ・デザインは変更前と同じである（当たり判定のみ拡張、視覚サイズは維持）。

---

### User Story 2 - スタッフがタブレット/スマホでヘッダー・グループ詳細のアイコンボタンを確実にタップできる (Priority: P1)

ホール・キッチンスタッフがタブレットやスマホでAppHeaderのハンバーガーメニュー、GroupDetail画面のQR表示・席変更ボタンを操作するとき、忙しい業務中でも誤タップ・タップ漏れなく操作できる。

**Why this priority**: User Story 1と同一指摘（8-6）の別画面への適用であり、独立して検証可能。客用画面ほどの緊急性はないが、忙しい厨房での操作性に直結するため同じP1とする。

**Independent Test**: AppHeaderのハンバーガーメニュー、GroupDetail画面のQR表示・席変更ボタンのタップ可能領域が44×44px以上であることを確認する。

**Acceptance Scenarios**:

1. **Given** いずれかの画面でAppHeaderが表示されている、**When** ハンバーガーメニューアイコンの周辺44px四方のいずれかの位置をタップする、**Then** ナビゲーションドロワーが開く。
2. **Given** GroupDetail画面が表示されている、**When** QR表示ボタンまたは席変更ボタンの周辺44px四方のいずれかの位置をタップする、**Then** 対応する操作が発火する。
3. **Given** 対象画面が表示されている、**When** ボタンを視覚的に確認する、**Then** 見た目のサイズ・デザインは変更前と同じである。

---

### User Story 3 - QuantityPickerの±ボタンがZeroStartStepperと同じ当たり判定基準になる (Priority: P3)

CancelModal（キャンセル数選択）やCourseTab（コース人数変更）でQuantityPickerを操作するユーザーが、アプリ内の他の個数操作コンポーネント（ZeroStartStepper）と同じタップしやすさを体感できる。

**Why this priority**: 指摘の深刻度がLowであり、他の2件と異なり「現状動作するが体験が不揃い」という一貫性の問題にとどまるため最も優先度を下げる。

**Independent Test**: QuantityPickerの±ボタンのタップ可能領域が44×44px以上（ZeroStartStepperと同基準）であることを確認する。

**Acceptance Scenarios**:

1. **Given** QuantityPickerが表示されている（CancelModal・CourseTab等）、**When** −ボタンまたは＋ボタンの周辺44px四方のいずれかの位置をタップする、**Then** 対応する増減処理が発火する。
2. **Given** QuantityPickerが表示されている、**When** ボタンを視覚的に確認する、**Then** 見た目のサイズ・デザイン（円のサイズ・ボーダー・文字サイズ）は変更前と同じである。

---

### Edge Cases

- ヘッダー内でボタン同士が近接している場合（例: AppHeaderの戻る矢印ボタンとハンバーガーメニュー、GroupDetailのQR表示・席変更ボタンが並ぶ場合）、当たり判定を44pxへ拡張した結果、隣接ボタンの当たり判定と重なり誤操作を誘発しないよう、拡張後も要素間に十分な間隔を確保する。
- QuantityPickerの`min`/`max`到達時（ボタンが実質無効化される、または境界値で動作が変わらない場合）も、当たり判定サイズ自体は変更前後で一貫している。
- disabled状態のボタン（品切れ等）は、当たり判定が拡張されても引き続き操作を受け付けない。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: システムは、`AppHeader`のハンバーガーメニューボタンのタップ可能領域を、視覚サイズを変更せずに44×44px（`min-w-11 min-h-11`相当）以上に拡張しなければならない。
- **FR-002**: システムは、`GroupDetail`画面のQR表示ボタン・席変更ボタンのタップ可能領域を、視覚サイズを変更せずに44×44px以上に拡張しなければならない。
- **FR-003**: システムは、`CustomerOrder`画面の「店員を呼ぶ」ボタン・「お会計」ボタンのタップ可能領域を、視覚サイズを変更せずに44×44px以上に拡張しなければならない。
- **FR-004**: システムは、`QuantityPicker`の−ボタン・＋ボタンのタップ可能領域を、視覚サイズを変更せずに44×44px以上に拡張し、`ZeroStartStepper`と同じ当たり判定基準に揃えなければならない。
- **FR-005**: 上記いずれの変更も、ボタンの視覚的な見た目（サイズ・色・アイコン・配置）を変更してはならない。当たり判定のみを拡張する。
- **FR-006**: 上記いずれの変更も、既存の`disabled`状態・クリックハンドラの挙動を変更してはならない。

### Key Entities

*(該当なし。本フィーチャーはUIコンポーネントのスタイル調整のみで、データエンティティを扱わない)*

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 対象6箇所（AppHeaderハンバーガーメニュー、GroupDetailのQR表示・席変更、CustomerOrderの店員呼び出し・お会計、QuantityPickerの±）すべてのタップ可能領域が44×44px以上になる。
- **SC-002**: 対象6箇所すべてについて、変更前後で視覚的な見た目（スクリーンショット比較）に差異がない。
- **SC-003**: 既存の自動テスト（対象コンポーネントのユニットテスト、関連するE2Eテスト）がすべて成功し、回帰がない。

## Assumptions

- 当たり判定拡張の実装パターンは、既存の`ZeroStartStepper`が採用している「視覚要素は維持しつつ親要素に`min-w-11 min-h-11`を付与し`flex items-center justify-center`で中央寄せする」方式を踏襲する。新規パターンは導入しない。
- 44px（`min-w-11 min-h-11` = Tailwindの`2.75rem`）という数値自体は指摘・既存実装（ZeroStartStepper）で既に採用されている基準であり、本フィーチャーで新たに基準値を検討し直すことはしない。
- 本フィーチャーはスタイル調整のみであり、コンポーネントの props・振る舞い（クリックハンドラの発火条件等）は変更しない。
- 対象範囲は指摘された6箇所（AppHeader、GroupDetail×2、CustomerOrder×2、QuantityPicker×2ボタン）に限定する。他にも同様の32px/40pxアイコンボタンが存在する可能性はあるが、本レビューで指摘された箇所以外への網羅的な適用は本フィーチャーのスコープ外とする。
