import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../index.tsx', import.meta.url), 'utf8')

describe('AppHeader tap target', () => {
  it('gives the navigation menu button a 44px minimum target', () => {
    const button = source.match(/className="[^"]+"[\s\S]{0,180}?aria-label=\{t\('nav\.openMenu'\)\}/)?.[0]

    expect(button).toContain('min-w-11 min-h-11')
    expect(button).not.toContain('w-8 h-8')
  })
})
