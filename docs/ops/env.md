# Env

## Purpose
環境変数一覧（開発・本番）と説明。

## Audience
開発者、運用担当

## Variables
- NODE_ENV: development|production
- PORT: Listen port (default 3000)
- DATABASE_URL: PostgreSQL connection string
- JWT_SECRET: Secret for JWT signing
- CORS_ORIGIN: Allowed origins for frontend
- JWT_EXPIRES_IN: e.g. 8h

## Notes
Do not commit .env to VCS. Use secrets manager in production.

