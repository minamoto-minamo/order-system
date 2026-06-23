# S101 — Login

## Purpose

スタッフ・管理者ログインの操作仕様。

## Audience

フロント実装者、QA

## ID / Path / Devices / Auth

- ID: S101
- Path: `/login`
- Devices: Desktop / Tablet / Mobile
- Auth: none（認証済みユーザーがアクセスすると `/` へリダイレクト）

## Summary

ユーザー名・パスワード入力による認証。成功時に httpOnly cookie を受け取りホーム（`/`）へ遷移。ロールは `staff` / `admin` の2値。`admin` ロールのみ管理メニューへのアクセスが許可される。ホール・キッチンはロールではなくホーム画面で選択するモード。

## UI Elements

- Username input
- Password input
- Login button
- Error message area

## Actions / Flows

- Submit credentials → POST `/api/auth/login` { username, password }
- On success → Set-Cookie(token) + redirect to `/`

## API / Socket

- POST `/api/auth/login`
- GET `/api/auth/me` (for auth check)

## Acceptance Criteria

- 正常な資格情報で cookie がセットされること。
- エラー時は適切なメッセージ表示。

## Notes

- Rate-limiting configured on backend; show friendly error.
