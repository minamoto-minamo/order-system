# docs フォルダ構成

このファイルは docs 配下フォルダの役割を簡潔に示す。

- screens/
  - 画面仕様を1画面＝1ファイルで管理する。各ファイルは以下を含める:
    - 目的
    - 対象読者
    - パス/デバイス/認証
    - 概要
    - UI 要素（一覧）
    - 主なアクション/フロー
    - 連携する API / Socket イベント
    - 受入条件

- api/
  - API エンドポイント一覧、リクエスト/レスポンス例、認証・エラー仕様、OpenAPI などを格納。

- data-model/
  - DB スキーマ（Prisma）の解説、ER 図、主要モデル説明、会計・集計に関する注意点を格納。

- ops/
  - 起動手順、環境変数一覧、デプロイ手順、Runbook、バックアップ/復旧手順を格納。

運用上の注意:
- 各ファイルは冒頭に「目的」と「対象読者」を必ず記載する。
- ドキュメントの削除・移動は PR で管理することを推奨する。

---

作成予定ファイル一覧（例）

screens/
- S100-home.md
- S101-login.md
- S102-group-detail.md
- S200-hall.md
- S300-kitchen.md
- S400-admin-menu.md
- S401-admin-products.md
- S402-admin-seats.md
- S403-admin-report.md
- S404-admin-settings.md
- S405-admin-staff.md

api/
- api-spec.md (高レベルまとめ)
- openapi.yaml (OpenAPI/Swagger 定義)
- endpoints.md (EP 別サマリ)
- auth.md (認証フロー)
- sessions.md
- seats.md
- groups.md
- orders.md
- menus.md
- reports.md
- settings.md

data-model/
- prisma-summary.md
- er-diagram.png
- accounting-notes.md
- migrations.md

ops/
- runbook.md
- deploy.md
- env.md
- backup-and-restore.md
- ci-cd.md

必要なファイルがあればここに追加してください。実際の作成は指示を受けてから行います。
