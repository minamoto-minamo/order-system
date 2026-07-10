import type { PublicSetting } from '@order-system/shared'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { EP } from '@/lib/endpoints'
import { SOCKET_EVENTS as SE } from '@/lib/events'
import { socket } from '@/lib/socket'
import { useSessionStore } from '@/stores/session'

function checkOverTime(closingTime: string, openedAt: string): boolean {
  const [h, m] = closingTime.split(':').map(Number)
  const opened = new Date(openedAt)
  // 閉店時刻を「開店日」ベースで算出し、開店より前なら翌日扱い
  const closing = new Date(opened)
  closing.setHours(h, m, 0, 0)
  if (closing <= opened) closing.setDate(closing.getDate() + 1)
  return new Date() > closing
}

export function useOverTimeWarning(): boolean {
  const [closingTime, setClosingTime] = useState<string | null>(null)
  const [show, setShow] = useState(false)
  const { session } = useSessionStore()
  const isOpen = session?.status === 'open'

  useEffect(() => {
    api
      .get<{ closingTime: string }>(EP.settings)
      .then((s) => setClosingTime(s.closingTime))
      // 営業時間警告は補助表示なので、設定取得に失敗した場合は非表示のまま続行する
      .catch(() => {})

    const onSettingsUpdated = (s: PublicSetting) => setClosingTime(s.closingTime)
    socket.on(SE.settingsUpdated, onSettingsUpdated)
    return () => {
      socket.off(SE.settingsUpdated, onSettingsUpdated)
    }
  }, [])

  useEffect(() => {
    if (!closingTime || !session?.openedAt) return
    const check = () => setShow(isOpen && checkOverTime(closingTime, session.openedAt))
    check()
    const id = setInterval(check, 60_000)
    return () => clearInterval(id)
  }, [closingTime, isOpen, session?.openedAt])

  return show
}
