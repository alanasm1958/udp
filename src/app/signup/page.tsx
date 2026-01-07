"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassSelect,
  Spinner,
} from "@/components/ui/glass";

interface Plan {
  code: string;
  name: string;
  description: string;
  priceAmount: string;
}

export default function SignupPage() {
  const router = useRouter();
  const [tenantName, setTenantName] = React.useState("");
  const [adminName, setAdminName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [planCode, setPlanCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [plans, setPlans] = React.useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = React.useState(true);

  // Fetch available plans
  React.useEffect(() => {
    async function fetchPlans() {
      try {
        const res = await fetch("/api/billing/plans");
        if (res.ok) {
          const data = await res.json();
          const fetchedPlans = data.plans || [];
          setPlans(fetchedPlans);
          
          // Set default plan to first available plan, or free plan if available
          if (fetchedPlans.length > 0) {
            const freePlan = fetchedPlans.find((p: Plan) => p.code === "free" || parseFloat(p.priceAmount) === 0);
            setPlanCode(freePlan?.code || fetchedPlans[0].code);
          }
        } else {
          // Fallback plans if API fails
          const fallbackPlans = [
            { code: "free", name: "Free", description: "Basic features, free forever.", priceAmount: "0.00" },
            { code: "monthly_30", name: "Monthly", description: "Full access - $30/month", priceAmount: "30.00" },
            { code: "six_month_pack_25", name: "6-Month Package", description: "Best value - $25/month", priceAmount: "150.00" },
          ];
          setPlans(fallbackPlans);
          setPlanCode(fallbackPlans[0].code);
        }
      } catch (err) {
        console.error("Failed to fetch plans:", err);
        // Fallback plans
        const fallbackPlans = [
          { code: "free", name: "Free", description: "Basic features, free forever.", priceAmount: "0.00" },
          { code: "monthly_30", name: "Monthly", description: "Full access - $30/month", priceAmount: "30.00" },
          { code: "six_month_pack_25", name: "6-Month Package", description: "Best value - $25/month", priceAmount: "150.00" },
        ];
        setPlans(fallbackPlans);
        setPlanCode(fallbackPlans[0].code);
      } finally {
        setPlansLoading(false);
      }
    }
    fetchPlans();
  }, []);

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
          planCode,
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

  const planOptions = plans.map((p) => ({
    value: p.code,
    label: `${p.name} - ${parseFloat(p.priceAmount) === 0 ? "Free" : `$${p.priceAmount}`}`,
  }));

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

              {plansLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Spinner size="sm" />
                  <span className="ml-2 text-sm text-white/50">Loading plans...</span>
                </div>
              ) : plans.length === 0 ? (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <p className="text-sm text-red-400">No plans available. Please contact support.</p>
                </div>
              ) : (
                <GlassSelect
                  label="Select Plan"
                  value={planCode}
                  onChange={(e) => setPlanCode(e.target.value)}
                  options={planOptions}
                  disabled={loading || plansLoading}
                  required
                />
              )}

              {/* Selected plan description */}
              {!plansLoading && plans.length > 0 && (
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-xs text-white/60">
                    {plans.find((p) => p.code === planCode)?.description || "Select a plan"}
                  </p>
                </div>
              )}

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
                disabled={loading || plansLoading}
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
