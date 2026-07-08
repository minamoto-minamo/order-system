import { BaseButton, Icon } from "@/components";
import { useForm } from "@/hooks/useForm";
import { ACTION_ICONS } from "@/lib/icons";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import type { Cat, Product, ProductFormData } from "./types";
import { TO_OPTIONS } from "./types";

type ProductForm = {
  name: string;
  price: number | string;
  subId: number | null;
  takeout: string;
};

export function ProductModal({ product, cats, initialSubId, onConfirm, onClose, onToggleSoldOut, onDelete }: {
  product?: Product;
  cats: Cat[];
  initialSubId?: number | null;
  onConfirm: (data: ProductFormData) => void;
  onClose: () => void;
  onToggleSoldOut?: () => void;
  onDelete?: () => void;
}) {
  const { t } = useTranslation();
  const formId = useId();
  const nameId = `${formId}-name`;
  const priceId = `${formId}-price`;
  const subIdId = `${formId}-sub-id`;
  const takeoutId = `${formId}-takeout`;
  const { values: form, setValue } = useForm<ProductForm>({
    name: product?.name ?? "",
    price: product?.price ?? "",
    subId: product?.subId ?? initialSubId ?? null,
    takeout: product?.takeout ?? "both",
  });
  const { name, price, subId, takeout } = form;

  const contextLabel = !product && subId
    ? (() => {
      for (const c of cats) {
        const s = c.subs.find(s => s.id === subId);
        if (s) return `${c.label} › ${s.label}`;
      }
      return null;
    })()
    : null;

  const isEdit = !!product;
  const canSubmit = name.trim() !== "" && Number(price) > 0 && subId !== null;

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-modal animate-[fadeIn_0.15s_ease_both]" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl p-4 w-72 animate-[slideUp_0.2s_ease_both]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-note font-medium text-ink">
              {isEdit ? t('productSettings.editProductTitle') : t('productSettings.addProductTitle')}
            </div>
            {contextLabel && <div className="text-label text-muted mt-0.5">{contextLabel}</div>}
          </div>
          <BaseButton className="w-6 h-6 flex items-center justify-center rounded text-muted text-note" onClick={onClose} aria-label={t('common.close')}>
            <Icon src={ACTION_ICONS.close} />
          </BaseButton>
        </div>

        <label htmlFor={nameId} className="block text-caption text-muted mb-0.75">{t('productSettings.productName')}</label>
        <input id={nameId} value={name} onChange={e => setValue("name", e.target.value)}
          placeholder={t('productSettings.namePlaceholder')}
          className="input-field w-full border border-line rounded-[7px] px-2.5 py-1.75 text-xs outline-none text-ink mb-2"
        />

        <label htmlFor={priceId} className="block text-caption text-muted mb-0.75">{t('productSettings.price')}</label>
        <input id={priceId} value={price} onChange={e => setValue("price", e.target.value)}
          placeholder={t('productSettings.pricePlaceholder')} type="number"
          className="input-field w-full border border-line rounded-[7px] px-2.5 py-1.75 text-xs outline-none text-ink mb-2"
        />

        <label htmlFor={subIdId} className="block text-caption text-muted mb-0.75">{t('productSettings.category')}</label>
        <select id={subIdId} value={subId ?? ""} onChange={e => setValue("subId", e.target.value ? Number(e.target.value) : null)}
          className="input-field w-full border border-line rounded-[7px] px-2.5 py-1.75 text-xs outline-none text-ink bg-white mb-2 appearance-none"
        >
          {!subId && <option value="">{t('productSettings.selectPrompt')}</option>}
          {cats.map(c => (
            <optgroup key={c.id} label={c.label}>
              {c.subs.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </optgroup>
          ))}
        </select>

        <label htmlFor={takeoutId} className="block text-caption text-muted mb-0.75">{t('productSettings.takeoutType')}</label>
        <select id={takeoutId} value={takeout} onChange={e => setValue("takeout", e.target.value)}
          className="input-field w-full border border-line rounded-[7px] px-2.5 py-1.75 text-xs outline-none text-ink bg-white mb-3 appearance-none"
        >
          {TO_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
          ))}
        </select>

        {isEdit && (
          <div className="mb-2.5">
            <BaseButton
              className={`w-full py-1.75 rounded-lg text-caption border ${product!.soldOut ? 'border-danger-glow bg-danger-bg text-danger' : 'border-line text-muted'}`}
              onClick={onToggleSoldOut}
            >
              {product!.soldOut ? t('productSettings.soldOutActive') : t('productSettings.soldOut')}
            </BaseButton>
          </div>
        )}
        <div className="flex gap-2">
          {isEdit && (
            <BaseButton variant="ghost" className="flex-1 py-2 rounded-lg text-xs text-danger" onClick={onDelete}>{t('common.delete')}</BaseButton>
          )}
          <BaseButton variant="primary" className="flex-1 py-2 rounded-lg text-xs font-medium disabled:opacity-40"
            disabled={!canSubmit}
            onClick={() => canSubmit && onConfirm({ name: name.trim(), price: Number(price), subId: subId!, takeout })}>
            {isEdit ? t('common.save') : t('common.add')}
          </BaseButton>
        </div>
      </div>
    </div>
  );
}
