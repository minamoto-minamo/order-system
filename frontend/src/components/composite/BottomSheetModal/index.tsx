import type { ReactNode } from 'react'
import { Toast } from '@/components/feedback'
import { BaseButton } from '@/components/primitives'
import { BottomSheet } from '../BottomSheet'

interface BottomSheetModalProps {
  show: boolean
  title?: string
  description?: string
  error?: string | null
  /** trueの場合、children部分を独自にスクロール可能にする（max-h-[85vh]でシート全体の高さを制限）。ヘッダー等の余白はchildren側で用意する。 */
  scrollable?: boolean
  onClose: () => void
  primaryAction: {
    label: ReactNode
    onClick: () => void
    variant?: 'default' | 'danger' | 'takeout'
    disabled?: boolean
  }
  secondaryAction?: { label: ReactNode; onClick: () => void; variant?: 'default' | 'danger' }
  children?: ReactNode
}

const PRIMARY_BUTTON_VARIANT = {
  default: 'primary',
  danger: 'danger',
  takeout: 'takeout',
} as const

export function BottomSheetModal({
  show,
  title,
  description,
  error,
  scrollable,
  onClose,
  primaryAction,
  secondaryAction,
  children,
}: BottomSheetModalProps) {
  if (!show) return null
  const variant = primaryAction.variant ?? 'default'
  const content = children ?? (
    <>
      <div className="text-sub font-medium text-ink mb-1.5">{title}</div>
      {description && <div className="text-xs text-muted mb-5">{description}</div>}
    </>
  )
  return (
    <div className="fixed inset-0 z-sheet flex items-end bg-black/30 animate-[fadeIn_0.2s_ease_both]">
      <button
        type="button"
        aria-label="Close modal"
        onClick={onClose}
        className="absolute inset-0"
      />
      <BottomSheet
        className={scrollable ? 'max-h-[85vh] flex flex-col' : 'px-6 pt-6 pb-10'}
        onClick={(e) => e.stopPropagation()}
      >
        {scrollable ? <div className="overflow-y-auto flex-1">{content}</div> : content}
        <div className={scrollable ? 'flex gap-2.5 px-6 pt-3 pb-10 shrink-0' : 'flex gap-2.5'}>
          {secondaryAction && (
            <BaseButton
              variant="secondary"
              className={`flex-1 py-3.25 rounded-[10px] text-sm${secondaryAction.variant === 'danger' ? ' text-danger' : ''}`}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </BaseButton>
          )}
          <BaseButton
            variant={PRIMARY_BUTTON_VARIANT[variant]}
            className="flex-1 py-3.25 rounded-[10px] text-sm font-medium"
            onClick={primaryAction.onClick}
            disabled={primaryAction.disabled}
          >
            {primaryAction.label}
          </BaseButton>
        </div>
      </BottomSheet>
      <Toast message={error} />
    </div>
  )
}
