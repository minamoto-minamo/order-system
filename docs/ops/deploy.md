# Deploy

## Purpose

デプロイ手順とロールバック手順。

## Audience

開発者、運用担当

---

## デプロイ

デプロイは GHA → AWS ECS を前提とする。詳細は CI/CD 整備後に記載予定。

`Dockerfile` はプロジェクトルートに配置済み。frontend 静的ファイルを内包した単一イメージとしてビルドされる。
