"use client";

import * as React from "react";
import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassTextarea,
  GlassSelect,
  GlassBadge,
  Spinner,
  EmptyState,
  useToast,
} from "@/components/ui/glass";
import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/http";

/* ═══════════════════════════════════════════════════════════════════════════
   TYPES & INTERFACES
   ═══════════════════════════════════════════════════════════════════════════ */

interface AnalyticsData {
  totalReach: number;
  reachTrend: number;
  engagementRate: number;
  engagementTrend: number;
  conversionRate: number;
  conversionTrend: number;
  activeCampaigns: number;
  budgetSpent: number;
  budgetTotal: number;
  roi: number;
}

interface Channel {
  id: string;
  name: string;
  type: string;
  icon: string;
  color: string;
  connected: boolean;
  metrics?: {
    reach: number;
    engagement: number;
    conversions: number;
  };
}

// Channel data from API
interface ConnectedChannelData {
  id: string; // Database ID
  name: string;
  type: string;
  status: string;
  integrationProvider: string | null; // Maps to channel.id (instagram, facebook, etc.)
  authMethod: string;
  metadata: Record<string, unknown> | null;
}

interface Campaign {
  id: string;
  name: string;
  status: "draft" | "active" | "paused" | "completed";
  budget: number;
  spent: number;
  startDate: string;
  endDate?: string;
  channels: string[];
  metrics?: {
    reach: number;
    clicks: number;
    conversions: number;
  };
}

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock?: number;
  category?: string;
}

interface WizardData {
  // Step 1: What to promote
  promotionType: "product" | "service" | "brand" | "event" | "";
  selectedProducts: string[];
  customPromotionDescription: string;

  // Step 2: Goals
  goalType: "awareness" | "leads" | "sales" | "traffic" | "engagement" | "";
  targetMetric: number;
  targetRevenue: number;
  timelineType: "ongoing" | "fixed";
  startDate: string;
  endDate: string;

  // Step 3: Audience & Channels
  targetAudience: {
    ageRange: string;
    gender: string;
    location: string;
    interests: string[];
  };
  selectedChannels: string[];

  // Step 4: Budget
  totalBudget: number;
  budgetPeriod: "daily" | "weekly" | "monthly" | "total";
  spendLimit: number;

  // Step 5: Creative Direction
  keyMessage: string;
  toneOfVoice: string;
  additionalNotes: string;

  // AI Recommendations
  aiGenerated: boolean;
  recommendations?: AIRecommendation[];
  selectedStrategy?: string;
}

