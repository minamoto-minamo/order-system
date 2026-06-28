import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AppHeader, NavButton } from "@/components";
import { ROUTES } from "@/lib/routes";
import { ICONS } from "@/assets/icons";

export default function AdminMenu() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const menuItems = [
    { path: ROUTES.adminProducts, label: t('admin.products'), sub: t('admin.productsSub'), icon: ICONS.product },
    { path: ROUTES.adminSeats,    label: t('admin.seats'),    sub: t('admin.seatsSub'),    icon: ICONS.layout  },
    { path: ROUTES.adminStaff,    label: t('admin.staff'),    sub: t('admin.staffSub'),    icon: ICONS.staff   },
    { path: ROUTES.adminReport,   label: t('admin.report'),   sub: t('admin.reportSub'),   icon: ICONS.report  },
    { path: ROUTES.adminSettings, label: t('admin.settings'), sub: t('admin.settingsSub'), icon: ICONS.setting },
  ];

  return (
    <>
      <AppHeader title={t('admin.menuTitle')} />

      <div className="flex-1 flex flex-col items-center justify-center px-8">
        <div className="w-full max-w-80 flex flex-col gap-2.5">
          {menuItems.map((item, i) => (
            <NavButton
              key={item.path}
              label={item.label}
              subtitle={item.sub}
              icon={item.icon}
              animationDelay={i * 0.06}
              onClick={() => navigate(item.path)}
            />
          ))}
        </div>
      </div>
    </>
  );
}
