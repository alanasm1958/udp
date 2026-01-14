/**
 * Marketing Channel Connectors
 *
 * Factory for creating platform-specific connectors that fetch metrics
 * from connected social media and marketing platforms.
 */

import {
  type AuthState,
  type FetchOptions,
  type ChannelMetrics,
  type ChannelConnector,
  type ProviderType,
  PROVIDER_METRICS,
} from "./types";

// Helper to generate mock data with realistic patterns
function generateMockValue(type: string, provider: string): { value: number; previousValue: number } {
  const baseValues: Record<string, number> = {
    followers: 15000 + Math.floor(Math.random() * 50000),
    page_likes: 8000 + Math.floor(Math.random() * 20000),
    reach: 50000 + Math.floor(Math.random() * 100000),
    impressions: 80000 + Math.floor(Math.random() * 150000),
    engagement_rate: 2 + Math.random() * 6,
    posts: 10 + Math.floor(Math.random() * 30),
    clicks: 1000 + Math.floor(Math.random() * 5000),
    ctr: 1 + Math.random() * 4,
    conversions: 50 + Math.floor(Math.random() * 200),
    cost: 500 + Math.random() * 2000,
    video_views: 100000 + Math.floor(Math.random() * 500000),
    likes: 5000 + Math.floor(Math.random() * 20000),
    comments: 200 + Math.floor(Math.random() * 1000),
    shares: 100 + Math.floor(Math.random() * 500),
    delivered: 5000 + Math.floor(Math.random() * 10000),
    opens: 1500 + Math.floor(Math.random() * 3000),
    open_rate: 20 + Math.random() * 30,
    click_rate: 2 + Math.random() * 8,
    sent: 5000 + Math.floor(Math.random() * 10000),
    delivery_rate: 90 + Math.random() * 9,
    responses: 100 + Math.floor(Math.random() * 500),
    read: 3000 + Math.floor(Math.random() * 5000),
    read_rate: 60 + Math.random() * 30,
  };

  const value = baseValues[type] ?? Math.floor(Math.random() * 10000);
  // Generate previous value with -20% to +20% variance
  const variance = (Math.random() - 0.5) * 0.4;
  const previousValue = value * (1 - variance);

  return { value: Math.round(value * 100) / 100, previousValue: Math.round(previousValue * 100) / 100 };
}

// Mock connector that generates realistic test data
// This allows the UI to work while real API integrations are developed
class MockConnector implements ChannelConnector {
  provider: string;

  constructor(provider: string) {
    this.provider = provider;
  }

  async fetchMetrics(authState: AuthState, options: FetchOptions): Promise<ChannelMetrics> {
    const metricDefs = PROVIDER_METRICS[this.provider as ProviderType] || [];
    const now = new Date();

    // Calculate period dates
    let periodStart = new Date();
    let periodEnd = now;

    switch (options.period) {
      case "7d":
        periodStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        periodStart = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "custom":
        if (options.startDate) periodStart = options.startDate;
        if (options.endDate) periodEnd = options.endDate;
        break;
    }

    const metrics = metricDefs.map((def) => {
      const { value, previousValue } = generateMockValue(def.type, this.provider);
      const trendValue = ((value - previousValue) / previousValue) * 100;

      return {
        type: def.type,
        value,
        previousValue,
        label: def.label,
        format: def.format,
        trend: trendValue > 1 ? "up" as const : trendValue < -1 ? "down" as const : "stable" as const,
        trendValue: Math.round(trendValue * 10) / 10,
      };
    });

    return {
      metrics,
      rawData: {
        provider: this.provider,
        accountId: authState.accountInfo?.id,
        period: options.period,
        generatedAt: now.toISOString(),
      },
      fetchedAt: now,
      periodStart,
      periodEnd,
    };
  }
}

// Meta (Instagram/Facebook) connector
// Uses Facebook Graph API v18.0
class MetaConnector implements ChannelConnector {
  provider: string;

  constructor(provider: "instagram" | "facebook") {
    this.provider = provider;
  }

  async fetchMetrics(authState: AuthState, options: FetchOptions): Promise<ChannelMetrics> {
    // If no access token, fall back to mock data
    if (!authState.accessToken) {
      return new MockConnector(this.provider).fetchMetrics(authState, options);
    }

    try {
      // Real implementation would call Facebook Graph API here
      // Example: GET /{page-id}/insights?metric=page_impressions,page_engaged_users&period=day
      // For now, return mock data with a note that real data requires API setup

      const mockData = await new MockConnector(this.provider).fetchMetrics(authState, options);
      mockData.rawData.note = "Using mock data. Configure Meta API for real metrics.";
      return mockData;
    } catch (error) {
      console.error(`Error fetching ${this.provider} metrics:`, error);
      return new MockConnector(this.provider).fetchMetrics(authState, options);
    }
  }

