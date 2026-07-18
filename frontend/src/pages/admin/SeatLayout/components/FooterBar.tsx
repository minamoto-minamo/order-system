import type { ReactNode } from 'react'

export function FooterBar({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white border-t border-divider px-5 py-2.5 flex gap-5 items-center shrink-0">
      {children}
    </div>
  )
}
