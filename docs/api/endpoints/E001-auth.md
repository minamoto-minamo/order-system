# E001 — Auth

## Purpose

認証に関する REST API。ログイン、ログアウト、ログインユーザー取得。

## Audience

フロント実装者、バックエンド実装者

## ID / Paths / Auth

- ID: E001
- Base: `/api/auth`
- Auth: none（login / logout）、httpOnly cookie（その他）

## Summary

- POST `/api/auth/login` — ログイン（username/password）
- POST `/api/auth/logout` — ログアウト（cookie クリア）
- GET `/api/auth/me` — ログイン中のユーザー情報取得

## Request / Response (例)

POST /api/auth/login

Request (application/json):

```json
{
  "username": "admin",
  "password": "secret"
}
```

Response 200 — JWT を httpOnly cookie `token` にセット:

```json
{
  "id": 1,
  "username": "admin",
  "role": "admin"
}
```

Response 401:

```json
{ "error": "認証情報が正しくありません" }
```

---

GET /api/auth/me

Response 200:

```json
{
  "id": 1,
  "username": "admin",
  "role": "admin"
}
```

---

POST /api/auth/logout

Response 200:

```json
{ "ok": true }
```

## Acceptance Criteria

- ログイン成功で 200、JWT を httpOnly cookie にセット、`{ id, username, role }` を返す
- 認証失敗で 401 を返す
- ログアウトで cookie をクリアする
- GET /me は認証済みユーザーの情報を返す（未認証は 401）

## Notes

JWT は httpOnly cookie（名前: `token`）でやり取りする。Bearer トークンは使用しない。
JWT の有効期限は環境変数 `JWT_EXPIRES_IN`（デフォルト `8h`）。
