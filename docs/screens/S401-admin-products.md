# S401 — Admin Products

## Purpose

商品管理（カテゴリ/商品/飲み放題/コース）の操作仕様。

## Audience

管理者、フロント実装者

## ID / Path / Devices / Auth

- ID: S401
- Path: `/admin/products`
- Devices: Desktop
- Auth: admin required

## Summary

カテゴリツリーと商品一覧の CRUD、および品切れ/テイクアウト区分管理。

## UI Elements

- Category tree, product list, product modal, sold-out toggle
- Drink plan / Course editors

## API / Socket

- CRUD endpoints: /api/menus, /api/categories, /api/subcategories
- Socket: menu:soldout

## Acceptance Criteria

- 商品 CRUD が正しく反映され、soldOut は即時配信される。
