# Phase 0 Research: セットメニュー機能

Technical ContextにNEEDS CLARIFICATIONは残っていない。本ドキュメントは既存実装パターンの調査結果と、それに基づく設計方針の決定を記録する。

## Decision 1: データモデルは Course（親）+ CourseFoodItem（子）パターンを踏襲し、親商品はMenuItemの特殊種別として表現する

- **Decision**: セットメニュー自体は新規エンティティを作らず、既存`MenuItem`に`isSet: Boolean`フラグを追加して表現する（[Clarifications](./spec.md#clarifications) Q4：既存の商品管理画面に統合）。セット枠は`SetFrame`（親、MenuItem 1:多）→ `SetFrameChoice`（子、SetFrame 1:多、既存MenuItemへの参照）の2階層モデルとする。
- **Rationale**: `003-product-options`の`ProductOptionGroup`/`ProductOptionChoice`と全く同じ形。管理画面統合方針（Q4）により、セットメニューを独立エンティティにすると商品一覧・カテゴリ絞り込み等の既存UIをすべて複製する必要が生じるため、`MenuItem`の特殊種別として扱うのが最小差分になる。
- **Alternatives considered**:
  - セット専用の新規親エンティティ（`SetMenu`）を作る案 → 商品一覧・カテゴリ・品切れ表示・並び替え等の既存`MenuItem`機構をすべて複製することになり、Q4の「既存画面に統合」という決定と矛盾するため却下。

## Decision 2: 注文明細の親子関係は自己参照FK（`OrderItem.setOrderItemId`）で表現する。Courseの`courseId`方式は踏襲しない

- **Decision**: `OrderItem`に`isSetCharge: Boolean`（親明細フラグ、`isCourseCharge`と同型）と`setOrderItemId: String?`（自己参照FK、子明細が親明細の`id`を指す）を追加する。
- **Rationale**: Courseは「グループに1つだけ適用される」ため、子明細（`CourseFoodItem`由来の付属料理）は`courseId`（コースのテンプレートID）で親を一意に特定できる。しかしセットメニューは「同じグループが同じセットを何度も、別の内訳で追加注文できる」（spec User Story 2 Acceptance Scenario 3）ため、テンプレートID（`menuItemId`）だけでは特定の注文インスタンスを一意に紐付けられない。個々の親明細インスタンスを指す自己参照FKが必要。
- **Alternatives considered**:
  - `courseId`同様に`setMenuItemId`（テンプレートの`MenuItem.id`）で紐付ける案 → 同じセットを複数回注文した場合に内訳が混ざり合い、FR-006（どのセット注文に属するか判別可能）を満たせないため却下。

## Decision 3: セット枠の選択肢参照は`onDelete: Cascade`とし、Course/DrinkPlanの`Restrict`パターンは踏襲しない

- **Decision**: `SetFrameChoice.menuItemId`（参照先の既存商品）は`onDelete: Cascade`とする。
- **Rationale**: `CourseFoodItem.menuItemId`/`DrinkPlanItem.menuItemId`は`onDelete: Restrict`（参照されている商品は削除不可、`menus.ts`の`ReferencedCourse`/`ReferencedDrinkPlan`チェック）。しかしspec Edge Caseは「枠に登録された商品が管理者によって削除された場合、その商品は選択肢から除外される」と明記しており、削除をブロックするのではなく選択肢が自動的に消えることを要求している。これはCourse/DrinkPlanと明確に異なる挙動のため、既存パターンをそのまま踏襲せず`Cascade`を選ぶ。
- **Alternatives considered**: 既存Restrictパターンを踏襲する案 → spec Edge Caseの文言（「除外される」＝削除は成立する）と矛盾するため却下。

## Decision 4: セット選択時の価格・数量ロジックはCourseの付属料理生成パターンを踏襲する

- **Decision**: 親明細（セット）は`price: セット価格, originalPrice: セット価格, qty: 指定数量, isSetCharge: true, status: 'served'`で即時作成する（Courseの定額課金明細と同じ扱い：厨房調理を要さないため最初から`served`）。子明細（内訳）は各枠1件ずつ、`price: 0, originalPrice: 選択商品の単価, qty: 親と同じ数量`（[Clarifications](./spec.md#clarifications) Q1）で作成し、`status`はデフォルト（`pending`、通常の厨房ワークフローに乗る）のままとする。
- **Rationale**: `backend/src/routes/groups.ts`の`POST /groups/:id/course`が、コース定額課金明細（`isCourseCharge: true, status: 'served'`）とコース付属料理明細（`price: 0, originalPrice: menuItem.price, status`未指定=`pending`）を全く同じ考え方で作り分けている。セットも「セット価格で課金される親」と「厨房調理が必要な子」という構造が同一のため、この既存パターンをそのまま適用する。
- **Alternatives considered**: 子明細もセット確定と同時に`served`にする案 → FR-007（厨房チケットに内訳商品が個別表示される）と矛盾するため却下。

## Decision 5: セットのキャンセルは親明細操作時に子明細へカスケードする。子明細単独のキャンセルはAPIレベルで拒否する

- **Decision**: `PUT /orders/:id/cancel`を拡張する。対象が`isSetCharge: true`の場合、同一トランザクション内で`setOrderItemId`が一致する全子明細にも同じqty変更（全キャンセルまたは同数量分の減算）を適用する。対象が子明細（`setOrderItemId != null`かつ`isSetCharge: false`）の場合は`isCourseCharge`ブロックと同様に409エラーで拒否する。
- **Rationale**: spec Edge Case「セットの内訳商品のうち1品だけを個別にキャンセルする操作は提供しない。キャンセルはセット単位で行う」を満たすため。既存の`isCourseCharge`ブロック（`orders.ts`の`courseCharge: true`分岐）と対称的な構造にすることで実装・レビューコストを抑える。
- **Alternatives considered**: フロントエンドのUIで子明細のキャンセルボタンを単に非表示にするだけ（API側は無制限） → API直叩きで内訳だけの取消が可能になりFR違反となるため却下（003のオプション必須バリデーションと同じ理由でバックエンド検証が必須）。

## Decision 6: セット枠選択UIはOptionSelectSheetと同型の新規コンポーネントとして追加する。MenuConfirmModalの表示は既存の`options`フィールドを再利用する

- **Decision**: `frontend/src/features/order/components/OptionSelectSheet.tsx`と同じ構造（`BottomSheetModal` + フィールドセットごとのラジオボタン + 数量ステッパー）で`SetFrameSelectSheet`を新設する。ただし全枠が必須選択のため「必須」バッジの条件分岐は不要。確認モーダル（`MenuConfirmModal`）への引き渡しは、選択した枠内訳を`{ groupName: frame.name, choiceName: 選択商品名, extraPrice: 0 }[]`という既存の`options`と同じ形に変換して渡す。
- **Rationale**: 003で確立された「商品タップ→ボトムシートで選択→確認モーダルで内訳表示→確定」のフローとUIパターンを再利用することで学習コスト・実装コストを抑える。`MenuConfirmModal`の`linePrice()`計算（`item.price + Σoptions.extraPrice`）はセットの場合`extraPrice: 0`を渡せばそのまま「セット価格のみ」が算出され、コード変更なしで内訳名の表示（`groupName: choiceName`）も両立できる。
- **Alternatives considered**: `MenuConfirmModal`に「セット専用の内訳表示ブランチ」を追加する案 → 既存の`options`表示ロジックで要件を満たせるため、追加の分岐はシンプル第一原則に反すると判断し却下。

## Decision 7: セット枠選択肢商品のtakeout整合性チェックはスコープ外とする

- **Decision**: 既存商品には`takeout: 'dine_in' | 'both' | 'takeout'`があるが、セット枠の選択肢としてtakeout専用商品が登録され、かつセット自体がdine_inで注文された場合の整合性チェックは行わない。
- **Rationale**: specのFR・Edge Casesにこの組み合わせへの言及がなく、既存の001系操作ガード同様に「明示的に依頼されていない検証を追加しない」（シンプル第一）。運用上は管理者がtakeout専用商品をセット枠に登録しないことを前提とする。
- **Alternatives considered**: 通常注文と同じ`invalidTakeout`チェックを枠選択肢にも適用する案 → 要件外の検証追加になり実装・テストコストが増えるため今回は見送り、必要になれば別途仕様化する。
