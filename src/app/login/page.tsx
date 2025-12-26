"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GlassCard, GlassButton, GlassInput, Spinner } from "@/components/ui/glass";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login failed");
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

      <div className="w-full max-w-sm">
        <GlassCard padding="lg" className="relative overflow-hidden">
          {/* Subtle glow effect */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl" />

          <div className="relative">
            {/* Header */}
            <div className="text-center mb-8">
              <h1 className="text-2xl font-semibold text-white mb-2">Welcome back</h1>
              <p className="text-sm text-white/50">Sign in to your account</p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <GlassInput
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@local"
                required
                autoComplete="email"
                disabled={loading}
              />

              <GlassInput
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                autoComplete="current-password"
                disabled={loading}
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
                    Signing in...
                  </>
                ) : (
                  "Sign in"
                )}
              </GlassButton>
            </form>

            {/* Dev hint */}
            {process.env.NODE_ENV !== "production" && (
              <div className="mt-6 pt-4 border-t border-white/10">
                <p className="text-xs text-white/30 text-center">
                  Dev mode: Use <code className="text-white/50">admin@local</code> / <code className="text-white/50">admin1234</code>
                </p>
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
