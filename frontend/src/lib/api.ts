import {
  ApiError,
  ClientErrorCodes,
  invalidJsonApiError,
  networkApiError,
  timeoutApiError,
  toApiError,
} from '@/lib/apiError'
import { useAuthStore } from '@/stores/auth'
import { usePlatformAuthStore } from '@/stores/platformAuth'

const BASE = (import.meta.env.VITE_BACKEND_URL ?? '') + '/api'
const REQUEST_TIMEOUT_MS = 15_000

async function parseJsonResponse(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch {
    throw invalidJsonApiError(res.status, res.statusText)
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body != null
  const controller = new AbortController()
  let timedOut = false
  const timeoutId = window.setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)
  const onAbort = () => controller.abort()
  init?.signal?.addEventListener('abort', onAbort, { once: true })

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, {
      headers: hasBody ? { 'Content-Type': 'application/json' } : {},
      credentials: 'include',
      ...init,
      signal: controller.signal,
    })
  } catch {
    if (timedOut) throw timeoutApiError()
    throw networkApiError()
  } finally {
    window.clearTimeout(timeoutId)
    init?.signal?.removeEventListener('abort', onAbort)
  }
  // /platform/auth 自身が 401 を返したときに再帰ループしないよう除外
  if (res.status === 401 && path.startsWith('/platform') && !path.startsWith('/platform/auth')) {
    // React コンテキスト外から Zustand を直接更新
    usePlatformAuthStore.getState().setAdmin(null)
    throw new ApiError(401, null, 'Unauthorized', ClientErrorCodes.Unauthorized)
  }
  // /auth 自身が 401 を返したときに再帰ループしないよう除外
  if (res.status === 401 && !path.startsWith('/auth') && !path.startsWith('/platform')) {
    // React コンテキスト外から Zustand を直接更新
    useAuthStore.getState().setUser(null)
    throw new ApiError(401, null, 'Unauthorized', ClientErrorCodes.Unauthorized)
  }
  if (!res.ok) throw toApiError(res.status, res.statusText, await parseJsonResponse(res))
  if (res.status === 204) return undefined as T
  return parseJsonResponse(res) as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
