"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  GlassCard,
  GlassButton,
  GlassInput,
  Spinner,
} from "@/components/ui/glass";

export default function SignupPage() {
  const router = useRouter();
  const [tenantName, setTenantName] = React.useState("");
  const [adminName, setAdminName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantName,
          adminName,
          email,
          password,
          planCode: "free",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Signup failed");
        return;
      }

      // Success - redirect to dashboard
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      {/* Background blobs */}
      <div className="glass-bg-blob-1" />
      <div className="glass-bg-blob-2" />

      <div className="w-full max-w-md">
        <GlassCard padding="lg" className="relative overflow-hidden">
          {/* Subtle glow effect */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl" />

          <div className="relative">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-semibold text-white mb-2">Create your account</h1>
              <p className="text-sm text-white/50">Get started with your company workspace</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <GlassInput
                label="Company Name"
                type="text"
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                placeholder="Acme Inc."
                required
                disabled={loading}
                autoComplete="organization"
              />

              <GlassInput
                label="Your Name"
                type="text"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                placeholder="John Smith"
                required
                disabled={loading}
                autoComplete="name"
              />

              <GlassInput
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@acme.com"
                required
                disabled={loading}
                autoComplete="email"
              />

              <GlassInput
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 characters"
                required
                disabled={loading}
                autoComplete="new-password"
                minLength={8}
              />

              {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400">{error}</p>
                </div>
              )}

              <GlassButton
                type="submit"
                variant="primary"
                size="lg"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Spinner size="sm" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </GlassButton>
            </form>

            {/* Link to login */}
            <div className="mt-6 pt-4 border-t border-white/10 text-center">
              <p className="text-sm text-white/50">
                Already have an account?{" "}
                <Link href="/login" className="text-blue-400 hover:text-blue-300 transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
