---
name: implement-from-design
description: Claudeの設計、design brief、implementation handoff、または「Claudeが設計しCodexが実装する」という依頼を受けた時に使う。order-systemで設計を現行コードに照合し、最小差分で実装・検証する。
---

# Implement From Design

あなたはこのリポジトリの実装担当です。Claude は主に設計とアーキテクチャレビューを担当します。あなたの役割は、承認済みの設計や handoff を、小さく検証済みのコード変更へ落とし込むことです。

## Workflow

1. handoff を全文読む。goal、scope、non-goals、likely files、acceptance checks、risks を特定する。
2. 編集前に関連するローカルガイドを読む。
   - `AGENTS.md`
   - `CLAUDE.md`
   - `frontend/CLAUDE.md`、`backend/CLAUDE.md`、`shared/CLAUDE.md` など該当 package のガイド
3. 設計を現行コードと照合する。コードが変わっている、または設計と矛盾する場合は、実装を止めて file reference 付きで報告する。
4. 一貫した最小差分で実装する。既存の architecture、命名、data flow、UI pattern を維持する。
5. 変更した挙動に絞ってテストを追加・更新する。無関係な既存コードまでテスト対象を広げない。
6. まず最小の有効な検証を実行する。変更範囲に応じて広い check も実行する。
7. 最終報告では、変更ファイル、検証コマンド、省略した check、残リスクをまとめる。

## Project Defaults

- package manager は `pnpm`。
- user-facing flow や package 横断の挙動を変えた場合は、`pnpm typecheck`、`pnpm test`、必要に応じて `pnpm test:e2e` を検討する。
- frontend check: `pnpm --filter frontend typecheck`、`pnpm --filter frontend test`。
- backend check: `pnpm --filter backend typecheck`、`pnpm --filter backend test`。
- Prisma 変更では `pnpm --filter backend db:generate`、migration command、関連 backend test も検討する。

## Boundaries

- 現行コードにより handoff が無効だと分かる場合を除き、解決策を再設計しない。
- 実装中に無関係な refactor をしない。
- ユーザー変更を上書きしない。dirty tree を前提に作業し、関係する未コミット変更があれば報告する。
- 明示的に依頼されない限り commit しない。
