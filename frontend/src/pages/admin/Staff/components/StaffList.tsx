import type { StaffMember } from '@order-system/shared'
import { useTranslation } from 'react-i18next'
import { BaseButton } from '@/components/primitives'
import { formatDate } from '@/lib/utils'
import { RoleBadge } from './RoleBadge'

// スタッフ行リスト（名前・ロール・作成日と操作ボタン群）
export function StaffList({
  staffList,
  meId,
  onSessions,
  onEdit,
  onDelete,
}: {
  staffList: StaffMember[]
  meId: string | undefined
  onSessions: (s: StaffMember) => void
  onEdit: (s: StaffMember) => void
  onDelete: (s: StaffMember) => void
}) {
  const { t } = useTranslation()
  return (
    <div className="bg-white border border-divider rounded-xl overflow-hidden animate-[fadeIn_0.3s_ease_both]">
      {staffList.map((s, i) => (
        <div
          key={s.id}
          className={`flex items-center gap-3 px-5 py-3.5 ${i < staffList.length - 1 ? 'border-b border-surface' : ''}`}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-medium text-ink truncate">{s.username}</span>
              {s.id === meId && (
                <span className="text-caption text-muted">{t('staff.selfLabel')}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <RoleBadge role={s.role} />
              <span className="text-label text-muted">{formatDate(s.createdAt)}</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <BaseButton
              variant="secondary"
              className="rounded-md px-3 py-1 text-label"
              onClick={() => onSessions(s)}
            >
              {t('staff.devices.button')}
            </BaseButton>
            <BaseButton
              variant="secondary"
              className="rounded-md px-3 py-1 text-label"
              onClick={() => onEdit(s)}
            >
              {t('common.edit')}
            </BaseButton>
            <BaseButton
              variant="secondary"
              className="rounded-md px-3 py-1 text-label text-danger border-danger-border"
              onClick={() => onDelete(s)}
              disabled={s.id === meId}
            >
              {t('common.delete')}
            </BaseButton>
          </div>
        </div>
      ))}
    </div>
  )
}
