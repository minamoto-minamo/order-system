import type { ReactNode } from "react";
import { useEffect } from "react";
import { socket } from "@/lib/socket";
import { SOCKET_EVENTS as SE } from "@/lib/events";
import { useToast } from "@/hooks/useToast";

export function PageLayout({ children }: { children: ReactNode }) {
  const { toast, showToast } = useToast();

  useEffect(() => {
    const onError = (payload: { message: string }) => showToast(payload.message);
    socket.on(SE.error, onError);
    return () => { socket.off(SE.error, onError); };
  }, []);

  return (
    <div className="h-dvh bg-surface flex flex-col">
      {toast && (
        <div className="fixed top-4 left-4 right-4 bg-white border border-line rounded-xl px-4 py-3 text-sm text-ink text-center shadow-sm z-sheet animate-[fadeIn_0.2s_ease_both]">
          {toast}
        </div>
      )}
      {children}
    </div>
  );
}
