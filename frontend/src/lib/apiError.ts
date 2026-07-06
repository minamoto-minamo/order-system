// バックエンドはリクエスト失敗時に { error: { code, message, details } } 形式の body を返す
export const ClientErrorCodes = {
  NetworkUnreachable: 'common.network.unreachable',
  NetworkTimeout: 'common.network.timeout',
  InvalidJson: 'common.response.invalid_json',
  Unauthorized: 'auth.session.required',
} as const

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly serverMessage: string | null,
    statusText = '',
    readonly serverCode: string | null = null,
    readonly details: unknown = null,
  ) {
    super(serverMessage ?? `${status} ${statusText}`.trim())
    this.name = 'ApiError'
  }
}

export function toApiError(status: number, statusText: string, body: unknown): ApiError {
  const b = body as { error?: { code?: unknown; message?: unknown; details?: unknown } } | null
  const serverMessage = b && typeof b.error?.message === 'string' ? b.error.message : null
  const serverCode = b && typeof b.error?.code === 'string' ? b.error.code : null
  const details =
    b && typeof b.error === 'object' && b.error !== null && 'details' in b.error ? b.error.details : null
  return new ApiError(status, serverMessage, statusText, serverCode, details)
}

export function networkApiError(): ApiError {
  return new ApiError(
    0,
    'サーバーに接続できません',
    'Network Error',
    ClientErrorCodes.NetworkUnreachable,
  )
}

export function timeoutApiError(): ApiError {
  return new ApiError(
    0,
    'リクエストがタイムアウトしました',
    'Request Timeout',
    ClientErrorCodes.NetworkTimeout,
  )
}

export function invalidJsonApiError(status: number, statusText: string): ApiError {
  return new ApiError(
    status,
    'サーバーから不正なレスポンスを受信しました',
    statusText,
    ClientErrorCodes.InvalidJson,
  )
}

/** リクエスト失敗時の表示文言。サーバーメッセージ優先、なければ fallback */
export function apiErrorMessage(e: unknown, fallback: string): string {
  return e instanceof ApiError && e.serverMessage ? e.serverMessage : fallback
}
