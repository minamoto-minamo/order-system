import type { StaffMember, StaffSession } from '@order-system/shared'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BottomSheetModal } from '@/components/composite'
import { RetryableLoadError } from '@/components/feedback'
import { BaseButton } from '@/components/primitives'
import { ActionBar, AppHeader } from '@/features/navigation/components'
import { useForm } from '@/hooks/useForm'
import { api } from '@/lib/api'
import { apiErrorMessage } from '@/lib/apiError'
import { EP } from '@/lib/endpoints'
import { ROUTES } from '@/lib/routes'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { StaffFormModal } from './components/StaffFormModal'
import { StaffList } from './components/StaffList'
import { StaffSessionsModal } from './components/StaffSessionsModal'

type ModalMode = 'add' | 'edit' | null

type StaffForm = {
  username: string
  password: string
  role: 'admin' | 'staff'
}

const EMPTY_FORM: StaffForm = { username: '', password: '', role: 'staff' }

export default function Staff() {
  const { t } = useTranslation()
  const { user: me } = useAuthStore()
  const [staffList, setStaffList] = useState<StaffMember[]>([])
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null)
  const [sessionsTarget, setSessionsTarget] = useState<StaffMember | null>(null)
  const [sessions, setSessions] = useState<StaffSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [revokeSessionTarget, setRevokeSessionTarget] = useState<StaffSession | null>(null)
  const [loadError, setLoadError] = useState(false)
  const {
    values: form,
    setValue,
    reset,
    error: formError,
    setError: setFormError,
  } = useForm<StaffForm>(EMPTY_FORM)
  const showToast = useToastStore((state) => state.showToast)

  useEffect(() => {
    api
      .get<StaffMember[]>(EP.staff)
      .then((list) => {
        setLoadError(false)
        setStaffList(list)
      })
      .catch(() => setLoadError(true))
  }, [])

  const openAdd = () => {
    reset(EMPTY_FORM)
    setEditTarget(null)
    setModalMode('add')
  }

  const openEdit = (s: StaffMember) => {
    reset({ username: s.username, password: '', role: s.role as 'admin' | 'staff' })
    setEditTarget(s)
    setModalMode('edit')
  }

  const closeModal = () => {
    setModalMode(null)
    setEditTarget(null)
    setFormError(null)
  }

  const handleSave = async () => {
    setFormError(null)
    try {
      if (modalMode === 'add') {
        const created = await api.post<StaffMember>(EP.staff, {
          username: form.username,
          password: form.password,
          role: form.role,
        })
        setStaffList((prev) => [...prev, created])
      } else if (modalMode === 'edit' && editTarget) {
        const body: Record<string, string> = { username: form.username, role: form.role }
        if (form.password) body.password = form.password
        const updated = await api.put<StaffMember>(EP.staffMember(editTarget.id), body)
        setStaffList((prev) => prev.map((s) => (s.id === updated.id ? updated : s)))
      }
      closeModal()
    } catch (e) {
      setFormError(apiErrorMessage(e, t('common.saveFailed')))
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await api.delete(EP.staffMember(deleteTarget.id))
      setStaffList((prev) => prev.filter((s) => s.id !== deleteTarget.id))
    } catch (e) {
      showToast(apiErrorMessage(e, t('common.deleteFailed')))
    }
    setDeleteTarget(null)
  }

  const openSessions = (s: StaffMember) => {
    setSessionsTarget(s)
    setSessionsLoading(true)
    api
      .get<StaffSession[]>(EP.staffSessions(s.id))
      .then(setSessions)
      .catch((e) => showToast(apiErrorMessage(e, t('common.saveFailed'))))
      .finally(() => setSessionsLoading(false))
  }

  const closeSessions = () => {
    setSessionsTarget(null)
    setSessions([])
  }

  const handleRevokeSession = async () => {
    if (!sessionsTarget || !revokeSessionTarget) return
    try {
      await api.delete(EP.staffSession(sessionsTarget.id, revokeSessionTarget.id))
      setSessions((prev) => prev.filter((s) => s.id !== revokeSessionTarget.id))
      showToast(t('staff.devices.revoked'))
    } catch (e) {
      showToast(apiErrorMessage(e, t('common.deleteFailed')))
    }
    setRevokeSessionTarget(null)
  }

  const isSaveDisabled = !form.username.trim() || (modalMode === 'add' && !form.password)

  if (loadError) return <RetryableLoadError />

  return (
    <>
      <AppHeader
        title={t('admin.staff')}
        breadcrumb={{ label: t('admin.menuTitle'), to: ROUTES.admin }}
      />
      <ActionBar
        right={
          <BaseButton
            className="border-none rounded-lg px-4 py-1.5 text-note font-medium bg-brand text-white"
            onClick={openAdd}
          >
            {t('staff.addStaff')}
          </BaseButton>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 max-w-150 mx-auto w-full">
        {staffList.length === 0 ? (
          <div className="py-12 text-center text-muted text-note">{t('staff.noStaff')}</div>
        ) : (
          <StaffList
            staffList={staffList}
            meId={me?.id}
            onSessions={openSessions}
            onEdit={openEdit}
            onDelete={setDeleteTarget}
          />
        )}
      </div>

      {modalMode && (
        <StaffFormModal
          modalMode={modalMode}
          form={form}
          formError={formError}
          isSaveDisabled={isSaveDisabled}
          onClose={closeModal}
          onSave={handleSave}
          setValue={setValue}
        />
      )}

      {/* 削除確認 */}
      <BottomSheetModal
        show={!!deleteTarget}
        title={deleteTarget ? t('staff.deleteConfirm', { name: deleteTarget.username }) : ''}
        onClose={() => setDeleteTarget(null)}
        secondaryAction={{ label: t('common.cancel'), onClick: () => setDeleteTarget(null) }}
        primaryAction={{ label: t('common.delete'), onClick: handleDelete }}
      />

      {sessionsTarget && (
        <StaffSessionsModal
          target={sessionsTarget}
          sessions={sessions}
          loading={sessionsLoading}
          onClose={closeSessions}
          onRevoke={setRevokeSessionTarget}
        />
      )}

      {/* 強制ログアウト確認 */}
      <BottomSheetModal
        show={!!revokeSessionTarget}
        title={t('staff.devices.revokeConfirm')}
        onClose={() => setRevokeSessionTarget(null)}
        secondaryAction={{ label: t('common.cancel'), onClick: () => setRevokeSessionTarget(null) }}
        primaryAction={{
          label: t('staff.devices.revoke'),
          onClick: handleRevokeSession,
          variant: 'danger',
        }}
      />
    </>
  )
}
