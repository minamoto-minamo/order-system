export function PieChart({ data, colorMap }: {
  data: Record<string, number>;
  colorMap: Record<string, string>;
}) {
  const total = Object.values(data).reduce((s, v) => s + v, 0);
  if (total === 0) return null;
  let cumAngle = -Math.PI / 2;
  const R = 70, cx = 90, cy = 90;

  const slices = Object.entries(data).map(([key, val]) => {
    const angle = (val / total) * 2 * Math.PI;
    const x1 = cx + R * Math.cos(cumAngle);
    const y1 = cy + R * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = cx + R * Math.cos(cumAngle);
    const y2 = cy + R * Math.sin(cumAngle);
    const large = angle > Math.PI ? 1 : 0;
    return { key, val, x1, y1, x2, y2, large, pct: Math.round(val / total * 100) };
  });

  return (
    <div className="flex items-center gap-5 flex-wrap">
      <svg width={180} height={180} viewBox="0 0 180 180" className="shrink-0">
        {slices.map(s => (
          <path key={s.key}
            d={`M${cx},${cy} L${s.x1},${s.y1} A${R},${R} 0 ${s.large},1 ${s.x2},${s.y2} Z`}
            fill={colorMap[s.key] ?? 'var(--color-line)'}
            stroke="white" strokeWidth={2}
          />
        ))}
        <circle cx={cx} cy={cy} r={36} fill="white" />
      </svg>
      <div className="flex flex-col gap-2">
        {slices.map(s => (
          <div key={s.key} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ background: colorMap[s.key] ?? 'var(--color-line)' }} />
            <div>
              <div className="text-xs text-secondary font-medium">{s.key}</div>
              <div className="text-label text-muted">¥{s.val.toLocaleString()} ({s.pct}%)</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
