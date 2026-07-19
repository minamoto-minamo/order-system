# Phase 0 Research: デザイントークンのコントラストをWCAG AA基準に合わせて改善する

すべての決定事項は `/speckit-clarify`（2026-07-18セッション）で確定済み。本ドキュメントはその決定の技術的根拠（コントラスト比の算出）を記録する。

## Decision 1: takeoutボタンの実装方式

- **Decision**: 新規トークンを追加せず、既存の `amber-bg` (`#fef9e8`) / `amber-border` (`#fcd34d`) / `amber-fg` (`#92400e`) を再利用する。`BaseButton.tsx` の `takeout` バリアントを `'bg-amber text-white border-none'` から `'bg-amber-bg border border-amber-border text-amber-fg'` に変更する。
- **Rationale**:
  - 同一パターン（`bg-amber-bg border-amber-border text-amber-fg`）が既に `frontend/src/pages/kitchen/Kitchen/components/SidePanel.tsx:73` の `complete-btn`（ボタン要素）で使われており、既存の意味色運用と完全に一致する。新規トークンを増やす必要がない。
  - コントラスト比（相対輝度法、WCAG 2.1）: `amber-bg` (#fef9e8, 相対輝度 L≈0.9465) と `amber-fg` (#92400e, L≈0.0981) の比は **(0.9465+0.05)/(0.0981+0.05) ≈ 6.73:1**。AA基準4.5:1・実装目標5.5:1のいずれも満たす。
- **Alternatives considered**:
  - 新規の暗色トークン（`amber-dark`等）を追加し白文字のまま使う: 新規トークンが増え、既存の`complete-btn`と別パターンになり一貫性が下がるため不採用。

## Decision 2: order-pending-fg / order-ready-fg の色

- **Decision**: 既存の `order-pending` (#c97300) / `order-ready` (#d97706) と同一色相を保ったまま明度（HSVのV）のみを下げた濃色を新規トークンとして追加する。
  - `order-pending-fg` = `#8c5000`（元の色相 H≈34°, S=1.0 を維持し、V=0.55に低減）
  - `order-ready-fg` = `#8c4d04`（元の色相 H≈32°, S≈0.97 を維持し、V=0.55に低減）
- **Rationale**:
  - コントラスト比（相対輝度法）:
    - `order-pending-bg` (#ffedd5, L≈0.8664) × `order-pending-fg` (#8c5000, L≈0.1132) = **(0.8664+0.05)/(0.1132+0.05) ≈ 5.62:1**
    - `order-ready-bg` (#fef3c7, L≈0.8928) × `order-ready-fg` (#8c4d04, L≈0.1090) = **(0.8928+0.05)/(0.1090+0.05) ≈ 5.93:1**
  - いずれもAA基準4.5:1・実装目標5.5:1を満たす。
  - 元の色相を保つことで、pending（やや赤みの強いオレンジ）とready（やや黄みの強いオレンジ）という既存の視覚的な区別を維持する。
- **Alternatives considered**:
  - `amber-fg` (#92400e) をそのまま流用: pending/readyそれぞれの色相アイデンティティが失われ、amberトークングループとの意味的な混同を招くリスクがあるため不採用（`/speckit-clarify` Q2で明示的に不採用と決定）。

## Decision 3: コントラスト目標の余裕度

- **Decision**: WCAG AA最低基準（4.5:1）ではなく、5.5:1以上を実装目標とする。
- **Rationale**: 将来のテーマ微調整で再度基準を割り込むリスクを低減するため。上記Decision 1・2の算出値（6.73:1 / 5.62:1 / 5.93:1）はいずれもこの目標を満たす。
- **Alternatives considered**: 4.5:1ぎりぎりを狙う案は、将来の色調整で基準割れが再発しやすいため不採用。

## コントラスト比算出方法（共通）

WCAG 2.1 相対輝度（relative luminance）計算式を使用:

```
sRGBチャンネル c（0-1正規化）に対し:
  c_linear = c/12.92                        (c <= 0.03928)
  c_linear = ((c+0.055)/1.055)^2.4          (c > 0.03928)

L = 0.2126*R_linear + 0.7152*G_linear + 0.0722*B_linear

contrast(L1, L2) = (max(L1,L2)+0.05) / (min(L1,L2)+0.05)
```

対象は通常文字サイズ（`text-caption`等、太字18pt/14pt未満）としてWCAG AA基準4.5:1を採用する（AAAの7:1は対象外、既存specのAssumptions通り）。
