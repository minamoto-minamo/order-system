import { create } from 'zustand'
import type { ToastVariant } from '@/components/feedback/Toast/Toast'

export type ToastItem = {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastStore {
  toasts: ToastItem[]
  showToast: (message: string, variant?: ToastVariant) => void
}

let nextToastId = 1
const TOAST_DURATION_MS = 1800
const toastTimeouts = new Map<number, number>()

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  showToast: (message, variant = 'default') => {
    let id = 0
    set((state) => ({
      toasts: (() => {
        const existingToast = state.toasts.find(
          (toast) => toast.message === message && toast.variant === variant,
        )
        if (existingToast) {
          id = existingToast.id
          return state.toasts
        }

        id = nextToastId++
        return [...state.toasts, { id, message, variant }]
      })(),
    }))

    const existingTimeout = toastTimeouts.get(id)
    if (existingTimeout) {
      window.clearTimeout(existingTimeout)
    }

    const timeoutId = window.setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((toast) => toast.id !== id),
      }))
      toastTimeouts.delete(id)
    }, TOAST_DURATION_MS)
    toastTimeouts.set(id, timeoutId)
  },
}))
