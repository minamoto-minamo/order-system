import { create } from 'zustand'
import type { AuthUser } from '@order-system/shared'

export type { AuthUser }

interface AuthStore {
  user: AuthUser | null
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
