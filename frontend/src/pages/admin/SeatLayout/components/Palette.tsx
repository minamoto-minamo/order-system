import { BaseButton } from "@/components";
import { useTranslation } from "react-i18next";

interface PaletteItem {
  type: string;
  icon: string;
  label: string;
  sub: string;
}

interface Props {
  sidebarOpen: boolean;
  onToggle: () => void;
  items: PaletteItem[];
  onPalettePointerDown: (e: React.PointerEvent, type: string, icon: string) => void;
}

export function Palette({ sidebarOpen, onToggle, items, onPalettePointerDown }: Props) {
  const { t } = useTranslation();
  return (
    <div className={`bg-white border-r border-divider shrink-0 flex flex-col overflow-y-auto overflow-x-hidden transition-[width] duration-200 ${sidebarOpen ? 'w-39' : 'w-10'}`}>
      <BaseButton
        className="self-end m-1.5 w-5 h-5 flex items-center justify-center rounded text-muted text-note shrink-0"
        onClick={onToggle}
      >
        {sidebarOpen ? '«' : '»'}
      </BaseButton>
      <div className={`flex flex-col flex-1 ${sidebarOpen ? 'px-3 pb-4' : 'px-1.5 pb-3'}`}>
        {sidebarOpen
          ? <div className="text-label text-muted tracking-widest mb-2.5">{t('common.add')}</div>
          : <div className="text-caption text-dim text-center mb-1.5">{t('seatEditor.addLabel')}</div>
        }
        {items.map(item => (
          <div
            key={item.type}
            className={`palette-item mb-1.75 flex items-center ${sidebarOpen ? 'bg-surface border border-divider rounded-lg gap-2 px-2.5 py-2.25' : 'justify-center p-1.5'}`}
            onPointerDown={(e) => onPalettePointerDown(e, item.type, item.icon)}
            title={item.label}
          >
            <div className={`w-6.5 h-6.5 bg-surface-deep border border-line flex items-center justify-center text-xs text-dim shrink-0 ${item.type === 'seat' ? 'rounded-full' : 'rounded-[5px]'}`}>
              {item.icon}
            </div>
            {sidebarOpen && (
              <div className="min-w-0">
                <div className="text-label text-secondary font-medium">{item.label}</div>
                <div className="text-caption text-dim mt-px">{item.sub}</div>
              </div>
            )}
          </div>
        ))}
        {sidebarOpen && (
          <div className="text-caption text-dim text-center pt-1.5 pb-3.5 leading-[1.7]">
            {t('seatEditor.dragHintLine1')}<br />{t('seatEditor.dragHintLine2')}
          </div>
        )}
      </div>
    </div>
  );
}
