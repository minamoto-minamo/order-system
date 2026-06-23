# S405 — Admin Staff

## Purpose

スタッフアカウント管理の仕様（CRUD）。

## Audience

管理者, フロント実装者

## ID / Path / Devices / Auth

- ID: S405
- Path: `/admin/staff`
- Devices: Desktop
- Auth: admin required

## Summary

スタッフの作成・編集・削除。パスワードはハッシュ保存。

## UI Elements

- Staff list, create/edit modal, delete confirmation

## API / Socket

- GET/POST/PUT/DELETE `/api/staff`

## Acceptance Criteria

- CRUD が API と一致して動作。パスワードは平文保存されない。
