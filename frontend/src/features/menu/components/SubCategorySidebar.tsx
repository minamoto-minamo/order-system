import { useTranslation } from "react-i18next";
import type { SubCategory } from "@order-system/shared";

export function SubCategorySidebar({ subs, activeSubId, onSelect }: {
  subs: SubCategory[];
  activeSubId: number | null;
  onSelect: (id: number | null) => void;
}) {
  const { t } = useTranslation();
  if (subs.length === 0) return null;
  return (
    <div className="w-18 shrink-0 border-r border-divider bg-surface overflow-y-auto">
      <button
        className={`w-full px-2 py-3 text-caption text-left border-none cursor-pointer border-b border-surface-deep ${activeSubId === null ? 'bg-white text-ink font-medium' : 'bg-transparent text-muted'}`}
        onClick={() => onSelect(null)}
      >
        {t('common.all')}
      </button>
      {subs.map(s => (
        <button
          key={s.id}
          className={`w-full px-2 py-3 text-caption text-left border-none cursor-pointer border-b border-surface-deep ${activeSubId === s.id ? 'bg-white text-ink font-medium' : 'bg-transparent text-muted'}`}
          onClick={() => onSelect(s.id)}
        >
          {s.name}
        </button>
      ))}
    </div>
  );
}
