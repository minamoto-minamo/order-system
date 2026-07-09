import type { ReactNode } from "react";
import { useEffect } from "react";
import { socket } from "@/lib/socket";
import { ToastStack } from "@/components/feedback";
import { useToastStore } from "@/stores/toast";
import { useTranslation } from "react-i18next";

export function CustomerPageLayout({ children }: { children: ReactNode }) {
  const showToast = useToastStore((state) => state.showToast);
  const { t } = useTranslation();

  useEffect(() => {
    let wasConnected = socket.connected;
    const onConnect = () => { wasConnected = true; };
    const onConnectError = () => showToast(t('common.socketConnectError'), 'danger');
    const onDisconnect = () => {
      if (wasConnected) showToast(t('common.socketDisconnected'), 'danger');
      wasConnected = false;
    };
    const onReconnectFailed = () => showToast(t('common.socketReconnectFailed'), 'danger');

    socket.on('connect', onConnect);
    socket.on('connect_error', onConnectError);
    socket.on('disconnect', onDisconnect);
    socket.io.on('reconnect_failed', onReconnectFailed);
    return () => {
      socket.off('connect', onConnect);
      socket.off('connect_error', onConnectError);
      socket.off('disconnect', onDisconnect);
      socket.io.off('reconnect_failed', onReconnectFailed);
    };
  }, [showToast, t]);

  return (
    <>
      <ToastStack />
      {children}
    </>
  );
}
