# S400 — Admin Menu

## Purpose
管理者用メニュー画面の仕様（各管理画面へのナビゲーション）。

## Audience
管理者、フロント実装者

## ID / Path / Devices / Auth
- ID: S400
- Path: `/admin`
- Devices: Desktop / Tablet
- Auth: admin required

## Summary
商品設定・席設定・レポート・設定・スタッフへのリンクを提供するダッシュボード。

## UI Elements
- Cards / Links for each admin function
- Quick status widgets (current session, alerts)

## API / Socket
- GET `/api/auth/me` (auth check)

## Acceptance Criteria
- 未認証/非管理者はリダイレクトされる。リンクで各画面に遷移可能。

