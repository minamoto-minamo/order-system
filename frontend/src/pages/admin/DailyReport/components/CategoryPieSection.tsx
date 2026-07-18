import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ToggleButtonGroup } from '@/components/primitives'
import { PieChart } from './PieChart'
import type { ReportData } from './types'

export function CategoryPieSection({
  data,
  catColorMap,
  subColorMap,
}: {
  data: ReportData
  catColorMap: Record<string, string>
  subColorMap: Record<string, string>
}) {
  const { t } = useTranslation()
  const [view, setView] = useState('cat')
  return (
    <div className="bg-white border border-divider rounded-xl px-5 py-4 mb-4 animate-[fadeIn_0.3s_ease_both]">
      <div className="flex items-center justify-between mb-4">
        <div className="text-note font-medium text-ink">{t('report.categoryBreakdown')}</div>
        <ToggleButtonGroup
          options={[
            { key: 'cat', label: t('report.majorCategory') },
            { key: 'sub', label: t('report.minorCategory') },
          ]}
          value={view}
          onChange={setView}
        />
      </div>
      {view === 'cat' ? (
        <PieChart data={data.categoryBreakdown} colorMap={catColorMap} />
      ) : (
        <PieChart data={data.subBreakdown} colorMap={subColorMap} />
      )}
    </div>
  )
}
