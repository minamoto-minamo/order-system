import { jest } from '@jest/globals'
import type { Category, MenuItem, SubCategory } from '@order-system/shared'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

const TRANSLATIONS: Record<string, string> = {
  'common.delete': '削除',
  'common.cancel': 'キャンセル',
  'common.confirm': '確定',
  'common.add': '追加',
  'common.close': '閉じる',
  'common.all': 'すべて',
  'productSettings.deleteProductConfirm': '{{name}} を削除しますか？',
  'productSettings.deleteSubCategoryConfirm':
    '{{name}} を削除しますか？配下の商品もすべて削除されます',
  'productSettings.deleteCategoryConfirm':
    '{{name}} を削除しますか？配下の小分類・商品もすべて削除されます',
}

function translate(key: string, options?: Record<string, unknown>): string {
  const template = TRANSLATIONS[key] ?? key
  if (!options) return template
  return template.replace(/{{(\w+)}}/g, (_, k) => String(options[k as string] ?? ''))
}

await jest.unstable_mockModule('react-i18next', () => ({
  useTranslation: () => ({ t: translate }),
}))

await jest.unstable_mockModule('@/lib/icons', () => ({
  ACTION_ICONS: {
    arrowLeft: 'arrowLeft',
    chevronDown: 'chevronDown',
    chevronRight: 'chevronRight',
    close: 'close',
    gear: 'gear',
    menu: 'menu',
  },
  SYMBOL_ICONS: {
    beer: 'beer',
    dining: 'dining',
    door: 'door',
    seat: 'seat',
    table: 'table',
    takeout: 'takeout',
  },
}))

await jest.unstable_mockModule('@/features/navigation/components', () => ({
  AppHeader: () => null,
}))

const apiDelete = jest.fn(async (_path: string): Promise<undefined> => undefined)

const categories: Category[] = [{ id: 1, name: 'ドリンク', sort: 1 }]
const subCategories: SubCategory[] = [{ id: 10, name: 'ビール', sort: 1, categoryId: 1 }]
const menus: MenuItem[] = [
  {
    id: 100,
    name: '生ビール',
    price: 600,
    categoryId: 1,
    subCategoryId: 10,
    soldOut: false,
    takeout: 'both',
    sort: 1,
  },
]

await jest.unstable_mockModule('@/lib/api', () => ({
  api: {
    get: jest.fn(async (path: string) => {
      if (path === '/categories') return categories
      if (path === '/subcategories') return subCategories
      if (path === '/menus') return menus
      return []
    }),
    delete: apiDelete,
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
  },
}))

const { default: Products } = await import('@/pages/admin/Products/Products')

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

function findButtonByText(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find(
    (b) => b.textContent?.trim() === text,
  )
  if (!button) throw new Error(`button not found: ${text}`)
  return button
}

function findButtonContaining(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find((b) =>
    b.textContent?.includes(text),
  )
  if (!button) throw new Error(`button containing not found: ${text}`)
  return button
}

/** カテゴリ・小分類行の「歯車（編集）」ボタンは、行ラベルを含むボタンの兄弟要素としてアイコンのみ（textContent === ''）で描画される */
function findEditGearNear(container: HTMLElement, labelText: string): HTMLButtonElement {
  const labelButton = findButtonContaining(container, labelText)
  const parent = labelButton.parentElement
  if (!parent) throw new Error(`parent not found for: ${labelText}`)
  const gear = Array.from(parent.querySelectorAll('button')).find(
    (b) => b !== labelButton && b.textContent?.trim() === '',
  )
  if (!gear) throw new Error(`edit gear button not found near: ${labelText}`)
  return gear
}

describe('Products 削除確認フロー', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(async () => {
    apiDelete.mockClear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    await act(async () => {
      root.render(<Products />)
    })
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('商品削除：確認ステップを経てキャンセルすると削除されず、確定すると削除される', async () => {
    await act(async () => {
      findButtonContaining(container, '生ビール').click()
    })
    await act(async () => {
      findButtonByText(container, '削除').click()
    })

    expect(container.textContent).toContain('生ビール を削除しますか？')
    expect(apiDelete).not.toHaveBeenCalled()

    await act(async () => {
      findButtonByText(container, 'キャンセル').click()
    })
    expect(apiDelete).not.toHaveBeenCalled()
    expect(container.querySelector('input')).toBeNull()
    expect(container.textContent).toContain('生ビール')

    await act(async () => {
      findButtonContaining(container, '生ビール').click()
    })
    await act(async () => {
      findButtonByText(container, '削除').click()
    })
    await act(async () => {
      findButtonByText(container, '削除').click()
    })

    expect(apiDelete).toHaveBeenCalledWith('/menus/100')
    expect(container.textContent).not.toContain('生ビール')
  })

  it('小分類削除：カスケード警告付きの確認ステップを経てキャンセル・確定それぞれ検証する', async () => {
    await act(async () => {
      findEditGearNear(container, 'ビール').click()
    })
    await act(async () => {
      findButtonByText(container, '削除').click()
    })

    expect(container.textContent).toContain('ビール を削除しますか？配下の商品もすべて削除されます')
    expect(apiDelete).not.toHaveBeenCalled()

    await act(async () => {
      findButtonByText(container, 'キャンセル').click()
    })
    expect(apiDelete).not.toHaveBeenCalled()
    expect(container.querySelector('input')).toBeNull()
    expect(container.textContent).toContain('ビール')

    await act(async () => {
      findEditGearNear(container, 'ビール').click()
    })
    await act(async () => {
      findButtonByText(container, '削除').click()
    })
    await act(async () => {
      findButtonByText(container, '削除').click()
    })

    expect(apiDelete).toHaveBeenCalledWith('/subcategories/10')
    expect(container.textContent).not.toContain('生ビール')
  })

  it('カテゴリ削除：カスケード警告付きの確認ステップを経てキャンセル・確定それぞれ検証する', async () => {
    await act(async () => {
      findEditGearNear(container, 'ドリンク').click()
    })
    await act(async () => {
      findButtonByText(container, '削除').click()
    })

    expect(container.textContent).toContain(
      'ドリンク を削除しますか？配下の小分類・商品もすべて削除されます',
    )
    expect(apiDelete).not.toHaveBeenCalled()

    await act(async () => {
      findButtonByText(container, 'キャンセル').click()
    })
    expect(apiDelete).not.toHaveBeenCalled()
    expect(container.querySelector('input')).toBeNull()
    expect(container.textContent).toContain('ドリンク')

    await act(async () => {
      findEditGearNear(container, 'ドリンク').click()
    })
    await act(async () => {
      findButtonByText(container, '削除').click()
    })
    await act(async () => {
      findButtonByText(container, '削除').click()
    })

    expect(apiDelete).toHaveBeenCalledWith('/categories/1')
    expect(container.textContent).not.toContain('ビール')
    expect(container.textContent).not.toContain('生ビール')
  })
})
