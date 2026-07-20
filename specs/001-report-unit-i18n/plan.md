# Implementation Plan: 数量単位・レポート単位表記のi18n集約

**Branch**: `001-report-unit-i18n` | **Date**: 2026-07-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-report-unit-i18n/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

5箇所（`CourseConfirmModal.tsx`・`CourseTab.tsx`・`CreateGroupSheet.tsx`の`QuantityPicker unit="名"`直書き3箇所、`HourlyChart.tsx`・`RankingSection.tsx`のテンプレートリテラル直書き2箇所）を、`frontend/src/i18n/locales/ja.ts`に新設する翻訳キー（`common.personUnit`、`report.hourLabel`、`report.countUnit`）経由の`t()`呼び出しに置き換える。表示結果は変更しない（純粋な参照方法の変更）。

## Technical Context

**Language/Version**: TypeScript（React 18）。既存の`frontend`ワークスペースの構成に従う。

**Primary Dependencies**: react-i18next（既存、新規追加なし）。

**Storage**: N/A（UI表示文言の変更のみ）。

**Testing**: Jest + React Testing Library（`frontend`ワークスペースの既存ユニットテスト構成）。表示結果が変わらないため新規のE2Eシナリオ追加は不要。

**Target Platform**: 既存フロントエンド（Vite + React、ブラウザ）。

**Project Type**: Web application（`frontend` + `backend` + `shared`のpnpmワークスペース構成、既存）。本フィーチャーは`frontend`のみを変更する。

**Performance Goals**: 既存の表示性能を維持する（i18nキー参照はすでに広く使われている既存の仕組みであり、追加コストは無視できる）。

**Constraints**: 表示される文字列・レイアウトを変更しない（spec.md FR-005）。

**Scale/Scope**: 変更対象は既存5ファイル（`CourseConfirmModal.tsx`、`CourseTab.tsx`、`CreateGroupSheet.tsx`、`HourlyChart.tsx`、`RankingSection.tsx`）と`ja.ts`への翻訳キー3件追加。新規ファイル・新規モジュールの追加なし。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

`.specify/memory/constitution.md`はプロジェクト固有の原則が未記入のテンプレート状態であり、本フィーチャーに適用可能な明文化されたgateは存在しない。代わりにリポジトリの`CLAUDE.md`（プロジェクトルート・`frontend/CLAUDE.md`）の原則を判断基準とする。

- **シンプル第一**: 新規モジュール・抽象化を追加せず、既存5ファイルの該当箇所とi18nファイルへのキー追加のみを行う。✅
- **影響を最小化する**: 変更範囲を指摘された5箇所に限定する。他の同種のハードコードが見つかっても本フィーチャーでは対応しない（Assumptions参照）。✅
- **UI文言はすべてi18n/locales/ja.tsに定義**（`frontend/CLAUDE.md`）: 本フィーチャーはこのルールへの準拠を回復する変更そのもの。✅
- **手を抜かない**: 変更した5箇所それぞれについて、表示結果が変わらないことを検証するテストを確認・必要なら追加する。✅

違反なし。Complexity Trackingへの記載は不要。

## Project Structure

### Documentation (this feature)

```text
specs/001-report-unit-i18n/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md         # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

`contracts/`は生成しない。本フィーチャーはUI表示文言の参照方法のみを変更し、HTTP API・イベント等の外部インターフェース契約に変更がないため。

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── i18n/
│   │   └── locales/
│   │       └── ja.ts                 # 変更: common.personUnit, report.hourLabel, report.countUnit を追加
│   └── pages/
│       ├── group/GroupDetail/components/
│       │   ├── CourseConfirmModal.tsx  # 変更: unit="名" → t('common.personUnit')
│       │   └── CourseTab.tsx           # 変更: 同上
│       ├── hall/Hall/components/
│       │   └── CreateGroupSheet.tsx    # 変更: 同上
│       └── admin/DailyReport/components/
│           ├── HourlyChart.tsx         # 変更: `${h.hour}時` → t('report.hourLabel', { hour: h.hour })
│           └── RankingSection.tsx      # 変更: `${item.qty}件` → t('report.countUnit', { qty: item.qty })
└── tests/
    └── (既存テストに表示結果の回帰がないことの確認を追加、既存のテスト配置規約に従う)
```

**Structure Decision**: 既存の`frontend`ワークスペース内、既存5ファイルとi18nファイルのみを変更する。新規ディレクトリ・新規ファイルの追加はない。`backend`/`shared`への変更は不要。

## Complexity Tracking

*Constitution Checkに違反なし。本セクションへの記載事項なし。*
