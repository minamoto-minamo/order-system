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

  it('does not stack duplicate toasts and extends the existing toast duration', () => {
    const { showToast } = useToastStore.getState()

    showToast('socket error', 'danger')
    const [firstToast] = useToastStore.getState().toasts

    jest.advanceTimersByTime(1000)
    showToast('socket error', 'danger')

    expect(useToastStore.getState().toasts).toEqual([firstToast])

    jest.advanceTimersByTime(799)
    expect(useToastStore.getState().toasts).toEqual([firstToast])

    jest.advanceTimersByTime(1)
    expect(useToastStore.getState().toasts).toEqual([firstToast])

    jest.advanceTimersByTime(1000)
    expect(useToastStore.getState().toasts).toEqual([])
  })

  it('can show the same toast again after the previous one is dismissed', () => {
    const { showToast } = useToastStore.getState()

    showToast('socket error', 'danger')
    jest.advanceTimersByTime(1800)
    expect(useToastStore.getState().toasts).toEqual([])

    showToast('socket error', 'danger')

    expect(useToastStore.getState().toasts).toEqual([
      expect.objectContaining({ message: 'socket error', variant: 'danger' }),
    ])
  })
})
