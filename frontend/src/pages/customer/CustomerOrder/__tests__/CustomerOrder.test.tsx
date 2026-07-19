import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../CustomerOrder.tsx', import.meta.url), 'utf8')

describe('CustomerOrder tap targets', () => {
  it('gives the staff-call and bill-request buttons 44px minimum targets', () => {
    const buttons = source.match(/className="[^"]+"[\s\S]{0,180}?aria-label=\{t\('customerOrder\.(?:callStaff|requestBill)'\)\}/g)

    expect(buttons).toHaveLength(2)
    for (const button of buttons ?? []) {
      expect(button).toContain('min-w-11 min-h-11')
      expect(button).not.toContain('w-8 h-8')
    }
  })
})
