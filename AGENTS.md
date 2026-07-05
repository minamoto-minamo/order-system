# Repository Guidelines

## Project Structure & Module Organization

このリポジトリは pnpm TypeScript ワークスペースの居酒屋注文システムです。`frontend/` は React 18 + Vite アプリで、UI は `frontend/src/components`、hooks は `frontend/src/hooks`、stores は `frontend/src/stores`、API 補助は `frontend/src/lib`、スタイルは `frontend/src/styles`、Jest テストは `frontend/src/__tests__` に置きます。`backend/` は Fastify + Socket.io API で、routes は `backend/src/routes`、plugins は `backend/src/plugins`、utilities は `backend/src/lib`、Prisma は `backend/prisma`、Jest テストは `backend/src/__tests__` に置きます。共有型は `shared/types`、Playwright は `e2e/` と `e2e/helpers`、ドキュメントは `docs/` です。

## Agent Collaboration Model

Claude は設計・レビュー担当、Codex は実行担当です。Claude からタスクを受け取ったら、設計を起点にしつつ、編集前に必ず現行コードと照合します。Codex の担当には開発、調査、Lint、単体テスト、e2e、テスト追加・改修、型チェック・ビルド、検証失敗の原因調査と修正が含まれます。設計と現行コードが矛盾する場合は、無理に進めず差分を報告します。Codex 側は `.agents/skills/implement-from-design`、Claude 側は `.claude/skills/codex-execution` を使います。

## Build, Test, and Development Commands

- `pnpm install`: ワークスペース依存関係をインストール。
- `pnpm setup`: ローカル env ファイルと secret を生成。
- `pnpm dev`: frontend `http://localhost:5173` と backend `http://localhost:3000` を起動。
- `pnpm build`: frontend と backend をビルド。
- `pnpm typecheck`: 全ワークスペースの TypeScript 型チェック。
- `pnpm test`: frontend/backend の Jest テスト。
- `pnpm test:e2e`: `e2e/` の Playwright テスト。
- `pnpm --filter backend db:migrate`: ローカル Prisma migration を適用。
- `pnpm --filter backend db:seed`: 開発データを投入。

## Coding Style & Naming Conventions

TypeScript modules と `@order-system/shared` などの既存 alias を使います。既存スタイルに合わせ、2スペースインデント、セミコロン、責務を絞った utility module、React component は PascalCase（例: `CourseModal.tsx`）、hooks は `useX.ts` とします。backend route は `orders.ts` のような小文字 domain 名です。lint script はないため、提出前に `pnpm typecheck` と関連テストを実行します。

## Testing Guidelines

Jest は frontend/backend の unit/integration test を担当します。テスト名は `*.test.ts` とし、各 package の `src/__tests__/` に置きます。Playwright spec は `e2e/s05-login.spec.ts` のような順序付き scenario 名です。共通 setup は `e2e/helpers` に置きます。DB 変更では e2e の前に migration と seed を確認します。

## Implementation Handoffs

実装依頼には goal、scope、変更候補ファイル、acceptance checks、non-goals を含めます。Claude からの handoff は `codex@openai-codex` plugin の `/codex:rescue` 経由で渡される前提です。Codex は handoff を読み、現行コードと照合してから実装します。変更範囲を絞り、変更した挙動のテストを追加・更新し、実行したコマンドと省略した検証を報告します。

## Commit & Pull Request Guidelines

最近の commit は `feat:` や `refactor:` などの Conventional Commit prefix と短い日本語説明です。例: `feat: 注文一覧に絞り込みを追加`。PR には挙動の要約、実行したテスト、関連 issue/task、UI 変更時の screenshot/recording を含めます。

## Security & Configuration Tips

生成された secret やローカル DB 認証情報は commit しません。runtime configuration は `env/backend.env` に置きます。`pnpm setup` で想定されるローカルファイルを作成できます。Prisma command はこの env に依存するため、migration/deploy/seed 前に `DATABASE_URL` を確認します。
