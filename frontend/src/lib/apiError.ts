// バックエンドはリクエスト失敗時に { error: string } 形式の body を返す
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly serverMessage: string | null,
    statusText = '',
  ) {
    super(serverMessage ?? `${status} ${statusText}`.trim())
    this.name = 'ApiError'
  }
}

export function toApiError(status: number, statusText: string, body: unknown): ApiError {
  const b = body as { error?: unknown; statusCode?: unknown } | null
  // statusCode を含む body は Fastify 組み込みエラー（スキーマバリデーション400等）。
  // その error は英語の HTTP フレーズなので表示用メッセージとして扱わない
  const serverMessage =
    b && typeof b.error === 'string' && b.statusCode === undefined ? b.error : null
  return new ApiError(status, serverMessage, statusText)
}

/** リクエスト失敗時の表示文言。サーバーメッセージ優先、なければ fallback */
export function apiErrorMessage(e: unknown, fallback: string): string {
  return e instanceof ApiError && e.serverMessage ? e.serverMessage : fallback
}
