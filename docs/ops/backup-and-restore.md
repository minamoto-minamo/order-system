---
type: Runbook
title: Backup and Restore
description: DB のバックアップ・復旧手順。DBA / SRE 向け。
tags: [ops, backup, restore, database]
---

# Backup and Restore

DB のバックアップと復旧の手順をまとめる。DBA / SRE 向け。

## Backup

バックアップコマンドの例:

```bash
pg_dumpall -U postgres -h <host> -f /backups/order_system_$(date +%F).sql
```

生成したファイルは durable storage（S3）へ転送する。

## Restore

復旧コマンドの例:

```bash
psql -U postgres -h <host> -f /backups/<file>.sql
```

## Verification

定期的に staging へのリストアテストを実施し、バックアップの妥当性を検証する。
