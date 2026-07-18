import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'

const mockDisconnectSockets = jest.fn<(close?: boolean) => void>()
const mockClose = jest.fn<() => Promise<void>>()
const mockListen = jest.fn<() => Promise<void>>()
const mockInfo = jest.fn<(message: string) => void>()
const mockError = jest.fn<(error: unknown) => void>()

const mockApp = {
  io: { disconnectSockets: mockDisconnectSockets },
  close: mockClose,
  listen: mockListen,
  log: { info: mockInfo, error: mockError },
}

jest.unstable_mockModule('../app.js', () => ({
  buildApp: jest.fn(async () => mockApp),
}))

describe('backend/src/index.ts shutdown', () => {
  const originalExit = process.exit
  const originalOn = process.on

  beforeEach(() => {
    jest.clearAllMocks()
    mockClose.mockResolvedValue(undefined)
    mockListen.mockResolvedValue(undefined)
    process.env.PORT = '3000'
  })

  afterEach(() => {
    process.exit = originalExit
    process.on = originalOn
    jest.resetModules()
  })

  it.each([
    ['SIGTERM', 'SIGTERM received, shutting down'],
    ['SIGINT', 'SIGINT received, shutting down'],
  ] as const)('%s 受信時に Socket.io を切断してから close する', async (signal, logMessage) => {
    const handlers = new Map<string, () => void>()
    process.on = jest.fn<typeof process.on>((event, handler) => {
      if (typeof event === 'string') {
        handlers.set(event, handler as () => void)
      }
      return process
    })
    process.exit = jest.fn<typeof process.exit>(((code?: number) => code as never))

    await import('../index.js')
    await handlers.get(signal)!()

    expect(mockInfo).toHaveBeenCalledWith(logMessage)
    expect(mockDisconnectSockets).toHaveBeenCalledWith(true)
    expect(mockClose).toHaveBeenCalledTimes(1)
    expect(mockDisconnectSockets.mock.invocationCallOrder[0]).toBeLessThan(
      mockClose.mock.invocationCallOrder[0],
    )
    expect(process.exit).toHaveBeenCalledWith(0)
  })
})
