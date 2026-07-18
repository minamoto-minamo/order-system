import { useEffect, useRef } from 'react'
import { socket } from '@/lib/socket'

type SocketEventMap = Record<string, (...args: any[]) => void>

export function useSocketListeners(listeners: SocketEventMap): void {
  const ref = useRef(listeners)
  // 毎レンダーで更新することで、effect の依存配列を空にしつつ常に最新クロージャを参照できる
  ref.current = listeners

  useEffect(() => {
    const entries = Object.keys(ref.current).map((event) => {
      // socket.off に同一関数参照が必要なため、ref への間接呼び出しで参照を固定した wrapper を使う
      const wrapped = (...args: any[]) => ref.current[event]?.(...args)
      socket.on(event as any, wrapped as any)
      return [event, wrapped] as const
    })
    return () => {
      for (const [event, wrapped] of entries) socket.off(event as any, wrapped as any)
    }
  }, [])
}
