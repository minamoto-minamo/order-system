import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AppHeader, NavigationCard } from '@/features/navigation/components'
import { NAV_ICONS } from '@/lib/icons'
import { ROUTES } from '@/lib/routes'

export default function AdminMenu() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const menuItems = [
    {
      path: ROUTES.adminProducts,
      label: t('admin.products'),
      sub: t('admin.productsSub'),
      icon: NAV_ICONS.product,
    },
    {
      path: ROUTES.adminCourses,
      label: t('admin.courses'),
      sub: t('admin.coursesSub'),
      icon: NAV_ICONS.course,
    },
    {
      path: ROUTES.adminSeats,
      label: t('admin.seats'),
      sub: t('admin.seatsSub'),
      icon: NAV_ICONS.layout,
    },
    {
      path: ROUTES.adminStaff,
      label: t('admin.staff'),
      sub: t('admin.staffSub'),
      icon: NAV_ICONS.staff,
    },
    {
      path: ROUTES.adminReport,
      label: t('admin.report'),
      sub: t('admin.reportSub'),
      icon: NAV_ICONS.report,
    },
    {
      path: ROUTES.adminSettings,
      label: t('admin.settings'),
      sub: t('admin.settingsSub'),
      icon: NAV_ICONS.setting,
    },
  ]

  return (
    <>
      <AppHeader title={t('admin.menuTitle')} />

      <div className="flex-1 overflow-y-auto px-8">
        <div
          className="min-h-full py-6 flex flex-col items-center"
          style={{ justifyContent: 'safe center' }}
        >
          <div className="w-full max-w-[41rem] flex flex-wrap gap-2.5">
            {menuItems.map((item, i) => (
              <NavigationCard
                key={item.path}
                label={item.label}
                subtitle={item.sub}
                icon={item.icon}
                className={`min-[560px]:w-[calc(50%-0.3125rem)] ${menuItems.length % 2 === 1 && i === menuItems.length - 1 ? 'min-[560px]:mx-auto' : ''}`}
                animationDelay={i * 0.06}
                onClick={() => navigate(item.path)}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
