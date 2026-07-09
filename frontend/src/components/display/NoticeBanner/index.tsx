import { useBannerStore } from "@/stores/banner";

export function NoticeBanner() {
  const message = useBannerStore((state) => state.message);
  const dismissBanner = useBannerStore((state) => state.dismissBanner);
  if (!message) return null;
  return (
    <div
      className="tappable fixed top-4 left-4 right-4 bg-white border border-line rounded-xl px-4 py-3 text-sm text-ink text-center shadow-sm z-sheet animate-[fadeIn_0.2s_ease_both]"
      onClick={dismissBanner}
    >
      {message}
    </div>
  );
}
