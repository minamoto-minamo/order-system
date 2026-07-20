# Quickstart: セキュリティ境界の強化（CORS越境許可・レート制限のプロキシ配下対応）

## 前提

- `env/backend.env`に`BASE_DOMAIN`が設定済み（例: `order-system.local`）。
- `pnpm --filter backend dev`でbackendを起動済み。

## 1. CORS越境拒否の確認（開発環境、手動）

```bash
# storeA相当のOriginからstoreB相当のHostへcredentials付きでリクエスト（拒否されるはず）
curl -i -X OPTIONS \
  -H "Origin: https://storeA.order-system.local" \
  -H "Access-Control-Request-Method: GET" \
  -H "Host: storeB.order-system.local" \
  http://localhost:3000/api/groups
# 期待結果: Access-Control-Allow-Origin ヘッダーが返らない（許可されない）

# 同一テナント（storeA→storeA）は従来どおり許可されるはず
curl -i -X OPTIONS \
  -H "Origin: https://storeA.order-system.local" \
  -H "Access-Control-Request-Method: GET" \
  -H "Host: storeA.order-system.local" \
  http://localhost:3000/api/groups
# 期待結果: Access-Control-Allow-Origin: https://storeA.order-system.local が返る
```

## 2. レート制限のプロキシ配下対応の確認（開発環境、手動）

```bash
# X-Forwarded-For を付けて異なるIPを装ったログイン失敗を、それぞれ制限回数まで送る
for ip in 10.0.0.1 10.0.0.2; do
  for i in $(seq 1 6); do
    curl -s -o /dev/null -w "%{http_code} " \
      -H "X-Forwarded-For: $ip" \
      -H "Content-Type: application/json" \
      -d '{"loginId":"invalid","password":"invalid"}' \
      http://localhost:3000/api/auth/login
  done
  echo "(ip=$ip)"
done
# NODE_ENV=production相当（max: 5）の場合、各IPで6回目に429が返る
# trustProxy設定前は両方のIPが同一キーに集約され、2つ目のIPが最初のリクエストから429になる
```

## 3. 自動テスト（Codexへのハンドオフ後の検証）

```bash
pnpm --filter backend typecheck
pnpm --filter backend test
```

`backend/src/__tests__/`に追加されるCORS判定・レート制限の各ユニットテストが通ることを確認する（詳細は`tasks.md`参照）。

## 4. 回帰確認

- 既存の店舗管理画面・客用注文画面が、それぞれ自分のサブドメインからの操作で従来どおり動作すること（同一テナント内の通信は無影響）。
- 開発環境でのログイン試行レート制限の回数・時間窓が変化しないこと。
