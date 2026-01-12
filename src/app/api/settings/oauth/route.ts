/**
 * /api/settings/oauth
 *
 * GET: Get configured OAuth providers (without secrets)
 * PUT: Save OAuth credentials for a provider
 * DELETE: Remove OAuth credentials for a provider
 */

import { NextRequest, NextResponse } from "next/server";
import { requireTenantIdFromHeaders, TenantError, getUserIdFromHeaders, isValidUUID } from "@/lib/tenant";
import { db } from "@/db";
import { tenantSettings, actors } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit";

// Encrypt credentials (in production, use proper encryption like AES-256-GCM)
function encryptCredentials(value: string): string {
  // Simple base64 encoding for now - in production, use proper encryption
  return Buffer.from(value).toString("base64");
}

function decryptCredentials(value: string): string {
  return Buffer.from(value, "base64").toString("utf-8");
}

// Provider configuration info
const PROVIDER_INFO: Record<string, { name: string; setupUrl: string; requiredScopes: string[] }> = {
  meta: {
    name: "Meta (Instagram/Facebook)",
    setupUrl: "https://developers.facebook.com/apps/",
    requiredScopes: ["instagram_basic", "instagram_content_publish", "pages_show_list", "pages_read_engagement"],
  },
  google: {
    name: "Google (Ads/Analytics)",
    setupUrl: "https://console.cloud.google.com/apis/credentials",
    requiredScopes: ["https://www.googleapis.com/auth/adwords"],
  },
  tiktok: {
    name: "TikTok",
    setupUrl: "https://developers.tiktok.com/apps/",
    requiredScopes: ["user.info.basic", "video.list"],
  },
  linkedin: {
    name: "LinkedIn",
    setupUrl: "https://www.linkedin.com/developers/apps",
    requiredScopes: ["r_liteprofile", "w_member_social"],
  },
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);

    const settings = await db
      .select({ oauthCredentials: tenantSettings.oauthCredentials })
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId))
      .limit(1);

    const credentials = settings.length > 0 ? settings[0].oauthCredentials || {} : {};

    // Return configured providers without exposing secrets
    const configuredProviders = Object.entries(credentials).map(([provider, creds]) => ({
      provider,
      name: PROVIDER_INFO[provider]?.name || provider,
      configured: !!(creds as { clientId?: string })?.clientId,
      clientIdPreview: ((creds as { clientId?: string })?.clientId || "").slice(0, 8) + "...",
    }));

    // Include all available providers
    const allProviders = Object.entries(PROVIDER_INFO).map(([provider, info]) => {
      const existing = configuredProviders.find((p) => p.provider === provider);
      return {
        provider,
        name: info.name,
        setupUrl: info.setupUrl,
        requiredScopes: info.requiredScopes,
        configured: existing?.configured || false,
        clientIdPreview: existing?.clientIdPreview || null,
      };
    });

    return NextResponse.json({ providers: allProviders });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/settings/oauth error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);

    if (!userId || !isValidUUID(userId)) {
      return NextResponse.json({ error: "Missing or invalid x-user-id header" }, { status: 400 });
    }

    const body = await req.json();
    const { provider, clientId, clientSecret } = body;

    if (!provider || !clientId || !clientSecret) {
      return NextResponse.json({ error: "provider, clientId, and clientSecret are required" }, { status: 400 });
    }

    if (!PROVIDER_INFO[provider]) {
      return NextResponse.json(
        { error: `Unknown provider: ${provider}. Supported: ${Object.keys(PROVIDER_INFO).join(", ")}` },
        { status: 400 }
      );
    }

    // Get or create tenant settings
    let settings = await db
      .select()
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId))
      .limit(1);

    // Get actor
    const actor = await db
      .select()
      .from(actors)
      .where(and(eq(actors.tenantId, tenantId), eq(actors.userId, userId)))
      .limit(1);

    const actorId = actor.length > 0 ? actor[0].id : null;

    const encryptedCreds = {
      clientId: encryptCredentials(clientId),
      clientSecret: encryptCredentials(clientSecret),
    };

    if (settings.length === 0) {
      // Create new settings
      await db.insert(tenantSettings).values({
        tenantId,
        oauthCredentials: { [provider]: encryptedCreds },
        updatedByActorId: actorId,
      });
    } else {
      // Update existing settings
      const existingCreds = (settings[0].oauthCredentials || {}) as Record<string, { clientId: string; clientSecret: string }>;
      await db
        .update(tenantSettings)
        .set({
          oauthCredentials: { ...existingCreds, [provider]: encryptedCreds },
          updatedAt: new Date(),
          updatedByActorId: actorId,
        })
        .where(eq(tenantSettings.id, settings[0].id));
    }

    if (actorId) {
      await logAuditEvent({
        tenantId,
        actorId,
        entityType: "tenant_settings",
        entityId: tenantId,
        action: "oauth_credentials_updated",
        metadata: { provider },
      });
    }

    return NextResponse.json({ success: true, provider, configured: true });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("PUT /api/settings/oauth error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userId = getUserIdFromHeaders(req);

    if (!userId || !isValidUUID(userId)) {
      return NextResponse.json({ error: "Missing or invalid x-user-id header" }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider");

    if (!provider) {
      return NextResponse.json({ error: "provider query parameter is required" }, { status: 400 });
    }

    const settings = await db
      .select()
      .from(tenantSettings)
      .where(eq(tenantSettings.tenantId, tenantId))
      .limit(1);

    if (settings.length === 0) {
      return NextResponse.json({ error: "No settings found" }, { status: 404 });
    }

    // Get actor
    const actor = await db
      .select()
      .from(actors)
      .where(and(eq(actors.tenantId, tenantId), eq(actors.userId, userId)))
      .limit(1);

    const actorId = actor.length > 0 ? actor[0].id : null;

    const existingCreds = (settings[0].oauthCredentials || {}) as Record<string, { clientId: string; clientSecret: string }>;
    const { [provider]: _, ...remainingCreds } = existingCreds;

    await db
      .update(tenantSettings)
      .set({
        oauthCredentials: remainingCreds,
        updatedAt: new Date(),
        updatedByActorId: actorId,
      })
      .where(eq(tenantSettings.id, settings[0].id));

    if (actorId) {
      await logAuditEvent({
        tenantId,
        actorId,
        entityType: "tenant_settings",
        entityId: tenantId,
        action: "oauth_credentials_removed",
        metadata: { provider },
      });
    }

    return NextResponse.json({ success: true, provider, configured: false });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("DELETE /api/settings/oauth error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
