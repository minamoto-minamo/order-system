import type { MenuItem } from '@order-system/shared'

const TOAST_STAGGER_MS = 150

export function showAddedOrderToasts(
  orderItems: { item: Pick<MenuItem, 'name'>; qty: number }[],
  formatMessage: (name: string) => string,
  showToast: (message: string) => void,
) {
  orderItems.forEach(({ item, qty }, index) => {
    window.setTimeout(() => {
      showToast(formatMessage(`${item.name} ×${qty}`))
    }, index * TOAST_STAGGER_MS)
  })
}
