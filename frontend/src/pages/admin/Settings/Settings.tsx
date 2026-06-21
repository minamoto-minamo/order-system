import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AppHeader, Button, SubHeader } from "@/components";
import { api } from "@/lib/api";
import { ROUTES } from "@/lib/routes";
import { EP } from "@/lib/endpoints";
import { Section, SettingRow } from "./SettingRow";
import "./Settings.scss";

// ── メイン ────────────────────────────────────────────────────
export default function Settings() {
  const { t } = useTranslation();
  const [storeName, setStoreName]       = useState("居酒屋");
  const [closeHour, setCloseHour]       = useState("23");
  const [closeMin, setCloseMin]         = useState("00");
  const [taxDineIn, setTaxDineIn]       = useState("10");
  const [taxTakeout, setTaxTakeout]     = useState("8");
  const [saved, setSaved]               = useState(false);

  useEffect(() => {
    api.get<{ storeName: string; closingTime: string; taxRateInHouse: number; taxRateTakeout: number }>(EP.settings)
      .then(s => {
        setStoreName(s.storeName)
        const [h, m] = s.closingTime.split(':')
        setCloseHour(h)
        setCloseMin(m)
        setTaxDineIn(String(s.taxRateInHouse))
        setTaxTakeout(String(s.taxRateTakeout))
      })
      .catch(() => {})
  }, [])

  const handleSave = () => {
    api.put(EP.settings, {
      storeName,
      closingTime: `${closeHour.padStart(2, '0')}:${closeMin.padStart(2, '0')}`,
      taxRateInHouse: parseInt(taxDineIn, 10),
      taxRateTakeout: parseInt(taxTakeout, 10),
    })
      .then(() => {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      })
      .catch(() => {})
  };

  // 時刻フォーマット（25:00 = 翌1:00 表記）
  const formatCloseTime = () => {
    const h = parseInt(closeHour);
    const m = closeMin;
    if (h >= 24) return `翌${h - 24}:${m}（${closeHour}:${m}）`;
    return `${closeHour}:${m}`;
  };

  return (
    <>
      <div className="h-dvh bg-surface flex flex-col">
        <AppHeader
          title={t('settings.title')}
          breadcrumb={{ label: t('admin.menuTitle'), to: ROUTES.admin }}
        />
        <SubHeader
          right={
            <Button
              className={`border-none rounded-lg px-4 py-1.5 text-note font-medium transition-all ${saved ? 'bg-success-bg text-success-fg' : 'bg-ink text-white'}`}
              onClick={handleSave}
            >
              {saved ? t('common.saved') : t('common.save')}
            </Button>
          }
        />

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-5 max-w-150 mx-auto w-full">

          {/* 店舗情報 */}
          <Section title={t('settings.storeInfo')}>
            <SettingRow
              label={t('settings.storeName')}
              sub={t('settings.storeNameSub')}
            >
              <input
                className="input-field border border-line rounded-[7px] px-2.5 py-1.5 text-note text-ink w-40"
                value={storeName}
                onChange={e => setStoreName(e.target.value)}
              />
            </SettingRow>
          </Section>

          {/* 営業設定 */}
          <Section title={t('settings.businessSettings')}>
            <SettingRow
              label={t('settings.closingTime')}
              sub={t('settings.closingTimeSub', { time: formatCloseTime() })}
            >
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1">
                  <input
                    className="input-field border border-line rounded-[7px] px-2 py-1.5 text-sm w-13 text-center text-ink"
                    type="number" min="0" max="30"
                    value={closeHour}
                    onChange={e => setCloseHour(e.target.value)}
                    onBlur={e => setCloseHour(e.target.value.padStart(2, "0"))}
                  />
                  <span className="text-note text-dim">:</span>
                  <select
                    className="input-field border border-line rounded-[7px] px-2 py-1.5 text-sm w-13 text-center appearance-none text-ink bg-white"
                    value={closeMin}
                    onChange={e => setCloseMin(e.target.value)}
                  >
                    {["00", "15", "30", "45"].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                {parseInt(closeHour) >= 24 && (
                  <span className="text-label text-muted">
                    翌{parseInt(closeHour) - 24}:{closeMin}
                  </span>
                )}
              </div>
            </SettingRow>

            <div className="px-5 pt-2.5 pb-3.5">
              <div className="px-3.5 py-2.5 bg-surface border border-divider rounded-lg text-label text-muted leading-[1.7]">
                💡 深夜営業の場合は24以上の時刻を入力してください。<br/>
                例）翌1:00 の場合は <strong className="text-dim">25:00</strong> と入力
              </div>
            </div>
          </Section>

          {/* 税率設定 */}
          <Section title={t('settings.taxSettings')}>
            <SettingRow
              label={t('settings.taxDineIn')}
              sub={t('settings.taxDineInSub')}
            >
              <div className="flex items-center gap-1.5">
                <input
                  className="input-field border border-line rounded-[7px] px-2 py-1.5 text-sm w-15 text-center text-ink"
                  type="number" min="0" max="100"
                  value={taxDineIn}
                  onChange={e => setTaxDineIn(e.target.value)}
                />
                <span className="text-note text-dim">%</span>
              </div>
            </SettingRow>
            <SettingRow
              label={t('settings.taxTakeout')}
              sub={t('settings.taxTakeoutSub')}
            >
              <div className="flex items-center gap-1.5">
                <input
                  className="input-field border border-line rounded-[7px] px-2 py-1.5 text-sm w-15 text-center text-ink"
                  type="number" min="0" max="100"
                  value={taxTakeout}
                  onChange={e => setTaxTakeout(e.target.value)}
                />
                <span className="text-note text-dim">%</span>
              </div>
            </SettingRow>
            <div className="px-5 pt-2.5 pb-3.5">
              <div className="px-3.5 py-2.5 bg-surface border border-divider rounded-lg text-label text-muted leading-[1.7]">
                💡 日本の標準税率は店内10%・テイクアウト8%です。
              </div>
            </div>
          </Section>

        </div>
      </div>
    </>
  );
}
