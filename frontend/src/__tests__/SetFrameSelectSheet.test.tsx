import { jest } from '@jest/globals'
import type { MenuItem } from '@order-system/shared'
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'

await jest.unstable_mockModule('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

await jest.unstable_mockModule('@/components/composite/BottomSheetModal', () => ({
  BottomSheetModal: ({
    children,
    primaryAction,
  }: {
    children: ReactNode
    primaryAction: { label: string; disabled: boolean; onClick: () => void }
  }) => (
    <div>
      {children}
      <button type="button" disabled={primaryAction.disabled} onClick={primaryAction.onClick}>
        {primaryAction.label}
      </button>
    </div>
  ),
}))

await jest.unstable_mockModule('@/components/primitives', () => ({
  ZeroStartStepper: () => <div>stepper</div>,
}))

const { SetFrameSelectSheet } = await import('@/features/order/components/SetFrameSelectSheet')

Object.assign(globalThis, {
  IS_REACT_ACT_ENVIRONMENT: true,
  crypto: { randomUUID: () => 'line-1' },
})

const item: MenuItem = {
  id: 1,
  name: 'セット',
  price: 1200,
  categoryId: 1,
  subCategoryId: 1,
  soldOut: false,
  takeout: 'both',
  sort: 1,
  isSet: true,
  optionGroups: [],
  setFrames: [
    {
      id: 10,
      name: '主菜',
      sort: 0,
      choices: [{ id: 101, menuItemId: 2, name: '主菜A', price: 800, soldOut: false, sort: 0 }],
    },
    {
      id: 11,
      name: '副菜',
      sort: 1,
      choices: [{ id: 102, menuItemId: 3, name: '副菜A', price: 500, soldOut: false, sort: 0 }],
    },
  ],
}

describe('SetFrameSelectSheet', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => root.unmount())
    container.remove()
  })

  it('全枠を選択するまで追加を無効化し、選択を明細に変換する', async () => {
    const onAdd = jest.fn()
    await act(async () => {
      root.render(<SetFrameSelectSheet item={item} open onClose={() => undefined} onAdd={onAdd} />)
    })

    const addButton = container.querySelector('button') as HTMLButtonElement
    expect(addButton.disabled).toBe(true)

    await act(async () => {
      ;(container.querySelector('input[name="set-frame-10"]') as HTMLInputElement).click()
      ;(container.querySelector('input[name="set-frame-11"]') as HTMLInputElement).click()
    })
    expect(addButton.disabled).toBe(false)

    await act(async () => addButton.click())
    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        selectedFrameChoiceIds: [101, 102],
        options: [
          { groupName: '主菜', choiceName: '主菜A', extraPrice: 0 },
          { groupName: '副菜', choiceName: '副菜A', extraPrice: 0 },
        ],
      }),
    )
  })
})
