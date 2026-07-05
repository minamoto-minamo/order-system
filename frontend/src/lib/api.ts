import { useAuthStore } from '@/stores/auth'
import { usePlatformAuthStore } from '@/stores/platformAuth'
import { ApiError, toApiError } from '@/lib/apiError'

const BASE = (import.meta.env.VITE_BACKEND_URL ?? '') + '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body != null
  const res = await fetch(`${BASE}${path}`, {
    headers: hasBody ? { 'Content-Type': 'application/json' } : {},
    credentials: 'include',
    ...init,
  })
  // /platform/auth 自身が 401 を返したときに再帰ループしないよう除外
  if (res.status === 401 && path.startsWith('/platform') && !path.startsWith('/platform/auth')) {
    // React コンテキスト外から Zustand を直接更新
    usePlatformAuthStore.getState().setAdmin(null)
    throw new ApiError(401, null, 'Unauthorized')
  }
  // /auth 自身が 401 を返したときに再帰ループしないよう除外
  if (res.status === 401 && !path.startsWith('/auth') && !path.startsWith('/platform')) {
    // React コンテキスト外から Zustand を直接更新
    useAuthStore.getState().setUser(null)
    throw new ApiError(401, null, 'Unauthorized')
  }
  if (!res.ok) throw toApiError(res.status, res.statusText, await res.json().catch(() => null))
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
