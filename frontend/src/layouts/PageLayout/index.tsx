import type { ReactNode } from "react";
import { useEffect } from "react";
import { socket } from "@/lib/socket";
import { SOCKET_EVENTS as SE } from "@/lib/events";
import { NoticeBanner } from "@/components/display/NoticeBanner";
import { ToastStack } from "@/components/display/Toast/ToastStack";
import { useToastStore } from "@/stores/toast";
import { useBannerStore } from "@/stores/banner";
import type { ApiErrorPayload } from "@order-system/shared";
import { useTranslation } from "react-i18next";

export function PageLayout({ children }: { children: ReactNode }) {
  const showToast = useToastStore((state) => state.showToast);
  const showBanner = useBannerStore((state) => state.showBanner);
  const { t } = useTranslation();

  useEffect(() => {
    let wasConnected = socket.connected;
    const onError = (payload: ApiErrorPayload) => showToast(payload.message, 'danger');
    const onConnect = () => { wasConnected = true; };
    const onConnectError = () => showToast(t('common.socketConnectError'), 'danger');
    const onDisconnect = () => {
      if (wasConnected) showToast(t('common.socketDisconnected'), 'danger');
      wasConnected = false;
    };
    const onReconnectFailed = () => showToast(t('common.socketReconnectFailed'), 'danger');
    const onStaffCalled = (_groupId: string, groupName: string) =>
      showBanner(`${groupName} ${t('hall.staffCalled')}`);

    socket.on(SE.error, onError);
    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_failed', onReconnectFailed);
    socket.on(SE.staffCalled, onStaffCalled);
    return () => {
      socket.off(SE.error, onError);
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_failed', onReconnectFailed);
      socket.off(SE.staffCalled, onStaffCalled);
    };
  }, [showToast, showBanner, t]);

	  return (
	    <div className="app-shell h-dvh bg-white flex flex-col overflow-hidden">
	      <ToastStack />
	      <NoticeBanner />
	      {children}
	    </div>
	  );
}
