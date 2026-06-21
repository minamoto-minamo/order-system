/** 数量を増減するコントロール（− 数値 ＋ 単位） */

interface QuantityControlProps {
  value: number;
  onChange: (value: number) => void;
  min?: number; // デフォルト 1
  max?: number; // 未指定で上限なし
  unit?: string; // 「名」「個」など
}

export function QuantityControl({ value, onChange, min = 1, max, unit }: QuantityControlProps) {
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(max === undefined ? value + 1 : Math.min(max, value + 1));
  return (
    <div className="flex items-center gap-4">
      <button
        onClick={dec}
        className="w-10 h-10 rounded-full border border-line bg-white text-xl text-dim cursor-pointer flex items-center justify-center"
      >
        −
      </button>
      <span className="text-2xl font-medium text-ink min-w-10 text-center">{value}</span>
      <button
        onClick={inc}
        className="w-10 h-10 rounded-full border border-line bg-white text-xl text-dim cursor-pointer flex items-center justify-center"
      >
        ＋
      </button>
      {unit && <span className="text-note text-muted">{unit}</span>}
    </div>
  );
}
