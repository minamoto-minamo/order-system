const ICON_FILTERS = {
  default: undefined,
  danger: 'brightness(0) saturate(100%) invert(21%) sepia(98%) saturate(1400%) hue-rotate(342deg) brightness(97%)',
} as const;

const TEXT_COLORS = {
  default: 'text-ink',
  danger:  'text-danger',
} as const;

type Variant = keyof typeof ICON_FILTERS;

interface NavItemProps {
  label: string;
  onClick: () => void;
  icon?: string;
  variant?: Variant;
  dot?: boolean;
  sub?: string;
  disabled?: boolean;
}

export function NavItem({ label, onClick, icon, variant = 'default', dot, sub, disabled }: NavItemProps) {
  return (
    <button
      className={`tappable w-full text-left px-5 py-2.5 text-note bg-transparent border-none cursor-pointer flex items-center gap-3 ${TEXT_COLORS[variant]} ${disabled ? 'opacity-40' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && (
        <img src={icon} alt="" className="h-5 w-5 object-contain shrink-0"
          style={ICON_FILTERS[variant] ? { filter: ICON_FILTERS[variant] } : undefined}
        />
      )}
      <span className="flex-1 flex flex-col gap-0.5">
        <span>{label}</span>
        {sub && <span className="text-caption text-danger">{sub}</span>}
      </span>
      {dot && <span className="w-2 h-2 rounded-full bg-danger border border-white shrink-0" />}
    </button>
  );
}
