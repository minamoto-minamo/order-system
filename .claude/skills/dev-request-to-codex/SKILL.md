---
name: dev-request-to-codex
description: Claude用。レビュースキルを通さず、ユーザーの開発要望・機能追加・バグ修正依頼を整理し、codex-execution（①）へ渡すhandoffを作ってCodex実行担当へ委譲する。ユーザーが「これを開発して」「Codexに任せて」「レビューは不要で実行に回して」「開発要望をCodexへ渡して」と言った時に使う。
---

# 開発要望をCodex実装へ渡す

レビュー結果を起点にしない通常の開発要望を、`codex-execution`（①）へ渡せるhandoffに変換する。Claudeは設計と分解だけを担当し、実行はCodexへ委譲する。

## 手順

1. ユーザー要望を読む。
2. `CLAUDE.md` と該当 package の `CLAUDE.md` を読む。
3. 関連する既存コードを最小限読む。
4. 目的、実装対象、非対象、受け入れ条件を明確化する。
5. 曖昧で実装判断に影響する点があれば、Codexへ渡す前にユーザーへ確認する。
6. 方針が確定したら `codex-execution`（①）形式のhandoffを作る。
7. `/codex:rescue --background --fresh` または小さい変更なら `/codex:rescue --wait --fresh` で委譲する。

## 判断基準

- 小さい変更: 1〜2ファイル、仕様明確、テスト範囲明確。`--wait` でよい。
- 通常の開発: 複数ファイル、UI/API/DBをまたぐ、テスト追加あり。`--background` を推奨。
- 設計未確定: Codexへ渡さない。Claude側で質問してからhandoffを作る。

## Codexへ渡すプロンプト

```text
/codex:rescue --background --fresh
あなたはorder-systemの実行担当です。以下の開発要望handoffを実行してください。
実装前に現行コードと照合し、設計と現行コードが矛盾する場合は実装せず報告してください。
変更は最小差分にしてください。変更した挙動にはfocused testsを追加・更新してください。必要ならLint、単体テスト、e2eテストも拡張・改修してください。
最後に変更ファイル、実行した検証、省略した検証、残リスクを報告してください。

〈Codex Implementation Handoff〉
```

## Handoffに必ず入れるもの

- Goal: 何を実現するか。
- Background: なぜ必要か。ユーザー要望の根拠。
- Scope: 実装対象。
- Non-goals: 今回やらないこと。
- Likely Files: 変更候補ファイル。
- Implementation Notes: 既存パターン、使う helper、不変条件。
- Acceptance Criteria: 観測可能な完了条件。
- Verification: 実行すべき検証コマンド。Lint / typecheck / unit / e2e の要否を明記する。
- Risks / Open Questions: 残リスク。なければ「なし」。

## 規律

- Claudeは実装しない。
- 「要望をそのまま丸投げ」しない。Codexが迷わない粒度まで整理する。
- 既存コードを読まずに変更候補ファイルを断定しない。
- テスト方針なしでCodexに渡さない。
