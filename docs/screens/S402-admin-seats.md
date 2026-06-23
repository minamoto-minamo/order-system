# S402 — Admin Seats

## Purpose

席レイアウトエディタの仕様（ドラッグ&ドロップ）を定義する。

## Audience

管理者、フロント実装者, QA

## ID / Path / Devices / Auth

- ID: S402
- Path: `/admin/seats`
- Devices: Desktop
- Auth: admin required

## Summary

グリッドでテーブルと席を配置、保存するとホール画面へ即時反映される。

## UI Elements

- Palette (table, seat types), canvas grid, save button, seat editor

## API / Socket

- GET/POST/PUT/DELETE `/api/seats`, `/api/seat-tables`

## Acceptance Criteria

- 保存後 GET /api/seats の結果に変更が反映される。使用中の席は削除不可。
