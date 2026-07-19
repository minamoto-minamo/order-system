# Research: タップ領域サイズの不整合を解消する

Phase 0 output. 本フィーチャーはspec.mdに[NEEDS CLARIFICATION]マーカーが残っていないため、技術的な実装方針の調査結果のみを記録する。

## R1: 当たり判定拡張の実装パターン

**Decision**: `frontend/src/components/primitives/ZeroStartStepper/index.tsx`が既に採用しているパターンをそのまま踏襲する。外側の`BaseButton`（または`button`/`IconButton`）要素に`min-w-11 min-h-11 flex items-center justify-center`を付与し、視覚要素（アイコン・文字・円）は内側の`<span>`にそのままのサイズで配置する。

**Rationale**:
- 既に同一リポジトリ内に確立されたパターンがあり、新規概念・新規コンポーネントを持ち込まない（「シンプル第一」原則）。
- `min-w-`/`min-h-`を使うことで、内側コンテンツがそれより大きい場合でも縮小されず、44px未満になることがない。
- `flex items-center justify-center`により、内側の視覚要素が拡張された当たり判定の中央に配置され、見た目のズレが生じない。

**Alternatives considered**:
- `padding`で直接ボタン要素を拡張する（`w-8 h-8` → `p-1.5` 等でクリック領域を広げる）: 視覚サイズ自体も一緒に広がってしまい、FR-005（視覚サイズ変更禁止）に抵触するため不採用。
- 疑似要素（`::before`）でクリック領域だけ拡張する: CSSのみで完結するが、Tailwindユーティリティクラスのみで完結する既存パターン（ZeroStartStepper）と一貫しない実装になり、保守性が下がるため不採用。

## R2: `AppHeader`のハンバーガーメニューボタンへの適用

**Decision**: `IconButton`の`className`を`w-8 h-8 flex flex-col justify-center items-center gap-1.25 bg-transparent rounded-md`から、`min-w-11 min-h-11 flex flex-col justify-center items-center gap-1.25 bg-transparent rounded-md`に変更する（`w-8 h-8`を`min-w-11 min-h-11`に置き換えるのみ）。内側の3本線（`span`要素、`w-4.5 h-[1.5px]`）はサイズ変更しない。

**Rationale**: 現状`w-8 h-8`は固定サイズのボタン全体を表しており、視覚要素（3本線）は内側に別途サイズ指定されている。`w-8 h-8`を`min-w-11 min-h-11`に置き換えるだけで、視覚要素のサイズはそのまま、外枠の当たり判定のみが拡張される。

## R3: `GroupDetail`・`CustomerOrder`のアイコンボタンへの適用

**Decision**: いずれも`w-8 h-8 flex items-center justify-center rounded-md ...`という同型のクラス構成であるため、`w-8 h-8`を`min-w-11 min-h-11`に置き換える。

**Rationale**: R2と同じ理由。両画面とも`IconButton`の直下にアイコン（`Icon`コンポーネント等、固定サイズ）が配置されており、外枠のサイズ指定を変更するだけで視覚要素に影響しない。

**Alternatives considered**: `AppHeader`と共通の`IconButton`バリアント（例: `size="lg"`のようなprops）を新設する案 — 対象4箇所すべてで`className`直接指定によるTailwindユーティリティの上書きが既存パターンであり、共通コンポーネントへの新規propsは今回の変更範囲を超える抽象化になるため不採用（「シンプル第一」「影響を最小化する」原則）。

## R4: `QuantityPicker`への適用

**Decision**: `QuantityPicker/index.tsx`の−・＋ボタン（`<button>`要素、`w-10 h-10 rounded-full border border-line bg-white text-xl text-dim cursor-pointer flex items-center justify-center`）を、`ZeroStartStepper`と同じ二層構造（外側`min-w-11 min-h-11`の当たり判定＋内側`w-10 h-10`（または`ZeroStartStepper`に合わせた`w-7.5 h-7.5`相当）の視覚円）に変更する。

**Rationale**: 現状`QuantityPicker`は単一の`<button>`要素にサイズと見た目のスタイルが両方乗っており、`w-10 h-10`をそのまま`min-w-11 min-h-11`に置き換えると視覚サイズも40px→44pxに変わってしまい、FR-005（視覚サイズ変更禁止）に抵触する。そのため`ZeroStartStepper`と同様、外側要素（当たり判定用）と内側要素（視覚用の円）を分離する構造変更が必要。

**Alternatives considered**: `<button>`に`min-w-11 min-h-11`を追加しつつ内側の見た目用`<span>`に既存の`w-10 h-10`スタイルをそのまま移すだけの最小差分案（`ZeroStartStepper`が使う`BaseButton`ラッパーは使わず素の`<button>`のまま） — `ZeroStartStepper`との実装方式の一貫性はやや下がるが、`QuantityPicker`は`unit`表示など`ZeroStartStepper`にはない独自propsを持ち、`BaseButton`への置き換えは差分が広がるため、こちらを採用する（視覚・構造ともに二層化するが、ラッパーコンポーネント自体は変更しない）。

## R5: 隣接ボタンとの当たり判定重なり（Edge Case対応）

**Decision**: `AppHeader`の戻る矢印ボタン（`breadcrumb`、`px-2 py-0.5`のパディングベース、対象外）とハンバーガーメニュー、`GroupDetail`のQR表示・席変更ボタン間の既存の`gap`（`gap-2`/`gap-3`相当）を実装時に確認し、44px化後も視覚的な重なりが生じないことを目視確認する。既存レイアウトの`gap`値はいずれも8px以上あり、44px化しても隣接ボタンの当たり判定同士が重ならない見込みだが、確定的な判定はPhase 2のquickstart手動確認で行う。

**Rationale**: レイアウトの実測はコード上の静的解析だけでは断定できないため、実装後の目視確認をquickstart.mdの検証手順に含める。
