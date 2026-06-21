# Runbook

## Purpose
開発・運用担当向けの起動手順と日常運用手順。

## Audience
開発者、運用担当

## Quick Start (dev)
1. pnpm install
2. pnpm setup
3. pnpm db:up
4. pnpm --filter backend db:migrate
5. pnpm --filter backend db:seed
6. pnpm dev

## Production
- Build: pnpm build
- Migrate: pnpm --filter backend db:migrate
- Start service via systemd/container runtime

## Health & Logs
- Health: curl -f http://localhost:3000/health
- Logs: journalctl -u order-backend

