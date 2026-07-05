export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-brand text-white rounded-full px-5 py-2.25 text-xs whitespace-nowrap animate-[slideUp_0.2s_ease_both] z-toast">
      {message}
    </div>
  );
}
