# 挙動変更契約: セキュリティ境界の強化

新規エンドポイントの追加・既存エンドポイントのリクエスト/レスポンススキーマ変更はない。ここではHTTPレベルの挙動変化のみを記載する。

## 1. CORS（全`/api/*`エンドポイント共通、`backend/src/plugins/cors.ts`）

### 変更点

`Origin`ヘッダーのホスト名が表すテナントと、リクエスト先`Host`ヘッダーが表すテナントが一致しない場合、CORSレベルで拒否する（ブラウザ側で`fetch`が失敗する。サーバーはpreflight `OPTIONS`に`Access-Control-Allow-Origin`を返さない、または実リクエストに`Access-Control-Allow-Origin`を付与しない）。

### 拒否されるようになるケース（新規）

- Origin: `storeA.<BASE_DOMAIN>` → Host: `storeB.<BASE_DOMAIN>` 宛のリクエスト
- Origin: `storeA.<BASE_DOMAIN>` → Host: `admin.<BASE_DOMAIN>` 宛のリクエスト
- Origin: `admin.<BASE_DOMAIN>` → Host: `storeA.<BASE_DOMAIN>` 宛のリクエスト

### 既存レスポンスへの影響

- 同一テナント内（Origin/Hostのサブドメインラベルが一致）のリクエストは、既存どおり許可される。
- `Origin`ヘッダーが存在しないリクエストは、既存どおり許可される（変更なし）。
- 許可されたリクエストのレスポンスボディ・ステータスコード自体への影響はない（CORS判定は許可/拒否のみで、通過後の処理は無変更）。

## 2. ログイン試行レート制限（`POST /api/auth/login`、`POST /api/platform/auth/login`）

### 変更点

`request.ip`の解決方法が、プロキシ配下（`X-Forwarded-For`ヘッダーあり）の場合は転送元の実クライアントIPを使うようになる（`trustProxy: true`）。

### 既存レスポンスへの影響

- レスポンスの形（`429`時のエラーボディ含む）は変更なし。
- 開発環境（`X-Forwarded-For`なし）では、レート制限の判定結果に変化はない。
- 本番環境（プロキシ配下）では、レート制限のキーがプロキシIPから実クライアントIPに変わるため、同一プロキシ配下の複数クライアントが1つのレート制限を共有する状態が解消される。
