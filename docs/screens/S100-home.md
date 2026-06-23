# S100 — Home

## Purpose

アプリ起動時のモード選択と営業セッション操作の仕様。

## Audience

フロント実装者、QA、PM

## ID / Path / Devices / Auth

- ID: S100
- Path: `/`
- Devices: Mobile / Tablet / Desktop
- Auth: login required（未認証は `/login` へリダイレクト）

## Summary

モード（Hall / Kitchen / Admin）選択、現在セッション表示、営業開始・締め/再開操作を提供する。

## UI Elements

- Mode buttons: Hall, Kitchen, Admin
- Session badge: status (open/closed) and start time
- Action buttons: Start session, Close session, Reopen
- Admin link (small)

## Actions / Flows

- Start session → POST `/api/sessions`（admin のみ）
- Close session → PUT `/api/sessions/:id` { status: 'closed' }（admin のみ）
- Reopen session → PUT `/api/sessions/:id` { status: 'open' }（admin のみ）

## API / Socket

- GET `/api/sessions/current`
- GET `/api/settings` — 店舗名の表示
- POST `/api/sessions`（requireAdmin）
- PUT `/api/sessions/:id`（requireAdmin）
- Socket（購読）: session:updated, settings:updated

## Acceptance Criteria

- Mode buttons navigate to correct routes.
- Session start/close/reopen call APIs and reflect new status.

## Notes

- Confirmation modal required for closing sessions.
