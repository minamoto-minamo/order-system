import type { AuthUser } from '@order-system/shared'
import { create } from 'zustand'

export type { AuthUser }

interface AuthStore {
  user: AuthUser | null
  // /auth/me の完了前に認証ガードが誤発火しないよう、初期化完了を別フラグで管理
  initialized: boolean
  setUser: (user: AuthUser | null) => void
  setInitialized: (v: boolean) => void
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  initialized: false,
  setUser: (user) => set({ user }),
  setInitialized: (initialized) => set({ initialized }),
}))
