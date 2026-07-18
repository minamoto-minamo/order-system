import { useTranslation } from 'react-i18next'
import { BottomSheetModal, SlideUpFooter } from '@/components/composite'
import { BaseButton, QuantityPicker } from '@/components/primitives'

// グループ作成の下部フッターと人数入力モーダル。
export function CreateGroupSheet({
  canCreate,
  groupName,
  guestCount,
  showModal,
  onOpenModal,
  onCloseModal,
  onGuestCountChange,
  onCreate,
}: {
  canCreate: boolean
  groupName: string
  guestCount: number
  showModal: boolean
  onOpenModal: () => void
  onCloseModal: () => void
  onGuestCountChange: (count: number) => void
  onCreate: () => void
}) {
  const { t } = useTranslation()

  return (
    <>
      {canCreate && (
        <SlideUpFooter className="px-5 py-3.5">
          <div className="text-label text-muted mb-2 text-center">
            {t('hall.seatsSelected', { seats: groupName })}
          </div>
          <BaseButton
            variant="primary"
            onClick={onOpenModal}
            className="w-full rounded-[10px] p-3.5 text-sm font-medium tracking-[0.04em]"
          >
            {t('hall.createGroup')}
          </BaseButton>
        </SlideUpFooter>
      )}

      <BottomSheetModal
        show={showModal}
        onClose={onCloseModal}
        secondaryAction={{ label: t('common.cancel'), onClick: onCloseModal }}
        primaryAction={{
          label: t('hall.createGroupAction', { count: guestCount }),
          onClick: () => {
            onCreate()
          },
        }}
      >
        <div className="text-sub font-medium text-ink mb-1">{t('hall.createGroup')}</div>
        <div className="text-xs text-muted mb-5">{groupName}</div>
        <div className="mb-6">
          <div className="text-xs text-dim mb-2.5">{t('hall.guestCount')}</div>
          <QuantityPicker value={guestCount} onChange={onGuestCountChange} min={1} unit="名" />
        </div>
      </BottomSheetModal>
    </>
  )
}
