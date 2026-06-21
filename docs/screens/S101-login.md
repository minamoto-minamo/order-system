# S101 — Login

## Purpose
管理者ログインの操作仕様。

## Audience
フロント実装者、QA

## ID / Path / Devices / Auth
- ID: S101
- Path: `/login`
- Devices: Desktop / Tablet / Mobile
- Auth: none

## Summary
パスワード入力による認証。成功時に httpOnly cookie を受け取り管理画面へ遷移。

## UI Elements
- Password input
- Login button
- Error message area

## Actions / Flows
- Submit password → POST `/api/auth/login`
- On success → Set-Cookie(token) + redirect to `/admin`

## API / Socket
- POST `/api/auth/login`
- GET `/api/auth/me` (for auth check)

## Acceptance Criteria
- 正常な資格情報で cookie がセットされること。
- エラー時は適切なメッセージ表示。

## Notes
- Rate-limiting configured on backend; show friendly error.

