import { useTranslation } from "react-i18next";

interface Props {
  tableCount: number;
  tableSeatCount: number;
  counterSeatCount: number;
  totalSeatCount: number;
}

export function FooterBar({ tableCount, tableSeatCount, counterSeatCount, totalSeatCount }: Props) {
  const { t } = useTranslation();
  return (
    <div className="bg-white border-t border-divider px-5 py-2.5 flex gap-5 items-center shrink-0">
      <div className="text-xs text-muted">
        {t('seatEditor.footerTables')}：<span className="text-dim font-medium">{tableCount}</span>
      </div>
      <div className="text-xs text-muted">
        {t('seatEditor.footerTableSeats')}：<span className="text-dim font-medium">{tableSeatCount}{t('seatEditor.seatUnit')}</span>
      </div>
      <div className="text-xs text-muted">
        {t('seatEditor.footerCounter')}：<span className="text-dim font-medium">{counterSeatCount}{t('seatEditor.seatUnit')}</span>
      </div>
      <div className="text-xs text-muted ml-auto">
        {t('seatEditor.footerTotal')}：<span className="text-dim font-medium">{totalSeatCount}{t('seatEditor.seatUnit')}</span>
      </div>
    </div>
  );
}
