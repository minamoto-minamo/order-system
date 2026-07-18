import { readFileSync } from 'node:fs'

describe('SeatLayout save button classes', () => {
  it('uses text-muted for the disabled save button label', () => {
    const source = readFileSync(new URL('../pages/admin/SeatLayout/SeatLayout.tsx', import.meta.url), 'utf8')

    expect(source).toContain('bg-surface text-muted cursor-not-allowed')
    expect(source).not.toContain('bg-surface text-faint cursor-not-allowed')
  })
})
