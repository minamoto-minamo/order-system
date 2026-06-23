# Migrations

## Purpose

Prisma マイグレーションの運用手順と注意点。

## Audience

バックエンド実装者、デプロイ担当

## Local / Dev

- schema 変更後: `pnpm --filter backend db:migrate` を実行してローカルを更新
- マイグレーションは必ずレビューを経て main へマージ

## Staging / Production

- CI で `prisma migrate deploy` を実行してマイグレーションを適用
- 事前にバックアップ（スナップショット）を取る
- 破壊的変更は段階的に行い、トラフィックが低い時間帯を選定

## Rollback

- Prisma は自動ローリングバックを提供しないため、ロールバック手順を用意する（マイグレーション前の DB バックアップを復元）

## Notes

- マイグレーションはスキーマだけでなく、既存データの移行スクリプトを含めること。
- `DATABASE_URL` の取り扱いに注意（環境ごとに別設定）。
