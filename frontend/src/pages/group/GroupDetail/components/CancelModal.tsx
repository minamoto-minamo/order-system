import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BottomSheetModal } from "@/components";
import "./CancelModal.scss";
import type { OrderItem } from "@order-system/shared";

export function CancelModal({ item, onConfirm, onClose }: {
  item: OrderItem;
  onConfirm: (id: string, cancelQty: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [selectedQty, setSelectedQty] = useState(1);
  const isMulti = item.qty >= 2;

  return (
    <BottomSheetModal
      show={true}
      onClose={onClose}
      secondaryAction={{ label: t('common.back'), onClick: onClose }}
      primaryAction={{
        label: isMulti ? t('group.cancelQty', { qty: selectedQty }) : t('group.cancelConfirm'),
        variant: "danger",
        onClick: () => onConfirm(item.id, isMulti ? selectedQty : 1),
      }}
    >
      <div className="text-sub font-medium text-ink mb-1">{item.menuItemName}</div>
      <div className="text-xs text-muted mb-5">
        {isMulti ? t('group.cancelSelectQty') : t('group.cancelQuestion')}
      </div>
      {isMulti && (
        <div className="mb-6">
          <div className="text-label text-muted mb-2.5">{t('group.currentQty', { qty: item.qty })}</div>
          <div className="flex gap-2 flex-wrap">
            {Array.from({ length: item.qty }, (_, i) => i + 1).map(n => (
              <button
                key={n}
                className={`qty-select-btn w-12 h-12 rounded-[10px] border text-base ${selectedQty === n ? 'border-ink bg-ink text-white font-medium' : 'border-line bg-white text-secondary'}`}
                onClick={() => setSelectedQty(n)}
              >
                {n}
              </button>
            ))}
          </div>
          {selectedQty === item.qty && (
            <div className="text-label text-bill mt-2">{t('group.cancelAll')}</div>
          )}
        </div>
      )}
    </BottomSheetModal>
  );
}
