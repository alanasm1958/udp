/**
 * /api/marketing/channels/oauth/[provider]/connect
 *
 * POST: Initiate OAuth flow or API key connection for a marketing channel
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError, getUserIdFromHeaders, isValidUUID } from "@/lib/tenant";
import { db } from "@/db";
import { marketingChannels, marketingConnectors, actors, tenantSettings } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit";
import crypto from "crypto";

// Decrypt credentials (matches encryption in settings API)
function decryptCredentials(value: string): string {
  return Buffer.from(value, "base64").toString("utf-8");
}

// Map provider to credential key in tenant settings
function getCredentialKey(provider: string): string {
  switch (provider) {
    case "instagram":
    case "facebook":
      return "meta";
    case "google_ads":
      return "google";
    default:
      return provider;
  }
}

// Get OAuth credentials from tenant settings
async function getTenantOAuthCredentials(
  tenantId: string,
  provider: string
): Promise<{ clientId: string; clientSecret: string } | null> {
  const credKey = getCredentialKey(provider);

  const settings = await db
    .select({ oauthCredentials: tenantSettings.oauthCredentials })
    .from(tenantSettings)
    .where(eq(tenantSettings.tenantId, tenantId))
    .limit(1);

  if (settings.length === 0) {
    return null;
  }

  const creds = settings[0].oauthCredentials as Record<string, { clientId: string; clientSecret: string }> | null;
  if (!creds || !creds[credKey]) {
    return null;
  }

  try {
    return {
      clientId: decryptCredentials(creds[credKey].clientId),
      clientSecret: decryptCredentials(creds[credKey].clientSecret),
    };
  } catch {
    return null;
  }
}

// Provider configurations
const PROVIDER_CONFIG: Record<string, {
  name: string;
  type: "social" | "email" | "messaging" | "ads" | "sms";
  authMethod: "oauth2" | "api_key";
  scopes?: string[];
  authUrl?: string;
  permissions?: string[];
}> = {
  instagram: {
    name: "Instagram",
    type: "social",
    authMethod: "oauth2",
    scopes: ["instagram_basic", "instagram_content_publish", "instagram_manage_insights", "pages_show_list", "pages_read_engagement"],
    authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
    permissions: ["read_insights", "manage_pages"],
  },
  facebook: {
    name: "Facebook",
    type: "social",
    authMethod: "oauth2",
    scopes: ["pages_show_list", "pages_read_engagement", "pages_manage_posts", "pages_read_user_content", "read_insights"],
    authUrl: "https://www.facebook.com/v18.0/dialog/oauth",
    permissions: ["read_insights", "manage_pages"],
  },
  google_ads: {
    name: "Google Ads",
    type: "ads",
    authMethod: "oauth2",
    scopes: ["https://www.googleapis.com/auth/adwords"],
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    permissions: ["manage_campaigns", "read_reports"],
  },
  tiktok: {
    name: "TikTok",
    type: "social",
    authMethod: "oauth2",
    scopes: ["user.info.basic", "video.list", "video.upload"],
    authUrl: "https://www.tiktok.com/v2/auth/authorize/",
    permissions: ["read_insights", "manage_videos"],
  },
  linkedin: {
    name: "LinkedIn",
    type: "social",
    authMethod: "oauth2",
    scopes: ["r_liteprofile", "r_emailaddress", "w_member_social", "r_organization_social", "w_organization_social"],
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    permissions: ["read_insights", "manage_posts"],
  },
  email: {
    name: "Email Marketing",
    type: "email",
    authMethod: "api_key",
    permissions: ["send_emails", "manage_lists"],
  },
  sms: {
    name: "SMS Marketing",
    type: "sms",
    authMethod: "api_key",
    permissions: ["send_sms", "manage_contacts"],
  },
  whatsapp: {
    name: "WhatsApp Business",
    type: "messaging",
    authMethod: "api_key", // WhatsApp Business API uses API key
    permissions: ["send_messages", "manage_templates"],
  },
};

// Build OAuth authorization URL
function buildAuthUrl(
  provider: string,
  state: string,
  redirectUri: string,
  creds: { clientId: string; clientSecret: string }
): string | null {
  const config = PROVIDER_CONFIG[provider];

  if (!config || !config.authUrl || !creds.clientId) {
    return null;
  }

  const params = new URLSearchParams();

  switch (provider) {
    case "instagram":
    case "facebook":
      params.set("client_id", creds.clientId);
      params.set("redirect_uri", redirectUri);
      params.set("state", state);
      params.set("scope", config.scopes?.join(",") || "");
      params.set("response_type", "code");
      break;

    case "google_ads":
      params.set("client_id", creds.clientId);
      params.set("redirect_uri", redirectUri);
      params.set("state", state);
      params.set("scope", config.scopes?.join(" ") || "");
      params.set("response_type", "code");
      params.set("access_type", "offline");
      params.set("prompt", "consent");
      break;

    case "tiktok":
      params.set("client_key", creds.clientId);
      params.set("redirect_uri", redirectUri);
      params.set("state", state);
      params.set("scope", config.scopes?.join(",") || "");
      params.set("response_type", "code");
      break;

    case "linkedin":
      params.set("client_id", creds.clientId);
      params.set("redirect_uri", redirectUri);
      params.set("state", state);
      params.set("scope", config.scopes?.join(" ") || "");
      params.set("response_type", "code");
      break;

    default:
      return null;
  }

  return `${config.authUrl}?${params.toString()}`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);
    const { provider } = await params;

    if (!userId || !isValidUUID(userId)) {
      return NextResponse.json({ error: "Missing or invalid x-user-id header" }, { status: 400 });
    }

    const config = PROVIDER_CONFIG[provider];
    if (!config) {
      return NextResponse.json(
        { error: `Unknown provider: ${provider}. Supported: ${Object.keys(PROVIDER_CONFIG).join(", ")}` },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));

    // Get or create actor for user
    const actor = await db
      .select()
      .from(actors)
      .where(and(eq(actors.tenantId, tenantId), eq(actors.userId, userId)))
      .limit(1);

    let actorId: string;
    if (actor.length === 0) {
      const newActor = await db
        .insert(actors)
        .values({ tenantId, type: "user", userId })
        .returning({ id: actors.id });
      actorId = newActor[0].id;
    } else {
      actorId = actor[0].id;
    }

    // Check if channel already exists for this provider
    const existingChannel = await db
      .select()
      .from(marketingChannels)
      .where(
        and(
          eq(marketingChannels.tenantId, tenantId),
          eq(marketingChannels.integrationProvider, provider)
        )
      )
      .limit(1);

    let channelId: string;

    if (existingChannel.length > 0) {
      channelId = existingChannel[0].id;
    } else {
      // Create new channel - starts disconnected until OAuth completes
      const newChannel = await db
        .insert(marketingChannels)
        .values({
          tenantId,
          name: config.name,
          type: config.type,
          status: "disconnected",
          integrationProvider: provider,
          authMethod: config.authMethod,
          permissions: config.permissions || [],
          createdByActorId: actorId,
        })
        .returning({ id: marketingChannels.id });
      channelId = newChannel[0].id;
    }

    // Handle OAuth flow
    if (config.authMethod === "oauth2") {
      // Get tenant-specific OAuth credentials
      const creds = await getTenantOAuthCredentials(tenantId, provider);
      const credKey = getCredentialKey(provider);

      if (!creds || !creds.clientId || !creds.clientSecret) {
        return NextResponse.json({
          error: `OAuth not configured for ${provider}. Please configure your ${credKey === "meta" ? "Meta (Instagram/Facebook)" : credKey} app credentials in Settings.`,
          needsConfiguration: true,
          configurationUrl: "/settings?tab=integrations",
          provider: credKey,
        }, { status: 400 });
      }

      // Generate state token for CSRF protection
      const state = crypto.randomBytes(32).toString("hex");
      const stateData = JSON.stringify({ tenantId, userId, channelId, provider, timestamp: Date.now() });
      const encryptedState = Buffer.from(stateData).toString("base64");

      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
      const redirectUri = `${appUrl}/api/marketing/channels/oauth/${provider}/callback`;

      const authUrl = buildAuthUrl(provider, encryptedState, redirectUri, creds);

      if (!authUrl) {
        return NextResponse.json({ error: "Failed to build authorization URL" }, { status: 500 });
      }

      // Store pending connection state in connector
      const existingConnector = await db
        .select()
        .from(marketingConnectors)
        .where(
          and(
            eq(marketingConnectors.tenantId, tenantId),
            eq(marketingConnectors.channelId, channelId)
          )
        )
        .limit(1);

      if (existingConnector.length === 0) {
        await db.insert(marketingConnectors).values({
          tenantId,
          channelId,
          connectionType: "oauth",
          authState: { state: encryptedState, initiatedAt: new Date().toISOString() },
          syncMode: "scheduled",
          isActive: false,
          createdByActorId: actorId,
        });
      } else {
        await db
          .update(marketingConnectors)
          .set({
            authState: { state: encryptedState, initiatedAt: new Date().toISOString() },
            updatedAt: new Date(),
          })
          .where(eq(marketingConnectors.id, existingConnector[0].id));
      }

      await logAuditEvent({
        tenantId,
        actorId,
        entityType: "marketing_channel",
        entityId: channelId,
        action: "oauth_initiated",
        metadata: { provider },
      });

      return NextResponse.json({
        success: true,
        authMethod: "oauth2",
        authUrl,
        channelId,
      });
    }

    // Handle API key connection
    if (config.authMethod === "api_key") {
      const { apiKey, accountId, additionalConfig } = body;

      if (!apiKey) {
        return NextResponse.json({
          error: "API key is required",
          fields: provider === "whatsapp"
            ? ["apiKey", "phoneNumberId", "businessAccountId"]
            : provider === "sms"
            ? ["apiKey", "accountSid", "phoneNumber"]
            : ["apiKey"],
        }, { status: 400 });
      }

      // Validate API key with provider (simplified)
      const isValid = await validateApiKey(provider, apiKey, additionalConfig);

      if (!isValid.success) {
        return NextResponse.json({ error: isValid.error || "Invalid API key" }, { status: 400 });
      }

      // Store encrypted API key
      const encryptedApiKey = Buffer.from(apiKey).toString("base64"); // In production, use proper encryption

      const existingConnector = await db
        .select()
        .from(marketingConnectors)
        .where(
          and(
            eq(marketingConnectors.tenantId, tenantId),
            eq(marketingConnectors.channelId, channelId)
          )
        )
        .limit(1);

      if (existingConnector.length === 0) {
        await db.insert(marketingConnectors).values({
          tenantId,
          channelId,
          connectionType: "api_key",
          authState: {
            apiKey: encryptedApiKey,
            accountId: accountId || null,
            additionalConfig: additionalConfig || {},
            connectedAt: new Date().toISOString(),
          },
          syncMode: "scheduled",
          isActive: true,
          createdByActorId: actorId,
        });
      } else {
        await db
          .update(marketingConnectors)
          .set({
            authState: {
              apiKey: encryptedApiKey,
              accountId: accountId || null,
              additionalConfig: additionalConfig || {},
              connectedAt: new Date().toISOString(),
            },
            isActive: true,
            updatedAt: new Date(),
          })
          .where(eq(marketingConnectors.id, existingConnector[0].id));
      }

      // Update channel status
      await db
        .update(marketingChannels)
        .set({ status: "connected", updatedAt: new Date() })
        .where(eq(marketingChannels.id, channelId));

      await logAuditEvent({
        tenantId,
        actorId,
        entityType: "marketing_channel",
        entityId: channelId,
        action: "api_key_connected",
        metadata: { provider, accountId },
      });

      return NextResponse.json({
        success: true,
        authMethod: "api_key",
        channelId,
        connected: true,
      });
    }

    return NextResponse.json({ error: "Unsupported auth method" }, { status: 400 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/marketing/channels/[provider]/connect error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

// Validate API key with provider
async function validateApiKey(
  provider: string,
  apiKey: string,
  additionalConfig?: Record<string, string>
): Promise<{ success: boolean; error?: string; accountInfo?: Record<string, unknown> }> {
  try {
    switch (provider) {
      case "email": {
        // Validate SendGrid API key
        const sendgridKey = apiKey;
        const res = await fetch("https://api.sendgrid.com/v3/user/profile", {
          headers: { Authorization: `Bearer ${sendgridKey}` },
        });
        if (!res.ok) {
          return { success: false, error: "Invalid SendGrid API key" };
        }
        const profile = await res.json();
        return { success: true, accountInfo: { email: profile.email, username: profile.username } };
      }

      case "sms":
      case "whatsapp": {
        // Validate Twilio credentials
        const accountSid = additionalConfig?.accountSid || process.env.TWILIO_ACCOUNT_SID;
        const authToken = apiKey;

        if (!accountSid) {
          return { success: false, error: "Account SID is required" };
        }

        const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}.json`, {
          headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          },
        });

        if (!res.ok) {
          return { success: false, error: "Invalid Twilio credentials" };
        }

        const account = await res.json();
        return { success: true, accountInfo: { friendlyName: account.friendly_name, status: account.status } };
      }

      default:
        // For development, accept any key
        if (process.env.NODE_ENV === "development") {
          return { success: true, accountInfo: { demo: true } };
        }
        return { success: false, error: "Provider not supported for API key validation" };
    }
  } catch (error) {
    console.error("API key validation error:", error);
    return { success: false, error: "Failed to validate API key" };
  }
}
