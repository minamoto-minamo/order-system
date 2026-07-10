/** 0 から始める個数ステッパー。qty===0 では − と数値を隠し ＋ のみ表示する */

import { BaseButton } from '../button'

interface ZeroStartStepperProps {
  qty: number
  onChange: (qty: number) => void
  /** ＋ ボタンの disabled（品切れ等）。− ボタンには適用しない */
  disabled?: boolean
}

export function ZeroStartStepper({ qty, onChange, disabled }: ZeroStartStepperProps) {
  return (
    <div className="flex items-center gap-2">
      {qty > 0 && (
        <>
          <BaseButton
            className="min-w-11 min-h-11 p-0 border-none bg-transparent flex items-center justify-center"
            onClick={() => onChange(qty - 1)}
          >
            <span className="w-7.5 h-7.5 rounded-full border border-line bg-white text-base text-dim flex items-center justify-center">
              −
            </span>
          </BaseButton>
          <span className="text-sub font-medium text-ink min-w-5 text-center">{qty}</span>
        </>
      )}
      <BaseButton
        className="min-w-11 min-h-11 p-0 border-none bg-transparent flex items-center justify-center"
        onClick={() => onChange(qty + 1)}
        disabled={disabled}
      >
        <span
          className={`w-7.5 h-7.5 rounded-full border text-base flex items-center justify-center ${
            qty > 0 ? 'border-brand bg-brand text-white' : 'border-line bg-white text-dim'
          }`}
        >
          ＋
        </span>
      </BaseButton>
    </div>
  )
}
