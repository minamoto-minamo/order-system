import { useEffect, useId, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { FormSheetModal } from '@/components/composite'

type ModalMode = 'add' | 'edit'

type StoreForm = {
  subdomain: string
  name: string
  adminUsername: string
  adminPassword: string
}

export function StoreFormModal({
  modalMode,
  form,
  formError,
  isSaveDisabled,
  onClose,
  onSave,
  setValue,
}: {
  modalMode: ModalMode
  form: StoreForm
  formError: string | null
  isSaveDisabled: boolean
  onClose: () => void
  onSave: () => void
  setValue: (key: keyof StoreForm, value: string) => void
}) {
  const { t } = useTranslation()
  const firstFieldRef = useRef<HTMLInputElement>(null)
  const formId = useId()
  const subdomainId = `${formId}-subdomain`
  const nameId = `${formId}-name`
  const adminUsernameId = `${formId}-admin-username`
  const adminPasswordId = `${formId}-admin-password`

  // アニメーション（slideUp 0.2s）開始直後はDOMが未レンダリングのため50ms遅延してフォーカス
  useEffect(() => {
    setTimeout(() => firstFieldRef.current?.focus(), 50)
  }, [])

  return (
    <FormSheetModal
      title={modalMode === 'add' ? t('platform.addTitle') : t('platform.editTitle')}
      error={formError}
      saveDisabled={isSaveDisabled}
      onClose={onClose}
      onSave={onSave}
    >
      {modalMode === 'add' ? (
        <div>
          <label htmlFor={subdomainId} className="text-label text-muted block mb-1.5">
            {t('platform.subdomain')}
          </label>
          <input
            id={subdomainId}
            ref={firstFieldRef}
            className="input-field border border-line rounded-lg px-3 py-2.5 text-sm text-ink w-full"
            value={form.subdomain}
            onChange={(e) => setValue('subdomain', e.target.value)}
            placeholder={t('platform.subdomainHint')}
          />
        </div>
      ) : (
        <div>
          <div className="text-label text-muted block mb-1.5">{t('platform.subdomain')}</div>
          <div className="text-sm text-muted px-3 py-2.5">{form.subdomain}</div>
        </div>
      )}
      <div>
        <label htmlFor={nameId} className="text-label text-muted block mb-1.5">
          {t('platform.name')}
        </label>
        <input
          id={nameId}
          ref={modalMode === 'edit' ? firstFieldRef : undefined}
          className="input-field border border-line rounded-lg px-3 py-2.5 text-sm text-ink w-full"
          value={form.name}
          onChange={(e) => setValue('name', e.target.value)}
        />
      </div>
      {modalMode === 'add' && (
        <>
          <div>
            <label htmlFor={adminUsernameId} className="text-label text-muted block mb-1.5">
              {t('platform.adminUsername')}
            </label>
            <input
              id={adminUsernameId}
              className="input-field border border-line rounded-lg px-3 py-2.5 text-sm text-ink w-full"
              value={form.adminUsername}
              onChange={(e) => setValue('adminUsername', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor={adminPasswordId} className="text-label text-muted block mb-1.5">
              {t('platform.adminPassword')}
            </label>
            <input
              id={adminPasswordId}
              type="password"
              className="input-field border border-line rounded-lg px-3 py-2.5 text-sm text-ink w-full"
              value={form.adminPassword}
              onChange={(e) => setValue('adminPassword', e.target.value)}
            />
          </div>
        </>
      )}
    </FormSheetModal>
  )
}
