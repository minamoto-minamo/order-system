import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { jest } from '@jest/globals'
import type { Category, MenuItem, SubCategory } from '@order-system/shared'

await jest.unstable_mockModule('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => (key === 'group.drinkPlanTarget' ? '飲み放題' : key),
  }),
}))

await jest.unstable_mockModule('@/components/primitives', () => ({
  Icon: () => <span aria-hidden="true">icon</span>,
  ZeroStartStepper: ({ qty }: { qty: number }) => <div>{qty}</div>,
}))

await jest.unstable_mockModule('@/features/menu/components', () => ({
  SubCategorySidebar: () => <div>sidebar</div>,
}))

await jest.unstable_mockModule('@/lib/icons', () => ({
  SYMBOL_ICONS: { beer: 'beer' },
}))

const { CustomerMenuList } = await import(
  '@/pages/customer/CustomerOrder/components/CustomerMenuList'
)

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const categories: Category[] = [{ id: 1, name: 'ドリンク', sort: 1 }]
const subs: SubCategory[] = [{ id: 10, name: 'ビール', sort: 1, categoryId: 1 }]
const items: MenuItem[] = [
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
  },
  {
    id: 2,
    name: '枝豆',
    price: 300,
    categoryId: 1,
    subCategoryId: 10,
    soldOut: false,
    takeout: 'both',
    sort: 2,
    optionGroups: [],
  },
]

describe('CustomerMenuList', () => {
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

  it('飲み放題対象商品だけにバッジを出し価格を ¥0 表示する', async () => {
    await act(async () => {
      root.render(
        <CustomerMenuList
          categories={categories}
          activeCatId={1}
          onSelectCategory={() => undefined}
          subs={subs}
          activeSubId={null}
          onSelectSub={() => undefined}
          items={items}
          drinkPlanMenuItemIds={[1]}
          getQty={() => 0}
          onQtyChange={() => undefined}
          footerVisible={false}
        />,
      )
    })

    expect(container.textContent).toContain('生ビール')
    expect(container.textContent).toContain('飲み放題')
    expect(container.textContent).toContain('¥0')
    expect(container.textContent).toContain('枝豆')
    expect(container.textContent).toContain('¥300')
  })
})
