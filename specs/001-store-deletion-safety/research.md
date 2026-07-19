# Research: 店舗削除・無効化の運用安全性（F7）

## R1: プリコンディションチェック（FR-001〜005）の実装パターン

**Decision**: `backend/src/routes/platformStores.ts`の`DELETE /:id`にある既存のカスケード削除`$transaction([...])`（配列形式のバッチトランザクション）を、インタラクティブトランザクション（`prisma.$transaction(async (tx) => { ... })`）に変更する。トランザクション内の先頭で`tx.session.count({ where: { storeId, status: 'open' } })`と`tx.group.count({ where: { storeId, status: { in: ['active', 'bill_requested'] } } })`を判定し、いずれか1件でもあれば専用エラー（`ErrorCodes.PlatformStores.ActiveDataExists`、409）を投げてロールバックする。0件ならそのまま既存のカスケード削除（`orderItem.deleteMany`〜`store.delete`）を同一トランザクション内で続行する。

**Rationale**:
- 既存の配列形式`$transaction([...])`は条件分岐ができないため、判定結果に応じて削除を実行するかどうかを制御できない。インタラクティブトランザクションへの変更が必須。
- `docs/data-model/concurrency-notes.md`の「確認と書き込みは同一のSerializableトランザクション内で行う」方針に合致する。ただし本ケースは判定対象（Session/Group）と書き込み対象（Store配下の全エンティティ）が別テーブルの集計であり、Prismaの既定分離レベル（Read Committed）でも判定から書き込みまでを1トランザクションに閉じ込めれば、既存の「先に`isActive: false`にして新規リクエストをHost解決時点で404にする」対策（下記R2）と組み合わせることで十分な安全性が得られる。SerializableへのアップグレードはR2の対策と重複するため不要と判断する。
- 既存の`unapplyCourse`等、他機能で確立されたインタラクティブトランザクションパターンをそのまま踏襲でき、新規概念を持ち込まない。

**Alternatives considered**:
- 判定をトランザクション外で先に行い、その後カスケード削除トランザクションを実行する（check-then-act）: 判定と削除実行の間に他リクエストが割り込むレースコンディションが残り、FR-005（不可分性）を満たさない。不採用。
- `updateMany`によるcompare-and-swap: 本ケースは複数テーブルにまたがるカスケード削除であり単一行の条件付き更新では表現できないため、不成立。不採用。

## R2: 既存の「先に`isActive: false`にする」対策との関係

**Decision**: 既存の「削除トランザクション実行前に`store.update({ isActive: false })`を先に行う」対策は維持する。R1のインタラクティブトランザクション（判定＋カスケード削除）は、この非アクティブ化の**後**に実行する。

**Rationale**:
- 非アクティブ化により、判定開始以降に発行される新規リクエストは`resolveStoreContext`がHost解決時点で`unknown`（404）として弾く。これにより「判定時点では営業中データが0件だったが、判定直後に新しいセッション/グループが作成される」という抜け道を、トランザクションの分離レベルに頼らず塞げる。
- 既存コードのコメント（「削除トランザクション中の同時書き込みを防ぐため、先に非アクティブ化する」）が示す意図と一致しており、変更を最小化できる。
- 判定失敗（営業中データあり）で409を返す場合も、既存のcatch節と同じパターンで`isActive: true`に戻す処理を通す（既存の例外処理フローに合流させる）。

**Alternatives considered**:
- 非アクティブ化も含めて1つのインタラクティブトランザクションにまとめる: トランザクションがコミットされるまで他リクエストからは`isActive: true`のまま見えてしまい、判定〜コミットの間の同時実行防止効果が既存実装より弱くなる。不採用。

## R3: タイムアウト対策（FR-006、5-1相当ではなく6-2/P2）の実装パターン

**Decision**: `prisma.$transaction(callback, { timeout: 30_000 })`のように、Prismaのトランザクション`timeout`オプションを既定値（5000ms）から30秒に延長する。`maxWait`（トランザクション開始待機の既定2000ms）はデフォルトのまま変更しない。

**Rationale**:
- Clarifications（Session 2026-07-19）で「タイムアウト値の延長」を採用する方針が確定している。
- 既存のカスケード削除ロジック（削除順序・対象テーブル）は変更しないため、実装差分がオプション追加のみに留まる。
- 30秒は、Prisma公式ドキュメントが長時間トランザクションの目安として言及する範囲内であり、既定の5000msに対して十分な余裕を持たせつつ、DB接続を過度に長く占有しないバランスとする。具体的な閾値は運用データがないため経験則的な値であり、将来的にタイムアウトが再発する場合は値の再調整（または分割実行への切り替え）を検討する前提とする。

**Alternatives considered**:
- 削除処理の分割実行（バッチ化）: Clarificationsで不採用と判断済み（部分削除状態からの復旧ロジックが複雑化するため）。

## R4: 新規エラーコード設計

**Decision**: `backend/src/lib/errors.ts`の`ErrorCodes.PlatformStores`に`ActiveDataExists: 'platform_stores.delete.active_data_exists'`を追加する。HTTPステータスは409（Conflict）。

**Rationale**: 既存の命名規則（`<リソース>.<操作>.<理由>`のスネークケース、例: `platform_stores.detail.not_found`、`platform_stores.save.reserved_subdomain`）に合わせる。同一名前空間（`PlatformStores`）に追加することで、既存の`NotFound`等と一貫した使い方ができる（FR-008: 成功と拒否を呼び出し元が区別できる形で応答）。

**Alternatives considered**: 新規の名前空間（例: `ErrorCodes.StoreDeletion`）を切る案 — 既存の`PlatformStores`名前空間に既に店舗CRUD関連のエラーが集約されており、削除固有のエラーだけを分離する理由がないため不採用。

## R5: DBスキーマ変更の要否

**Decision**: スキーマ変更なし。

**Rationale**: `Session.status`（`open`/`closed`）、`Group.status`（`active`/`bill_requested`/`closed`）は既存のフィールドで、本機能はこれらの既存値に対する追加のサーバー側検証ロジックのみを実装する。新規カラム・新規テーブル・マイグレーションは不要。
