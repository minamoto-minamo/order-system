import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ToggleButtonGroup } from "@/components/primitives";
import "./RankingSection.scss";
import { rankColor } from "./types";
import type { RankingEntry } from "./types";

export function RankingSection({ ranking, catColorMap }: {
  ranking: RankingEntry[];
  catColorMap: Record<string, string>;
}) {
  const { t } = useTranslation();
  const [metric, setMetric] = useState("amount");
  const [catFilter, setCatFilter] = useState("all");

  const catNames = [...new Set(ranking.map(r => r.categoryName))];
  const subNames = [...new Set(ranking.map(r => r.subCategoryName))];

  interface CatOption { key: string; label: string; isCat?: boolean; isSub?: boolean; }
  const catOptions: CatOption[] = [
    { key: "all", label: t('common.all') },
    ...catNames.map(c => ({ key: c, label: c, isCat: true })),
    ...subNames.map(s => ({ key: `sub:${s}`, label: s, isSub: true })),
  ];

  const filtered = ranking.filter(item => {
    if (catFilter === "all") return true;
    if (catFilter.startsWith("sub:")) return item.subCategoryName === catFilter.slice(4);
    return item.categoryName === catFilter;
  });

  const sorted = [...filtered]
    .sort((a, b) => metric === "amount" ? b.amount - a.amount : b.qty - a.qty)
    .map((item, i) => ({ ...item, rank: i + 1 }));

  const maxVal = sorted.length > 0 ? (metric === "amount" ? sorted[0].amount : sorted[0].qty) : 1;

  return (
    <div className="bg-white border border-divider rounded-xl overflow-hidden animate-[fadeIn_0.4s_ease_both]">
      <div className="px-4 py-3 border-b border-surface-deep flex items-center justify-between flex-wrap gap-2">
        <div className="text-note font-medium text-ink">{t('report.popularMenu')}</div>
        <ToggleButtonGroup
          options={[{ key: "amount", label: t('report.amount') }, { key: "qty", label: t('report.quantity') }]}
          value={metric}
          onChange={setMetric}
        />
      </div>

      <div className="px-4 py-2.5 border-b border-surface flex gap-1.5 flex-wrap">
        {catOptions.map(opt => {
          const accentColor = opt.isCat ? (catColorMap[opt.key] ?? "#888") : "#888";
          const isActive = catFilter === opt.key;
          return (
            <button key={opt.key} onClick={() => setCatFilter(opt.key)}
              className="px-2.5 py-0.75 text-label rounded-full cursor-pointer border"
              style={{
                borderColor: isActive ? accentColor : "var(--color-line)",
                background: isActive ? (opt.isCat ? `${accentColor}18` : "var(--color-surface-deep)") : "white",
                color: isActive ? (opt.isCat ? accentColor : "var(--color-secondary)") : "var(--color-muted)",
                fontWeight: opt.isSub ? 300 : 400,
              }}>
              {opt.isSub ? `└ ${opt.label}` : opt.label}
            </button>
          );
        })}
      </div>

      {sorted.length === 0 ? (
        <div className="p-6 text-center text-muted text-note">{t('report.noItems')}</div>
      ) : sorted.map((item, i) => {
        const rc = rankColor(item.rank);
        const barW = Math.round((metric === "amount" ? item.amount : item.qty) / maxVal * 100);
        const catColor = catColorMap[item.categoryName] ?? "#ccc";
        return (
          <div key={item.name} className={`rank-row px-4 py-2.75 flex items-center gap-2.5 ${i < sorted.length - 1 ? 'border-b border-surface' : ''}`}>
            <div className="w-6 h-6 rounded-md shrink-0 border flex items-center justify-center text-label font-bold"
              style={{ background: rc.bg, borderColor: rc.border, color: rc.color }}>{item.rank}</div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-note text-ink" style={{ fontWeight: item.rank <= 3 ? 500 : 400 }}>{item.name}</span>
                  <span className="text-micro px-1.25 py-px rounded-full border"
                    style={{ color: catColor, background: `${catColor}18`, borderColor: `${catColor}33` }}>
                    {item.subCategoryName}
                  </span>
                </div>
                <span className="text-label text-muted ml-2 shrink-0">
                  {metric === "qty" ? `${item.qty}件` : `¥${item.amount.toLocaleString()}`}
                </span>
              </div>
              <div className="h-1 bg-surface-deep rounded-sm overflow-hidden">
                <div className="h-full rounded-sm transition-[width] duration-300 ease-out"
                  style={{
                    width: `${barW}%`,
                    background: item.rank === 1 ? "var(--color-gold-border)" : item.rank <= 3 ? "var(--color-line)" : `${catColor}99`,
                  }} />
              </div>
            </div>

            <div className="text-note text-dim font-medium shrink-0 min-w-18 text-right">
              {metric === "amount" ? `¥${item.amount.toLocaleString()}` : `${item.qty}件`}
            </div>
          </div>
        );
      })}
    </div>
  );
}
