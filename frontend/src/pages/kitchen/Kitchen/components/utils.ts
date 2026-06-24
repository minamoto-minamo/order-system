export const elapsed = (ts: string) => {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  return m < 1 ? "今" : `${m}分前`;
};

export const timeStr = (ts: string) => {
  const d = new Date(ts);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const elapsedColor = (ts: string) => {
  const m = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (m >= 15) return "var(--color-danger)";
  if (m >= 8)  return "var(--color-bill)";
  return "var(--color-muted)";
};
