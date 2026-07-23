import type { OrderItem } from '@order-system/shared'
import { groupItems } from '@/pages/customer/CustomerOrder/components/CustomerOrderHistory'

function createItem(overrides: Partial<OrderItem> = {}): OrderItem {
  return {
    id: 'item-1',
    groupId: 'group-1',
    menuItemId: 1,
    menuItemName: 'ハイボール',
    price: 500,
    qty: 1,
    status: 'pending',
    isTakeout: false,
    courseId: null,
    isCourseCharge: false,
    isDrinkPlanCharge: false,
    orderedAt: '2026-07-23T00:00:00.000Z',
    options: [],
    ...overrides,
  }
}

describe('groupItems', () => {
  it('選択オプションが異なる同一商品は別の明細として集計する', () => {
    const groups = groupItems([
      createItem({
        options: [
          {
            id: 'option-1',
            choiceId: 1,
            groupName: '氷の状態',
            choiceName: 'ロック',
            extraPrice: 0,
          },
        ],
      }),
      createItem({
        id: 'item-2',
        qty: 2,
        options: [
          {
            id: 'option-2',
            choiceId: 2,
            groupName: '氷の状態',
            choiceName: 'ソーダ',
            extraPrice: 0,
          },
        ],
      }),
    ])

    expect(groups).toHaveLength(2)
    expect(groups).toEqual([
      expect.objectContaining({
        totalQty: 1,
        options: [{ groupName: '氷の状態', choiceName: 'ロック' }],
      }),
      expect.objectContaining({
        totalQty: 2,
        options: [{ groupName: '氷の状態', choiceName: 'ソーダ' }],
      }),
    ])
  })

  it('同じ選択オプションは選択順に関係なく1明細に集計する', () => {
    const groups = groupItems([
      createItem({
        options: [
          {
            id: 'option-1',
            choiceId: 1,
            groupName: '氷の状態',
            choiceName: 'ロック',
            extraPrice: 0,
          },
          { id: 'option-2', choiceId: 3, groupName: '濃さ', choiceName: '濃いめ', extraPrice: 0 },
        ],
      }),
      createItem({
        id: 'item-2',
        qty: 2,
        options: [
          { id: 'option-2', choiceId: 3, groupName: '濃さ', choiceName: '濃いめ', extraPrice: 0 },
          {
            id: 'option-1',
            choiceId: 1,
            groupName: '氷の状態',
            choiceName: 'ロック',
            extraPrice: 0,
          },
        ],
      }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({
      totalQty: 3,
      options: [
        { groupName: '氷の状態', choiceName: 'ロック' },
        { groupName: '濃さ', choiceName: '濃いめ' },
      ],
    })
  })

  it('オプションのない同一商品は従来通り1明細に集計する', () => {
    const groups = groupItems([createItem(), createItem({ id: 'item-2', qty: 2 })])

    expect(groups).toEqual([expect.objectContaining({ totalQty: 3, options: [] })])
  })
})
