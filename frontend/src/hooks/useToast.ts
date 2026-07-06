import { useCallback, useEffect, useRef, useState } from "react";

export function useToast(duration = 1800): {
  toast: string | null;
  showToast: (msg: string) => void;
} {
  const [toast, setToast] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const showToast = useCallback((msg: string) => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    setToast(msg);
    timerRef.current = window.setTimeout(() => {
      setToast(null);
      timerRef.current = null;
    }, duration);
  }, [duration]);
  useEffect(() => () => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
  }, []);
  return { toast, showToast };
}
