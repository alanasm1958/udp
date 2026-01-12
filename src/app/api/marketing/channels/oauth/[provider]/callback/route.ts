/**
 * /api/marketing/channels/oauth/[provider]/callback
 *
 * GET: OAuth callback handler - exchanges code for tokens
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { marketingChannels, marketingConnectors, tenantSettings } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { logAuditEvent } from "@/lib/audit";

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

// Exchange authorization code for access token
async function exchangeCodeForTokens(
  provider: string,
  code: string,
  redirectUri: string,
  creds: { clientId: string; clientSecret: string }
): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  accountInfo?: Record<string, unknown>;
  error?: string;
}> {
  if (!creds.clientId || !creds.clientSecret) {
    return { success: false, error: "OAuth credentials not configured" };
  }

  try {
    switch (provider) {
      case "instagram":
      case "facebook": {
        // Exchange code for access token
        const tokenRes = await fetch("https://graph.facebook.com/v18.0/oauth/access_token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: creds.clientId,
            client_secret: creds.clientSecret,
            redirect_uri: redirectUri,
            code,
          }),
        });

        if (!tokenRes.ok) {
          const error = await tokenRes.json();
          return { success: false, error: error.error?.message || "Failed to exchange code" };
        }

        const tokenData = await tokenRes.json();

        // Get user info
        const userRes = await fetch(
          `https://graph.facebook.com/v18.0/me?fields=id,name,email&access_token=${tokenData.access_token}`
        );
        const userData = userRes.ok ? await userRes.json() : {};

        // Get pages for Facebook / Instagram accounts
        const pagesRes = await fetch(
          `https://graph.facebook.com/v18.0/me/accounts?access_token=${tokenData.access_token}`
        );
        const pagesData = pagesRes.ok ? await pagesRes.json() : { data: [] };

        return {
          success: true,
          accessToken: tokenData.access_token,
          expiresIn: tokenData.expires_in,
          accountInfo: {
            userId: userData.id,
            name: userData.name,
            email: userData.email,
            pages: pagesData.data,
          },
        };
      }

      case "google_ads": {
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: creds.clientId,
            client_secret: creds.clientSecret,
            redirect_uri: redirectUri,
            code,
            grant_type: "authorization_code",
          }),
        });

        if (!tokenRes.ok) {
          const error = await tokenRes.json();
          return { success: false, error: error.error_description || "Failed to exchange code" };
        }

        const tokenData = await tokenRes.json();

        // Get user info
        const userRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const userData = userRes.ok ? await userRes.json() : {};

        return {
          success: true,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresIn: tokenData.expires_in,
          accountInfo: {
            email: userData.email,
            name: userData.name,
          },
        };
      }

      case "tiktok": {
        const tokenRes = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_key: creds.clientId,
            client_secret: creds.clientSecret,
            code,
            grant_type: "authorization_code",
            redirect_uri: redirectUri,
          }),
        });

        if (!tokenRes.ok) {
          const error = await tokenRes.json();
          return { success: false, error: error.error?.message || "Failed to exchange code" };
        }

        const tokenData = await tokenRes.json();

        return {
          success: true,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresIn: tokenData.expires_in,
          accountInfo: {
            openId: tokenData.open_id,
          },
        };
      }

      case "linkedin": {
        const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: creds.clientId,
            client_secret: creds.clientSecret,
            redirect_uri: redirectUri,
            code,
            grant_type: "authorization_code",
          }),
        });

        if (!tokenRes.ok) {
          const error = await tokenRes.json();
          return { success: false, error: error.error_description || "Failed to exchange code" };
        }

        const tokenData = await tokenRes.json();

        // Get profile info
        const profileRes = await fetch("https://api.linkedin.com/v2/me", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        const profileData = profileRes.ok ? await profileRes.json() : {};

        return {
          success: true,
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresIn: tokenData.expires_in,
          accountInfo: {
            id: profileData.id,
            firstName: profileData.localizedFirstName,
            lastName: profileData.localizedLastName,
          },
        };
      }

      default:
        return { success: false, error: "Provider not supported" };
    }
  } catch (error) {
    console.error("Token exchange error:", error);
    return { success: false, error: "Failed to exchange authorization code" };
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
): Promise<NextResponse> {
  const { provider } = await params;
  const { searchParams } = new URL(req.url);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const marketingUrl = `${appUrl}/marketing`;

  // Handle OAuth errors
  if (error) {
    console.error(`OAuth error for ${provider}:`, error, errorDescription);
    return NextResponse.redirect(
      `${marketingUrl}?error=${encodeURIComponent(errorDescription || error)}&provider=${provider}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${marketingUrl}?error=${encodeURIComponent("Missing authorization code or state")}&provider=${provider}`
    );
  }

  try {
    // Decode state to get tenant/user/channel info
    let stateData: { tenantId: string; userId: string; channelId: string; provider: string; timestamp: number };
    try {
      stateData = JSON.parse(Buffer.from(state, "base64").toString("utf-8"));
    } catch {
      return NextResponse.redirect(
        `${marketingUrl}?error=${encodeURIComponent("Invalid state parameter")}&provider=${provider}`
      );
    }

    // Verify state is not too old (15 minutes max)
    if (Date.now() - stateData.timestamp > 15 * 60 * 1000) {
      return NextResponse.redirect(
        `${marketingUrl}?error=${encodeURIComponent("Authorization request expired. Please try again.")}&provider=${provider}`
      );
    }

    const { tenantId, channelId } = stateData;
    const redirectUri = `${appUrl}/api/marketing/channels/oauth/${provider}/callback`;

    // Get tenant-specific OAuth credentials
    const creds = await getTenantOAuthCredentials(tenantId, provider);
    if (!creds) {
      return NextResponse.redirect(
        `${marketingUrl}?error=${encodeURIComponent("OAuth credentials not configured for this tenant")}&provider=${provider}`
      );
    }

    // Exchange code for tokens
    const tokenResult = await exchangeCodeForTokens(provider, code, redirectUri, creds);

    if (!tokenResult.success) {
      return NextResponse.redirect(
        `${marketingUrl}?error=${encodeURIComponent(tokenResult.error || "Failed to connect")}&provider=${provider}`
      );
    }

    // Update connector with tokens
    const connector = await db
      .select()
      .from(marketingConnectors)
      .where(
        and(
          eq(marketingConnectors.tenantId, tenantId),
          eq(marketingConnectors.channelId, channelId)
        )
      )
      .limit(1);

    if (connector.length === 0) {
      return NextResponse.redirect(
        `${marketingUrl}?error=${encodeURIComponent("Channel not found")}&provider=${provider}`
      );
    }

    // Store tokens securely (in production, encrypt these)
    const authState = {
      accessToken: tokenResult.accessToken,
      refreshToken: tokenResult.refreshToken,
      expiresAt: tokenResult.expiresIn
        ? new Date(Date.now() + tokenResult.expiresIn * 1000).toISOString()
        : null,
      accountInfo: tokenResult.accountInfo,
      connectedAt: new Date().toISOString(),
    };

    await db
      .update(marketingConnectors)
      .set({
        authState,
        isActive: true,
        lastSyncAt: new Date(),
        syncErrors: [],
        updatedAt: new Date(),
      })
      .where(eq(marketingConnectors.id, connector[0].id));

    // Update channel status to connected
    await db
      .update(marketingChannels)
      .set({
        status: "connected",
        metadata: {
          accountInfo: tokenResult.accountInfo,
          connectedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(marketingChannels.id, channelId));

    // Log audit event
    await logAuditEvent({
      tenantId,
      actorId: connector[0].createdByActorId,
      entityType: "marketing_channel",
      entityId: channelId,
      action: "oauth_connected",
      metadata: {
        provider,
        accountInfo: tokenResult.accountInfo,
      },
    });

    // Redirect back to marketing page with success
    return NextResponse.redirect(
      `${marketingUrl}?success=true&provider=${provider}&channel=${channelId}`
    );
  } catch (error) {
    console.error("OAuth callback error:", error);
    return NextResponse.redirect(
      `${marketingUrl}?error=${encodeURIComponent("Failed to complete connection")}&provider=${provider}`
    );
  }
}
