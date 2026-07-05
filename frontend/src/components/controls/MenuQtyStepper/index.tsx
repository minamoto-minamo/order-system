/** 商品個数の増減ステッパー（− 数値 ＋）。qty===0 では − と数値を隠し ＋ のみ表示する */

import { BaseButton } from "@/components";

interface MenuQtyStepperProps {
  qty: number;
  onChange: (qty: number) => void;
  /** ＋ ボタンの disabled（品切れ等）。− ボタンには適用しない */
  disabled?: boolean;
}

export function MenuQtyStepper({ qty, onChange, disabled }: MenuQtyStepperProps) {
  return (
    <div className="flex items-center gap-2">
      {qty > 0 && (
        <>
          <BaseButton
            className="w-7.5 h-7.5 rounded-full border border-line bg-white text-base text-dim flex items-center justify-center"
            onClick={() => onChange(qty - 1)}
          >
            −
          </BaseButton>
          <span className="text-sub font-medium text-ink min-w-5 text-center">{qty}</span>
        </>
      )}
      <BaseButton
        className={`w-7.5 h-7.5 rounded-full border text-base flex items-center justify-center ${
          qty > 0 ? "border-brand bg-brand text-white" : "border-line bg-white text-dim"
        }`}
        onClick={() => onChange(qty + 1)}
        disabled={disabled}
      >
        ＋
      </BaseButton>
    </div>
  );
}
