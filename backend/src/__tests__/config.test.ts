import { beforeEach, describe, expect, it, jest } from '@jest/globals'

process.env.BASE_DOMAIN = 'example.com'

const { corsOriginValidator } = await import('../lib/config.js')

function callValidator(origin: string | undefined, host: string | undefined) {
  const callback = jest.fn<(err: Error | null, allow: boolean) => void>()
  corsOriginValidator(origin, host, callback)
  return callback
}

describe('corsOriginValidator', () => {
  beforeEach(() => {
    process.env.BASE_DOMAIN = 'example.com'
  })

  it('Origin storeA / Host storeA は許可する', () => {
    const callback = callValidator('https://storeA.example.com', 'storeA.example.com')
    expect(callback).toHaveBeenCalledWith(null, true)
  })

  it('Origin storeA / Host storeB は拒否する', () => {
    const callback = callValidator('https://storeA.example.com', 'storeB.example.com')
    expect(callback).toHaveBeenCalledWith(null, false)
  })

  it('Origin storeA / Host admin は拒否する', () => {
    const callback = callValidator('https://storeA.example.com', 'admin.example.com')
    expect(callback).toHaveBeenCalledWith(null, false)
  })

  it('Origin admin / Host storeA は拒否する', () => {
    const callback = callValidator('https://admin.example.com', 'storeA.example.com')
    expect(callback).toHaveBeenCalledWith(null, false)
  })

  it('Origin admin / Host admin は許可する', () => {
    const callback = callValidator('https://admin.example.com', 'admin.example.com')
    expect(callback).toHaveBeenCalledWith(null, true)
  })

  it('Origin ヘッダーが無い場合は許可する（既存挙動維持）', () => {
    const callback = callValidator(undefined, 'storeA.example.com')
    expect(callback).toHaveBeenCalledWith(null, true)
  })

  it('Host ヘッダーがポート付きでもラベルを比較できる', () => {
    const callback = callValidator('https://storeA.example.com', 'storeA.example.com:3000')
    expect(callback).toHaveBeenCalledWith(null, true)
  })

  it('BASE_DOMAIN と無関係な Origin は拒否する', () => {
    const callback = callValidator('https://evil.com', 'storeA.example.com')
    expect(callback).toHaveBeenCalledWith(null, false)
  })

  it('不正な Origin 値（URL としてパースできない）は拒否する', () => {
    const callback = callValidator('not-a-url', 'storeA.example.com')
    expect(callback).toHaveBeenCalledWith(null, false)
  })
})
