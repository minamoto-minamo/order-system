---
type: Screen
id: S403
title: 日次レポート
description: セッション単位の売上レポート。サマリーカード、カテゴリ別円グラフ、時間帯別積み上げ、ランキングを表示する画面。
resource: frontend/src/pages/admin/DailyReport/DailyReport.tsx
tags: [admin]
---

# 日次レポート

セッション単位の売上レポート表示。管理者・データ担当 向け。

- Path: `/admin/report`
- Devices: Desktop / Tablet
- Auth: admin required

## 概要

サマリーカード、カテゴリ別円グラフ、時間帯別積み上げ、ランキングを表示する。

## UI 要素

- Session selector、summary cards、donut chart、stacked area chart、ranking table

## 連携する API・Socket

- `GET /api/sessions`
- `GET /api/sessions/:id/report`

参照: [Sessions API](../api/endpoints/sessions.md) / [Reports API](../api/endpoints/reports.md)

## 満たすべき条件

- 選択セッションの集計が API 結果と一致する。
