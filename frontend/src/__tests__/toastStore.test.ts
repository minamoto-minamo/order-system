import { jest } from '@jest/globals'
import { useToastStore } from '@/stores/toast'

describe('useToastStore', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    useToastStore.setState({ toasts: [] })
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
    useToastStore.setState({ toasts: [] })
  })

  it('showToast appends multiple toasts without overwriting', () => {
    const { showToast } = useToastStore.getState()

    showToast('first')
    showToast('second', 'danger')

    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({ message: 'first', variant: 'default' }),
      expect.objectContaining({ message: 'second', variant: 'danger' }),
    ])
  })

  it('removes only the toast whose timer expired', () => {
    const { showToast } = useToastStore.getState()

    showToast('first')
    jest.advanceTimersByTime(1000)
    showToast('second')
    jest.advanceTimersByTime(800)

    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({ message: 'second' }),
    ])
  })
})
