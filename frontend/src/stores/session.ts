import type { Session } from '@order-system/shared'
import { create } from 'zustand'

interface SessionStore {
  session: Session | null
  setSession: (s: Session | null) => void
}

export const useSessionStore = create<SessionStore>((set) => ({
  session: null,
  setSession: (session) => set({ session }),
}))
