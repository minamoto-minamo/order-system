import { api } from '@/lib/api'
import { EP } from '@/lib/endpoints'
import { ROUTES } from '@/lib/routes'
import { socket } from '@/lib/socket'
import { SOCKET_EVENTS as SE } from '@/lib/events'
import Login from '@/pages/login/Login/Login'
import Home from '@/pages/home/Home/Home'
import AdminMenu from '@/pages/admin/AdminMenu/AdminMenu'
import DailyReport from '@/pages/admin/DailyReport/DailyReport'
import Products from '@/pages/admin/Products/Products'
import SeatLayout from '@/pages/admin/SeatLayout/SeatLayout'
import Settings from '@/pages/admin/Settings/Settings'
import Staff from '@/pages/admin/Staff/Staff'
import GroupDetail from '@/pages/group/GroupDetail/GroupDetail'
import Hall from '@/pages/hall/Hall/Hall'
import Kitchen from '@/pages/kitchen/Kitchen/Kitchen'
import CustomerOrder from '@/pages/customer/CustomerOrder/CustomerOrder'
import NotFound from '@/pages/error/NotFound'
import type { AuthUser } from '@/stores/auth'
import { useAuthStore } from '@/stores/auth'
import { useSessionStore } from '@/stores/session'
import type { Session } from '@order-system/shared'
import { useEffect } from 'react'
import { PageLayout } from '@/components/layout/PageLayout'
import { Navigate, Route, Routes } from 'react-router-dom'

function RequireAuth({ children, adminOnly = false, requireSession = false }: { children: React.ReactNode; adminOnly?: boolean; requireSession?: boolean }) {
  const { user } = useAuthStore()
  const { session } = useSessionStore()
  if (!user) return <Navigate to={ROUTES.login} replace />
  if (adminOnly && user.role !== 'admin') return <Navigate to={ROUTES.root} replace />
  if (requireSession && session?.status !== 'open') return <Navigate to={ROUTES.root} replace />
  return <PageLayout>{children}</PageLayout>
}

export default function App() {
  const { user, initialized, setUser, setInitialized } = useAuthStore()
  const { setSession } = useSessionStore()

  useEffect(() => {
    Promise.all([
      api.get<AuthUser>(EP.authMe).catch(() => null),
      api.get<Session | null>(EP.sessionsCurrent),
    ]).then(([u, s]) => {
      setUser(u)
      setSession(s)
    }).finally(() => setInitialized(true))

    const onSessionUpdated = (s: Session) => setSession(s)
    socket.on(SE.sessionUpdated, onSessionUpdated)
    return () => { socket.off(SE.sessionUpdated, onSessionUpdated) }
  }, [setUser, setInitialized, setSession])

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
      <Route path={ROUTES.customerOrderPattern} element={<CustomerOrder />} />
      <Route path="*" element={user ? <Navigate to={ROUTES.root} replace /> : <NotFound />} />
    </Routes>
  )
}
