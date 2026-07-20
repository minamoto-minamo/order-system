# Feature Specification: デザイントークンのコントラストをWCAG AA基準に合わせて改善する

**Feature Branch**: `001-color-contrast-aa`

**Created**: 2026-07-18

**Status**: Draft

**Input**: User description: "デザイントークンのコントラストをWCAG AA基準に合わせて改善する。設計レビュー（UI/UXデザイン観点、いずれもHigh）で以下2件のコントラスト不足が指摘された。(1) takeout系ボタンの白文字がアンバー背景でコントラスト不足（約2.15:1）。(2) 注文ステータスバッジ（order-pending / order-ready）のコントラスト不足（約3.08:1 / 約2.86:1）。根本原因はどちらも共通で、色トークン設計時にWCAG AA基準（通常文字4.5:1）のコントラスト検証が行われていなかったこと。既存の「淡い背景＋濃色-fgトークン」パターンへの統一を複数箇所に適用する。"

## Clarifications

### Session 2026-07-18

- Q: [F13] takeoutボタンの実装方針は、(A) 既存の`amber-bg`/`amber-border`/`amber-fg`トークンをそのまま再利用する（新規トークンなし）か、(B) 白文字のまま使うための新規暗色トークン（例: `amber-dark`）を新設するか、どちらにするか？ → A: (A) を採用。既存コードで`frontend/src/pages/kitchen/Kitchen/components/SidePanel.tsx`の`complete-btn`が既に`bg-amber-bg border-amber-border text-amber-fg`の組み合わせをボタンに使用しており、新規トークンを増やさず一貫性を保てる。`amber-bg`(#fef9e8)×`amber-fg`(#92400e)のコントラストは約6.73:1でAA基準に十分な余裕がある。
- Q: [F13] `order-pending-fg`/`order-ready-fg`の色は、(A) 既存の`order-pending`(#c97300)/`order-ready`(#d97706)と同じ色相を保ったまま明度のみ下げて新規に定義するか、(B) `amber-fg`(#92400e)の値をそのまま流用するか、どちらにするか？ → A: (A) を採用。pending/readyという別ステータスの色相アイデンティティを保つため、`amber-fg`の流用は避ける。算出値: `order-pending-fg` = `#8c5000`（`order-pending-bg` #ffedd5 に対し約5.62:1）、`order-ready-fg` = `#8c4d04`（`order-ready-bg` #fef3c7 に対し約5.93:1）。
- Q: [F13] コントラスト目標の余裕度は、(A) AA基準ぎりぎり（4.5:1以上5.0:1未満）を狙うか、(B) 5.5:1以上の余裕を持たせるか？ → B: (B) を採用。将来のテーマ調整・微修正で再度基準を割り込むリスクを下げるため、新規・変更する全トークンの組み合わせで5.5:1以上を確保する（上記2件のQ&Aで算出した値はいずれもこの基準を満たす）。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - テイクアウト注文確定ボタンの文言を読み取れる（Priority: P1）

店舗スタッフが会計画面・メニュー追加画面でテイクアウト注文を確定する際、「確認する」ボタンの文字を、厨房や明るい環境でも問題なく読み取れる。

**Why this priority**: テイクアウト注文確定は注文フローの最終操作であり、ボタン文言が読めないと誤操作・二重注文・注文取りこぼしに直結する。指摘の中でも業務影響が最も直接的なためP1とする。

**Independent Test**: `MenuAdd`のテイクアウト確定ボタンと`MenuConfirmModal`のテイクアウト注文確定ボタンを表示し、背景色と文字色のコントラスト比を測定して4.5:1以上であることを確認する。実装を伴わずに単独でリリース・検証できる。

**Acceptance Scenarios**:

1. **Given** テイクアウト注文の商品追加画面を開いている、**When** 「テイクアウトで確認する」相当のボタンを表示する、**Then** ボタン背景色とボタン文字色のコントラスト比がWCAG AA基準（通常文字4.5:1）を満たす。
2. **Given** テイクアウト注文確定モーダル（`MenuConfirmModal`）を開いている、**When** 確定ボタンを表示する、**Then** ボタン背景色とボタン文字色のコントラスト比がWCAG AA基準を満たす。
3. **Given** 修正後のtakeoutボタン、**When** 既存の他ボタン（primary/bill/dangerなど）と並べて表示する、**Then** テイクアウトであることが視覚的に区別できる色合いを保っている。

---

### User Story 2 - 注文ステータスバッジの状態を読み取れる（Priority: P2）

店舗スタッフが注文履歴を確認する際、「未調理」（order-pending）・「提供待ち」（order-ready）バッジの文字を、小さい文字サイズでも問題なく読み取れる。

**Why this priority**: 注文履歴の全注文行に表示される最頻出のステータス表示であり、読み取りミスは二重調理・提供漏れという業務ミスに直結する。ボタン単体の指摘（User Story 1）よりも表示箇所数が多く影響範囲が広いが、注文完了操作そのものを妨げるものではないためP2とする。

**Independent Test**: `OrderStatusBadge`で`order-pending`・`order-ready`それぞれの状態を表示し、バッジ背景色とバッジ文字色のコントラスト比を測定して4.5:1以上であることを確認する。User Story 1とは独立したファイル・トークンの変更であり、単独で検証・リリースできる。

**Acceptance Scenarios**:

1. **Given** 注文履歴に「未調理」（order-pending）状態の注文行がある、**When** ステータスバッジを表示する、**Then** バッジ背景色と文字色のコントラスト比がWCAG AA基準（通常文字4.5:1）を満たす。
2. **Given** 注文履歴に「提供待ち」（order-ready）状態の注文行がある、**When** ステータスバッジを表示する、**Then** バッジ背景色と文字色のコントラスト比がWCAG AA基準を満たす。
3. **Given** 修正後のorder-pending/order-readyバッジ、**When** 既存の他ステータスバッジ（amberなど、-fgパターンを持つグループ）と並べて表示する、**Then** 同一のトークン設計パターン（淡い背景＋濃色-fg文字）に沿っている。

---

### Edge Cases

- 新しく濃色化した文字色が、対象の背景色以外の場所（例：ダークモードや異なる背景上）で誤って使い回された場合、コントラストが再び不足する可能性がある。トークンの命名・用途をコンポーネント側で背景とセットで使うことを前提とする。
- 既存のamber/bill/dangerトークングループと色相・彩度の系統がずれると、意味色としての一貫性（同じ意味色ファミリーに見える）が崩れる可能性がある。
- テイクアウトボタンの色を「淡い背景＋濃色文字」パターンに変更した場合、他の主要アクションボタン（primary等）とのビジュアル上の強弱（プライマリ度合い）が変わる可能性がある。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: テイクアウト系ボタン（`BaseButton`の`takeout`バリアント）は、既存の`amber-bg`/`amber-border`/`amber-fg`トークン（新規トークンなし）を使い、背景色と文字色のコントラスト比が5.5:1以上でなければならない。
- **FR-002**: テイクアウト系ボタンの見た目は、修正後も他の意味色ボタン（primary/bill/danger等）と視覚的に区別可能でなければならない（テイクアウトであることが色で識別できる）。
- **FR-003**: 注文ステータスバッジのうち`order-pending`（未調理）状態は、新設する`order-pending-fg`（`#8c5000`）トークンを文字色に使い、`order-pending-bg`との組み合わせでコントラスト比が5.5:1以上でなければならない。
- **FR-004**: 注文ステータスバッジのうち`order-ready`（提供待ち）状態は、新設する`order-ready-fg`（`#8c4d04`）トークンを文字色に使い、`order-ready-bg`との組み合わせでコントラスト比が5.5:1以上でなければならない。
- **FR-005**: `order-pending-fg`/`order-ready-fg`は、既存の意味色グループ（amber/bill/danger）が採用している「淡い背景＋専用濃色`-fg`トークン」という命名・設計パターンに合わせ、それぞれ`order-pending`/`order-ready`と同じ色相を保った濃色でなければならない（`amber-fg`の値を流用しない）。
- **FR-006**: 修正はデザイントークン（色定義）とその適用箇所（テイクアウトボタン、注文ステータスバッジ）に限定し、指摘されていない他のコンポーネント・トークンの色は変更してはならない。
- **FR-007**: 新規・変更後の各色トークンの組み合わせ（背景色×文字色）について、コントラスト比の算出根拠（数値）を仕様または実装記録として残さなければならない。

### Key Entities

- **デザイントークン（色）**: `frontend/src/styles/tailwind.css`で定義される意味色（semantic color）のCSS変数群。背景色（`-bg`）・原色・濃色文字用（`-fg`）のバリエーションを持つグループ（amber, bill, danger, order-pending, order-readyなど）として管理される。
- **ボタンバリアント**: `BaseButton`が持つ見た目のバリエーション（primary/bill/danger/takeoutなど）。各バリアントは背景色トークンと文字色トークンの組み合わせで定義される。
- **注文ステータスバッジ**: `OrderStatusBadge`が注文の調理・提供状態（pending/ready等）に応じて表示するラベル。状態ごとに背景色トークンと文字色トークンの組み合わせを持つ。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: テイクアウト系ボタンの背景色と文字色のコントラスト比が5.5:1以上になる（現状の約2.15:1から改善、`amber-bg`×`amber-fg`で約6.73:1）。
- **SC-002**: `order-pending`バッジの背景色と文字色のコントラスト比が5.5:1以上になる（現状の約3.08:1から改善、`order-pending-bg`×`order-pending-fg`で約5.62:1）。
- **SC-003**: `order-ready`バッジの背景色と文字色のコントラスト比が5.5:1以上になる（現状の約2.86:1から改善、`order-ready-bg`×`order-ready-fg`で約5.93:1）。
- **SC-004**: 変更後も、修正対象の3箇所（takeoutボタン、order-pendingバッジ、order-readyバッジ）がそれぞれ独自の色相を保ち、他の意味色（amber/bill/danger等）と混同されない。
- **SC-005**: 設計レビューで指摘された2件のHigh指摘が、再レビューで解消済みと判定される。

## Assumptions

- コントラスト比の算出は[WCAG 2.1の相対輝度計算式](既存指摘で使われた計算方法)に準拠する。通常文字サイズ（`text-caption`等、18pt/14pt太字未満）を対象とし、AAの4.5:1を基準とする（AAAの7:1は対象外）。Clarificationsで確定した通り、実装では5.5:1以上の余裕を確保する。
- 新規トークンの具体的な色（HEX値）は、既存の色相（amberはオレンジ系統、order-pending/order-readyもオレンジ系統）を保ったまま明度・彩度のみ調整して基準を確保する方針とする。彩度・色相を大きく変える案は採用しない。Clarificationsで確定した値: `order-pending-fg` = `#8c5000`、`order-ready-fg` = `#8c4d04`。takeoutボタンは新規トークンを追加せず、既存の`amber-bg`/`amber-border`/`amber-fg`を再利用する。
- ダークモード対応は本フィーチャーのスコープ外とする（現行`tailwind.css`にダークモード専用の色定義がなければ、ライトモードの1系統のみを対象とする）。
- 対象は指摘された2箇所（takeoutボタン、order-pending/order-readyバッジ）に限定し、他の意味色グループ（bill/danger等）の色は指摘がないため変更しない。
