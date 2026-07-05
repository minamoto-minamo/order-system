---
name: review-findings-to-codex
description: Claude用。既存のreview-archや観点別レビュースキルのレビュー結果を読み、未対応の指摘ごと、または強く関連する指摘グループごとにcodex-execution（①）へ渡すhandoffへ変換し、複数の /codex:rescue タスクとして並列委譲する。ユーザーが「レビュー結果をCodexに直させて」「指摘を並列で実行に回して」「review結果をもとにCodexへ渡して」と言った時に使う。
---

# レビュー結果からCodex並列実装へ渡す

既存レビュー結果を、Codexが実行できる独立タスクに分解する。各タスクは必ず `codex-execution`（①）の形式に正規化してからCodex pluginへ委譲する。Claudeは修正しない。

## 入力

対象は次のいずれか。

- `work/review-arch-YYYY-MM-DD.md`
- 観点別サブエージェントのレビュー出力
- Claudeチャット内のレビュー結果
- ユーザーが指定した指摘番号（例: `1-2`, `2-1`, `7-3`）

レビュー結果が見つからない場合は、先に `review-arch` を実行するか、対象ファイルを指定するようユーザーへ確認する。

## 手順

1. レビュー結果を読む。
2. Critical / High / Medium / Low の順に指摘を抽出する。
3. 実装対象から除外するものを分ける。
   - 調査だけで実装方針が未確定の指摘
   - 要件確認が必要な指摘
   - 同時修正すると競合しやすい広範囲な指摘
4. 独立に直せる指摘をタスクへ分割する。
5. 強く関連する指摘は1タスクにまとめる。例: 同じ route の同じ guard 漏れ、同じ mapper の型不整合。
6. 各タスクについて `codex-execution`（①）形式のhandoffを作る。
7. 各handoffを `/codex:rescue --background --fresh` で委譲する。独立タスクは同じ応答内でまとめて起動してよい。Codex plugin側でjobとして追跡する。
8. ユーザーには job 一覧、対象指摘番号、確認コマンドを返す。

## Codexへ渡すプロンプト

各タスクは次の形で渡す。

```text
/codex:rescue --background --fresh
あなたはorder-systemの実行担当です。レビュー指摘〈指摘番号〉を修正してください。
実装前に現行コードと照合し、指摘が再現しない、または前提が崩れている場合は実装せず報告してください。
変更は最小差分にしてください。回帰テストを追加・更新してください。必要ならLint、単体テスト、e2eテストも拡張・改修してください。
最後に変更ファイル、実行した検証、省略した検証、残リスクを報告してください。

〈Codex Implementation Handoff〉
```

## 並列化ルール

- 並列に回すのは、変更ファイルが重なりにくいタスクだけ。
- 同じファイルを触りそうな指摘は1つのhandoffにまとめる。
- DB schema / migration を触る指摘は単独タスクにする。
- UI snapshotやe2eに影響する指摘は、同じ画面単位でまとめる。
- Critical / High は優先して委譲する。Low はユーザーが明示した場合だけでよい。

## 出力形式

```md
## Codex委譲

- `job-id`: 指摘 `2-1`, `2-2` / 対象 `backend/src/routes/orders.ts`
- `job-id`: 指摘 `7-1` / 対象 `backend/src/plugins/store.ts`

確認:
- `/codex:status`
- `/codex:result <job-id>`
```

## 規律

- レビュー結果を要約だけで渡さない。場所、問題、影響、改善案をhandoffに含める。
- Claudeは修正しない。
- Codexに渡す前に、同時実行で競合しないか確認する。
- 不確かな指摘はCodex実装ではなく調査タスクにするか、ユーザーへ確認する。
