import { useState } from "react";

export function useToast(duration = 1800): {
  toast: string | null;
  showToast: (msg: string) => void;
} {
  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), duration);
  };
  return { toast, showToast };
}
