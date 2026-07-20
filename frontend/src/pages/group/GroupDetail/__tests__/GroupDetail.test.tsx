import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../GroupDetail.tsx', import.meta.url), 'utf8')

describe('GroupDetail tap targets', () => {
  it('gives the QR and seat-change buttons 44px minimum targets', () => {
    const buttons = source.match(/className="[^"]+"[\s\S]{0,180}?aria-label=\{t\('group\.(?:showQr|changeSeat)'\)\}/g)

    expect(buttons).toHaveLength(2)
    for (const button of buttons ?? []) {
      expect(button).toContain('min-w-11 min-h-11')
      expect(button).not.toContain('w-8 h-8')
    }
  })
})
