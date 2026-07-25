import { jest } from '@jest/globals'
import type { Category, Course, DrinkPlan, MenuItem } from '@order-system/shared'
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'

await jest.unstable_mockModule('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string | number>) => {
      switch (key) {
        case 'group.courseApplyDone':
          return '適用済み'
        case 'group.courseQtyLabel':
          return `${options?.qty}名で適用中`
        case 'group.drinkPlanActive':
          return '有効'
        case 'group.drinkPlanItems':
          return '食べ飲み放題内容'
        case 'group.courseItemsByCategory':
          return 'コース内容'
        case 'group.courseQtyChange':
          return '人数を変更'
        case 'group.courseQtyConfirm':
          return '確定'
        case 'group.courseRemove':
          return '解除する'
        case 'group.courseApply':
          return '適用する'
        case 'common.cancel':
          return 'キャンセル'
        case 'common.perPerson':
          return '/ 人'
        case 'common.unknownItem':
          return `商品${options?.id}`
        case 'common.unknownCategory':
          return `カテゴリ${options?.id}`
        default:
          return key
      }
    },
  }),
}))

await jest.unstable_mockModule('@/components/primitives', () => ({
  BaseButton: ({
    children,
    className,
    onClick,
  }: {
    children: ReactNode
    className?: string
    onClick?: () => void
  }) => (
    <button className={className} onClick={onClick}>
      {children}
    </button>
  ),
  Icon: () => <span aria-hidden="true" />,
  QuantityPicker: () => <div>QuantityPicker</div>,
}))

await jest.unstable_mockModule('@/lib/icons', () => ({
  SYMBOL_ICONS: { beer: 'beer' },
}))

const { CourseTab } = await import('@/pages/group/GroupDetail/components/CourseTab')

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const categories: Category[] = [
  { id: 1, name: '前菜', sort: 1 },
  { id: 2, name: '揚げ物', sort: 2 },
]

const menus: MenuItem[] = [
  {
    id: 10,
    name: '枝豆',
    price: 300,
    categoryId: 1,
    subCategoryId: 1,
    soldOut: false,
    takeout: 'both',
    sort: 1,
    optionGroups: [],
    isSet: false,
    setFrames: [],
  },
  {
    id: 11,
    name: '唐揚げ',
    price: 500,
    categoryId: 2,
    subCategoryId: 2,
    soldOut: false,
    takeout: 'both',
    sort: 2,
    optionGroups: [],
    isSet: false,
    setFrames: [],
  },
  {
    id: 20,
    name: 'ウーロン茶',
    price: 0,
    categoryId: 2,
    subCategoryId: 2,
    soldOut: false,
    takeout: 'both',
    sort: 3,
    optionGroups: [],
    isSet: false,
    setFrames: [],
  },
]

const courses: Course[] = [
  {
    id: 1,
    name: '宴会コース',
    price: 3000,
    drinkPlanId: 5,
    foodItems: [
      { menuItemId: 10, qty: 2 },
      { menuItemId: 11, qty: 1 },
      { menuItemId: 999, qty: 3 },
    ],
  },
  {
    id: 2,
    name: '二次会コース',
    price: 2000,
    drinkPlanId: null,
    foodItems: [{ menuItemId: 11, qty: 1 }],
  },
]

const drinkPlans: DrinkPlan[] = [{ id: 5, name: '飲み放題', price: 1500, menuItemIds: [20, 998] }]

describe('CourseTab', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('コース適用中は他コース一覧を表示せず、カテゴリ別のコース内容を表示する', async () => {
    await act(async () => {
      root.render(
        <CourseTab
          courses={courses}
          drinkPlans={drinkPlans}
          menus={menus}
          categories={categories}
          appliedCourse={courses[0]}
          appliedCourseQty={2}
          activeDrinkPlan={drinkPlans[0]}
          groupGuestCount={2}
          onApply={() => undefined}
          onRemove={() => undefined}
          onChangeQty={() => undefined}
        />,
      )
    })

    expect(container.textContent).toContain('宴会コース')
    expect(container.textContent).toContain('コース内容')
    expect(container.textContent).toContain('前菜: 枝豆 x2')
    expect(container.textContent).toContain('揚げ物: 唐揚げ x1')
    expect(container.textContent).toContain('カテゴリ999: 商品999 x3')
    expect(container.textContent).toContain('食べ飲み放題内容')
    expect(container.textContent).toContain('ウーロン茶')
    expect(container.textContent).toContain('商品998')
    expect(container.textContent).not.toContain('二次会コース')
    expect(container.textContent).not.toContain('適用する')
  })

  it('未適用時は未適用コース一覧を表示する', async () => {
    await act(async () => {
      root.render(
        <CourseTab
          courses={courses}
          drinkPlans={drinkPlans}
          menus={menus}
          categories={categories}
          appliedCourse={null}
          appliedCourseQty={null}
          activeDrinkPlan={null}
          groupGuestCount={4}
          onApply={() => undefined}
          onRemove={() => undefined}
          onChangeQty={() => undefined}
        />,
      )
    })

    expect(container.textContent).toContain('宴会コース')
    expect(container.textContent).toContain('二次会コース')
    expect(container.textContent).toContain('適用する')
    expect(container.textContent).not.toContain('コース内容')
  })
})
