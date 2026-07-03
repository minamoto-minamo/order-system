export const PALETTE = [
  'var(--color-series-1)', 'var(--color-series-2)', 'var(--color-series-3)', 'var(--color-series-4)',
  'var(--color-series-5)', 'var(--color-series-6)', 'var(--color-series-7)', 'var(--color-series-8)',
];

export interface SessionInfo { id: number; status: string; openedAt: string; closedAt: string | null; }
export interface HourlyEntry { hour: number; [cat: string]: number; }
export interface RankingEntry { name: string; qty: number; amount: number; categoryName: string; subCategoryName: string; }
export interface ReportData {
  total: number; groups: number; guests: number; seatUsageRate: number;
  categoryBreakdown: Record<string, number>; subBreakdown: Record<string, number>;
  hourly: HourlyEntry[]; ranking: RankingEntry[];
}

export const rankColor = (rank: number) => {
  if (rank === 1) return { color: "var(--color-gold)",    bg: "var(--color-gold-bg)",   border: "var(--color-gold-border)" };
  if (rank === 2) return { color: "var(--color-muted)",   bg: "var(--color-surface)",   border: "var(--color-divider)" };
  if (rank === 3) return { color: "var(--color-bronze)",  bg: "var(--color-bronze-bg)", border: "var(--color-bronze-border)" };
  return           { color: "var(--color-faint)",          bg: "white",                  border: "var(--color-surface-deep)" };
};
