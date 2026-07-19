import type {
  Category,
  Course,
  DrinkPlan,
  Group,
  MenuItem,
  OrderItem,
  Seat,
  SubCategory,
} from '@order-system/shared'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { TabNavigation } from '@/components/composite'
import { RetryableLoadError } from '@/components/feedback'
import { Icon, IconButton } from '@/components/primitives'
import { AppHeader } from '@/features/navigation/components'
import { useSocketListeners } from '@/hooks/useSocketListeners'
import { api } from '@/lib/api'
import { applyQueuedOrderEvents, type QueuedOrderEvent } from '@/lib/applyQueuedOrderEvents'
import { EP } from '@/lib/endpoints'
import { SOCKET_EVENTS as SE } from '@/lib/events'
import { ACTION_ICONS, SYMBOL_ICONS } from '@/lib/icons'
import { socket } from '@/lib/socket'
import { getSeatLabels } from '@/lib/utils'
import { useToastStore } from '@/stores/toast'
import { BillFooter } from './components/BillFooter'
import { CancelModal } from './components/CancelModal'
import { ChangeSeatModal } from './components/ChangeSeatModal'
import { ConfirmModal } from './components/ConfirmModal'
import { CourseConfirmModal } from './components/CourseConfirmModal'
import { CourseTab } from './components/CourseTab'
import { MenuAdd } from './components/MenuAdd'
import { OrderHistory } from './components/OrderHistory'
import { QrModal } from './components/QrModal'
import { showAddedOrderToasts } from './toastUtils'

// ── メイン ───────────────────────────────────────────────────

type SubmittingAction =
  | 'courseOrder'
  | 'courseRemove'
  | 'courseQtyChange'
  | 'cancel'
  | 'add'
  | 'seatChange'
  | 'billConfirm'
  | 'billCancel'
  | 'reset'

