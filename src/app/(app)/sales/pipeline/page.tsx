"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui/glass";
import { Suspense } from "react";

function PipelineRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("tab", "leads");

    // Preserve any status filter
    const status = searchParams.get("status");
    if (status) {
      params.set("status", status);
    }

    router.replace(`/sales-customers?${params.toString()}`);
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  );
}

export default function PipelinePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>}>
      <PipelineRedirect />
    </Suspense>
  );
}
