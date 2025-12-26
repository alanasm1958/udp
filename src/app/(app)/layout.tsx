"use client";

import { AppShell } from "@/components/layout/shell";
import { ToastProvider } from "@/components/ui/glass";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <AppShell>{children}</AppShell>
    </ToastProvider>
  );
}