export default function GroupDetail() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id: groupId = '' } = useParams<{ id: string }>()

  const [group, setGroup] = useState<Group | null>(null)
  const [items, setItems] = useState<OrderItem[]>([])
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [subCategories, setSubCategories] = useState<SubCategory[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [drinkPlans, setDrinkPlans] = useState<DrinkPlan[]>([])
  const [seats, setSeats] = useState<Seat[]>([])

  const [tab, setTab] = useState('menu')
  const [showSeatModal, setShowSeatModal] = useState(false)
  const [showQr, setShowQr] = useState(false)
  const [showCourseConfirm, setShowCourseConfirm] = useState<Course | null>(null)
  const [courseQty, setCourseQty] = useState(1)
  const [cancelTarget, setCancelTarget] = useState<OrderItem | null>(null)
  const [showBillConfirm, setShowBillConfirm] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [showCourseRemoveConfirm, setShowCourseRemoveConfirm] = useState(false)
  const showToast = useToastStore((state) => state.showToast)
  const [loadError, setLoadError] = useState(false)
  const [submittingAction, setSubmittingAction] = useState<SubmittingAction | null>(null)
  const submittingRef = useRef(false)
  // fetchAll 実行中に届いた注文関連Socketイベントは、RESTスナップショットで上書きされないよう
  // ここに保留し、フェッチ完了後に順番どおり再適用する。世代カウンタは多重フェッチ（再接続連打）時に
  // 最新でなくなったフェッチの結果を破棄するために使う。
  const fetchGenRef = useRef(0)
  const queueRef = useRef<QueuedOrderEvent[]>([])
  const isFetchingRef = useRef(false)

  useEffect(() => {
    const fetchAll = () => {
      const gen = ++fetchGenRef.current
      queueRef.current = []
      isFetchingRef.current = true
      return Promise.all([
        api.get<Group>(EP.group(groupId)),
        api.get<OrderItem[]>(`${EP.orders}?groupId=${groupId}`),
        api.get<MenuItem[]>(EP.menus),
        api.get<Category[]>(EP.categories),
        api.get<SubCategory[]>(EP.subcategories),
        api.get<Course[]>(EP.courses),
        api.get<DrinkPlan[]>(EP.drinkPlans),
        api.get<Seat[]>(EP.seats),
      ])
        .then(([g, o, m, c, sc, cr, dp, s]) => {
          if (fetchGenRef.current !== gen) return
          setLoadError(false)
          setGroup(g)
          setTab(g.status === 'active' ? 'menu' : 'history')
          setItems(applyQueuedOrderEvents(o, queueRef.current))
          setMenus(m)
          setCategories(c)
          setSubCategories(sc)
          setCourses(cr)
          setDrinkPlans(dp)
          setSeats(s)
        })
        .catch(() => {
          if (fetchGenRef.current !== gen) return
          setLoadError(true)
        })
        .finally(() => {
          if (fetchGenRef.current !== gen) return
          isFetchingRef.current = false
        })
    }
    fetchAll()
    socket.on('connect', fetchAll)
    return () => {
      socket.off('connect', fetchAll)
    }
  }, [groupId])

  useSocketListeners({
    // Socket と初期ロードの二重受信を防ぐため id 重複チェックを行う
    // fetchAll 実行中は直接反映せず保留キューへ積み、フェッチ完了後にまとめて再適用する
    [SE.orderCreated]: (o: OrderItem) => {
      if (o.groupId !== groupId) return
      if (isFetchingRef.current) {
        queueRef.current.push({ type: 'created', item: o })
        return
      }
      setItems((prev) => (prev.some((i) => i.id === o.id) ? prev : [...prev, o]))
    },
    [SE.orderUpdated]: (o: OrderItem) => {
      if (o.groupId !== groupId) return
      if (isFetchingRef.current) {
        queueRef.current.push({ type: 'updated', item: o })
        return
      }
      setItems((prev) => prev.map((i) => (i.id === o.id ? o : i)))
    },
    // orderCancelled は id だけ届くため、アイテム全体はローカルで status だけ更新
    [SE.orderCancelled]: (id: string) => {
      if (isFetchingRef.current) {
        queueRef.current.push({ type: 'cancelled', id })
        return
      }
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: 'cancelled' as const } : i)),
      )
    },
    [SE.groupUpdated]: (g: Group) => {
      if (g.id === groupId) setGroup(g)
    },
    [SE.menuSoldout]: (menuItemId: number, soldOut: boolean) =>
      setMenus((prev) => prev.map((m) => (m.id === menuItemId ? { ...m, soldOut } : m))),
    [SE.menuCreated]: (item: MenuItem) => setMenus((prev) => [...prev, item]),
    [SE.menuUpdated]: (item: MenuItem) =>
      setMenus((prev) => prev.map((m) => (m.id === item.id ? item : m))),
    [SE.menuDeleted]: (menuItemId: number) =>
      setMenus((prev) => prev.filter((m) => m.id !== menuItemId)),
    [SE.courseCreated]: (course: Course) => setCourses((prev) => [...prev, course]),
    [SE.courseUpdated]: (course: Course) =>
      setCourses((prev) => prev.map((c) => (c.id === course.id ? course : c))),
    [SE.courseDeleted]: (courseId: number) =>
      setCourses((prev) => prev.filter((c) => c.id !== courseId)),
    [SE.drinkPlanCreated]: (drinkPlan: DrinkPlan) => setDrinkPlans((prev) => [...prev, drinkPlan]),
    [SE.drinkPlanUpdated]: (drinkPlan: DrinkPlan) =>
      setDrinkPlans((prev) => prev.map((p) => (p.id === drinkPlan.id ? drinkPlan : p))),
    [SE.drinkPlanDeleted]: (drinkPlanId: number) =>
      setDrinkPlans((prev) => prev.filter((p) => p.id !== drinkPlanId)),
  })

  const appliedCourse = courses.find((c) => c.id === group?.courseId) ?? null
  const activeDrinkPlan = drinkPlans.find((p) => p.id === group?.drinkPlanId) ?? null
  const appliedCourseChargeItem = items.find(
    (i) => i.isCourseCharge && !i.isDrinkPlanCharge && i.courseId === group?.courseId,
  )
  const appliedCourseQty = appliedCourseChargeItem?.qty ?? null

  const seatLabels = getSeatLabels(seats, group?.seatIds ?? [])
  const isSubmitting = submittingAction !== null

  const runSubmitting = async (action: SubmittingAction, task: () => Promise<void>) => {
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmittingAction(action)
    try {
      await task()
    } finally {
      submittingRef.current = false
      setSubmittingAction(null)
    }
  }

  const handleCourseOrder = async (course: Course, qty: number) => {
    if (!group) return
    await runSubmitting('courseOrder', async () => {
      try {
        const updatedGroup = await api.post<Group>(EP.groupCourse(group.id), {
          courseId: course.id,
          qty,
        })
        setGroup(updatedGroup)
        showToast(t('group.courseAppliedToast', { name: course.name }))
        setShowCourseConfirm(null)
        setTab('history')
      } catch {
        showToast(t('group.courseApplyFailed'))
      }
    })
  }

  const handleCourseRemove = async () => {
    if (!group) return
    await runSubmitting('courseRemove', async () => {
      try {
        const updatedGroup = await api.delete<Group>(EP.groupCourse(group.id))
        setGroup(updatedGroup)
        showToast(t('group.courseRemovedToast'))
      } catch {
        showToast(t('group.courseRemoveFailed'))
      }
      setShowCourseRemoveConfirm(false)
    })
  }

  const handleCourseQtyChange = async (qty: number) => {
    if (!group) return
    await runSubmitting('courseQtyChange', async () => {
      try {
        const updated = await api.put<OrderItem | undefined>(EP.groupCourse(group.id), { qty })
        if (updated) setItems((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
        showToast(t('group.courseQtyChangedToast'))
      } catch {
        showToast(t('group.courseQtyChangeFailed'))
      }
    })
  }

  const handleChangeStatus = (id: string) => {
    const item = items.find((i) => i.id === id)
    if (!item) return
    if (item.status === 'pending') socket.emit(SE.orderComplete, id)
    else if (item.status === 'ready') socket.emit(SE.orderServe, id)
  }

  const handleCancelConfirm = async (id: string, cancelQty: number) => {
    await runSubmitting('cancel', async () => {
      try {
        const updated = await api.put<OrderItem>(EP.orderCancel(id), { qty: cancelQty })
        setItems((prev) => prev.map((i) => (i.id === id ? updated : i)))
      } catch {
        showToast(t('group.cancelFailed'))
      }
      setCancelTarget(null)
    })
  }

  const handleAdd = async (orderItems: { item: MenuItem; qty: number }[], isTakeout: boolean) => {
    if (!group || orderItems.length === 0) return
    await runSubmitting('add', async () => {
      try {
        const created = await api.post<OrderItem[]>(EP.orders, {
          groupId: group.id,
          items: orderItems.map(({ item, qty }) => ({ menuItemId: item.id, qty, isTakeout })),
        })
        // order:created イベントの到着を待たず、レスポンスを直接反映して履歴タブに即時反映する
        setItems((prev) => [...prev, ...created.filter((c) => !prev.some((i) => i.id === c.id))])
        showAddedOrderToasts(orderItems, (name) => t('group.addedToastMsg', { name }), showToast)
        setTab('history')
      } catch {
        showToast(t('group.addOrderFailed'))
      }
    })
  }

  const handleSeatChange = async (seatIds: number[], name: string) => {
    if (!group) return
    await runSubmitting('seatChange', async () => {
      try {
        const updated = await api.put<Group>(EP.group(group.id), { seatIds, name })
        setGroup(updated)
        showToast(t('group.changeSeatToast'))
      } catch {
        showToast(t('group.changeSeatFailed'))
      }
      setShowSeatModal(false)
    })
  }

  const handleBillConfirm = async () => {
    if (!group) return
    await runSubmitting('billConfirm', async () => {
      try {
        const updated = await api.put<Group>(EP.group(group.id), { status: 'bill_requested' })
        setGroup(updated)
      } catch {
        showToast(t('group.billFailed'))
      }
      setShowBillConfirm(false)
    })
  }

  const handleBillCancel = async () => {
    if (!group) return
    await runSubmitting('billCancel', async () => {
      try {
        const updated = await api.put<Group>(EP.group(group.id), { status: 'active' })
        setGroup(updated)
        setTab('history')
      } catch {
        showToast(t('group.billCancelFailed'))
      }
    })
  }

  const handleResetConfirm = async () => {
    if (!group) return
    await runSubmitting('reset', async () => {
      try {
        await api.put<Group>(EP.group(group.id), { status: 'closed' })
        navigate(-1)
      } catch {
        showToast(t('group.checkOutFailed'))
      }
      setShowResetConfirm(false)
    })
  }

  if (loadError) return <RetryableLoadError />

  return (
    <>
      <AppHeader
        title={group?.name ?? '...'}
        sub={seatLabels || undefined}
        breadcrumb={{ label: t('common.back'), onClick: () => navigate(-1) }}
        right={
          group?.status === 'active' ? (
            <div className="flex items-center gap-2">
              <IconButton
                className="w-8 h-8 flex items-center justify-center rounded-md text-dim"
                onClick={() => setShowQr(true)}
                aria-label={t('group.showQr')}
              >
                <Icon src={ACTION_ICONS.qr} />
              </IconButton>
              <IconButton
                className="w-8 h-8 flex items-center justify-center rounded-md text-dim"
                onClick={() => setShowSeatModal(true)}
                aria-label={t('group.changeSeat')}
              >
                <Icon src={ACTION_ICONS.edit} />
              </IconButton>
            </div>
          ) : undefined
        }
      />

      {/* bill_requested / closed 状態ではメニュー追加・コース操作を禁止するためタブを history のみに制限 */}
      {/* group ロード完了前にタブを描画すると、クリック直後にロード完了時の初期タブ設定が選択を上書きするため、完了まで描画しない */}
      {group && (
        <>
          <TabNavigation
            tabs={
              group?.status === 'active'
                ? [
                    { key: 'menu', label: t('group.menuTab') },
                    { key: 'history', label: t('group.orderHistory') },
                    { key: 'course', label: t('group.courseTab') },
                  ]
                : [{ key: 'history', label: t('group.orderHistory') }]
            }
            activeTab={group?.status === 'active' ? tab : 'history'}
            onChange={setTab}
          />

          <div className="flex-1 overflow-hidden flex flex-col">
            {tab === 'history' ? (
              <>
                <OrderHistory
                  items={items}
                  onChangeStatus={handleChangeStatus}
                  onCancelTap={setCancelTarget}
                />
                <BillFooter
                  items={items}
                  tax={group}
                  groupStatus={group?.status}
                  onBillRequest={() => setShowBillConfirm(true)}
                  onBillCancel={handleBillCancel}
                  onCheckOut={() => setShowResetConfirm(true)}
                />
              </>
            ) : tab === 'menu' ? (
              <MenuAdd
                menus={menus}
                categories={categories}
                subCategories={subCategories}
                activeDrinkPlan={activeDrinkPlan}
                onAdd={handleAdd}
              />
            ) : (
              <CourseTab
                courses={courses}
                drinkPlans={drinkPlans}
                menus={menus}
                categories={categories}
                appliedCourse={appliedCourse}
                appliedCourseQty={appliedCourseQty}
                activeDrinkPlan={activeDrinkPlan}
                groupGuestCount={group?.guestCount ?? 1}
                onApply={(course) => {
                  setShowCourseConfirm(course)
                  setCourseQty(group?.guestCount ?? 1)
                }}
                onRemove={() => setShowCourseRemoveConfirm(true)}
                onChangeQty={handleCourseQtyChange}
              />
            )}
          </div>
        </>
      )}

      {cancelTarget && (
        <CancelModal
          item={cancelTarget}
          disabled={isSubmitting}
          onConfirm={handleCancelConfirm}
          onClose={() => setCancelTarget(null)}
        />
      )}

      <ConfirmModal
        show={showBillConfirm}
        title={t('group.billConfirmTitle')}
        description={t('group.billConfirmDesc')}
        cancelLabel={t('common.back')}
        confirmLabel={t('group.billConfirmAction')}
        disabled={isSubmitting}
        onConfirm={handleBillConfirm}
        onClose={() => setShowBillConfirm(false)}
      />

      <ConfirmModal
        show={showResetConfirm}
        cancelLabel={t('common.back')}
        confirmLabel={t('group.checkOutAction')}
        variant="danger"
        disabled={isSubmitting}
        onConfirm={handleResetConfirm}
        onClose={() => setShowResetConfirm(false)}
      >
        <div className="mb-5 text-center">
          <div className="mb-3 text-danger">
            <Icon src={SYMBOL_ICONS.door} size="2rem" />
          </div>
          <div className="text-sub font-semibold text-ink mb-2">
            {t('group.checkOutConfirmTitle')}
          </div>
          <div className="text-xs text-danger font-medium">{t('group.checkOutConfirmDesc')}</div>
        </div>
      </ConfirmModal>

      <ConfirmModal
        show={showCourseRemoveConfirm}
        title={t('group.courseRemoveConfirmTitle')}
        description={t('group.courseRemoveConfirmDesc')}
        cancelLabel={t('common.back')}
        confirmLabel={t('group.courseRemove')}
        variant="danger"
        disabled={isSubmitting}
        onConfirm={handleCourseRemove}
        onClose={() => setShowCourseRemoveConfirm(false)}
      />

      {showCourseConfirm && (
        <CourseConfirmModal
          course={showCourseConfirm}
          courseQty={courseQty}
          setCourseQty={setCourseQty}
          drinkPlans={drinkPlans}
          menus={menus}
          disabled={isSubmitting}
          onConfirm={() => handleCourseOrder(showCourseConfirm, courseQty)}
          onClose={() => setShowCourseConfirm(null)}
        />
      )}

      <ChangeSeatModal
        show={showSeatModal}
        currentGroupId={groupId}
        currentSeatIds={group?.seatIds ?? []}
        disabled={isSubmitting}
        onConfirm={handleSeatChange}
        onClose={() => setShowSeatModal(false)}
      />

      <QrModal show={showQr} groupId={groupId} onClose={() => setShowQr(false)} />
    </>
  )
}
