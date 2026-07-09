import { RetryableLoadError } from "@/components/feedback";
import { AppHeader } from "@/features/navigation/components";
import { api } from "@/lib/api";
import { EP } from "@/lib/endpoints";
import { ROUTES } from "@/lib/routes";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CategoryPieSection } from "./components/CategoryPieSection";
import { HourlyChart } from "./components/HourlyChart";
import { RankingSection } from "./components/RankingSection";
import { SummaryCard } from "./components/SummaryCard";
import type { ReportData, SessionInfo } from "./components/types";
import { PALETTE } from "./components/types";

// ── メイン ───────────────────────────────────────────────────
export default function DailyReport() {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [data, setData] = useState<ReportData | null>(null);
	  const [catColorMap, setCatColorMap] = useState<Record<string, string>>({});
	  const [subColorMap, setSubColorMap] = useState<Record<string, string>>({});
	  const [catNames, setCatNames] = useState<string[]>([]);
	  const [loadError, setLoadError] = useState(false);

  const sessionLabel = (s: SessionInfo): string => {
    const fmt = (iso: string) => {
      const d = new Date(iso);
      return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    };
    return s.closedAt
      ? `${fmt(s.openedAt)} 〜 ${fmt(s.closedAt)}`
      : `${fmt(s.openedAt)} 〜 ${t('session.open')}`;
  };

  useEffect(() => {
    api.get<SessionInfo[]>(`${EP.sessions}?status=closed`)
	      .then(ss => {
	        setLoadError(false);
	        setSessions(ss);
        if (ss.length > 0) setSelectedId(ss[0].id);
      })
	      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    if (selectedId === null) return;
    api.get<ReportData>(EP.sessionReport(selectedId))
	      .then(r => {
	        setLoadError(false);
	        setData(r);
        const cats = Object.keys(r.categoryBreakdown);
        const subs = Object.keys(r.subBreakdown);
        const catMap: Record<string, string> = {};
        cats.forEach((c, i) => { catMap[c] = PALETTE[i % PALETTE.length]; });
        const subMap: Record<string, string> = {};
        // cats.length 分オフセットしてカテゴリとサブカテゴリで色が隣接しないよう分散
        subs.forEach((s, i) => { subMap[s] = PALETTE[(i + cats.length) % PALETTE.length]; });
        setCatColorMap(catMap);
        setSubColorMap(subMap);
        setCatNames(cats);
      })
	      .catch(() => setLoadError(true));
	  }, [selectedId]);

  const groupAvg = data && data.groups > 0 ? Math.round(data.total / data.groups) : 0;
  const guestAvg = data && data.guests > 0 ? Math.round(data.total / data.guests) : 0;

	  if (loadError) return <RetryableLoadError />;

	  return (
    <>
      <AppHeader title={t('admin.report')} breadcrumb={{ label: t('admin.menuTitle'), to: ROUTES.admin }} />

        <div className="flex-1 overflow-y-auto p-5 max-w-170 mx-auto w-full">

          {/* 営業セッション選択 */}
          <div className="mb-5">
            <div className="text-label text-muted tracking-widest mb-2">{t('report.sessionLabel')}</div>
            {sessions.length === 0 ? (
              <div className="py-4 text-center text-muted text-note">{t('report.noSessions')}</div>
            ) : (
              <div className="flex flex-col gap-1.5">
                {sessions.map(s => (
                  <button key={s.id}
                    className={`cursor-pointer px-3.5 py-2.5 text-left rounded-lg text-note border ${selectedId === s.id ? 'border-brand bg-brand text-white font-medium' : 'border-line bg-white text-dim'}`}
                    onClick={() => setSelectedId(s.id)}>
                    {sessionLabel(s)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {data && (
            <>
              {/* サマリーカード */}
              <div className="grid gap-2.5 mb-4 animate-[fadeIn_0.25s_ease_both] grid-cols-[repeat(auto-fill,minmax(120px,1fr))]">
                {[
                  { label: t('report.totalSales'), value: `¥${data.total.toLocaleString()}`, sub: null },
                  { label: t('report.seatUsage'), value: `${data.seatUsageRate}%`, sub: null },
                  { label: t('report.groups'), value: `${data.groups}組`, sub: null },
                  { label: t('report.groupAvg'), value: `¥${groupAvg.toLocaleString()}`, sub: t('report.perGroup') },
                  { label: t('report.guests'), value: `${data.guests}名`, sub: null },
                  { label: t('report.guestAvg'), value: `¥${guestAvg.toLocaleString()}`, sub: t('report.perGuest') },
                ].map(card => (
                  <SummaryCard key={card.label} {...card} />
                ))}
              </div>

              <CategoryPieSection data={data} catColorMap={catColorMap} subColorMap={subColorMap} />

              <div className="bg-white border border-divider rounded-xl px-5 py-4 mb-4 animate-[fadeIn_0.35s_ease_both]">
                <div className="text-note font-medium text-ink mb-4">{t('report.hourlySales')}</div>
                {data.hourly.length > 0
                  ? <HourlyChart hourly={data.hourly} catNames={catNames} catColorMap={catColorMap} />
                  : <div className="py-4 text-center text-muted text-note">{t('common.noData')}</div>
                }
              </div>

              <RankingSection ranking={data.ranking} catColorMap={catColorMap} />
            </>
          )}
        </div>
    </>
  );
}
