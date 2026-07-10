import { jest } from '@jest/globals'
import { useBannerStore } from '@/stores/banner'

describe('useBannerStore', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    useBannerStore.setState({ message: null })
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
    useBannerStore.setState({ message: null })
  })

  it('showBanner overwrites the current message', () => {
    const { showBanner } = useBannerStore.getState()

    showBanner('first')
    showBanner('second')

    expect(useBannerStore.getState().message).toBe('second')
  })

  it('message persists until dismissBanner is called (no auto-clear)', () => {
    const { showBanner, dismissBanner } = useBannerStore.getState()

    showBanner('first')
    jest.advanceTimersByTime(10000)

    expect(useBannerStore.getState().message).toBe('first')

    dismissBanner()

    expect(useBannerStore.getState().message).toBeNull()
  })
})
