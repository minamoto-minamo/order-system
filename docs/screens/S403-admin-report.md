# S403 — Admin Report

## Purpose

セッション単位の売上レポート表示仕様。

## Audience

管理者、データ担当

## ID / Path / Devices / Auth

- ID: S403
- Path: `/admin/report`
- Devices: Desktop / Tablet
- Auth: admin required

## Summary

サマリーカード、カテゴリ別円グラフ、時間帯別積み上げ、ランキングを表示する。

## UI Elements

- Session selector, summary cards, donut chart, stacked area chart, ranking table

## API / Socket

- GET `/api/sessions`
- GET `/api/sessions/:id/report`

## Acceptance Criteria

- 選択セッションの集計が API 結果と一致すること。
