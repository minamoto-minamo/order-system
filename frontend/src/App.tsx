import { CustomerPageLayout, PageLayout, PlatformPageLayout } from '@/layouts'
import { api } from '@/lib/api'
import { EP } from '@/lib/endpoints'
import { SOCKET_EVENTS as SE } from '@/lib/events'
import { isPlatformAdminHost } from '@/lib/platform'
import { ROUTES } from '@/lib/routes'
import { socket } from '@/lib/socket'
import AdminMenu from '@/pages/admin/AdminMenu/AdminMenu'
import Courses from '@/pages/admin/Courses/Courses'
import DailyReport from '@/pages/admin/DailyReport/DailyReport'
import Products from '@/pages/admin/Products/Products'
import SeatLayout from '@/pages/admin/SeatLayout/SeatLayout'
import Settings from '@/pages/admin/Settings/Settings'
import Staff from '@/pages/admin/Staff/Staff'
import CustomerOrder from '@/pages/customer/CustomerOrder/CustomerOrder'
import NotFound from '@/pages/error/NotFound'
import GroupDetail from '@/pages/group/GroupDetail/GroupDetail'
import Hall from '@/pages/hall/Hall/Hall'
import Home from '@/pages/home/Home/Home'
import Kitchen from '@/pages/kitchen/Kitchen/Kitchen'
import Login from '@/pages/login/Login/Login'
import PlatformLogin from '@/pages/platform/PlatformLogin/PlatformLogin'
import StoreList from '@/pages/platform/StoreList/StoreList'
import type { AuthUser } from '@/stores/auth'
import { useAuthStore } from '@/stores/auth'
import type { PlatformAdmin } from '@/stores/platformAuth'
import { usePlatformAuthStore } from '@/stores/platformAuth'
import { useSessionStore } from '@/stores/session'
import type { Session } from '@order-system/shared'
import { useEffect } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

function RequireAuth({ children, adminOnly = false, requireSession = false }: { children: React.ReactNode; adminOnly?: boolean; requireSession?: boolean }) {
  const { user } = useAuthStore()
  const { session } = useSessionStore()
  if (!user) return <Navigate to={ROUTES.login} replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to={ROUTES.root} replace />
  if (requireSession && session?.status !== 'open') return <Navigate to={ROUTES.root} replace />
  return <PageLayout>{children}</PageLayout>
}

function RequirePlatformAuth({ children }: { children: React.ReactNode }) {
  const { admin } = usePlatformAuthStore()
  if (!admin) return <Navigate to={ROUTES.platformLogin} replace />
  return <PlatformPageLayout>{children}</PlatformPageLayout>
}

export default function App() {
  const isPlatform = isPlatformAdminHost()
  const { user, initialized, setUser, setInitialized } = useAuthStore()
  const { setSession } = useSessionStore()
  const { admin, initialized: platformInitialized, setAdmin, setInitialized: setPlatformInitialized } = usePlatformAuthStore()

  useEffect(() => {
    if (isPlatform) {
      // 認証確認は失敗時も未ログイン扱いで初期化を進める
      api.get<PlatformAdmin>(EP.platformAuthMe).catch(() => null)
        .then(setAdmin)
        .finally(() => setPlatformInitialized(true))
      return
    }

    Promise.all([
      // 認証・現セッション確認は失敗時も未ログイン/セッションなし扱いで初期化を進める
      api.get<AuthUser>(EP.authMe).catch(() => null),
      api.get<Session | null>(EP.sessionsCurrent).catch(() => null),
    ]).then(([u, s]) => {
      setUser(u)
      setSession(s)
    }).finally(() => setInitialized(true))

    const onSessionUpdated = (s: Session) => setSession(s)
    socket.on(SE.sessionUpdated, onSessionUpdated)
    return () => { socket.off(SE.sessionUpdated, onSessionUpdated) }
  }, [isPlatform, setUser, setInitialized, setSession, setAdmin, setPlatformInitialized])

  if (isPlatform) {
    // 初期認証確認が終わるまで描画しないことでルートのフラッシュを防ぐ
    if (!platformInitialized) return null

    return (
      <Routes>
        <Route path={ROUTES.platformLogin} element={admin ? <Navigate to={ROUTES.platformStores} replace /> : <PlatformLogin />} />
        <Route path={ROUTES.platformStores} element={<RequirePlatformAuth><StoreList /></RequirePlatformAuth>} />
        <Route path="*" element={<Navigate to={admin ? ROUTES.platformStores : ROUTES.platformLogin} replace />} />
      </Routes>
    )
  }

  // 初期認証確認が終わるまで描画しないことでルートのフラッシュを防ぐ
  if (!initialized) return null

  return (
    <Routes>
      <Route path={ROUTES.login} element={user ? <Navigate to={ROUTES.root} replace /> : <Login />} />
      <Route path={ROUTES.root} element={<RequireAuth><Home /></RequireAuth>} />
      <Route path={ROUTES.hall} element={<RequireAuth requireSession><Hall /></RequireAuth>} />
      <Route path={ROUTES.hallGroupPattern} element={<RequireAuth requireSession><GroupDetail /></RequireAuth>} />
      <Route path={ROUTES.kitchen} element={<RequireAuth requireSession><Kitchen /></RequireAuth>} />
      <Route path={ROUTES.kitchenGroupPattern} element={<RequireAuth requireSession><GroupDetail /></RequireAuth>} />
      <Route path={ROUTES.admin} element={<RequireAuth adminOnly><AdminMenu /></RequireAuth>} />
      <Route path={ROUTES.adminSeats} element={<RequireAuth adminOnly><SeatLayout /></RequireAuth>} />
      <Route path={ROUTES.adminProducts} element={<RequireAuth adminOnly><Products /></RequireAuth>} />
      <Route path={ROUTES.adminReport} element={<RequireAuth adminOnly><DailyReport /></RequireAuth>} />
      <Route path={ROUTES.adminSettings} element={<RequireAuth adminOnly><Settings /></RequireAuth>} />
      <Route path={ROUTES.adminStaff} element={<RequireAuth adminOnly><Staff /></RequireAuth>} />
      <Route path={ROUTES.adminCourses} element={<RequireAuth adminOnly><Courses /></RequireAuth>} />
      <Route path={ROUTES.customerOrderPattern} element={<CustomerPageLayout><CustomerOrder /></CustomerPageLayout>} />
      <Route path="*" element={user ? <Navigate to={ROUTES.root} replace /> : <NotFound />} />
    </Routes>
  )
}
