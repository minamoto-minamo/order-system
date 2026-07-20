# Phase 0 Research: 状態変更エンドポイントのレースコンディションをトランザクション内再検証で解消する

技術的な不明点は`spec.md`のClarifications段階でほぼ解消済み。本フィーチャーはリポジトリ内に確立済みの2パターン（`docs/data-model/concurrency-notes.md`参照）を既存の3箇所に適用するものであり、新規技術選定は発生しない。以下は各対象箇所への適用方法を具体化するための実装調査結果。

## Decision 1: 会計依頼（`POST /customer/groups/:id/bill`）は素の`updateMany`によるCASを使う

- **Decision**: `prisma.group.updateMany({ where: { id, storeId: request.storeId, status: 'active' }, data: { status: 'bill_requested' } })` を実行し、`count === 1` の場合のみ成功として扱う。`$transaction`でラップしない。
- **Rationale**: `backend/src/lib/refreshToken.ts`の`revokeTokenById`/`revokeTokenByRaw`が同じ形（`$transaction`なしの単発`updateMany`）でCASを実装している。PostgreSQLのUPDATE文自体が対象行を排他ロックするため、単発の`updateMany`だけで確認と書き込みが不可分になる。複数ステートメントにまたがる整合性要求がないため、`$transaction`でラップする必要はない（オーバーヘッドを避ける）。
- **成功後の扱い**: `updateMany`は更新後の行を返さないため、`count === 1`確認後に`prisma.group.findUniqueOrThrow({ where: { id }, include: { seats: true } })`で取得し直し、既存の`toGroup(updated, setting)`にそのまま渡す。
- **失敗時の扱い**: `count === 0`の場合、事前の`findFirst`によるstatus確認と同じ挙動（`400 / ErrorCodes.Customer.BillRequestNotAllowed`）を返す。事前の`findFirst`（404判定用）はそのまま維持する。
- **Alternatives considered**:
  - Serializableトランザクション内で`findFirst`→`update`を再検証: 単一行・単一ステートメントの更新にトランザクションを使うのは過剰（`revokeTokenById`と一貫しない）。

## Decision 2: `order:complete`/`order:serve`も素の`updateMany`によるCASを使う

- **Decision**: 例えば`order:complete`は次の形にする。
  ```ts
  const result = await prisma.orderItem.updateMany({
    where: {
      id: itemId,
      storeId: socket.data.storeId,
      status: 'pending',
      group: { status: { not: 'closed' }, session: { status: { not: 'closed' } } },
    },
    data: { status: 'ready' },
  })
  if (result.count !== 1) return
  const updated = await prisma.orderItem.findUniqueOrThrow({ where: { id: itemId } })
  ```
  `order:serve`も`status: 'ready'` → `status: 'served'`で同様。
- **Rationale**: Prismaの`updateMany`はネストしたリレーションフィルタ（`group: { status: {...}, session: {...} }`）を`where`に受け付ける（JOINベースのSQL条件になるだけで、ネストwriteとは異なるため制限なし）。`OrderItem.group`→`Group.session`のリレーションは`schema.prisma`で定義済み（`Group.sessionId` → `Session`）。既存の`findFirst`が`include: { group: { include: { session: true } } }`で行っていた確認をそのまま`where`条件に落とし込める。
- **失敗時の扱い**: `count !== 1`の場合はサイレントno-op（`return`のみ、`socket.emit('error', ...)`は呼ばない）。spec.md Clarificationsで確定済み。既存のtry/catch内`catch`ブロック（予期しない例外用の`socket.emit('error', ...)`）はそのまま維持する（CAS失敗は例外ではなく正常系の分岐のため、catchには到達しない）。
- **Alternatives considered**:
  - Serializableトランザクション内で再検証: 単一行更新のみのため過剰。CASで十分（compare-and-swapの`updateMany`パターンは指摘2の改善案そのもの）。

## Decision 3: コース適用・人数変更は既存のSerializableトランザクションを拡張し、Course/DrinkPlanをトランザクション内で再取得する

- **Decision**: `POST /:id/course`のトランザクション内（`groups.ts`の`tx.group.findUnique`直後）で、`tx.course.findFirst({ where: { id: courseId, storeId: request.storeId }, include: { foodItems: true } })`と（`course.drinkPlanId != null`の場合）`tx.drinkPlan.findFirst(...)`を再取得し、以降の`OrderItem`作成・`Group`更新に使う変数をこのトランザクション内変数に置き換える。トランザクション開始前の`prisma.course.findFirst`/`prisma.drinkPlan.findFirst`（404判定用）はそのまま残してよいが、書き込みには使わない。
  - トランザクション内で再取得した`course`が`null`になった場合（削除された等）は、既存の`GroupStatusError`等と同様の専用例外を投げてロールバックし、404相当のエラーを返す（`CourseNotFound`を再利用するか、専用の`CourseGoneError`を追加するかは実装時の判断。エラーコードの追加は最小限にする）。
  - `PUT /:id/course`（人数変更）も同様に、トランザクション内の`tx.group.findUnique`直後で`tx.course.findFirst`を再取得し、`foodItemQtyByMenuItemId`をトランザクション内変数から再構築する。
- **Rationale**: 両エンドポイントは複数の`OrderItem`作成・更新と`Group`更新を1つの整合した単位として扱う必要があり、既にSerializableトランザクションを使っている。参照系エンティティの読み直しを同じトランザクションに追加するだけで、`unapplyCourse`（`groups.ts`の`tx.course.findFirst`、133行目付近）と同じ保証が得られる。`updateMany`によるCASは複数行の作成を伴う操作には適用できない。
- **Alternatives considered**:
  - `updateMany`によるCAS: コース適用は`OrderItem`の新規作成を伴うため、単一行更新を前提とするCASパターンでは表現できない。不採用。

## Decision 4: エラーハンドリング・後方互換性

- 新規エラーコードは、コース適用/人数変更のトランザクション内でコースが消失していた場合の1ケースに限り、既存の`CourseNotFound`（404）を再利用する形で対応する（新規コード追加は最小限に留める、`backend/CLAUDE.md`のエラーコード一元管理方針に従う）。
- 会計依頼・`order:complete`/`order:serve`は新規エラーコードを追加しない（spec.md Clarifications）。

## Decision 5: テスト方針

- Jestで各変更関数の入出力をテストする。Prisma Clientをモックし、「事前条件は満たすが`updateMany`のcountが0（＝直前に他リクエストが割り込んだ）」ケースをシミュレートして、後続の更新・emitが発生しないことを検証する。
- コース適用/人数変更は、トランザクション内`tx.course.findFirst`が事前取得時と異なる値（別価格・別構成）を返すモックを用意し、生成される`OrderItem`がトランザクション内再取得後の値を使っていることを検証する。
- E2Eテスト（Playwright）は対象外（spec.md Assumptions）。
