# Research: 数量単位・レポート単位表記のi18n集約

Phase 0 output. Technical ContextにNEEDS CLARIFICATIONは残っていないため、実装方針の確認のみ記録する。

## R1: 翻訳キーの配置場所・命名

**Decision**: `frontend/src/i18n/locales/ja.ts`の`common`名前空間に`personUnit: '名'`を、`report`名前空間に`hourLabel: '{{hour}}時'`・`countUnit: '{{qty}}件'`を追加する。

**Rationale**: `common`名前空間には既に複数画面で共有される汎用文言（`perPerson: '/ 人'`、`unknownGroup: 'グループ{{id}}'`等）が定義されており、`personUnit`は3画面共通で使う単位表記のため同じ名前空間が適切。`report`名前空間には既に`sessionDateTime: '{{month}}月{{day}}日 {{hour}}:{{minute}}'`のようなプレースホルダー付きの日次レポート専用文言が存在し、同じパターン（`{{変数名}}`によるi18next標準の補間構文）を踏襲できる。

**Alternatives considered**: 新規の名前空間（例: `units`）を新設する案 — 対象が3+2の5箇所のみで、既存の`common`/`report`に自然に収まる規模のため、新規名前空間追加は過剰実装と判断し不採用。

## R2: プレースホルダー構文

**Decision**: `report.hourLabel`・`report.countUnit`は`{{hour}}`・`{{qty}}`のi18next標準補間構文を使い、`t('report.hourLabel', { hour: h.hour })`・`t('report.countUnit', { qty: item.qty })`の形で呼び出す。

**Rationale**: 既存の`report.sessionDateTime`（`{{month}}月{{day}}日 {{hour}}:{{minute}}`）が同じ補間構文を使っており、`t()`呼び出し時に第2引数でオブジェクトを渡すパターンが既にリポジトリ内に確立されている。新規の書式・ヘルパー関数は不要。

**Alternatives considered**: 単位文字のみを翻訳キー化し、数値部分は呼び出し側でテンプレートリテラル結合する案（例: `` `${h.hour}${t('report.hourUnit')}` ``）— i18nの本来の目的（言語ごとに語順・接辞が異なりうる）に対応できない（例: 英語では"Hour {{hour}}"のように数値の前に単位が来る言語がありうる）ため、i18next標準の補間構文を使う本方式を採用する。

## R3: `personUnit`の呼び出し方

**Decision**: `<QuantityPicker unit={t('common.personUnit')} />`の形で、`unit`プロパティに`t()`の戻り値をそのまま渡す。

**Rationale**: `QuantityPicker`コンポーネント自体のインターフェース（`unit: string`）は変更不要。呼び出し側3箇所でリテラル文字列を`t()`呼び出しに差し替えるだけで済み、影響範囲を最小化できる。

**Alternatives considered**: `QuantityPicker`コンポーネント内部でデフォルトの単位をi18nキーから解決する案 — `QuantityPicker`は他の用途（人数以外の数量指定）でも使われる汎用コンポーネントであり、コンポーネント内部に「人数」概念を持ち込むのは責務の混在になるため不採用。呼び出し側で明示的に指定する現行方式を維持する。

## R4: 表示結果の回帰確認方法

**Decision**: 既存のユニットテスト・スナップショットテストがある場合はそのまま実行し、テキスト内容（「名」「時」「件」を含む文字列）が変わらないことを確認する。新規のE2Eシナリオ追加は不要。

**Rationale**: `t()`関数はテスト環境でも実際の`ja.ts`翻訳リソースを解決するため（i18nextの標準的なテスト設定を前提）、キー参照に変えても解決される文字列は同一になる。表示結果の変更がないことはFR-005で明記されており、既存テストのグリーン維持で十分に検証できる。
