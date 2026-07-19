import { jest } from '@jest/globals'
import type { ReactElement } from 'react'

await jest.unstable_mockModule('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const { OrderStatusBadge } = await import('@/pages/group/GroupDetail/components/OrderStatusBadge')

function classTokens(element: ReactElement) {
  return (element.props.className as string).split(' ')
}

describe('OrderStatusBadge', () => {
  it.each([
    ['pending', 'text-order-pending-fg', 'text-order-pending'],
    ['ready', 'text-order-ready-fg', 'text-order-ready'],
  ] as const)('uses an accessible foreground token for %s', (status, foreground, previousForeground) => {
    const badge = OrderStatusBadge({ status }) as ReactElement
    const classes = classTokens(badge)

    expect(classes).toContain(foreground)
    expect(classes).not.toContain(previousForeground)
  })

  it.each(['served', 'cancelled'] as const)('keeps the muted text token for %s', (status) => {
    const badge = OrderStatusBadge({ status }) as ReactElement

    expect(classTokens(badge)).toContain('text-muted')
  })
})
