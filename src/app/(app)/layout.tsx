"use client";

import * as React from "react";
import { AppShell } from "@/components/layout/shell";
import { ToastProvider } from "@/components/ui/glass";
import { RbacProvider } from "@/lib/rbac-context";
import { ErrorBoundary } from "@/components/layout/error-boundary";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <RbacProvider>
        <React.Suspense fallback={<div className="flex h-screen items-center justify-center bg-zinc-950"><div className="text-white/50">Loading...</div></div>}>
          <ErrorBoundary>
            <AppShell>{children}</AppShell>
          </ErrorBoundary>
        </React.Suspense>
      </RbacProvider>
    </ToastProvider>
  );
}
