"use client";

import { GlassCard, GlassButton } from "@/components/ui/glass";

export default function OnboardingPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      {/* Background blobs */}
      <div className="glass-bg-blob-1" />
      <div className="glass-bg-blob-2" />

      <GlassCard className="max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
          <svg
            className="w-8 h-8 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-white mb-3">
          Account Not Configured
        </h1>

        <p className="text-white/60 mb-6">
          Your account is not yet associated with an organization. Please contact
          your administrator to complete the setup process.
        </p>

        <div className="space-y-3">
          <GlassButton
            className="w-full"
            onClick={() => {
              window.location.href = "mailto:support@example.com?subject=Account Setup Request";
            }}
          >
            Contact Support
          </GlassButton>

          <GlassButton
            variant="ghost"
            className="w-full"
            onClick={() => {
              window.location.href = "/api/auth/logout";
            }}
          >
            Sign Out
          </GlassButton>
        </div>

        <p className="text-xs text-white/40 mt-6">
          If you believe this is an error, please try signing out and back in.
        </p>
      </GlassCard>
    </div>
  );
}
