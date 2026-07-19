import { useTranslation } from 'react-i18next'
import type { HourlyEntry } from './types'
import { PALETTE } from './types'

export function HourlyChart({
  hourly,
  catNames,
  catColorMap,
}: {
  hourly: HourlyEntry[]
  catNames: string[]
  catColorMap: Record<string, string>
}) {
  const { t } = useTranslation()
  const maxVal = Math.max(...hourly.map((h) => catNames.reduce((s, c) => s + (h[c] ?? 0), 0)), 1)
  const BAR_H = 120

  return (
    <div className="overflow-x-auto">
      <div className="flex items-end gap-2 pb-6" style={{ minWidth: hourly.length * 44 }}>
        {hourly.map((h) => {
          const total = catNames.reduce((s, c) => s + (h[c] ?? 0), 0)
          const segments = catNames
            .map((c, i) => ({
              cat: c,
              height: Math.round(((h[c] ?? 0) / maxVal) * BAR_H),
              color: catColorMap[c] ?? PALETTE[i % PALETTE.length],
            }))
            .filter((s) => s.height > 0)
          return (
            <div key={h.hour} className="flex flex-col items-center gap-1 flex-1">
              <div className="text-micro text-dim whitespace-nowrap">
                ¥{(total / 1000).toFixed(1)}k
              </div>
              <div className="flex flex-col-reverse w-full max-w-8">
                {segments.map((seg, i) => (
                  <div
                    key={seg.cat}
                    className="w-full"
                    style={{
                      height: seg.height,
                      background: seg.color,
                      borderRadius: i === segments.length - 1 ? '3px 3px 0 0' : 0,
                    }}
                  />
                ))}
              </div>
              <div className="text-caption text-muted">
                {t('report.hourLabel', { hour: h.hour })}
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-3.5 mt-1 flex-wrap">
        {catNames.map((cat) => (
          <div key={cat} className="flex items-center gap-1.25">
            <div
              className="w-2 h-2 rounded-sm"
              style={{ background: catColorMap[cat] ?? 'var(--color-line)' }}
            />
            <span className="text-caption text-muted">{cat}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
