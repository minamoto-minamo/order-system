# Phase 0 Research: 商品オプション機能

Technical ContextにNEEDS CLARIFICATIONは残っていない。本ドキュメントは既存実装パターンの調査結果と、それに基づく設計方針の決定を記録する。

## Decision 1: データモデルは Course + CourseFoodItem パターンを踏襲する

- **Decision**: `ProductOptionGroup`（親、MenuItem 1:多）→ `ProductOptionChoice`（子、Group 1:多）の2階層モデルとし、注文明細側は独立した `OrderItemOption` スナップショットテーブルを新設する。
- **Rationale**: `backend/prisma/schema.prisma` の `Course` + `CourseFoodItem` が「親エンティティ＋子エンティティ配列」の既存パターンとして確立している。既存の実装・レビュー観点（review-data-integrity等）もこの形を前提にしているため、同じ形に合わせることでレビューコストと学習コストを最小化できる。
- **Alternatives considered**:
  - オプションをMenuItemのJSONカラムに格納する案 → 選択肢ごとの追加金額・表示順の個別管理、および将来的なクエリ（選択肢名での検索等）がしづらく却下。
  - Course同様にGroup単位の適用にする案 → spec Assumptionsで「Course/DrinkPlanとは独立」と明記済みのため不採用。

## Decision 2: 更新はCourseと同じ「全置換」方式

- **Decision**: `PUT /menus/:id` でoptionGroups配列を受け取った場合、`optionGroups: { deleteMany: {}, create: [...] }` のnested writeで全削除→全再作成する。
- **Rationale**: `backend/src/routes/courses.ts:145-150` の既存パターン（コメント: 「差分更新ではなく全置換。foodItemsの順序管理を簡略化するための設計」）をそのまま踏襲。オプション分類・選択肢もsort順を持つため同じ理由が当てはまる。
- **Alternatives considered**: 差分更新（既存レコードのid突き合わせ） → 複雑さが増し、CLAUDE.mdの「シンプル第一」原則に反するため却下。

## Decision 3: 価格スナップショットは新規テーブルにフィールドとして持たせる

- **Decision**: `OrderItemOption` に `groupName`（分類名）・`choiceName`（選択肢名）・`extraPrice`（追加金額）をスナップショットとして保持し、`choiceId` は `onDelete: SetNull` の任意参照とする。`OrderItem.price` は「MenuItem単価 + 選択されたオプションのextraPrice合計」を算出して格納し、`OrderItem.originalPrice` は従来通りMenuItem単価のみを保持する（既存の `orders.ts:189-198` の originalPrice パターンを維持）。
- **Rationale**: `originalPrice` と `price` の差分から機械的にオプション追加金額の合計を導出できるため、Course/DrinkPlanのような `isCourseCharge` 相当の追加フラグは不要（両者は差分だけでは区別できない複数の意味を持つが、オプション追加金額は一意な意味しか持たないため）。FR-010（分類削除後も過去記録は不変）を満たすため、`ProductOptionChoice` への参照は `SetNull` にしつつ名称・金額は非正規化して保持する。
- **Alternatives considered**: `OrderItem` に `optionsPrice` フィールドを追加する案 → `price - originalPrice` で導出可能なため冗長、却下（シンプル第一）。

## Decision 4: 必須オプション未選択のバリデーションはfrontend・backend両方で行う

- **Decision**: `POST /orders` のリクエスト処理内で、各 `menuItemId` に紐づく `required: true` の `ProductOptionGroup` が全て選択されているかをサーバー側で検証し、不足時は400エラーを返す。フロントエンドでも同様のチェックを行い、注文確定ボタンを無効化する。
- **Rationale**: `backend/CLAUDE.md` の既存方針（「バリデーションエラーはJSON Schemaまたはハンドラ内で判定」）に加え、API直叩き（客用ゲストエンドポイントを含む）で必須オプションを回避できてしまうとFR-004が破られるため、バックエンド側の検証は必須。
- **Alternatives considered**: フロントのみでバリデーション → セキュリティ境界としては不十分なため却下。

## Decision 5: オプション選択UIは新規コンポーネントとして追加する

- **Decision**: 商品にオプション分類が1つ以上ある場合のみ、商品タップ時に既存の `BottomSheetModal`（`components/composite`）を使ったオプション選択ステップを挟む。オプションなし商品は既存の「一覧上で直接数量ステッパー操作」フローを変更しない。
- **Rationale**: 調査の結果、既存の `MenuAdd.tsx`（スタッフ用）・`CustomerMenuList.tsx`（客用）には商品ごとの詳細モーダルを挟む仕組みが存在しない（数量ステッパーのインライン操作のみ）。オプションなし商品の既存UXを変更しないことがFR-001後方互換要件・影響最小化の原則に沿う。
- **Alternatives considered**: 全商品を詳細モーダル経由の注文フローに統一する案 → オプションのない大多数の商品にとって操作ステップが増えるだけで後方互換要件に反するため却下。
