import { useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { NavDrawer } from "@/components/layout/NavDrawer";
import { IconButton } from "@/components/controls/button";
import { useOverTimeWarning } from "@/hooks/useOverTimeWarning";
import { BRAND } from "@/lib/brand";

interface AppHeaderProps {
  title: ReactNode;
  sub?: ReactNode;
  breadcrumb?: { label: string; to?: string; onClick?: () => void };
  right?: ReactNode;
  titleTruncate?: boolean;
}

export function AppHeader({ title, sub, breadcrumb, right, titleTruncate = true }: AppHeaderProps) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [showNav, setShowNav] = useState(false);
  const isOverTime = useOverTimeWarning();

  return (
    <>
      <div className="app-header bg-white border-b border-divider px-4 py-3 flex items-center gap-3 shrink-0">
        <div className="flex-1 min-w-0 flex items-center gap-2">
          {breadcrumb && (
            <IconButton
              className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface text-xs text-dim"
              onClick={() => breadcrumb.onClick ? breadcrumb.onClick() : navigate(breadcrumb.to!)}
            >
              <span>←</span>
              <span>{breadcrumb.label}</span>
            </IconButton>
          )}
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <img src={BRAND.iconPath} alt="" className="h-4.5 w-4.5 shrink-0" />
              <div className={`min-w-0 text-sub font-medium text-ink ${titleTruncate ? 'truncate' : ''}`}>{title}</div>
            </div>
            {sub && <div className="text-label text-muted mt-px truncate">{sub}</div>}
          </div>
        </div>
        {right && <div className="flex items-center gap-2 shrink-0">{right}</div>}
        <div className="relative shrink-0">
          <IconButton
            className="w-8 h-8 flex flex-col justify-center items-center gap-1.25 bg-transparent rounded-md"
            onClick={() => setShowNav(true)}
            aria-label={t('nav.openMenu')}
          >
            <span className="block w-4.5 h-[1.5px] bg-dim rounded-full" />
            <span className="block w-4.5 h-[1.5px] bg-dim rounded-full" />
            <span className="block w-4.5 h-[1.5px] bg-dim rounded-full" />
          </IconButton>
          {isOverTime && (
            <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-danger border border-white pointer-events-none" />
          )}
        </div>
      </div>

      {showNav && <NavDrawer isOverTime={isOverTime} onClose={() => setShowNav(false)} />}
    </>
  );
}
