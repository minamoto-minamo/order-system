import type { ReactNode } from "react";
import { useEffect } from "react";
import { socket } from "@/lib/socket";
import { SOCKET_EVENTS as SE } from "@/lib/events";
import { useToast } from "@/hooks/useToast";
import { NoticeBanner } from "../../display/NoticeBanner";

export function PageLayout({ children }: { children: ReactNode }) {
  const { toast, showToast } = useToast();

  useEffect(() => {
    const onError = (payload: { message: string }) => showToast(payload.message);
    socket.on(SE.error, onError);
    return () => { socket.off(SE.error, onError); };
  }, []);

  return (
    <div className="app-shell h-dvh bg-white flex flex-col overflow-hidden">
      {toast && <NoticeBanner>{toast}</NoticeBanner>}
      {children}
    </div>
  );
}
