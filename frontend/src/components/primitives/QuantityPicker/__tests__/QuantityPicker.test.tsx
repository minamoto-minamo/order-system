import { jest } from '@jest/globals'
import { Children, isValidElement, type ReactElement } from 'react'
import { QuantityPicker } from '..'

describe('QuantityPicker tap targets', () => {
  it('keeps 40px visual circles inside 44px minimum button targets', () => {
    const picker = QuantityPicker({ value: 1, onChange: () => undefined }) as ReactElement
    const children = Children.toArray(picker.props.children)
    const buttons = [children[0], children[2]].filter(isValidElement) as ReactElement[]

    expect(buttons).toHaveLength(2)
    for (const button of buttons) {
      expect(button.props.className).toContain('min-w-11 min-h-11')
      expect(button.props.className).toContain('p-0')
      const visual = button.props.children as ReactElement
      expect(visual.type).toBe('span')
      expect(visual.props.className).toContain('w-10 h-10')
    }
  })

  it('keeps the increment and decrement handlers on the outer buttons', () => {
    const onChange = jest.fn()
    const picker = QuantityPicker({ value: 2, onChange, min: 1, max: 3 }) as ReactElement
    const children = Children.toArray(picker.props.children)
    const [decrementButton, incrementButton] = [children[0], children[2]] as ReactElement[]

    decrementButton.props.onClick()
    incrementButton.props.onClick()

    expect(onChange).toHaveBeenNthCalledWith(1, 1)
    expect(onChange).toHaveBeenNthCalledWith(2, 3)
  })
})
