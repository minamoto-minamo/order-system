export function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string
  value: string
  sub?: string | null
}) {
  return (
    <div className="bg-white border border-divider rounded-[10px] px-4 py-3.5">
      <div className="text-label text-muted mb-1.5">{label}</div>
      <div className="text-lg font-medium text-ink tracking-[0.02em]">{value}</div>
      {sub && <div className="text-caption text-dim mt-0.5">{sub}</div>}
    </div>
  )
}
