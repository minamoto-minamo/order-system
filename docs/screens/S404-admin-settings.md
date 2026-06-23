# S404 — Admin Settings

## Purpose

店舗設定・税率・営業終了時刻などの編集仕様。

## Audience

管理者, 運用担当

## ID / Path / Devices / Auth

- ID: S404
- Path: `/admin/settings`
- Devices: Desktop
- Auth: admin required

## Summary

Setting レコードの編集と即時配信（settings:updated）。

## UI Elements

- Form: storeName, closingTime, taxRateInHouse, taxRateTakeout
- Save button

## API / Socket

- GET `/api/settings`
- PUT `/api/settings` (emit settings:updated)

## Acceptance Criteria

- 設定変更が保存され、Socket で配信される。
