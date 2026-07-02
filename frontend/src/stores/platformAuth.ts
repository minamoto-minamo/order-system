import { create } from 'zustand'
import type { PlatformAdmin } from '@order-system/shared'

export type { PlatformAdmin }

interface PlatformAuthStore {
  admin: PlatformAdmin | null
  // /platform/auth/me の完了前に認証ガードが誤発火しないよう、初期化完了を別フラグで管理
  initialized: boolean
  setAdmin: (admin: PlatformAdmin | null) => void
  setInitialized: (v: boolean) => void
}

export const usePlatformAuthStore = create<PlatformAuthStore>((set) => ({
  admin: null,
  initialized: false,
  setAdmin: (admin) => set({ admin }),
  setInitialized: (initialized) => set({ initialized }),
}))
