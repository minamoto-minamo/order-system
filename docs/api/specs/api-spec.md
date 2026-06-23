# API Spec — Overview

## Purpose

API 全体の概要とバージョン、契約 (contract) を明記する。

## Audience

フロント実装者、バックエンド実装者、QA、Ops

## Contents

- Version: v1
- Base URL: `/api`
- Authentication: Bearer token (JWT)
- Error format: { "error": { "code": "string", "message": "string", "details": null }}

## Conventions

- 時刻は ISO 8601 (UTC) を使用
- リソース ID はプレフィックス付き (例: `g_1`, `m_1`)
- ステータス変更は 200/204 を返し、body に最新リソースを返すこと

## Pagination

- Query: `?page=1&perPage=50`
- Response: `meta: { total, page, perPage }`

## Error handling

- 400: validation error
- 401: unauthorized
- 403: forbidden
- 404: not found
- 500: internal server error

## Versioning

- Breaking change は major version を増やす
- 新しいフィールドは後方互換性を保ちながら追加する

## Notes

詳細なエンドポイント仕様は ../endpoints/E000-endpoints.md および各 E### ファイルを参照する。
