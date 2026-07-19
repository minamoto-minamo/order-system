import type { ReactElement } from 'react'
import { BaseButton } from '@/components/primitives'

function classTokens(element: ReactElement) {
  return (element.props.className as string).split(' ')
}

describe('BaseButton', () => {
  it('uses accessible amber tokens for the takeout variant', () => {
    const button = BaseButton({ variant: 'takeout', children: '確認する' }) as ReactElement
    const classes = classTokens(button)

    expect(classes).toEqual(
      expect.arrayContaining(['bg-amber-bg', 'border-amber-border', 'text-amber-fg']),
    )
    expect(classes).not.toContain('bg-amber')
    expect(classes).not.toContain('text-white')
  })

  it('keeps primary and danger variant colors unchanged', () => {
    const primary = BaseButton({ variant: 'primary', children: '保存' }) as ReactElement
    const danger = BaseButton({ variant: 'danger', children: '削除' }) as ReactElement

    expect(classTokens(primary)).toContain('bg-brand')
    expect(classTokens(danger)).toContain('bg-danger')
  })
})
