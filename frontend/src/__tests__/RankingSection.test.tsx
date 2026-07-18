import { TextEncoder } from 'util'
import { jest } from '@jest/globals'
import type { RankingEntry } from '@/pages/admin/DailyReport/components/types'

global.TextEncoder = TextEncoder

const ranking: RankingEntry[] = [
  {
    name: '枝豆',
    qty: 3,
    amount: 1200,
    categoryName: 'food',
    subCategoryName: 'snack',
  },
]

describe('RankingSection', () => {
  it('uses color tokens for missing category colors', async () => {
    jest.unstable_mockModule('react-i18next', () => ({
      useTranslation: () => ({ t: (key: string) => key }),
    }))
    const { renderToStaticMarkup } = await import('react-dom/server')
    const { RankingSection } = await import('@/pages/admin/DailyReport/components/RankingSection')

    const html = renderToStaticMarkup(<RankingSection ranking={ranking} catColorMap={{}} />)
    const doc = new DOMParser().parseFromString(html, 'text/html')
    const categoryButton = Array.from(doc.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('food'),
    )
    const badge = doc.querySelector('.text-micro')

    expect(categoryButton?.getAttribute('style')).toContain('color:var(--color-muted)')
    expect(badge?.getAttribute('style')).toContain('color:var(--color-line)')
    expect(badge?.getAttribute('style')).toContain('background:var(--color-line)18')
    expect(badge?.getAttribute('style')).toContain('border-color:var(--color-line)33')
  })
})
