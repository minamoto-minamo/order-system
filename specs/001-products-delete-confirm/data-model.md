# Phase 1 Data Model: 商品管理画面の削除操作に確認ステップを追加する

本機能はDB・APIのデータモデルを変更しない（既存の `Category`/`SubCategory`/`MenuItem` エンティティ・削除エンドポイントはそのまま利用）。以下は本機能で新たに導入するフロントエンド側のクライアント状態のみを対象とする。

## DeleteTarget（フロントエンド state、`Products.tsx` 内で完結）

削除確認ステップの表示対象を表す判別可能なユニオン型。`frontend/src/pages/admin/Products/components/types.ts` に追加する。

```ts
export type DeleteTarget =
  | { type: 'cat'; id: number; label: string }
  | { type: 'sub'; catId: number; id: number; label: string }
  | { type: 'product'; id: number; label: string }
```

| フィールド | 型 | 説明 |
|---|---|---|
| `type` | `'cat' \| 'sub' \| 'product'` | 削除対象の種別。確認文言の出し分け（FR-006）と削除確定時に呼び出す関数（`deleteCat`/`deleteSub`/`deleteProduct`）の判別に使う。 |
| `id` | `number` | 削除対象自身のID。 |
| `label` | `string` | 確認文言に埋め込む対象名（カテゴリ名／小分類名／商品名）。 |
| `catId`（`type: 'sub'` のみ） | `number` | 小分類削除時に既存の `deleteSub(catId, subId)` を呼び出すために必要な親カテゴリID。既存の `deleteSub` のシグネチャに合わせる。 |

**ライフサイクル**:
1. 初期値: `null`（確認ステップ非表示）。
2. 編集モーダル（`InputModal`/`ProductModal`）の削除ボタンタップ時: 編集モーダルを閉じる（`setModal(null)`）と同時に `DeleteTarget` をセットする。
3. 確認ステップでキャンセル／オーバーレイタップ時: `null` に戻す（編集モーダルは再表示しない。spec.md FR-010）。
4. 確認ステップで削除確定時: `type` に応じて既存の `deleteCat`/`deleteSub`/`deleteProduct` を呼び出した後、`null` に戻す。

**不変条件**: `DeleteTarget` と編集モーダル用の既存 `ModalState` が同時に非nullになることはない（FR-009: 編集モーダルと確認ステップを同時に重ねて表示しない）。この不変条件はコードレベルでは強制せず、削除ボタンのonClickハンドラで両方を同一tick内にセットすることで実質的に担保する（`ModalState` を `null` にしてから `DeleteTarget` をセットする）。

## 既存エンティティへの参照（変更なし）

- **Category（カテゴリ／大分類）**: `frontend/src/pages/admin/Products/components/types.ts` の `Cat` 型を参照。削除時は配下の `SubCategory`/`MenuItem` もローカル表示から除去される（既存の `deleteCat` の挙動を変更しない）。
- **SubCategory（小分類）**: 同ファイルの `Sub` 型を参照。削除時は配下の `MenuItem` もローカル表示から除去される（既存の `deleteSub` の挙動を変更しない）。
- **MenuItem（商品）**: 同ファイルの `Product` 型を参照。削除時は一覧から除去される（既存の `deleteProduct` の挙動を変更しない）。
