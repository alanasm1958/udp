"use client";

import Link from "next/link";
import {
  GlassCard,
  PageHeader,
} from "@/components/ui/glass";

const settingsLinks = [
  {
    title: "Tenant Settings",
    description: "View tenant info, subscription plan, and usage",
    href: "/settings/tenant",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
      </svg>
    ),
  },
  {
    title: "User Management",
    description: "Manage users, roles, and permissions",
    href: "/settings/users",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
  {
    title: "Billing",
    description: "Manage your subscription and billing",
    href: "/settings/billing",
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
  },
];

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Configure your tenant and manage users"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {settingsLinks.map((link) => (
          <Link key={link.href} href={link.href}>
            <GlassCard className="h-full hover:bg-white/15 transition-colors cursor-pointer group">
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-white/10 text-white/70 group-hover:text-white group-hover:bg-white/15 transition-colors">
                  {link.icon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white group-hover:text-white/90">
                    {link.title}
                  </h3>
                  <p className="text-sm text-white/50 mt-1">
                    {link.description}
                  </p>
                </div>
              </div>
            </GlassCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
