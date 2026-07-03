---
type: Deploy Guide
title: Deploy Guide
description: デプロイ手順とロールバック手順。開発者・運用担当向け。
tags: [ops, deploy, ci-cd]
---

# Deploy Guide

デプロイとロールバックの手順をまとめる。開発者・運用担当向け。

デプロイは GHA → AWS ECS を前提とする。詳細は CI/CD 整備後に記載予定。

`Dockerfile` はプロジェクトルートに配置済み。frontend 静的ファイルを内包した単一イメージとしてビルドされる。

## ロールバック

- アプリケーション（イメージ）のロールバック手順は CI/CD 整備後に記載予定。
- デプロイに伴う `prisma migrate deploy` が途中で失敗した場合は [migrations.md のロールバック手順](../data-model/migrations.md) に従う。
