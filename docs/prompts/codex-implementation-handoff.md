# Codex Implementation Handoff Template

Claude が設計を完了し、Codex が実装する時に使うテンプレートです。

## Goal

- 実現すること。

## Background

- 背景。
- Claude 側で決めた設計判断。

## Scope

- 実装対象。

## Non-goals

- 今回やらないこと。

## Likely Files

- `path/to/file`: 変更理由。

## Implementation Notes

- 実装手順。
- 既存 pattern、使うべき helper、不変条件。

## Acceptance Criteria

- [ ] 観測可能な完了条件。

## Verification

- `pnpm typecheck`: 確認内容。
- `pnpm test`: 確認内容。

## Risks / Open Questions

- 残リスクや未確認事項。なければ「なし」。

## Codex Plugin Command

```text
/codex:rescue --background --fresh
あなたはorder-systemの実行担当です。以下のhandoffを実行してください。
実装前に現行コードと照合し、矛盾があれば実装せず報告してください。
変更は最小差分にしてください。変更した挙動にはfocused testsを追加・更新してください。必要ならLint、単体テスト、e2eテストも拡張・改修してください。
最後に変更ファイル、実行した検証、省略した検証、残リスクを報告してください。

〈このhandoff本文〉
```