interface AIRecommendation {
  id: string;
  name: string;
  type: "primary" | "conservative" | "aggressive" | "brand";
  description: string;
  projectedReach: number;
  estimatedConversions: number;
  budgetBreakdown: { channel: string; amount: number; percentage: number }[];
  riskLevel: "low" | "medium" | "high";
  reasoning: string;
  tactics: string[];
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHANNEL DEFINITIONS
   ═══════════════════════════════════════════════════════════════════════════ */

const AVAILABLE_CHANNELS: Omit<Channel, "connected" | "metrics">[] = [
  {
    id: "instagram",
    name: "Instagram",
    type: "social",
    icon: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z",
    color: "#E4405F",
  },
  {
    id: "facebook",
    name: "Facebook",
    type: "social",
    icon: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z",
    color: "#1877F2",
  },
  {
    id: "whatsapp",
    name: "WhatsApp Business",
    type: "messaging",
    icon: "M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z",
    color: "#25D366",
  },
  {
    id: "google_ads",
    name: "Google Ads",
    type: "ads",
    icon: "M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z",
    color: "#4285F4",
  },
  {
    id: "email",
    name: "Email Marketing",
    type: "email",
    icon: "M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z",
    color: "#EA4335",
  },
  {
    id: "sms",
    name: "SMS Marketing",
    type: "sms",
    icon: "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z",
    color: "#00BCD4",
  },
  {
    id: "tiktok",
    name: "TikTok",
    type: "social",
    icon: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
    color: "#000000",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    type: "social",
    icon: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
    color: "#0A66C2",
  },
];

const GOAL_OPTIONS = [
  { value: "awareness", label: "Brand Awareness", description: "Get your brand seen by more people", icon: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" },
  { value: "leads", label: "Lead Generation", description: "Capture potential customers", icon: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" },
  { value: "sales", label: "Sales & Conversions", description: "Drive direct purchases", icon: "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" },
  { value: "traffic", label: "Website Traffic", description: "Increase site visitors", icon: "M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" },
  { value: "engagement", label: "Engagement", description: "Build community interaction", icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" },
];

const TONE_OPTIONS = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly & Approachable" },
  { value: "bold", label: "Bold & Confident" },
  { value: "inspiring", label: "Inspiring & Motivational" },
  { value: "playful", label: "Playful & Fun" },
  { value: "luxurious", label: "Premium & Luxurious" },
];

/* ═══════════════════════════════════════════════════════════════════════════
   HELPER COMPONENTS
   ═══════════════════════════════════════════════════════════════════════════ */

function MetricCard({
  label,
  value,
  trend,
  trendValue,
  icon,
  color = "blue",
}: {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  icon?: React.ReactNode;
  color?: "blue" | "green" | "purple" | "amber" | "red";
}) {
  const colorClasses = {
    blue: "from-blue-500/20 to-blue-600/10 border-blue-500/20",
    green: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/20",
    purple: "from-purple-500/20 to-purple-600/10 border-purple-500/20",
    amber: "from-amber-500/20 to-amber-600/10 border-amber-500/20",
    red: "from-red-500/20 to-red-600/10 border-red-500/20",
  };

  const trendColors = {
    up: "text-emerald-400",
    down: "text-red-400",
    neutral: "text-white/50",
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${colorClasses[color]} border backdrop-blur-xl p-4`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-white/60 uppercase tracking-wider mb-1">{label}</p>
          <p className="text-2xl font-bold text-white tabular-nums">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {trend && trendValue && (
            <div className={`flex items-center gap-1 mt-1 ${trendColors[trend]}`}>
              {trend === "up" && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                </svg>
              )}
              {trend === "down" && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              )}
              <span className="text-xs font-medium">{trendValue}</span>
            </div>
          )}
        </div>
        {icon && <div className="text-white/30">{icon}</div>}
      </div>
      {/* Sparkline placeholder */}
      <div className="absolute bottom-0 left-0 right-0 h-8 opacity-30">
        <svg className="w-full h-full" viewBox="0 0 100 20" preserveAspectRatio="none">
          <path
            d="M0,15 Q10,10 20,12 T40,8 T60,14 T80,6 T100,10"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="text-white/40"
          />
        </svg>
      </div>
    </div>
  );
}

function ChannelCard({
  channel,
  connected,
  metrics,
  disconnecting,
  onConnect,
  onDisconnect,
}: {
  channel: Omit<Channel, "connected" | "metrics">;
  connected: boolean;
  metrics?: Channel["metrics"];
  disconnecting?: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border backdrop-blur-xl p-4 transition-all duration-200 hover:scale-[1.02] ${
        connected
          ? "bg-white/10 border-white/20"
          : "bg-white/5 border-white/10 hover:bg-white/8"
      }`}
    >
      {connected && (
        <div className="absolute top-3 right-3">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </div>
      )}

      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${channel.color}20` }}
        >
          <svg className="w-5 h-5" fill={channel.color} viewBox="0 0 24 24">
            <path d={channel.icon} />
          </svg>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-white">{channel.name}</h4>
          <p className="text-xs text-white/50 capitalize">{channel.type}</p>
        </div>
      </div>

      {connected && metrics ? (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center">
            <p className="text-xs text-white/50">Reach</p>
            <p className="text-sm font-semibold text-white">{metrics.reach.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-white/50">Engage</p>
            <p className="text-sm font-semibold text-white">{metrics.engagement}%</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-white/50">Conv</p>
            <p className="text-sm font-semibold text-white">{metrics.conversions}</p>
          </div>
        </div>
      ) : null}

      {connected ? (
        <div className="flex gap-2">
          <button
            onClick={onDisconnect}
            disabled={disconnecting}
            className="flex-1 py-2 rounded-xl text-xs font-medium transition-all bg-red-500/20 text-red-300 hover:bg-red-500/30 disabled:opacity-50"
          >
            {disconnecting ? "..." : "Disconnect"}
          </button>
        </div>
      ) : (
        <button
          onClick={onConnect}
          className="w-full py-2 rounded-xl text-xs font-medium transition-all bg-white/10 text-white hover:bg-white/20"
        >
          Connect
        </button>
      )}
    </div>
  );
}

function CampaignCard({
  campaign,
  onEdit,
  onPause,
  onViewAnalytics,
}: {
  campaign: Campaign;
  onEdit: () => void;
  onPause: () => void;
  onViewAnalytics: () => void;
}) {
  const statusColors = {
    draft: "bg-white/20 text-white/70",
    active: "bg-emerald-500/20 text-emerald-400",
    paused: "bg-amber-500/20 text-amber-400",
    completed: "bg-blue-500/20 text-blue-400",
  };

  const progress = campaign.budget > 0 ? (campaign.spent / campaign.budget) * 100 : 0;

  return (
    <GlassCard className="hover:bg-white/12 transition-all">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h4 className="text-base font-semibold text-white mb-1">{campaign.name}</h4>
          <div className="flex items-center gap-2">
            <span className={`text-xs px-2 py-0.5 rounded-lg ${statusColors[campaign.status]}`}>
              {campaign.status}
            </span>
            <span className="text-xs text-white/40">
              {new Date(campaign.startDate).toLocaleDateString()}
              {campaign.endDate && ` - ${new Date(campaign.endDate).toLocaleDateString()}`}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {campaign.channels.slice(0, 3).map((channelId) => {
            const channel = AVAILABLE_CHANNELS.find((c) => c.id === channelId);
            if (!channel) return null;
            return (
              <div
                key={channelId}
                className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${channel.color}20` }}
              >
                <svg className="w-3 h-3" fill={channel.color} viewBox="0 0 24 24">
                  <path d={channel.icon} />
                </svg>
              </div>
            );
          })}
          {campaign.channels.length > 3 && (
            <div className="w-6 h-6 rounded-lg bg-white/10 flex items-center justify-center text-xs text-white/60">
              +{campaign.channels.length - 3}
            </div>
          )}
        </div>
      </div>

      {/* Budget Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-white/50">Budget</span>
          <span className="text-white font-medium">
            ${campaign.spent.toLocaleString()} / ${campaign.budget.toLocaleString()}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              progress > 90 ? "bg-red-500" : progress > 70 ? "bg-amber-500" : "bg-emerald-500"
            }`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {/* Metrics */}
      {campaign.metrics && (
        <div className="grid grid-cols-3 gap-3 mb-4 py-3 border-t border-white/10">
          <div>
            <p className="text-xs text-white/50">Reach</p>
            <p className="text-sm font-semibold text-white">{campaign.metrics.reach.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-white/50">Clicks</p>
            <p className="text-sm font-semibold text-white">{campaign.metrics.clicks.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs text-white/50">Conversions</p>
            <p className="text-sm font-semibold text-white">{campaign.metrics.conversions}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <GlassButton variant="ghost" size="sm" onClick={onViewAnalytics} className="flex-1">
          Analytics
        </GlassButton>
        {campaign.status === "active" && (
          <GlassButton variant="ghost" size="sm" onClick={onPause}>
            Pause
          </GlassButton>
        )}
        <GlassButton variant="ghost" size="sm" onClick={onEdit}>
          Edit
        </GlassButton>
      </div>
    </GlassCard>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CAMPAIGN WIZARD COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */

function CampaignWizard({
  open,
  onClose,
  onComplete,
}: {
  open: boolean;
  onClose: () => void;
  onComplete: (data: WizardData) => void;
}) {
  const [step, setStep] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [products, setProducts] = React.useState<Product[]>([]);
  const [inventoryData, setInventoryData] = React.useState<Map<string, number>>(new Map());
  const { addToast } = useToast();

  const [data, setData] = React.useState<WizardData>({
    promotionType: "",
    selectedProducts: [],
    customPromotionDescription: "",
    goalType: "",
    targetMetric: 0,
    targetRevenue: 0,
    timelineType: "fixed",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    targetAudience: {
      ageRange: "25-45",
      gender: "all",
      location: "",
      interests: [],
    },
    selectedChannels: [],
    totalBudget: 1000,
    budgetPeriod: "monthly",
    spendLimit: 0,
    keyMessage: "",
    toneOfVoice: "professional",
    additionalNotes: "",
    aiGenerated: false,
    recommendations: undefined,
    selectedStrategy: undefined,
  });

  // Load products and inventory
  React.useEffect(() => {
    if (!open) return;

    async function loadData() {
      try {
        const [productsRes, inventoryRes] = await Promise.all([
          apiGet<{ items: Array<{ id: string; sku: string; name: string; defaultSalesPrice: string }> }>(
            "/api/master/products?limit=100"
          ),
          apiGet<{ items: Array<{ productId: string; available: string }> }>(
            "/api/reports/inventory/balances?limit=100"
          ).catch(() => ({ items: [] })),
        ]);

        setProducts(
          productsRes.items.map((p) => ({
            id: p.id,
            name: p.name,
            sku: p.sku,
            price: parseFloat(p.defaultSalesPrice || "0"),
          }))
        );

        const invMap = new Map<string, number>();
        inventoryRes.items.forEach((item) => {
          invMap.set(item.productId, parseFloat(item.available || "0"));
        });
        setInventoryData(invMap);
      } catch (err) {
        console.error("Failed to load products:", err);
      }
    }
    loadData();
  }, [open]);

  const updateData = (updates: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  };

  const generateAIRecommendations = async () => {
    setLoading(true);

    // Simulate AI processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const baseReach = data.totalBudget * 50;
    const baseConversions = Math.round(data.totalBudget * 0.02);

    const recommendations: AIRecommendation[] = [
      {
        id: "primary",
        name: "Balanced Growth Strategy",
        type: "primary",
        description: "A well-rounded approach that balances reach, engagement, and conversions across your selected channels.",
        projectedReach: baseReach,
        estimatedConversions: baseConversions,
        budgetBreakdown: data.selectedChannels.map((ch, i) => ({
          channel: ch,
          amount: Math.round(data.totalBudget / data.selectedChannels.length),
          percentage: Math.round(100 / data.selectedChannels.length),
        })),
        riskLevel: "medium",
        reasoning: "Based on your goals and budget, this strategy provides the optimal balance between brand visibility and direct response marketing. It allocates resources proportionally across channels to maximize overall performance.",
        tactics: [
          "Launch awareness campaigns in week 1-2",
          "Retarget engaged users with conversion campaigns",
          "A/B test creative variations weekly",
          "Optimize based on early performance data",
        ],
      },
      {
        id: "conservative",
        name: "Safe & Steady Approach",
        type: "conservative",
        description: "Lower risk strategy focusing on proven channels and gradual scaling based on results.",
        projectedReach: baseReach * 0.7,
        estimatedConversions: Math.round(baseConversions * 1.2),
        budgetBreakdown: data.selectedChannels.slice(0, 2).map((ch, i) => ({
          channel: ch,
          amount: Math.round((data.totalBudget * (i === 0 ? 0.6 : 0.4))),
          percentage: i === 0 ? 60 : 40,
        })),
        riskLevel: "low",
        reasoning: "This approach prioritizes conversion efficiency over reach. By focusing budget on fewer, more proven channels, we minimize waste and ensure better ROI tracking.",
        tactics: [
          "Start with small daily budgets",
          "Focus on bottom-funnel messaging",
          "Scale only what works",
          "Weekly optimization reviews",
        ],
      },
      {
        id: "aggressive",
        name: "Aggressive Growth Push",
        type: "aggressive",
        description: "High-impact strategy designed for rapid market penetration and maximum visibility.",
        projectedReach: baseReach * 1.5,
        estimatedConversions: Math.round(baseConversions * 0.8),
        budgetBreakdown: data.selectedChannels.map((ch, i) => ({
          channel: ch,
          amount: Math.round(data.totalBudget * (i === 0 ? 0.5 : 0.5 / (data.selectedChannels.length - 1))),
          percentage: i === 0 ? 50 : Math.round(50 / (data.selectedChannels.length - 1)),
        })),
        riskLevel: "high",
        reasoning: "This strategy maximizes reach and brand awareness quickly. Best suited when you need to establish market presence fast or capitalize on a time-sensitive opportunity.",
        tactics: [
          "Launch on all channels simultaneously",
          "Higher frequency, broader targeting",
          "Bold creative messaging",
          "Daily performance monitoring",
        ],
      },
      {
        id: "brand",
        name: "Brand Building Focus",
        type: "brand",
        description: "Long-term strategy emphasizing brand equity, recognition, and customer loyalty.",
        projectedReach: baseReach * 1.2,
        estimatedConversions: Math.round(baseConversions * 0.6),
        budgetBreakdown: [
          { channel: "instagram", amount: Math.round(data.totalBudget * 0.4), percentage: 40 },
          { channel: "facebook", amount: Math.round(data.totalBudget * 0.3), percentage: 30 },
          { channel: "email", amount: Math.round(data.totalBudget * 0.3), percentage: 30 },
        ],
        riskLevel: "medium",
        reasoning: "Building brand equity pays dividends long-term. This strategy invests in storytelling and community building, creating lasting customer relationships.",
        tactics: [
          "Develop compelling brand story content",
          "Build and nurture email list",
          "Engage with community consistently",
          "Measure brand sentiment monthly",
        ],
      },
    ];

    updateData({
      aiGenerated: true,
      recommendations,
      selectedStrategy: "primary",
    });
    setLoading(false);
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      // Here you would save to the API
      await new Promise((resolve) => setTimeout(resolve, 1000));
      onComplete(data);
      addToast("success", "Campaign created successfully!");
    } catch (err) {
      addToast("error", "Failed to create campaign");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  const totalSteps = 7;
  const progress = (step / totalSteps) * 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm overflow-y-auto py-8">
      <div className="w-full max-w-2xl mx-4 my-auto">
        <GlassCard className="relative">
          {/* Progress bar */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-white/10 rounded-t-2xl overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-6 pt-4">
            <div>
              <h2 className="text-xl font-bold text-white">Create Campaign</h2>
              <p className="text-sm text-white/50">Step {step} of {totalSteps}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 text-white/50 hover:bg-white/10 hover:text-white transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Step Content */}
          <div className="min-h-[400px]">
            {/* Step 1: What to Promote */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-white mb-2">What would you like to promote?</h3>
                  <p className="text-sm text-white/60">Select what you want to market to your audience</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {[
                    { value: "product", label: "Specific Products", icon: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" },
                    { value: "service", label: "Services", icon: "M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" },
                    { value: "brand", label: "Brand / Business", icon: "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" },
                    { value: "event", label: "Event / Promotion", icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => updateData({ promotionType: option.value as WizardData["promotionType"] })}
                      className={`p-4 rounded-xl text-left transition-all ${
                        data.promotionType === option.value
                          ? "bg-blue-500/20 border-2 border-blue-500/50 ring-2 ring-blue-500/20"
                          : "bg-white/5 border-2 border-transparent hover:bg-white/10"
                      }`}
                    >
                      <svg className="w-8 h-8 text-blue-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d={option.icon} />
                      </svg>
                      <h4 className="font-medium text-white">{option.label}</h4>
                    </button>
                  ))}
                </div>

                {data.promotionType === "product" && products.length > 0 && (
                  <div className="mt-4">
                    <label className="text-xs font-medium text-white/70 mb-2 block">Select Products</label>
                    <div className="max-h-48 overflow-y-auto space-y-2 rounded-xl bg-white/5 p-3">
                      {products.map((product) => {
                        const stock = inventoryData.get(product.id) || 0;
                        const isSelected = data.selectedProducts.includes(product.id);
                        return (
                          <button
                            key={product.id}
                            onClick={() => {
                              updateData({
                                selectedProducts: isSelected
                                  ? data.selectedProducts.filter((id) => id !== product.id)
                                  : [...data.selectedProducts, product.id],
                              });
                            }}
                            className={`w-full p-3 rounded-lg text-left transition-all flex items-center justify-between ${
                              isSelected
                                ? "bg-blue-500/20 border border-blue-500/50"
                                : "bg-white/5 border border-transparent hover:bg-white/10"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                isSelected ? "border-blue-500 bg-blue-500" : "border-white/30"
                              }`}>
                                {isSelected && (
                                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                              </div>
                              <div>
                                <span className="text-sm font-medium text-white">{product.name}</span>
                                <span className="text-xs text-white/40 ml-2">{product.sku}</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm text-white">${product.price.toLocaleString()}</p>
                              <p className={`text-xs ${stock > 10 ? "text-emerald-400" : stock > 0 ? "text-amber-400" : "text-red-400"}`}>
                                {stock > 0 ? `${stock} in stock` : "Out of stock"}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(data.promotionType === "brand" || data.promotionType === "event") && (
                  <GlassTextarea
                    label="Describe what you're promoting"
                    value={data.customPromotionDescription}
                    onChange={(e) => updateData({ customPromotionDescription: e.target.value })}
                    placeholder="Tell us about your business, event, or promotion..."
                    rows={3}
                  />
                )}
              </div>
            )}

            {/* Step 2: Campaign Goals */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-white mb-2">What's your goal?</h3>
                  <p className="text-sm text-white/60">Define what success looks like for this campaign</p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {GOAL_OPTIONS.map((goal) => (
                    <button
                      key={goal.value}
                      onClick={() => updateData({ goalType: goal.value as WizardData["goalType"] })}
                      className={`p-4 rounded-xl text-left transition-all flex items-center gap-4 ${
                        data.goalType === goal.value
                          ? "bg-blue-500/20 border-2 border-blue-500/50"
                          : "bg-white/5 border-2 border-transparent hover:bg-white/10"
                      }`}
                    >
                      <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d={goal.icon} />
                        </svg>
                      </div>
                      <div>
                        <h4 className="font-medium text-white">{goal.label}</h4>
                        <p className="text-xs text-white/50">{goal.description}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {data.goalType && (
                  <div className="grid grid-cols-2 gap-4 mt-4">
                    <GlassInput
                      label={data.goalType === "sales" ? "Target Revenue ($)" : data.goalType === "leads" ? "Target Leads" : "Target Reach"}
                      type="number"
                      value={data.targetMetric || ""}
                      onChange={(e) => updateData({ targetMetric: Number(e.target.value) })}
                      placeholder="Enter target"
                    />
                    <GlassSelect
                      label="Timeline"
                      value={data.timelineType}
                      onChange={(e) => updateData({ timelineType: e.target.value as "ongoing" | "fixed" })}
                      options={[
                        { value: "fixed", label: "Fixed Duration" },
                        { value: "ongoing", label: "Ongoing" },
                      ]}
                    />
                  </div>
                )}

                {data.timelineType === "fixed" && (
                  <div className="grid grid-cols-2 gap-4">
                    <GlassInput
                      label="Start Date"
                      type="date"
                      value={data.startDate}
                      onChange={(e) => updateData({ startDate: e.target.value })}
                    />
                    <GlassInput
                      label="End Date"
                      type="date"
                      value={data.endDate}
                      onChange={(e) => updateData({ endDate: e.target.value })}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Audience & Channels */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-white mb-2">Who's your audience?</h3>
                  <p className="text-sm text-white/60">Define your target audience and preferred channels</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <GlassSelect
                    label="Age Range"
                    value={data.targetAudience.ageRange}
                    onChange={(e) => updateData({ targetAudience: { ...data.targetAudience, ageRange: e.target.value } })}
                    options={[
                      { value: "18-24", label: "18-24" },
                      { value: "25-34", label: "25-34" },
                      { value: "25-45", label: "25-45" },
                      { value: "35-44", label: "35-44" },
                      { value: "45-54", label: "45-54" },
                      { value: "55+", label: "55+" },
                      { value: "all", label: "All ages" },
                    ]}
                  />
                  <GlassSelect
                    label="Gender"
                    value={data.targetAudience.gender}
                    onChange={(e) => updateData({ targetAudience: { ...data.targetAudience, gender: e.target.value } })}
                    options={[
                      { value: "all", label: "All genders" },
                      { value: "male", label: "Male" },
                      { value: "female", label: "Female" },
                    ]}
                  />
                </div>

                <GlassInput
                  label="Location (optional)"
                  value={data.targetAudience.location}
                  onChange={(e) => updateData({ targetAudience: { ...data.targetAudience, location: e.target.value } })}
                  placeholder="City, country, or region"
                />

                <div>
                  <label className="text-xs font-medium text-white/70 mb-2 block">Select Channels</label>
                  <p className="text-xs text-white/40 mb-3">Choose where you want to run your campaign. AI will suggest optimal allocation.</p>
                  <div className="grid grid-cols-4 gap-2">
                    {AVAILABLE_CHANNELS.map((channel) => {
                      const isSelected = data.selectedChannels.includes(channel.id);
                      return (
                        <button
                          key={channel.id}
                          onClick={() => {
                            updateData({
                              selectedChannels: isSelected
                                ? data.selectedChannels.filter((id) => id !== channel.id)
                                : [...data.selectedChannels, channel.id],
                            });
                          }}
                          className={`p-3 rounded-xl flex flex-col items-center gap-2 transition-all ${
                            isSelected
                              ? "bg-white/15 border-2 border-white/30 ring-2 ring-white/10"
                              : "bg-white/5 border-2 border-transparent hover:bg-white/10"
                          }`}
                        >
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{ backgroundColor: `${channel.color}20` }}
                          >
                            <svg className="w-4 h-4" fill={channel.color} viewBox="0 0 24 24">
                              <path d={channel.icon} />
                            </svg>
                          </div>
                          <span className="text-xs text-white/80 text-center leading-tight">{channel.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <GlassCard className="!bg-blue-500/10 border-blue-500/20 !p-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    <p className="text-xs text-blue-300">
                      AI will analyze your selection and recommend the best channel mix based on your goals and budget.
                    </p>
                  </div>
                </GlassCard>
              </div>
            )}

            {/* Step 4: Budget */}
            {step === 4 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-white mb-2">Set your budget</h3>
                  <p className="text-sm text-white/60">Define how much you want to invest in this campaign</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <GlassInput
                    label="Total Budget ($)"
                    type="number"
                    value={data.totalBudget || ""}
                    onChange={(e) => updateData({ totalBudget: Number(e.target.value) })}
                    placeholder="Enter budget"
                  />
                  <GlassSelect
                    label="Budget Period"
                    value={data.budgetPeriod}
                    onChange={(e) => updateData({ budgetPeriod: e.target.value as WizardData["budgetPeriod"] })}
                    options={[
                      { value: "daily", label: "Daily" },
                      { value: "weekly", label: "Weekly" },
                      { value: "monthly", label: "Monthly" },
                      { value: "total", label: "Total Campaign" },
                    ]}
                  />
                </div>

                <div className="flex gap-2">
                  {[500, 1000, 2500, 5000, 10000].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => updateData({ totalBudget: amount })}
                      className={`flex-1 py-2 px-3 rounded-xl text-sm transition-all ${
                        data.totalBudget === amount
                          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                          : "bg-white/5 text-white/60 border border-transparent hover:bg-white/10"
                      }`}
                    >
                      ${amount >= 1000 ? `${amount / 1000}k` : amount}
                    </button>
                  ))}
                </div>

                <GlassInput
                  label="Daily Spend Limit (optional)"
                  type="number"
                  value={data.spendLimit || ""}
                  onChange={(e) => updateData({ spendLimit: Number(e.target.value) })}
                  placeholder="Max daily spend"
                />

                {data.totalBudget > 0 && data.selectedChannels.length > 0 && (
                  <GlassCard className="!bg-white/5">
                    <h4 className="text-sm font-medium text-white/70 mb-3">Estimated Allocation</h4>
                    <div className="space-y-2">
                      {data.selectedChannels.map((channelId) => {
                        const channel = AVAILABLE_CHANNELS.find((c) => c.id === channelId);
                        const allocation = Math.round(data.totalBudget / data.selectedChannels.length);
                        const percentage = Math.round(100 / data.selectedChannels.length);
                        return (
                          <div key={channelId} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div
                                className="w-6 h-6 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: `${channel?.color}20` }}
                              >
                                <svg className="w-3 h-3" fill={channel?.color} viewBox="0 0 24 24">
                                  <path d={channel?.icon} />
                                </svg>
                              </div>
                              <span className="text-sm text-white/80">{channel?.name}</span>
                            </div>
                            <span className="text-sm text-white font-medium">
                              ${allocation.toLocaleString()} ({percentage}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-white/40 mt-3">
                      AI will optimize this allocation based on performance
                    </p>
                  </GlassCard>
                )}
              </div>
            )}

            {/* Step 5: Creative Direction */}
            {step === 5 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-white mb-2">Creative Direction</h3>
                  <p className="text-sm text-white/60">Help AI understand your brand voice (optional)</p>
                </div>

                <GlassTextarea
                  label="Key Message / Value Proposition"
                  value={data.keyMessage}
                  onChange={(e) => updateData({ keyMessage: e.target.value })}
                  placeholder="What's the main message you want to communicate? e.g., 'Quality products at affordable prices' or 'Fast delivery, no hassle returns'"
                  rows={3}
                />

                <GlassSelect
                  label="Tone of Voice"
                  value={data.toneOfVoice}
                  onChange={(e) => updateData({ toneOfVoice: e.target.value })}
                  options={TONE_OPTIONS}
                />

                <GlassTextarea
                  label="Additional Notes / Requirements"
                  value={data.additionalNotes}
                  onChange={(e) => updateData({ additionalNotes: e.target.value })}
                  placeholder="Any specific requirements, constraints, or ideas you want to include..."
                  rows={3}
                />

                <GlassCard className="!bg-purple-500/10 border-purple-500/20 !p-3">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-purple-300">
                      These details help AI generate more relevant recommendations. You can always edit the final plan.
                    </p>
                  </div>
                </GlassCard>
              </div>
            )}

            {/* Step 6: AI Recommendations */}
            {step === 6 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-white mb-2">AI Recommendations</h3>
                  <p className="text-sm text-white/60">
                    {data.aiGenerated
                      ? "Select a strategy that fits your needs"
                      : "Generate AI-powered campaign strategies"}
                  </p>
                </div>

                {!data.aiGenerated ? (
                  <div className="text-center py-8">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                      <svg className="w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-medium text-white mb-2">Ready to generate your plan</h4>
                    <p className="text-sm text-white/50 mb-6 max-w-sm mx-auto">
                      Our AI will analyze your inputs and create multiple strategy options optimized for different outcomes.
                    </p>
                    <GlassButton
                      variant="primary"
                      size="lg"
                      onClick={generateAIRecommendations}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Spinner size="sm" />
                          <span className="ml-2">Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                          </svg>
                          Generate AI Recommendations
                        </>
                      )}
                    </GlassButton>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {data.recommendations?.map((rec) => {
                      const isSelected = data.selectedStrategy === rec.id;
                      const riskColors = {
                        low: "text-emerald-400 bg-emerald-500/20",
                        medium: "text-amber-400 bg-amber-500/20",
                        high: "text-red-400 bg-red-500/20",
                      };
                      const typeLabels = {
                        primary: "Recommended",
                        conservative: "Safe Choice",
                        aggressive: "High Growth",
                        brand: "Long-term",
                      };

                      return (
                        <button
                          key={rec.id}
                          onClick={() => updateData({ selectedStrategy: rec.id })}
                          className={`w-full p-4 rounded-xl text-left transition-all ${
                            isSelected
                              ? "bg-blue-500/20 border-2 border-blue-500/50 ring-2 ring-blue-500/20"
                              : "bg-white/5 border-2 border-transparent hover:bg-white/10"
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-semibold text-white">{rec.name}</h4>
                                {rec.type === "primary" && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
                                    {typeLabels[rec.type]}
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-white/60">{rec.description}</p>
                            </div>
                            <span className={`text-xs px-2 py-1 rounded-lg ${riskColors[rec.riskLevel]}`}>
                              {rec.riskLevel} risk
                            </span>
                          </div>

                          <div className="grid grid-cols-3 gap-3 mb-3 py-3 border-t border-white/10">
                            <div>
                              <p className="text-xs text-white/50">Est. Reach</p>
                              <p className="text-sm font-semibold text-white">{rec.projectedReach.toLocaleString()}</p>
                            </div>
                            <div>
                              <p className="text-xs text-white/50">Est. Conversions</p>
                              <p className="text-sm font-semibold text-white">{rec.estimatedConversions}</p>
                            </div>
                            <div>
                              <p className="text-xs text-white/50">Budget Split</p>
                              <p className="text-sm font-semibold text-white">{rec.budgetBreakdown.length} channels</p>
                            </div>
                          </div>

                          {isSelected && (
                            <div className="pt-3 border-t border-white/10">
                              <p className="text-xs text-white/70 mb-2">{rec.reasoning}</p>
                              <div className="flex flex-wrap gap-1">
                                {rec.tactics.slice(0, 3).map((tactic, i) => (
                                  <span key={i} className="text-xs px-2 py-1 rounded-lg bg-white/10 text-white/60">
                                    {tactic}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Step 7: Review & Launch */}
            {step === 7 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h3 className="text-lg font-semibold text-white mb-2">Review & Launch</h3>
                  <p className="text-sm text-white/60">Review your campaign before launching</p>
                </div>

                <GlassCard className="!bg-white/5">
                  <div className="space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs text-white/50">Promotion</p>
                        <p className="text-sm text-white">
                          {data.promotionType === "product"
                            ? `${data.selectedProducts.length} product(s)`
                            : data.promotionType || "Not specified"}
                        </p>
                      </div>
                      <button className="text-xs text-blue-400 hover:text-blue-300" onClick={() => setStep(1)}>
                        Edit
                      </button>
                    </div>

                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs text-white/50">Goal</p>
                        <p className="text-sm text-white capitalize">
                          {data.goalType || "Not specified"}
                          {data.targetMetric ? ` - Target: ${data.targetMetric.toLocaleString()}` : ""}
                        </p>
                      </div>
                      <button className="text-xs text-blue-400 hover:text-blue-300" onClick={() => setStep(2)}>
                        Edit
                      </button>
                    </div>

                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs text-white/50">Channels</p>
                        <p className="text-sm text-white">{data.selectedChannels.length} channels selected</p>
                      </div>
                      <button className="text-xs text-blue-400 hover:text-blue-300" onClick={() => setStep(3)}>
                        Edit
                      </button>
                    </div>

                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs text-white/50">Budget</p>
                        <p className="text-sm text-white">
                          ${data.totalBudget.toLocaleString()} / {data.budgetPeriod}
                        </p>
                      </div>
                      <button className="text-xs text-blue-400 hover:text-blue-300" onClick={() => setStep(4)}>
                        Edit
                      </button>
                    </div>

                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs text-white/50">Strategy</p>
                        <p className="text-sm text-white">
                          {data.recommendations?.find((r) => r.id === data.selectedStrategy)?.name || "Not selected"}
                        </p>
                      </div>
                      <button className="text-xs text-blue-400 hover:text-blue-300" onClick={() => setStep(6)}>
                        Edit
                      </button>
                    </div>

                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs text-white/50">Duration</p>
                        <p className="text-sm text-white">
                          {data.timelineType === "ongoing"
                            ? "Ongoing"
                            : `${data.startDate} to ${data.endDate}`}
                        </p>
                      </div>
                      <button className="text-xs text-blue-400 hover:text-blue-300" onClick={() => setStep(2)}>
                        Edit
                      </button>
                    </div>
                  </div>
                </GlassCard>

                {data.selectedStrategy && data.recommendations && (
                  <GlassCard className="!bg-emerald-500/10 border-emerald-500/20">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-emerald-500/20">
                        <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-emerald-400 mb-1">Ready to Launch</h4>
                        <p className="text-sm text-white/80">
                          Estimated reach: {data.recommendations.find((r) => r.id === data.selectedStrategy)?.projectedReach.toLocaleString()}
                        </p>
                        <p className="text-xs text-white/50">
                          Estimated conversions: {data.recommendations.find((r) => r.id === data.selectedStrategy)?.estimatedConversions}
                        </p>
                      </div>
                    </div>
                  </GlassCard>
                )}
              </div>
            )}
          </div>

          {/* Footer Navigation */}
          <div className="flex gap-3 mt-6 pt-4 border-t border-white/10">
            {step > 1 && (
              <GlassButton variant="ghost" onClick={() => setStep(step - 1)} disabled={loading}>
                Back
              </GlassButton>
            )}
            <div className="flex-1" />
            {step < 6 && (
              <GlassButton
                variant="primary"
                onClick={() => setStep(step + 1)}
                disabled={
                  (step === 1 && !data.promotionType) ||
                  (step === 2 && !data.goalType) ||
                  (step === 3 && data.selectedChannels.length === 0)
                }
              >
                Continue
              </GlassButton>
            )}
            {step === 6 && data.aiGenerated && (
              <GlassButton
                variant="primary"
                onClick={() => setStep(7)}
                disabled={!data.selectedStrategy}
              >
                Review Campaign
              </GlassButton>
            )}
            {step === 7 && (
              <div className="flex gap-2">
                <GlassButton variant="ghost" onClick={handleComplete} disabled={loading}>
                  Save as Draft
                </GlassButton>
                <GlassButton variant="primary" onClick={handleComplete} disabled={loading}>
                  {loading ? <Spinner size="sm" /> : "Launch Campaign"}
                </GlassButton>
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   CHANNEL CONNECTION MODAL
   ═══════════════════════════════════════════════════════════════════════════ */

// Provider auth methods
const PROVIDER_AUTH_METHODS: Record<string, "oauth2" | "api_key"> = {
  instagram: "oauth2",
  facebook: "oauth2",
  google_ads: "oauth2",
  tiktok: "oauth2",
  linkedin: "oauth2",
  email: "api_key",
  sms: "api_key",
  whatsapp: "api_key",
};

// API key field configurations
const API_KEY_FIELDS: Record<string, { label: string; placeholder: string; fields: { name: string; label: string; placeholder: string; required: boolean }[] }> = {
  email: {
    label: "SendGrid API Key",
    placeholder: "SG.xxxxx",
    fields: [
      { name: "apiKey", label: "API Key", placeholder: "SG.xxxxx", required: true },
    ],
  },
  sms: {
    label: "Twilio Credentials",
    placeholder: "",
    fields: [
      { name: "accountSid", label: "Account SID", placeholder: "ACxxxxx", required: true },
      { name: "apiKey", label: "Auth Token", placeholder: "Your auth token", required: true },
      { name: "phoneNumber", label: "Phone Number", placeholder: "+1234567890", required: false },
    ],
  },
  whatsapp: {
    label: "WhatsApp Business API",
    placeholder: "",
    fields: [
      { name: "accountSid", label: "Account SID", placeholder: "ACxxxxx", required: true },
      { name: "apiKey", label: "Auth Token", placeholder: "Your auth token", required: true },
      { name: "phoneNumberId", label: "Phone Number ID", placeholder: "Your phone number ID", required: false },
    ],
  },
};

function ChannelConnectionModal({
  channel,
  onClose,
  onConnect,
}: {
  channel: Omit<Channel, "connected" | "metrics"> | null;
  onClose: () => void;
  onConnect: (channelId: string) => void;
}) {
  const [loading, setLoading] = React.useState(false);
  const [apiKeyValues, setApiKeyValues] = React.useState<Record<string, string>>({});
  const [showOAuthConfig, setShowOAuthConfig] = React.useState(false);
  const [oauthProvider, setOauthProvider] = React.useState<string | null>(null);
  const [oauthCreds, setOauthCreds] = React.useState({ clientId: "", clientSecret: "" });
  const { addToast } = useToast();

  if (!channel) return null;

  const authMethod = PROVIDER_AUTH_METHODS[channel.id] || "oauth2";
  const apiKeyConfig = API_KEY_FIELDS[channel.id];

  const handleConnect = async () => {
    setLoading(true);

    try {
      const response = await apiPost<{
        success: boolean;
        authUrl?: string;
        channelId?: string;
        error?: string;
        needsConfiguration?: boolean;
        provider?: string;
      }>(
        `/api/marketing/channels/oauth/${channel.id}/connect`,
        authMethod === "api_key"
          ? {
              apiKey: apiKeyValues.apiKey,
              additionalConfig: {
                accountSid: apiKeyValues.accountSid,
                phoneNumber: apiKeyValues.phoneNumber,
                phoneNumberId: apiKeyValues.phoneNumberId,
              },
            }
          : {}
      );

      if (response.error) {
        if (response.needsConfiguration && response.provider) {
          // Show OAuth configuration form
          setOauthProvider(response.provider);
          setShowOAuthConfig(true);
          setLoading(false);
          return;
        }
        addToast("error", response.error);
        setLoading(false);
        return;
      }

      if (authMethod === "oauth2" && response.authUrl) {
        // Redirect to OAuth provider
        window.location.href = response.authUrl;
        return;
      }

      if (response.success && response.channelId) {
        onConnect(response.channelId);
        addToast("success", `${channel.name} connected successfully!`);
        onClose();
      }
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "Failed to connect");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOAuthConfig = async () => {
    if (!oauthProvider || !oauthCreds.clientId || !oauthCreds.clientSecret) {
      addToast("error", "Please enter both Client ID and Client Secret");
      return;
    }

    setLoading(true);
    try {
      const response = await apiPut<{ success: boolean; error?: string }>("/api/settings/oauth", {
        provider: oauthProvider,
        clientId: oauthCreds.clientId,
        clientSecret: oauthCreds.clientSecret,
      });

      if (response.error) {
        addToast("error", response.error);
        setLoading(false);
        return;
      }

      addToast("success", "OAuth credentials saved! Now connecting...");
      setShowOAuthConfig(false);
      setOauthCreds({ clientId: "", clientSecret: "" });

      // Retry the connection
      await handleConnect();
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "Failed to save credentials");
      setLoading(false);
    }
  };

  const isApiKeyValid = () => {
    if (authMethod !== "api_key" || !apiKeyConfig) return true;
    return apiKeyConfig.fields
      .filter((f) => f.required)
      .every((f) => apiKeyValues[f.name]?.trim());
  };

  // OAuth Configuration Form
  if (showOAuthConfig && oauthProvider) {
    const providerNames: Record<string, string> = {
      meta: "Meta (Instagram/Facebook)",
      google: "Google",
      tiktok: "TikTok",
      linkedin: "LinkedIn",
    };
    const providerSetupUrls: Record<string, string> = {
      meta: "https://developers.facebook.com/apps/",
      google: "https://console.cloud.google.com/apis/credentials",
      tiktok: "https://developers.tiktok.com/apps/",
      linkedin: "https://www.linkedin.com/developers/apps",
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
        <div className="w-full max-w-md mx-4">
          <GlassCard>
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-blue-500/20">
                <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Configure {providerNames[oauthProvider] || oauthProvider}</h3>
              <p className="text-sm text-white/60">
                Enter your OAuth App credentials to connect {channel.name}
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <GlassCard className="!bg-blue-500/10 border-blue-500/20 !p-3">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-xs text-blue-300">
                    <p className="mb-1">Create an app at:</p>
                    <a
                      href={providerSetupUrls[oauthProvider]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline break-all"
                    >
                      {providerSetupUrls[oauthProvider]}
                    </a>
                  </div>
                </div>
              </GlassCard>

              <GlassInput
                label="Client ID (App ID)"
                type="text"
                value={oauthCreds.clientId}
                onChange={(e) => setOauthCreds((prev) => ({ ...prev, clientId: e.target.value }))}
                placeholder="Enter your Client ID"
              />

              <GlassInput
                label="Client Secret (App Secret)"
                type="password"
                value={oauthCreds.clientSecret}
                onChange={(e) => setOauthCreds((prev) => ({ ...prev, clientSecret: e.target.value }))}
                placeholder="Enter your Client Secret"
              />

              <GlassCard className="!bg-amber-500/10 border-amber-500/20 !p-3">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <p className="text-xs text-amber-300">
                    Credentials are encrypted and stored securely. Only you can access your connected accounts.
                  </p>
                </div>
              </GlassCard>
            </div>

            <div className="flex gap-3">
              <GlassButton
                variant="ghost"
                className="flex-1"
                onClick={() => {
                  setShowOAuthConfig(false);
                  setOauthCreds({ clientId: "", clientSecret: "" });
                }}
              >
                Back
              </GlassButton>
              <GlassButton
                variant="primary"
                className="flex-1"
                onClick={handleSaveOAuthConfig}
                disabled={loading || !oauthCreds.clientId || !oauthCreds.clientSecret}
              >
                {loading ? <Spinner size="sm" /> : "Save & Connect"}
              </GlassButton>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md mx-4">
        <GlassCard>
          <div className="text-center mb-6">
            <div
              className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: `${channel.color}20` }}
            >
              <svg className="w-8 h-8" fill={channel.color} viewBox="0 0 24 24">
                <path d={channel.icon} />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Connect {channel.name}</h3>
            <p className="text-sm text-white/60">
              {authMethod === "oauth2"
                ? `Link your ${channel.name} account to track performance and run campaigns`
                : `Enter your ${channel.name} API credentials to enable integration`}
            </p>
          </div>

          {authMethod === "api_key" && apiKeyConfig ? (
            <div className="space-y-4 mb-6">
              {apiKeyConfig.fields.map((field) => (
                <GlassInput
                  key={field.name}
                  label={field.label}
                  type={field.name === "apiKey" ? "password" : "text"}
                  value={apiKeyValues[field.name] || ""}
                  onChange={(e) =>
                    setApiKeyValues((prev) => ({ ...prev, [field.name]: e.target.value }))
                  }
                  placeholder={field.placeholder}
                />
              ))}
              <GlassCard className="!bg-amber-500/10 border-amber-500/20 !p-3">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-xs text-amber-300">
                    Your credentials are encrypted and stored securely. We never share them with third parties.
                  </p>
                </div>
              </GlassCard>
            </div>
          ) : (
            <GlassCard className="!bg-white/5 mb-6">
              <h4 className="text-sm font-medium text-white/70 mb-3">What you'll get:</h4>
              <ul className="space-y-2 text-sm text-white/60">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Automatic analytics sync
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  Create and manage ads
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  AI-powered optimization
                </li>
              </ul>
            </GlassCard>
          )}

          <div className="flex gap-3">
            <GlassButton variant="ghost" className="flex-1" onClick={onClose}>
              Cancel
            </GlassButton>
            <GlassButton
              variant="primary"
              className="flex-1"
              onClick={handleConnect}
              disabled={loading || !isApiKeyValid()}
            >
              {loading ? (
                <Spinner size="sm" />
              ) : authMethod === "oauth2" ? (
                <>
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Connect with {channel.name}
                </>
              ) : (
                "Save & Connect"
              )}
            </GlassButton>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN MARKETING PAGE
   ═══════════════════════════════════════════════════════════════════════════ */

function MarketingPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { addToast } = useToast();

  const [analytics, setAnalytics] = React.useState<AnalyticsData>({
    totalReach: 125400,
    reachTrend: 12.5,
    engagementRate: 4.8,
    engagementTrend: -2.1,
    conversionRate: 2.4,
    conversionTrend: 8.3,
    activeCampaigns: 3,
    budgetSpent: 2840,
    budgetTotal: 5000,
    roi: 3.2,
  });

  // Store connected channels: provider ID -> database channel ID
  const [connectedChannels, setConnectedChannels] = React.useState<Set<string>>(new Set());
  const [channelDbIds, setChannelDbIds] = React.useState<Map<string, string>>(new Map());
  const [channelMetrics, setChannelMetrics] = React.useState<Map<string, Channel["metrics"]>>(new Map());
  const [loadingChannels, setLoadingChannels] = React.useState(true);
  const [disconnecting, setDisconnecting] = React.useState<string | null>(null);

  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);

  const [showWizard, setShowWizard] = React.useState(false);
  const [connectingChannel, setConnectingChannel] = React.useState<Omit<Channel, "connected" | "metrics"> | null>(null);

  // Fetch connected channels from API
  const fetchConnectedChannels = React.useCallback(async () => {
    try {
      const response = await apiGet<{ items: ConnectedChannelData[]; total: number }>(
        "/api/marketing/channels?status=connected"
      );

      if (response.items) {
        const providerIds = new Set<string>();
        const dbIdMap = new Map<string, string>();

        response.items.forEach((channel) => {
          if (channel.integrationProvider) {
            providerIds.add(channel.integrationProvider);
            dbIdMap.set(channel.integrationProvider, channel.id);
          }
        });

        setConnectedChannels(providerIds);
        setChannelDbIds(dbIdMap);
      }
    } catch (error) {
      console.error("Failed to fetch channels:", error);
    } finally {
      setLoadingChannels(false);
    }
  }, []);

  // Handle OAuth callback params
  React.useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const provider = searchParams.get("provider");

    if (success === "true" && provider) {
      addToast("success", `${provider.charAt(0).toUpperCase() + provider.slice(1)} connected successfully!`);
      // Refresh channels
      fetchConnectedChannels();
      // Clean up URL params
      router.replace("/marketing");
    } else if (error) {
      addToast("error", decodeURIComponent(error));
      router.replace("/marketing");
    }
  }, [searchParams, addToast, fetchConnectedChannels, router]);

  // Fetch channels on mount
  React.useEffect(() => {
    fetchConnectedChannels();
  }, [fetchConnectedChannels]);

  const handleConnectChannel = (providerId: string) => {
    // Refresh to get the new channel from API
    fetchConnectedChannels();
  };

  const handleDisconnectChannel = async (providerId: string) => {
    const dbId = channelDbIds.get(providerId);
    if (!dbId) {
      addToast("error", "Channel not found");
      return;
    }

    setDisconnecting(providerId);

    try {
      const response = await apiDelete<{ success: boolean; deleted: boolean; error?: string }>(
        `/api/marketing/channels/${dbId}`
      );

      if (response.deleted) {
        setConnectedChannels((prev) => {
          const newSet = new Set(prev);
          newSet.delete(providerId);
          return newSet;
        });
        setChannelDbIds((prev) => {
          const newMap = new Map(prev);
          newMap.delete(providerId);
          return newMap;
        });
        addToast("success", "Channel disconnected");
      } else if (response.error) {
        addToast("error", response.error);
      }
    } catch (error) {
      addToast("error", error instanceof Error ? error.message : "Failed to disconnect channel");
    } finally {
      setDisconnecting(null);
    }
  };

  const handleWizardComplete = (data: WizardData) => {
    // Create campaign from wizard data
    const newCampaign: Campaign = {
      id: Date.now().toString(),
      name: `Campaign - ${data.goalType || "Custom"}`,
      status: "active",
      budget: data.totalBudget,
      spent: 0,
      startDate: data.startDate,
      endDate: data.endDate,
      channels: data.selectedChannels,
      metrics: { reach: 0, clicks: 0, conversions: 0 },
    };
    setCampaigns((prev) => [newCampaign, ...prev]);
    setShowWizard(false);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Marketing</h1>
          <p className="text-sm text-white/50 mt-1">
            Manage campaigns, track performance, and grow your business
          </p>
        </div>
        <GlassButton variant="primary" onClick={() => setShowWizard(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create Campaign
        </GlassButton>
      </div>

      {/* Analytics Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Performance Overview</h2>
          <GlassSelect
            value="30d"
            onChange={() => {}}
            options={[
              { value: "7d", label: "Last 7 days" },
              { value: "30d", label: "Last 30 days" },
              { value: "90d", label: "Last 90 days" },
            ]}
            className="!w-36"
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCard
            label="Total Reach"
            value={analytics.totalReach}
            trend="up"
            trendValue={`+${analytics.reachTrend}%`}
            color="blue"
          />
          <MetricCard
            label="Engagement"
            value={`${analytics.engagementRate}%`}
            trend={analytics.engagementTrend > 0 ? "up" : "down"}
            trendValue={`${analytics.engagementTrend > 0 ? "+" : ""}${analytics.engagementTrend}%`}
            color="purple"
          />
          <MetricCard
            label="Conversion"
            value={`${analytics.conversionRate}%`}
            trend="up"
            trendValue={`+${analytics.conversionTrend}%`}
            color="green"
          />
          <MetricCard
            label="Active"
            value={analytics.activeCampaigns}
            color="amber"
          />
          <MetricCard
            label="Budget Used"
            value={`$${analytics.budgetSpent}`}
            trend="neutral"
            trendValue={`of $${analytics.budgetTotal}`}
            color="red"
          />
          <MetricCard
            label="ROI"
            value={`${analytics.roi}x`}
            trend="up"
            trendValue="+0.4x"
            color="green"
          />
        </div>
      </section>

      {/* Channels Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Marketing Channels</h2>
            <p className="text-sm text-white/50">Connect your accounts to track performance</p>
          </div>
        </div>
        {loadingChannels ? (
          <div className="flex items-center justify-center py-12">
            <Spinner size="lg" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-4">
            {AVAILABLE_CHANNELS.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                connected={connectedChannels.has(channel.id)}
                metrics={channelMetrics.get(channel.id)}
                disconnecting={disconnecting === channel.id}
                onConnect={() => setConnectingChannel(channel)}
                onDisconnect={() => handleDisconnectChannel(channel.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Campaigns Section */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Active Campaigns</h2>
            <p className="text-sm text-white/50">{campaigns.length} campaigns running</p>
          </div>
          <GlassButton variant="ghost" size="sm">
            View All
          </GlassButton>
        </div>

        {campaigns.length === 0 ? (
          <GlassCard>
            <EmptyState
              icon={
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3" />
                </svg>
              }
              title="No campaigns yet"
              description="Create your first campaign to start reaching customers"
              action={
                <GlassButton variant="primary" onClick={() => setShowWizard(true)}>
                  Create Campaign
                </GlassButton>
              }
            />
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onEdit={() => addToast("info", "Edit campaign coming soon")}
                onPause={() => {
                  setCampaigns((prev) =>
                    prev.map((c) => (c.id === campaign.id ? { ...c, status: "paused" as const } : c))
                  );
                  addToast("success", "Campaign paused");
                }}
                onViewAnalytics={() => addToast("info", "Analytics view coming soon")}
              />
            ))}
          </div>
        )}
      </section>

      {/* Campaign Wizard Modal */}
      <CampaignWizard
        open={showWizard}
        onClose={() => setShowWizard(false)}
        onComplete={handleWizardComplete}
      />

      {/* Channel Connection Modal */}
      <ChannelConnectionModal
        channel={connectingChannel}
        onClose={() => setConnectingChannel(null)}
        onConnect={handleConnectChannel}
      />
    </div>
  );
}

// Wrap in Suspense for useSearchParams
export default function MarketingPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><Spinner size="lg" /></div>}>
      <MarketingPageContent />
    </Suspense>
  );
}
