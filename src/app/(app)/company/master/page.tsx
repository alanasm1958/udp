"use client";

import * as React from "react";
import Link from "next/link";
import { GlassCard, PageHeader } from "@/components/ui/glass";

export default function MasterDataPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Master Data"
        description="Products, parties, and reference data"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/master/parties">
          <GlassCard className="hover:bg-white/10 transition-colors cursor-pointer h-full">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-blue-500/20">
                <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white">Parties</h3>
                <p className="text-sm text-white/50 mt-1">Customers, vendors, and contacts</p>
              </div>
            </div>
          </GlassCard>
        </Link>

        <Link href="/master/products">
          <GlassCard className="hover:bg-white/10 transition-colors cursor-pointer h-full">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-purple-500/20">
                <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white">Products</h3>
                <p className="text-sm text-white/50 mt-1">Items, services, and SKUs</p>
              </div>
            </div>
          </GlassCard>
        </Link>

        <Link href="/company/master/categories">
          <GlassCard className="hover:bg-white/10 transition-colors cursor-pointer h-full">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-emerald-500/20">
                <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-white">Categories</h3>
                <p className="text-sm text-white/50 mt-1">Classification and grouping</p>
              </div>
            </div>
          </GlassCard>
        </Link>
      </div>
    </div>
  );
}
