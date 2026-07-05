import type { ButtonHTMLAttributes } from "react";

interface NavButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  subtitle?: string;
  icon?: string;
  animationDelay?: number;
}

export function NavButton({
  label,
  subtitle,
  icon,
  animationDelay,
  disabled,
  className = "",
  style,
  ...props
}: NavButtonProps) {
  const stateClass = disabled
    ? "bg-surface-deep border-line border-l-faint"
    : "bg-white border-brand-border border-l-brand";
  return (
    <button
      className={["tappable rounded-[10px] px-5.5 py-5 text-left w-full border border-l-4 flex items-center gap-4", stateClass, className].filter(Boolean).join(" ")}
      disabled={disabled}
      style={animationDelay !== undefined ? { animation: `fadeIn 0.4s ease ${animationDelay}s both`, ...style } : style}
      {...props}
    >
      {icon && <img src={icon} alt="" className="h-8 w-8 object-contain shrink-0" />}
      <div>
        <div className="text-sub font-medium text-ink mb-0.75">{label}</div>
        {subtitle && <div className="text-xs text-muted font-light">{subtitle}</div>}
      </div>
    </button>
  );
}
