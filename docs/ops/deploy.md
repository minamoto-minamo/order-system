# Deploy

## Purpose
本番リリース手順とロールバック手順の概要。

## Audience
SRE, Release engineers

## Steps
1. Build artifacts in CI
2. Deploy artifacts to servers/containers
3. Apply DB migrations
4. Restart services
5. Verify health checks

## Rollback
- Ensure DB backup before migration
- Rollback to previous artifact and restart

