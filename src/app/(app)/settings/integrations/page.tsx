"use client";

import * as React from "react";
import {
  GlassCard,
  GlassBadge,
  GlassButton,
  GlassInput,
  PageHeader,
  Spinner,
  useToast,
} from "@/components/ui/glass";
import { apiGet, apiPut, apiDelete } from "@/lib/http";

interface OAuthProvider {
  provider: string;
  name: string;
  setupUrl: string;
  requiredScopes: string[];
  configured: boolean;
  clientIdPreview: string | null;
}

interface OAuthResponse {
  providers: OAuthProvider[];
}

// Provider icons (same as marketing page)
const PROVIDER_ICONS: Record<string, { icon: string; color: string }> = {
  meta: {
    icon: "M17.525 9H14V7c0-1.032.084-1.682 1.563-1.682h1.868V2.112A25.1 25.1 0 0014.7 2C11.548 2 9.5 3.754 9.5 7.313V9H6.5v4h3v9h4.5v-9h2.963l.562-4z",
    color: "#1877F2",
  },
  google: {
    icon: "M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.61z M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z",
    color: "#4285F4",
  },
  tiktok: {
    icon: "M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z",
    color: "#000000",
  },
  linkedin: {
    icon: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
    color: "#0A66C2",
  },
};

export default function IntegrationsSettingsPage() {
  const [providers, setProviders] = React.useState<OAuthProvider[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [editingProvider, setEditingProvider] = React.useState<string | null>(null);
  const [credentials, setCredentials] = React.useState({ clientId: "", clientSecret: "" });
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState<string | null>(null);
  const { addToast } = useToast();

  const loadProviders = React.useCallback(async () => {
    try {
      setLoading(true);
      const result = await apiGet<OAuthResponse>("/api/settings/oauth");
      setProviders(result.providers);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load integrations");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const handleSave = async (provider: string) => {
    if (!credentials.clientId || !credentials.clientSecret) {
      addToast("error", "Both Client ID and Client Secret are required");
      return;
    }

    setSaving(true);
    try {
      await apiPut("/api/settings/oauth", {
        provider,
        clientId: credentials.clientId,
        clientSecret: credentials.clientSecret,
      });
      addToast("success", `${providers.find(p => p.provider === provider)?.name || provider} credentials saved successfully`);
      setEditingProvider(null);
      setCredentials({ clientId: "", clientSecret: "" });
      await loadProviders();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to save credentials");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (provider: string) => {
    setDeleting(provider);
    try {
      await apiDelete(`/api/settings/oauth?provider=${provider}`);
      addToast("success", `${providers.find(p => p.provider === provider)?.name || provider} credentials removed`);
      await loadProviders();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to remove credentials");
    } finally {
      setDeleting(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader title="Integrations" description="Connect your marketing platforms" />
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integrations"
        description="Configure OAuth credentials for marketing platform connections"
      />

      {/* Info Card */}
      <GlassCard className="!bg-blue-500/10 border-blue-500/20">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-300">
            <p className="font-medium mb-1">How OAuth Integration Works</p>
            <p className="text-blue-300/70">
              To connect your marketing channels, you need to create an OAuth app with each provider and enter the credentials here.
              Once configured, you can connect your accounts from the Marketing page.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Provider Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {providers.map((provider) => {
          const iconData = PROVIDER_ICONS[provider.provider];
          const isEditing = editingProvider === provider.provider;

          return (
            <GlassCard key={provider.provider}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${iconData?.color || "#6B7280"}20` }}
                  >
                    {iconData ? (
                      <svg className="w-6 h-6" fill={iconData.color} viewBox="0 0 24 24">
                        <path d={iconData.icon} />
                      </svg>
                    ) : (
                      <svg className="w-6 h-6 text-white/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{provider.name}</h3>
                    <GlassBadge variant={provider.configured ? "success" : "default"} className="mt-1">
                      {provider.configured ? "Configured" : "Not Configured"}
                    </GlassBadge>
                  </div>
                </div>
              </div>

              {provider.configured && !isEditing && (
                <div className="mb-4 p-3 rounded-lg bg-white/5">
                  <label className="text-xs font-medium text-white/50 block mb-1">Client ID</label>
                  <p className="text-white/70 font-mono text-sm">{provider.clientIdPreview}</p>
                </div>
              )}

              {isEditing ? (
                <div className="space-y-4">
                  <GlassCard className="!bg-amber-500/10 border-amber-500/20 !p-3">
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-xs text-amber-300">
                        <p className="mb-1">Create an app at:</p>
                        <a
                          href={provider.setupUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-amber-400 hover:underline break-all"
                        >
                          {provider.setupUrl}
                        </a>
                      </div>
                    </div>
                  </GlassCard>

                  <GlassInput
                    label="Client ID (App ID)"
                    type="text"
                    value={credentials.clientId}
                    onChange={(e) => setCredentials(prev => ({ ...prev, clientId: e.target.value }))}
                    placeholder="Enter your Client ID"
                  />

                  <GlassInput
                    label="Client Secret (App Secret)"
                    type="password"
                    value={credentials.clientSecret}
                    onChange={(e) => setCredentials(prev => ({ ...prev, clientSecret: e.target.value }))}
                    placeholder="Enter your Client Secret"
                  />

                  <div className="flex gap-3">
                    <GlassButton
                      variant="ghost"
                      className="flex-1"
                      onClick={() => {
                        setEditingProvider(null);
                        setCredentials({ clientId: "", clientSecret: "" });
                      }}
                    >
                      Cancel
                    </GlassButton>
                    <GlassButton
                      variant="primary"
                      className="flex-1"
                      onClick={() => handleSave(provider.provider)}
                      disabled={saving || !credentials.clientId || !credentials.clientSecret}
                    >
                      {saving ? <Spinner size="sm" /> : "Save Credentials"}
                    </GlassButton>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm text-white/50">
                    <span className="font-medium">Required Scopes:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {provider.requiredScopes.slice(0, 3).map((scope) => (
                        <span
                          key={scope}
                          className="px-2 py-0.5 rounded bg-white/10 text-white/60 text-xs font-mono"
                        >
                          {scope}
                        </span>
                      ))}
                      {provider.requiredScopes.length > 3 && (
                        <span className="px-2 py-0.5 rounded bg-white/10 text-white/60 text-xs">
                          +{provider.requiredScopes.length - 3} more
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <GlassButton
                      variant={provider.configured ? "ghost" : "primary"}
                      className="flex-1"
                      onClick={() => setEditingProvider(provider.provider)}
                    >
                      {provider.configured ? "Update Credentials" : "Configure"}
                    </GlassButton>
                    {provider.configured && (
                      <GlassButton
                        variant="danger"
                        onClick={() => handleDelete(provider.provider)}
                        disabled={deleting === provider.provider}
                      >
                        {deleting === provider.provider ? <Spinner size="sm" /> : "Remove"}
                      </GlassButton>
                    )}
                  </div>
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>

      {/* Security Note */}
      <GlassCard className="!bg-emerald-500/10 border-emerald-500/20">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <div className="text-sm text-emerald-300">
            <p className="font-medium mb-1">Security</p>
            <p className="text-emerald-300/70">
              Your OAuth credentials are encrypted and stored securely. We never share them with third parties.
              Only you and authorized team members can access your connected accounts.
            </p>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
