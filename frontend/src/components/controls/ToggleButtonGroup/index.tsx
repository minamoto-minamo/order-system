/** セグメントコントロール風のトグルボタン群 */

interface ToggleOption {
  key: string;
  label: string;
  /** アクティブ時の Tailwind クラス。未指定はブランド色背景 + 白文字 */
  activeClass?: string;
}

interface ToggleButtonGroupProps {
  options: ToggleOption[];
  value: string;
  onChange: (value: string) => void;
}

export function ToggleButtonGroup({ options, value, onChange }: ToggleButtonGroupProps) {
  return (
    <div className="flex border border-line rounded-[7px] overflow-hidden">
      {options.map(opt => (
        <button
          key={opt.key}
          className={`px-2.5 py-1 text-caption border-none cursor-pointer ${
            value === opt.key
              ? (opt.activeClass ?? "bg-brand text-white")
              : "bg-white text-dim"
          }`}
          onClick={() => onChange(opt.key)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
