import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppHeader } from "@/components";
import { ROUTES } from "@/lib/routes";
import "./AdminMenu.scss";


export default function AdminMenu() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const menuItems = [
    { path: ROUTES.adminProducts, label: t('admin.products'), sub: t('admin.productsSub') },
    { path: ROUTES.adminSeats,    label: t('admin.seats'),    sub: t('admin.seatsSub') },
    { path: ROUTES.adminStaff,    label: t('admin.staff'),    sub: t('admin.staffSub') },
    { path: ROUTES.adminReport,   label: t('admin.report'),   sub: t('admin.reportSub') },
    { path: ROUTES.adminSettings, label: t('admin.settings'), sub: t('admin.settingsSub') },
  ];

  return (
    <div className="min-h-dvh flex flex-col">
      <AppHeader title={t('admin.menuTitle')} />

      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="w-full max-w-80 flex flex-col gap-2.5">
          {menuItems.map((item, i) => (
            <button
              key={item.path}
              className="tappable rounded-[10px] px-5.5 py-5 text-left w-full border bg-white border-divider"
              onClick={() => navigate(item.path)}
              style={{ animation: `fadeIn 0.4s ease ${i * 0.06}s both` }}
            >
              <div className="text-sub font-medium text-ink mb-0.75">
                {item.label}
              </div>
              <div className="text-xs text-muted font-light">
                {item.sub}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
