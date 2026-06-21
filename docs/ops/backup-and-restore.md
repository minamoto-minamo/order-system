# Backup and Restore

## Purpose
DB のバックアップ/復旧手順。

## Audience
DBA, SRE

## Backup
- Example command:

```bash
pg_dumpall -U postgres -h <host> -f /backups/order_system_$(date +%F).sql
```

- Transfer the resulting file to durable storage (S3)

## Restore
- Example command:

```bash
psql -U postgres -h <host> -f /backups/<file>.sql
```


## Verification
- Periodic restore test to staging

