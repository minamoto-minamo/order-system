---
name: codex-execution
description: Claude用。設計済みの変更、レビュー指摘、開発要望、調査、検証、Lint、単体テスト、e2e、テスト拡張・改修をCodex実行担当へ渡すため、目的・スコープ・変更候補ファイル・受け入れ条件・検証コマンドを含む実行指示を作り、codex@openai-codex pluginの /codex:rescue に委譲する。ユーザーが「Codexでやって」「Codexに任せて」「実行担当に渡す」「Codexへ渡して」と言った時に使う。
---

# Codex実行ハンドオフ

Claudeは設計・レビュー担当、Codexは実行担当。Codexへ渡す時は、作業で迷わない粒度まで具体化し、`codex@openai-codex` plugin の `/codex:rescue` に委譲する。

Codexの役務は開発だけではない。次もCodex担当に含める。

- コード変更、バグ修正、リファクタ
- Lint / typecheck / build の実行と失敗修正
- 単体テストの追加・改修・実行
- e2e テストの追加・改修・実行
- CI失敗やローカル検証失敗の原因調査
- Claude設計と現行コードの矛盾検出

## 手順

1. `/codex:setup` 済みであることを前提にする。Codexが未設定・未認証なら、先にユーザーへ `/codex:setup` 実行を案内する。
2. 現行コードと `CLAUDE.md` / package別 `CLAUDE.md` を読んで、設計が現状に合うことを確認する。
3. 実装範囲と非対象を分ける。非対象がない場合も「非対象: なし」と明記する。
4. 変更候補ファイルを列挙する。推測なら「候補」と書く。
5. 受け入れ条件を、ユーザー操作・API応答・DB状態・表示状態など観測可能な形で書く。
6. 必要な検証コマンドを、狭い順に並べる。
7. 不明点や設計リスクが残る場合、Codexに実装させず先にユーザーへ確認する。
8. 次の形式で `/codex:rescue` に渡す。小さいタスクは `--wait`、複数ファイル・DB・UI・テスト追加を含むタスクは `--background` を推奨する。

```text
/codex:rescue --background --fresh
あなたはorder-systemの実行担当です。以下のhandoffを実行してください。
実装前に現行コードと照合し、矛盾があれば実装せず報告してください。
変更は最小差分にしてください。変更した挙動にはfocused testsを追加・更新してください。必要ならLint、単体テスト、e2eテストも拡張・改修してください。
最後に変更ファイル、実行した検証、省略した検証、残リスクを報告してください。

〈handoff本文〉
```

## Handoff本文の形式

```md
# Codex Implementation Handoff

## Goal
- 何を実現するか。

## Background
- なぜ必要か。
- Claude側で決めた設計判断。

## Scope
- 実装対象。

## Non-goals
- 今回やらないこと。

## Likely Files
- `path/to/file.ts`: 変更理由。

## Implementation Notes
- 実装手順。
- 既存パターンや利用すべきヘルパー。
- 注意すべき不変条件。

## Acceptance Criteria
- [ ] 観測可能な完了条件。

## Verification
- `pnpm ...`: 何を確認するか。
- Lint / typecheck / unit / e2e のうち必要なものを明記する。
- テスト自体の追加・改修が必要な場合は、その方針も明記する。

## Risks / Open Questions
- 残リスク。なければ「なし」。
```

## Plugin運用

- 同一タスクの続きは `/codex:rescue --resume` を使う。
- 進捗確認は `/codex:status` を使う。
- 完了結果の取得は `/codex:result <job-id>` を使う。
- ClaudeはCodexの代わりに実装しない。Codex起動に失敗した場合は失敗内容を報告して止める。

## 規律

- Codexに「いい感じに直して」と渡さない。
- 設計の根拠となるファイルパスを入れる。
- 実装判断をCodexに委ねる箇所は、許容範囲を明記する。
- 秘密情報やローカル環境値を含めない。
- Codexに渡した `/codex:rescue` の実行モード（`--wait` / `--background` / `--fresh` / `--resume`）をユーザーに伝える。
