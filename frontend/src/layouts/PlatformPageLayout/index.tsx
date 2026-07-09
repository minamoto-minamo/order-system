import type { ReactNode } from "react";
import { ToastStack } from "@/components/feedback";

export function PlatformPageLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ToastStack />
      {children}
    </>
  );
}
