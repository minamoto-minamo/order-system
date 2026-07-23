import { Children, isValidElement, type ReactElement, type ReactNode } from 'react'
import { jest } from '@jest/globals'
import type { OrderItem } from '@order-system/shared'

await jest.unstable_mockModule('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

await jest.unstable_mockModule('@/lib/icons', () => ({
  ACTION_ICONS: { close: 'close' },
  SYMBOL_ICONS: { takeout: 'takeout' },
}))

const { OrderHistory } = await import('@/pages/group/GroupDetail/components/OrderHistory')

function findElement(node: ReactNode, predicate: (element: ReactElement) => boolean): ReactElement | null {
  if (!isValidElement(node)) {
    return null
  }
  if (predicate(node)) {
    return node
  }

  for (const child of Children.toArray(node.props.children)) {
    const found = findElement(child, predicate)
    if (found) {
      return found
    }
  }

  return null
}

describe('OrderHistory', () => {
  it('adds a 40px minimum tap target to status action buttons', () => {
    const items: OrderItem[] = [
      {
        id: 'item-1',
        groupId: 'group-1',
        menuItemId: 1,
        menuItemName: '枝豆',
        price: 380,
        qty: 1,
        status: 'pending',
        isTakeout: false,
        courseId: null,
        isCourseCharge: false,
        isDrinkPlanCharge: false,
        orderedAt: '2026-07-11T10:00:00.000Z',
        options: [],
      },
    ]

    const tree = OrderHistory({
      items,
      onChangeStatus: () => undefined,
      onCancelTap: () => undefined,
    }) as ReactElement

    const statusAction = findElement(
      tree,
      (element) => typeof element.type === 'function' && element.type.name === 'StatusActionButton',
    )

    expect(statusAction).not.toBeNull()
    if (!statusAction) {
      throw new Error('StatusActionButton not found')
    }
    const foundStatusAction = statusAction

    const button = (
      foundStatusAction.type as (props: typeof foundStatusAction.props) => ReactElement
    )(
      foundStatusAction.props,
    )

    expect(button.props.className).toContain('min-h-10')
    expect(button.props.className).toContain('px-2.75')
    expect(button.props.className).toContain('py-1.25')
  })
})
