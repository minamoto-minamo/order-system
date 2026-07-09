import { VARIANT_CLASSES } from "@/components/display/Toast/Toast";
import { useToastStore } from "@/stores/toast";

export function ToastStack() {
  const toasts = useToastStore((state) => state.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 z-toast flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-col-reverse items-center gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`max-w-full animate-[slideUp_0.2s_ease_both] rounded-full border px-5 py-2.25 text-center text-xs shadow-sm ${VARIANT_CLASSES[toast.variant]}`}
          onClick={e => e.stopPropagation()}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
