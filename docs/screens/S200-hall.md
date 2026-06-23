# S200 — Hall

## Purpose

ホールの席一覧とグループ作成フローの仕様。

## Audience

フロント実装者、QA

## ID / Path / Devices / Auth

- ID: S200
- Path: `/hall`
- Devices: Mobile
- Auth: login + open session required（未認証は `/login`、セッション未開始は `/` へリダイレクト）

## Summary

席レイアウトを読み表示し、空席を複数選択してグループを作成する。

## UI Elements

- Seat grid (label, status badge)
- Multi-select, Create group button
- Guest count modal
- Warning banner for closing time

## Actions / Flows

- Fetch seats → GET `/api/seats`
- Create group → POST `/api/groups`
- Update UI on Socket events: group:created, seat:updated

## API / Socket

- GET `/api/seats`
- GET `/api/seat-tables` — テーブル枠の取得
- GET `/api/orders?status=ready` — 提供待ち注文数の取得
- POST `/api/groups`
- Socket（購読）: group:created, seat:updated, group:updated, order:created, order:updated, order:cancelled

## Acceptance Criteria

- 空席選択→グループ作成が可能。表示ステータスは groups(active) と一致。
