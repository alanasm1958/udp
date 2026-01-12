"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Spinner } from "@/components/ui/glass";
import { Suspense } from "react";

function AccountsRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const id = searchParams.get("id");
    let url = "/sales-customers?tab=customers";
    if (id) {
      url += `&id=${id}`;
    }
    router.replace(url);
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center h-64">
      <Spinner size="lg" />
    </div>
  );
}

export default function CustomerAccountsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>}>
      <AccountsRedirect />
    </Suspense>
  );
}
