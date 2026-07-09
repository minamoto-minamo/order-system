import { useTranslation } from "react-i18next";
import { FooterBar } from "./FooterBar";

interface Props {
  tableCount: number;
  tableSeatCount: number;
  counterSeatCount: number;
  totalSeatCount: number;
}

export function StatsBar({ tableCount, tableSeatCount, counterSeatCount, totalSeatCount }: Props) {
  const { t } = useTranslation();
  return (
    <FooterBar>
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
    </FooterBar>
  );
}
