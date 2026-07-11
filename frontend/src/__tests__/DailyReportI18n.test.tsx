import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { jest } from '@jest/globals'
import type { ReportData, SessionInfo } from '@/pages/admin/DailyReport/components/types'

const sessions: SessionInfo[] = [
  {
    id: 1,
    status: 'closed',
    openedAt: '2026-07-10T09:05:00+09:00',
    closedAt: '2026-07-10T18:45:00+09:00',
  },
  {
    id: 2,
    status: 'open',
    openedAt: '2026-07-11T11:00:00+09:00',
    closedAt: null,
  },
]

const reportData: ReportData = {
  total: 12000,
  groups: 3,
  guests: 6,
  seatUsageRate: 75,
  categoryBreakdown: { ドリンク: 7000 },
  subBreakdown: { ビール: 7000 },
  taxBreakdown: {},
  hourly: [],
  ranking: [],
}

const mockGet = jest.fn(async (_url: string): Promise<SessionInfo[] | ReportData> => reportData)

await jest.unstable_mockModule('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, string | number>) => {
      switch (key) {
        case 'session.open':
          return '営業中'
        case 'report.sessionDateTime':
          return `${options?.month}月${options?.day}日 ${options?.hour}:${options?.minute}`
        case 'report.sessionRange':
          return `${options?.start} 〜 ${options?.end}`
        case 'report.pieChartTitle':
          return '日次売上構成比の円グラフ'
        default:
          return key
      }
    },
  }),
}))

await jest.unstable_mockModule('@/components/feedback', () => ({
  RetryableLoadError: () => <div>load error</div>,
}))

await jest.unstable_mockModule('@/features/navigation/components', () => ({
  AppHeader: ({ title }: { title: string }) => <div>{title}</div>,
}))

await jest.unstable_mockModule('@/lib/api', () => ({
  api: {
    get: (...args: [string]) => mockGet(...args),
  },
}))

await jest.unstable_mockModule('@/pages/admin/DailyReport/components/CategoryPieSection', () => ({
  CategoryPieSection: () => <div>category pie</div>,
}))

await jest.unstable_mockModule('@/pages/admin/DailyReport/components/HourlyChart', () => ({
  HourlyChart: () => <div>hourly chart</div>,
}))

await jest.unstable_mockModule('@/pages/admin/DailyReport/components/RankingSection', () => ({
  RankingSection: () => <div>ranking</div>,
}))

await jest.unstable_mockModule('@/pages/admin/DailyReport/components/SummaryCard', () => ({
  SummaryCard: ({ label }: { label: string }) => <div>{label}</div>,
}))

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

describe('DailyReport i18n', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    mockGet.mockImplementation(async (url: string) =>
      url.includes('status=closed') ? sessions : reportData,
    )
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    mockGet.mockReset()
  })

  it('renders session labels via translation keys', async () => {
    const { default: DailyReport } = await import('@/pages/admin/DailyReport/DailyReport')

    await act(async () => {
      root.render(<DailyReport />)
    })
    await act(async () => {
      await Promise.resolve()
    })
    await act(async () => {
      await Promise.resolve()
    })

    expect(container.textContent).toContain('7月10日 9:05 〜 7月10日 18:45')
    expect(container.textContent).toContain('7月11日 11:00 〜 営業中')
  })

  it('renders pie chart title via translation key', async () => {
    const { PieChart } = await import('@/pages/admin/DailyReport/components/PieChart')

    await act(async () => {
      root.render(<PieChart data={{ ドリンク: 7000 }} colorMap={{ ドリンク: '#000' }} />)
    })

    expect(container.querySelector('title')?.textContent).toBe('日次売上構成比の円グラフ')
  })
})
