/**
 * Types for marketing channel connectors
 */

export interface AuthState {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: string;
  apiKey?: string;
  accountSid?: string;
  accountInfo?: {
    id?: string;
    name?: string;
    email?: string;
    username?: string;
    profileUrl?: string;
    pages?: Array<{ id: string; name: string }>;
  };
  connectedAt?: string;
  additionalConfig?: Record<string, unknown>;
}

export interface FetchOptions {
  period?: "7d" | "30d" | "90d" | "custom";
  startDate?: Date;
  endDate?: Date;
}

export interface ChannelMetric {
  type: string;
  value: number;
  previousValue?: number;
  label: string;
  format?: "number" | "percentage" | "currency";
  trend?: "up" | "down" | "stable";
  trendValue?: number;
}

export interface ChannelMetrics {
  metrics: ChannelMetric[];
  rawData: Record<string, unknown>;
  fetchedAt: Date;
  periodStart?: Date;
  periodEnd?: Date;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
  accountInfo?: AuthState["accountInfo"];
}

export interface ChannelConnector {
  provider: string;
  fetchMetrics(authState: AuthState, options: FetchOptions): Promise<ChannelMetrics>;
  validateCredentials?(authState: AuthState): Promise<ValidationResult>;
  refreshToken?(authState: AuthState): Promise<AuthState>;
}

export type ProviderType =
  | "instagram"
  | "facebook"
  | "google_ads"
  | "tiktok"
  | "linkedin"
  | "email"
  | "sms"
  | "whatsapp";

// Metric definitions by provider
export const PROVIDER_METRICS: Record<ProviderType, Array<{ type: string; label: string; format: "number" | "percentage" | "currency" }>> = {
  instagram: [
    { type: "followers", label: "Followers", format: "number" },
    { type: "reach", label: "Reach", format: "number" },
    { type: "impressions", label: "Impressions", format: "number" },
    { type: "engagement_rate", label: "Engagement Rate", format: "percentage" },
    { type: "posts", label: "Posts", format: "number" },
  ],
  facebook: [
    { type: "page_likes", label: "Page Likes", format: "number" },
    { type: "reach", label: "Reach", format: "number" },
    { type: "impressions", label: "Impressions", format: "number" },
    { type: "engagement_rate", label: "Engagement Rate", format: "percentage" },
    { type: "posts", label: "Posts", format: "number" },
  ],
  google_ads: [
    { type: "impressions", label: "Impressions", format: "number" },
    { type: "clicks", label: "Clicks", format: "number" },
    { type: "ctr", label: "CTR", format: "percentage" },
    { type: "conversions", label: "Conversions", format: "number" },
    { type: "cost", label: "Cost", format: "currency" },
  ],
  tiktok: [
    { type: "followers", label: "Followers", format: "number" },
    { type: "video_views", label: "Video Views", format: "number" },
    { type: "likes", label: "Likes", format: "number" },
    { type: "comments", label: "Comments", format: "number" },
    { type: "shares", label: "Shares", format: "number" },
  ],
  linkedin: [
    { type: "followers", label: "Followers", format: "number" },
    { type: "impressions", label: "Impressions", format: "number" },
    { type: "clicks", label: "Clicks", format: "number" },
    { type: "engagement_rate", label: "Engagement Rate", format: "percentage" },
    { type: "posts", label: "Posts", format: "number" },
  ],
  email: [
    { type: "delivered", label: "Delivered", format: "number" },
    { type: "opens", label: "Opens", format: "number" },
    { type: "open_rate", label: "Open Rate", format: "percentage" },
    { type: "clicks", label: "Clicks", format: "number" },
    { type: "click_rate", label: "Click Rate", format: "percentage" },
  ],
  sms: [
    { type: "sent", label: "Sent", format: "number" },
    { type: "delivered", label: "Delivered", format: "number" },
    { type: "delivery_rate", label: "Delivery Rate", format: "percentage" },
    { type: "responses", label: "Responses", format: "number" },
  ],
  whatsapp: [
    { type: "sent", label: "Sent", format: "number" },
    { type: "delivered", label: "Delivered", format: "number" },
    { type: "read", label: "Read", format: "number" },
    { type: "read_rate", label: "Read Rate", format: "percentage" },
  ],
};
