export const PALETTE = ['#4a9eff', '#3ec97a', '#f59e0b', '#a78bfa', '#f87171', '#34d399', '#fb923c', '#60a5fa'];

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
