import { Children, isValidElement, type ReactElement } from 'react'
import { BottomSheetModal } from '@/components/composite/BottomSheetModal'
import { Toast } from '@/components/feedback'
import { BaseButton, ZeroStartStepper } from '@/components/primitives'

describe('Toast', () => {
  it('uses amber tokens by default', () => {
    const toast = Toast({ message: 'saved' }) as ReactElement

    expect(toast.props.className).toContain('border-amber-border')
    expect(toast.props.className).toContain('bg-amber-bg')
    expect(toast.props.className).toContain('text-amber-fg')
  })

  it('uses danger tokens for danger variant', () => {
    const toast = Toast({ message: 'failed', variant: 'danger' }) as ReactElement

    expect(toast.props.className).toContain('border-danger-border')
    expect(toast.props.className).toContain('bg-danger-bg')
    expect(toast.props.className).toContain('text-danger')
  })
})

describe('ZeroStartStepper', () => {
  it('keeps a 30px visual circle inside a 44px tap target', () => {
    const stepper = ZeroStartStepper({ qty: 0, onChange: () => undefined }) as ReactElement
    const button = Children.toArray(stepper.props.children).find(isValidElement) as ReactElement
    const visual = button.props.children as ReactElement

    expect(button.props.className).toContain('min-w-11')
    expect(button.props.className).toContain('min-h-11')
    expect(visual.props.className).toContain('w-7.5')
    expect(visual.props.className).toContain('h-7.5')
  })
})

describe('BaseButton', () => {
  it('defaults to type=button', () => {
    const button = BaseButton({ children: 'ok' }) as ReactElement

    expect(button.props.type).toBe('button')
  })
})

describe('BottomSheetModal', () => {
  it('uses a button overlay for dismiss interaction', () => {
    const modal = BottomSheetModal({
      show: true,
      title: 'title',
      onClose: () => undefined,
      primaryAction: { label: 'save', onClick: () => undefined },
    }) as ReactElement
    const children = Children.toArray(modal.props.children)
    const overlay = children[0] as ReactElement

    expect(overlay.type).toBe('button')
    expect(overlay.props.type).toBe('button')
  })
})
