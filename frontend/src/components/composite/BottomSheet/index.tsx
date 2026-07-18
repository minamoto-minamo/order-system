import type { HTMLAttributes, ReactNode } from 'react'

export function BottomSheet({
  children,
  className = '',
  ...props
}: {
  children: ReactNode
  className?: string
} & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`w-full bg-white rounded-t-2xl border-t border-divider animate-[slideUp_0.22s_ease_both] ${className}`}
      {...props}
    >
      {children}
    </div>
  )
}
