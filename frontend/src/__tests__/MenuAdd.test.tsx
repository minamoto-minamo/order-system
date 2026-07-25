import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { jest } from '@jest/globals'
import type { Category, DrinkPlan, MenuItem, SubCategory } from '@order-system/shared'

await jest.unstable_mockModule('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      switch (key) {
        case 'group.takeout':
          return 'テイクアウト'
        case 'group.reviewOrder':
          return '注文内容を確認する'
        case 'group.drinkPlanTarget':
          return '飲み放題'
        case 'productSettings.toTakeout':
          return 'テイクアウト専用'
        case 'productSettings.soldOut':
          return '品切れ'
        default:
          return key
      }
    },
  }),
}))

await jest.unstable_mockModule('@/components/composite', () => ({
  MenuConfirmModal: () => null,
  SlideUpFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
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
  Icon: () => <span aria-hidden="true">icon</span>,
  ZeroStartStepper: ({ qty }: { qty: number }) => <div>{qty}</div>,
}))

await jest.unstable_mockModule('@/features/menu/components', () => ({
  SubCategorySidebar: () => <div>sidebar</div>,
}))

await jest.unstable_mockModule('@/lib/icons', () => ({
  SYMBOL_ICONS: { beer: 'beer' },
}))

const { MenuAdd } = await import('@/pages/group/GroupDetail/components/MenuAdd')

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const categories: Category[] = [{ id: 1, name: 'ドリンク', sort: 1 }]
const subCategories: SubCategory[] = [{ id: 10, name: 'ビール', sort: 1, categoryId: 1 }]
const menus: MenuItem[] = [
  {
    id: 1,
    name: '生ビール',
    price: 600,
    categoryId: 1,
    subCategoryId: 10,
    soldOut: false,
    takeout: 'both',
    sort: 1,
    optionGroups: [],
    isSet: false,
    setFrames: [],
  },
]
const activeDrinkPlan: DrinkPlan = { id: 5, name: '飲み放題', price: 1500, menuItemIds: [1] }

describe('MenuAdd', () => {
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

  it('店内注文では飲み放題対象商品にバッジを出し価格を ¥0 表示する', async () => {
    await act(async () => {
      root.render(
        <MenuAdd
          menus={menus}
          categories={categories}
          subCategories={subCategories}
          activeDrinkPlan={activeDrinkPlan}
          onAdd={async () => undefined}
        />,
      )
    })

    expect(container.textContent).toContain('生ビール')
    expect(container.textContent).toContain('飲み放題')
    expect(container.textContent).toContain('¥0')
    expect(container.textContent).not.toContain('¥600')
  })

  it('テイクアウト切替時は飲み放題バッジを消して通常価格を表示する', async () => {
    await act(async () => {
      root.render(
        <MenuAdd
          menus={menus}
          categories={categories}
          subCategories={subCategories}
          activeDrinkPlan={activeDrinkPlan}
          onAdd={async () => undefined}
        />,
      )
    })

    const takeoutButton = container.querySelector('button')
    const buttons = container.querySelectorAll('button')
    await act(async () => {
      ;(buttons[1] as HTMLButtonElement).click()
    })

    expect(takeoutButton).not.toBeNull()
    expect(container.textContent).not.toContain('飲み放題')
    expect(container.textContent).toContain('¥600')
    expect(container.textContent).not.toContain('¥0')
  })
})
