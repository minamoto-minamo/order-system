import { BaseButton } from "@/components/controls/button/BaseButton";
import { Icon } from "@/components/display/Icon";
import { ACTION_ICONS } from "@/lib/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export function InputModal({ title, sub, placeholder, initialValue = "", onConfirm, onClose, onDelete }: {
  title: string;
  sub?: string;
  placeholder: string;
  initialValue?: string;
  onConfirm: (val: string) => void;
  onClose: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const [val, setVal] = useState(initialValue);
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-modal animate-[fadeIn_0.15s_ease_both]" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl px-5 pt-5 pb-4 w-70 animate-[slideUp_0.2s_ease_both]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-sm font-medium text-ink">{title}</div>
            {sub && <div className="text-label text-muted mt-0.5">{sub}</div>}
          </div>
          <BaseButton className="w-6 h-6 flex items-center justify-center rounded text-muted text-note" onClick={onClose} aria-label={t('common.close')}>
            <Icon src={ACTION_ICONS.close} />
          </BaseButton>
        </div>
        <input
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => e.key === "Enter" && val.trim() && onConfirm(val.trim())}
          placeholder={placeholder}
          className="input-field w-full border border-line rounded-[7px] px-3 py-2.25 text-sm outline-none text-ink mb-3.5"
        />
        <div className="flex gap-2">
          {onDelete && (
            <BaseButton variant="secondary" className="flex-1 py-2.25 rounded-lg text-note text-danger" onClick={onDelete}>{t('common.delete')}</BaseButton>
          )}
          <BaseButton variant="primary" className="flex-1 py-2.25 rounded-lg text-note font-medium disabled:opacity-40" disabled={!val.trim()} onClick={() => val.trim() && onConfirm(val.trim())}>{t('common.confirm')}</BaseButton>
        </div>
      </div>
    </div>
  );
}
