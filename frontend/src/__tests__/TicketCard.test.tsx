import { jest } from '@jest/globals'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import type { DisplayOrder } from '@/pages/kitchen/Kitchen/components/types'

await jest.unstable_mockModule('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const { TicketCard } = await import('@/pages/kitchen/Kitchen/components/TicketCard')

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const order: DisplayOrder = {
  id: 'order-1',
  groupId: 'group-1',
  groupName: 'グループ1',
  seats: 'A1',
  item: 'ラーメン',
  options: [{ groupName: '麺の硬さ', choiceName: '硬め' }],
  qty: 1,
  catId: 1,
  subId: 1,
  orderedAt: '2024-01-01T10:00:00.000Z',
  status: 'pending',
}

describe('TicketCard', () => {
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

  it('選択されたオプション名を商品名と併記して表示する', async () => {
    await act(async () => {
      root.render(
        <TicketCard order={order} onComplete={() => undefined} onClick={() => undefined} />,
      )
    })

    expect(container.textContent).toContain('ラーメン')
    expect(container.textContent).toContain('麺の硬さ: 硬め')
  })
})
