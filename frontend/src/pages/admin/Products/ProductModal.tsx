import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components";
import { TO_OPTIONS } from "./types";
import type { Cat, Product, ProductFormData } from "./types";

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
const [name,    setName]    = useState(product?.name    ?? "");
  const [price,   setPrice]   = useState(product?.price   ?? "");
  const [subId,   setSubId]   = useState<number | null>(product?.subId ?? initialSubId ?? null);
  const [takeout, setTakeout] = useState(product?.takeout ?? "both");

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
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-200 animate-[fadeIn_0.15s_ease_both]" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl p-4 w-72 animate-[slideUp_0.2s_ease_both]">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-note font-medium text-ink">
              {isEdit ? t('productSettings.editProductTitle') : t('productSettings.addProductTitle')}
            </div>
            {contextLabel && <div className="text-label text-muted mt-0.5">{contextLabel}</div>}
          </div>
          <button className="action-btn w-6 h-6 flex items-center justify-center rounded text-muted text-note" onClick={onClose}>×</button>
        </div>

        <div className="text-caption text-muted mb-0.75">{t('productSettings.productName')}</div>
        <input value={name} onChange={e => setName(e.target.value)}
          placeholder="例：生ビール"
          className="input-field w-full border border-line rounded-[7px] px-2.5 py-1.75 text-xs outline-none text-ink mb-2"
        />

        <div className="text-caption text-muted mb-0.75">{t('productSettings.price')}</div>
        <input value={price} onChange={e => setPrice(e.target.value)}
          placeholder="例：550" type="number"
          className="input-field w-full border border-line rounded-[7px] px-2.5 py-1.75 text-xs outline-none text-ink mb-2"
        />

        <div className="text-caption text-muted mb-0.75">{t('productSettings.category')}</div>
        <select value={subId ?? ""} onChange={e => setSubId(e.target.value ? Number(e.target.value) : null)}
          className="input-field w-full border border-line rounded-[7px] px-2.5 py-1.75 text-xs outline-none text-ink bg-white mb-2 appearance-none"
        >
          {!subId && <option value="">— 選択してください —</option>}
          {cats.map(c => (
            <optgroup key={c.id} label={c.label}>
              {c.subs.map(s => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </optgroup>
          ))}
        </select>

        <div className="text-caption text-muted mb-0.75">{t('productSettings.takeoutType')}</div>
        <select value={takeout} onChange={e => setTakeout(e.target.value)}
          className="input-field w-full border border-line rounded-[7px] px-2.5 py-1.75 text-xs outline-none text-ink bg-white mb-3 appearance-none"
        >
          {TO_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
          ))}
        </select>

        {isEdit && (
          <div className="mb-2.5">
            <button
              className={`w-full py-1.75 rounded-lg text-caption border ${product!.soldOut ? 'border-danger-glow bg-danger-bg text-danger' : 'border-line text-muted'}`}
              onClick={onToggleSoldOut}
            >
              {product!.soldOut ? t('productSettings.soldOutActive') : t('productSettings.soldOut')}
            </button>
          </div>
        )}
        <div className="flex gap-2">
          {isEdit && (
            <Button variant="ghost" className="flex-1 py-2 rounded-lg text-xs text-danger" onClick={onDelete}>{t('common.delete')}</Button>
          )}
          <Button variant="primary" className="flex-1 py-2 rounded-lg text-xs font-medium disabled:opacity-40"
            disabled={!canSubmit}
            onClick={() => canSubmit && onConfirm({ name: name.trim(), price: Number(price), subId: subId!, takeout })}>
            {isEdit ? t('common.save') : t('common.add')}
          </Button>
        </div>
      </div>
    </div>
  );
}