  async refreshToken(authState: AuthState): Promise<AuthState> {
    // Meta tokens are long-lived after exchange, but can be refreshed
    // Real implementation would call: GET /oauth/access_token?grant_type=fb_exchange_token&...
    return authState;
  }
}

// Google Ads connector
class GoogleAdsConnector implements ChannelConnector {
  provider = "google_ads";

  async fetchMetrics(authState: AuthState, options: FetchOptions): Promise<ChannelMetrics> {
    if (!authState.accessToken) {
      return new MockConnector(this.provider).fetchMetrics(authState, options);
    }

    try {
      // Real implementation would use Google Ads API
      // Requires: google-ads-api client, customer ID, and OAuth tokens
      const mockData = await new MockConnector(this.provider).fetchMetrics(authState, options);
      mockData.rawData.note = "Using mock data. Configure Google Ads API for real metrics.";
      return mockData;
    } catch (error) {
      console.error("Error fetching Google Ads metrics:", error);
      return new MockConnector(this.provider).fetchMetrics(authState, options);
    }
  }
}

// TikTok connector
class TikTokConnector implements ChannelConnector {
  provider = "tiktok";

  async fetchMetrics(authState: AuthState, options: FetchOptions): Promise<ChannelMetrics> {
    if (!authState.accessToken) {
      return new MockConnector(this.provider).fetchMetrics(authState, options);
    }

    try {
      // Real implementation would use TikTok Business API
      const mockData = await new MockConnector(this.provider).fetchMetrics(authState, options);
      mockData.rawData.note = "Using mock data. Configure TikTok API for real metrics.";
      return mockData;
    } catch (error) {
      console.error("Error fetching TikTok metrics:", error);
      return new MockConnector(this.provider).fetchMetrics(authState, options);
    }
  }
}

// LinkedIn connector
class LinkedInConnector implements ChannelConnector {
  provider = "linkedin";

  async fetchMetrics(authState: AuthState, options: FetchOptions): Promise<ChannelMetrics> {
    if (!authState.accessToken) {
      return new MockConnector(this.provider).fetchMetrics(authState, options);
    }

    try {
      // Real implementation would use LinkedIn Marketing API
      const mockData = await new MockConnector(this.provider).fetchMetrics(authState, options);
      mockData.rawData.note = "Using mock data. Configure LinkedIn API for real metrics.";
      return mockData;
    } catch (error) {
      console.error("Error fetching LinkedIn metrics:", error);
      return new MockConnector(this.provider).fetchMetrics(authState, options);
    }
  }
}

// SendGrid (Email) connector
class SendGridConnector implements ChannelConnector {
  provider = "email";

  async fetchMetrics(authState: AuthState, options: FetchOptions): Promise<ChannelMetrics> {
    if (!authState.apiKey) {
      return new MockConnector(this.provider).fetchMetrics(authState, options);
    }

    try {
      // Real implementation would call SendGrid Stats API
      // GET https://api.sendgrid.com/v3/stats?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD
      const mockData = await new MockConnector(this.provider).fetchMetrics(authState, options);
      mockData.rawData.note = "Using mock data. Configure SendGrid API for real metrics.";
      return mockData;
    } catch (error) {
      console.error("Error fetching SendGrid metrics:", error);
      return new MockConnector(this.provider).fetchMetrics(authState, options);
    }
  }
}

// Twilio (SMS/WhatsApp) connector
class TwilioConnector implements ChannelConnector {
  provider: string;

  constructor(provider: "sms" | "whatsapp") {
    this.provider = provider;
  }

  async fetchMetrics(authState: AuthState, options: FetchOptions): Promise<ChannelMetrics> {
    if (!authState.apiKey || !authState.accountSid) {
      return new MockConnector(this.provider).fetchMetrics(authState, options);
    }

    try {
      // Real implementation would call Twilio Usage Records API
      const mockData = await new MockConnector(this.provider).fetchMetrics(authState, options);
      mockData.rawData.note = "Using mock data. Configure Twilio API for real metrics.";
      return mockData;
    } catch (error) {
      console.error(`Error fetching ${this.provider} metrics:`, error);
      return new MockConnector(this.provider).fetchMetrics(authState, options);
    }
  }
}

/**
 * Factory function to get the appropriate connector for a provider
 */
export function getConnector(provider: string): ChannelConnector {
  switch (provider) {
    case "instagram":
      return new MetaConnector("instagram");
    case "facebook":
      return new MetaConnector("facebook");
    case "google_ads":
      return new GoogleAdsConnector();
    case "tiktok":
      return new TikTokConnector();
    case "linkedin":
      return new LinkedInConnector();
    case "email":
      return new SendGridConnector();
    case "sms":
      return new TwilioConnector("sms");
    case "whatsapp":
      return new TwilioConnector("whatsapp");
    default:
      return new MockConnector(provider);
  }
}

// Re-export types
export * from "./types";
