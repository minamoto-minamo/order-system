import type { ReactNode } from "react";
import { ToastStack } from "@/components/display/Toast/ToastStack";

export function PlatformPageLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ToastStack />
      {children}
    </>
  );
}
