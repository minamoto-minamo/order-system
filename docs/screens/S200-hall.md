# S200 — Hall

## Purpose
ホールの席一覧とグループ作成フローの仕様。

## Audience
フロント実装者、QA

## ID / Path / Devices / Auth
- ID: S200
- Path: `/hall`
- Devices: Mobile
- Auth: none

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
- POST `/api/groups`
- Socket: group:created, seat:updated

## Acceptance Criteria
- 空席選択→グループ作成が可能。表示ステータスは groups(active) と一致。

