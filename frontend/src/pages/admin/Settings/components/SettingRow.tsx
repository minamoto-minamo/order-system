import type { ReactNode } from 'react'

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="bg-white border border-divider rounded-xl overflow-hidden mb-4 animate-[fadeIn_0.3s_ease_both]">
      <div className="px-5 py-3 border-b border-surface-deep text-label font-medium text-muted tracking-widest bg-surface">
        {title}
      </div>
      {children}
    </div>
  )
}

export function SettingRow({
  label,
  sub,
  children,
}: {
  label: string
  sub?: string
  children: ReactNode
}) {
  return (
    <div className="px-5 py-3.5 border-b border-surface flex flex-col gap-2">
      <div>
        <div className="text-sm text-ink">{label}</div>
        {sub && <div className="text-label text-muted mt-0.5">{sub}</div>}
      </div>
      <div className="self-end">{children}</div>
    </div>
  )
}
