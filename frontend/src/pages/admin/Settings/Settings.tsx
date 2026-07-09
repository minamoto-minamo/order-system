import { RetryableLoadError } from "@/components/feedback";
import { BaseButton, ToggleButtonGroup } from "@/components/primitives";
import { ActionBar, AppHeader } from "@/features/navigation/components";
import { api } from "@/lib/api";
import { EP } from "@/lib/endpoints";
import { ROUTES } from "@/lib/routes";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToastStore } from "@/stores/toast";
import { apiErrorMessage } from "@/lib/apiError";
import { Section, SettingRow } from "./components/SettingRow";
import { SettingHint } from "./components/SettingHint";

function clamp(value: string, min: number, max: number): string {
  const n = parseInt(value, 10);
  if (isNaN(n)) return String(min);
  return String(Math.min(max, Math.max(min, n)));
}

// ── メイン ────────────────────────────────────────────────────
export default function Settings() {
  const { t } = useTranslation();
  const showToast = useToastStore((state) => state.showToast);
  const [storeName, setStoreName] = useState("居酒屋");
  const [closeHour, setCloseHour] = useState("23");
  const [closeMin, setCloseMin] = useState("00");
  const [taxDineIn, setTaxDineIn] = useState("10");
  const [taxTakeout, setTaxTakeout] = useState("8");
  const [taxInclusive, setTaxInclusive] = useState(false);
  const [refreshTokenAutoExtend, setRefreshTokenAutoExtend] = useState(true);
	  const [refreshTokenExpiresMinutes, setRefreshTokenExpiresMinutes] = useState("1440");
	  const [saved, setSaved] = useState(false);
	  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    api.get<{
      storeName: string; closingTime: string; taxRateInHouse: number; taxRateTakeout: number;
      taxInclusive: boolean;
      refreshTokenAutoExtend: boolean; refreshTokenExpiresMinutes: number;
    }>(EP.settings)
	      .then(s => {
	        setLoadError(false)
	        setStoreName(s.storeName)
        const [h, m] = s.closingTime.split(':')
        setCloseHour(h)
        setCloseMin(m)
        setTaxDineIn(String(s.taxRateInHouse))
        setTaxTakeout(String(s.taxRateTakeout))
        setTaxInclusive(s.taxInclusive)
        setRefreshTokenAutoExtend(s.refreshTokenAutoExtend)
        setRefreshTokenExpiresMinutes(String(s.refreshTokenExpiresMinutes))
      })
	      .catch(() => setLoadError(true))
	  }, [])

  const handleSave = () => {
    api.put(EP.settings, {
      storeName,
      closingTime: `${closeHour.padStart(2, '0')}:${closeMin.padStart(2, '0')}`,
      taxRateInHouse: parseFloat(taxDineIn),
      taxRateTakeout: parseFloat(taxTakeout),
      taxInclusive,
      refreshTokenAutoExtend,
      refreshTokenExpiresMinutes: parseInt(refreshTokenExpiresMinutes, 10),
    })
      .then(() => {
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      })
      .catch((e) => { showToast(apiErrorMessage(e, t('common.saveFailed'))) })
  };

  // 時刻フォーマット（25:00 = 翌1:00 表記）
  const formatCloseTime = () => {
    const h = parseInt(closeHour);
    const m = closeMin;
    if (h >= 24) return `翌${h - 24}:${m}（${closeHour}:${m}）`;
    return `${closeHour}:${m}`;
  };

	  if (loadError) return <RetryableLoadError />;

	  return (
    <>
      <AppHeader
        title={t('settings.title')}
        breadcrumb={{ label: t('admin.menuTitle'), to: ROUTES.admin }}
      />
      <ActionBar
        right={
          <BaseButton
            className={`border-none rounded-lg px-4 py-1.5 text-note font-medium transition-all ${saved ? 'bg-success-bg text-success-fg' : 'bg-brand text-white'}`}
            onClick={handleSave}
          >
            {saved ? t('common.saved') : t('common.save')}
          </BaseButton>
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
                  onBlur={e => setCloseHour(clamp(e.target.value, 0, 30).padStart(2, "0"))}
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

          <SettingHint>
            {t('settings.closingTimeHint').split('\n').map((line, i) => (
              <span key={i}>
                {i > 0 && <br />}
                {line}
              </span>
            ))}
          </SettingHint>
        </Section>

        {/* 税率設定 */}
        <Section title={t('settings.taxSettings')}>
          <SettingRow
            label={t('settings.taxInclusive')}
            sub={t('settings.taxInclusiveSub')}
          >
            <ToggleButtonGroup
              options={[
                { key: 'on', label: t('settings.taxInclusiveOn') },
                { key: 'off', label: t('settings.taxInclusiveOff') },
              ]}
              value={taxInclusive ? 'on' : 'off'}
              onChange={v => setTaxInclusive(v === 'on')}
            />
          </SettingRow>
          <SettingRow
            label={t('settings.taxDineIn')}
            sub={t('settings.taxDineInSub')}
          >
            <div className="flex items-center gap-1.5">
              <input
                className="input-field border border-line rounded-[7px] px-2 py-1.5 text-sm w-15 text-center text-ink"
                type="number" min="0" max="100"
                value={taxDineIn}
                disabled={taxInclusive}
                onChange={e => setTaxDineIn(e.target.value)}
                onBlur={e => setTaxDineIn(clamp(e.target.value, 0, 100))}
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
                disabled={taxInclusive}
                onChange={e => setTaxTakeout(e.target.value)}
                onBlur={e => setTaxTakeout(clamp(e.target.value, 0, 100))}
              />
              <span className="text-note text-dim">%</span>
            </div>
          </SettingRow>
          <SettingHint>{t('settings.taxHint')}</SettingHint>
        </Section>

        {/* セッション設定 */}
        <Section title={t('settings.sessionSettings')}>
          <SettingRow label={t('settings.refreshExpireType')}>
            <ToggleButtonGroup
              options={[
                { key: 'auto', label: t('settings.refreshAutoExtend') },
                { key: 'fixed', label: t('settings.refreshFixedExpiry') },
              ]}
              value={refreshTokenAutoExtend ? 'auto' : 'fixed'}
              onChange={v => setRefreshTokenAutoExtend(v === 'auto')}
            />
          </SettingRow>
          <SettingRow
            label={t('settings.refreshExpiresMinutes')}
            sub={t('settings.refreshExpiresMinutesSub')}
          >
            <input
              className="input-field border border-line rounded-[7px] px-2.5 py-1.5 text-sm w-20 text-center text-ink"
              type="number" min="5" max="43200"
              value={refreshTokenExpiresMinutes}
              onChange={e => setRefreshTokenExpiresMinutes(e.target.value)}
              onBlur={e => setRefreshTokenExpiresMinutes(clamp(e.target.value, 5, 43200))}
            />
          </SettingRow>
          <SettingHint>{t('settings.sessionSettingsHint')}</SettingHint>
        </Section>

      </div>
    </>
  );
}
