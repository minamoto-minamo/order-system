import type { ReactNode } from "react";
import { useEffect } from "react";
import { socket } from "@/lib/socket";
import { SOCKET_EVENTS as SE } from "@/lib/events";
import { useToast } from "@/hooks/useToast";
import { NoticeBanner } from "../../display/NoticeBanner";
import type { ApiErrorPayload } from "@order-system/shared";

export function PageLayout({ children }: { children: ReactNode }) {
  const { toast, showToast } = useToast();

  useEffect(() => {
    let wasConnected = socket.connected;
    const onError = (payload: ApiErrorPayload) => showToast(payload.message);
    const onConnect = () => { wasConnected = true; };
    const onConnectError = () => showToast('リアルタイム接続に失敗しました');
    const onDisconnect = () => {
      if (wasConnected) showToast('リアルタイム接続が切断されました');
      wasConnected = false;
    };
    const onReconnectFailed = () => showToast('リアルタイム接続を再開できません');

    socket.on(SE.error, onError);
    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_failed', onReconnectFailed);
    return () => {
      socket.off(SE.error, onError);
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_failed', onReconnectFailed);
    };
  }, [showToast]);

	  return (
	    <div className="app-shell h-dvh bg-white flex flex-col overflow-hidden">
	      {toast && <NoticeBanner variant="danger">{toast}</NoticeBanner>}
	      {children}
	    </div>
	  );
}
