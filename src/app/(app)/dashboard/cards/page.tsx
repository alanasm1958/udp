"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GlassCard, PageHeader, GlassBadge, Spinner, SlideOver, GlassInput, GlassSelect, GlassTextarea, GlassButton, useToast } from "@/components/ui/glass";
import { apiGet, formatDateTime } from "@/lib/http";

const CARDS_DISMISSED_KEY = "udp-cards-dismissed";
const CARDS_SNOOZED_KEY = "udp-cards-snoozed";
const CUSTOM_CARDS_KEY = "udp-custom-cards";

interface AICard {
  id: string;
  type: "metric_snapshot" | "task_suggestion" | "document_summary" | "recommendation";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  domain: "finance" | "sales" | "procurement" | "inventory" | "operations" | "general";
  createdAt: string;
  data: Record<string, unknown>;
  actions: Array<{
    label: string;
    type: "navigate" | "create_task" | "dismiss" | "snooze";
    href?: string;
    payload?: Record<string, unknown>;
  }>;
}

interface CardsResponse {
  items: AICard[];
  total: number;
  generatedAt: string;
}

const typeLabels: Record<AICard["type"], string> = {
  metric_snapshot: "Metric",
  task_suggestion: "Task",
  document_summary: "Summary",
  recommendation: "Recommendation",
};

const typeColors: Record<AICard["type"], string> = {
  metric_snapshot: "bg-blue-500/20 text-blue-400",
  task_suggestion: "bg-purple-500/20 text-purple-400",
  document_summary: "bg-emerald-500/20 text-emerald-400",
  recommendation: "bg-amber-500/20 text-amber-400",
};

const priorityColors = {
  high: "danger",
  medium: "warning",
  low: "info",
} as const;

const domainIcons: Record<string, React.ReactNode> = {
  finance: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
    </svg>
  ),
  sales: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  ),
  procurement: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
  ),
  inventory: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  ),
  operations: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  general: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  ),
};

interface PendingCard {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  domain: string;
  type: AICard["type"];
  source: string;
  alertId?: string;
}

interface NewCardForm {
  title: string;
  description: string;
  type: AICard["type"];
  priority: "high" | "medium" | "low";
  domain: string;
}

const defaultNewCard: NewCardForm = {
  title: "",
  description: "",
  type: "task_suggestion",
  priority: "medium",
  domain: "general",
};

const domainToPlannerUrl: Record<string, string> = {
  finance: "/finance",
  sales: "/sales",
  procurement: "/procurement",
  inventory: "/inventory",
  operations: "/operations",
  marketing: "/marketing",
  customers: "/customers",
  grc: "/grc",
  strategy: "/strategy",
  general: "/strategy",
};

function CardStudioPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { addToast } = useToast();
  const [cards, setCards] = React.useState<AICard[]>([]);
  const [customCards, setCustomCards] = React.useState<AICard[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [generatedAt, setGeneratedAt] = React.useState<string | null>(null);
  const [dismissedIds, setDismissedIds] = React.useState<Set<string>>(new Set());
  const [snoozedCards, setSnoozedCards] = React.useState<Map<string, number>>(new Map());
  const [filter, setFilter] = React.useState<AICard["type"] | "all">("all");
  const [expandedCardId, setExpandedCardId] = React.useState<string | null>(null);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [newCard, setNewCard] = React.useState<NewCardForm>(defaultNewCard);

  // Load dismissed/snoozed/custom cards from localStorage
  React.useEffect(() => {
    try {
      const dismissed = localStorage.getItem(CARDS_DISMISSED_KEY);
      if (dismissed) {
        setDismissedIds(new Set(JSON.parse(dismissed)));
      }
      const snoozed = localStorage.getItem(CARDS_SNOOZED_KEY);
      if (snoozed) {
        const parsed = JSON.parse(snoozed);
        const now = Date.now();
        const validSnoozes = new Map<string, number>();
        for (const [id, expiry] of Object.entries(parsed)) {
          if ((expiry as number) > now) {
            validSnoozes.set(id, expiry as number);
          }
        }
        setSnoozedCards(validSnoozes);
      }
      const custom = localStorage.getItem(CUSTOM_CARDS_KEY);
      if (custom) {
        setCustomCards(JSON.parse(custom));
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Check for ?create=true query param and pending card from alerts
  React.useEffect(() => {
    if (searchParams.get("create") === "true") {
      // Check for pending card from alerts
      try {
        const pending = sessionStorage.getItem("udp-pending-card");
        if (pending) {
          const parsedPending: PendingCard = JSON.parse(pending);
          setNewCard({
            title: parsedPending.title,
            description: parsedPending.description,
            type: parsedPending.type || "task_suggestion",
            priority: parsedPending.priority,
            domain: parsedPending.domain || "general",
          });
          sessionStorage.removeItem("udp-pending-card");
        }
      } catch {
        // Ignore errors
      }
      setCreateOpen(true);
    }
  }, [searchParams]);

  React.useEffect(() => {
    async function loadData() {
      try {
        const data = await apiGet<CardsResponse>("/api/ai/cards");
        setCards(data.items || []);
        setGeneratedAt(data.generatedAt);
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleDismiss = (cardId: string) => {
    const newDismissed = new Set(dismissedIds).add(cardId);
    setDismissedIds(newDismissed);
    try {
      localStorage.setItem(CARDS_DISMISSED_KEY, JSON.stringify(Array.from(newDismissed)));
    } catch {
      // Ignore localStorage errors
    }
    addToast("success", "Card dismissed");
  };

  const handleSnooze = (cardId: string, days: number = 7) => {
    const expiry = Date.now() + days * 24 * 60 * 60 * 1000;
    const newSnoozed = new Map(snoozedCards).set(cardId, expiry);
    setSnoozedCards(newSnoozed);
    try {
      localStorage.setItem(CARDS_SNOOZED_KEY, JSON.stringify(Object.fromEntries(newSnoozed)));
    } catch {
      // Ignore localStorage errors
    }
    addToast("info", `Card snoozed for ${days} days`);
  };

  const handleCreateCard = () => {
    if (!newCard.title.trim()) {
      addToast("error", "Card title is required");
      return;
    }

    const card: AICard = {
      id: `custom-${Date.now()}`,
      type: newCard.type,
      title: newCard.title,
      description: newCard.description,
      priority: newCard.priority,
      domain: newCard.domain as AICard["domain"],
      createdAt: new Date().toISOString(),
      data: { custom: true },
      actions: [
        { label: "Dismiss", type: "dismiss" },
      ],
    };

    const newCustomCards = [...customCards, card];
    setCustomCards(newCustomCards);
    try {
      localStorage.setItem(CUSTOM_CARDS_KEY, JSON.stringify(newCustomCards));
    } catch {
      // Ignore localStorage errors
    }

    setNewCard(defaultNewCard);
    setCreateOpen(false);
    addToast("success", "Card created successfully");
  };

  const handleDeleteCustomCard = (cardId: string) => {
    const newCustomCards = customCards.filter((c) => c.id !== cardId);
    setCustomCards(newCustomCards);
    try {
      localStorage.setItem(CUSTOM_CARDS_KEY, JSON.stringify(newCustomCards));
    } catch {
      // Ignore localStorage errors
    }
    addToast("success", "Card deleted");
  };

  const handleCreateTask = (card: AICard) => {
    // Save task to sessionStorage and navigate to the domain planner
    try {
      sessionStorage.setItem("udp-pending-task", JSON.stringify({
        title: card.title,
        description: card.description,
        priority: card.priority,
        source: "card",
        cardId: card.id,
      }));
    } catch {
      // Ignore storage errors
    }

    const plannerUrl = domainToPlannerUrl[card.domain] || "/strategy";
    addToast("success", "Task created! Opening planner...");

    // Dismiss the card since we're creating a task from it
    handleDismiss(card.id);

    // Navigate to the planner (with planner tab active)
    setTimeout(() => {
      router.push(`${plannerUrl}?tab=planner`);
    }, 300);
  };

  // Combine AI cards with custom cards, filter dismissed and snoozed
  const allCards = [...cards, ...customCards];
  const filteredCards = allCards
    .filter((card) => !dismissedIds.has(card.id))
    .filter((card) => {
      const snoozeExpiry = snoozedCards.get(card.id);
      if (snoozeExpiry && snoozeExpiry > Date.now()) return false;
      return true;
    })
    .filter((card) => filter === "all" || card.type === filter);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  const typeCounts = allCards.reduce(
    (acc, card) => {
      if (!dismissedIds.has(card.id) && !snoozedCards.has(card.id)) {
        acc[card.type] = (acc[card.type] || 0) + 1;
      }
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI Card Studio"
        description="AI-generated insights and recommendations"
        actions={
          <div className="flex items-center gap-4">
            {generatedAt && (
              <span className="text-xs text-white/40">
                Generated: {formatDateTime(generatedAt)}
              </span>
            )}
            <GlassButton onClick={() => setCreateOpen(true)}>
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Create Card
            </GlassButton>
            <Link
              href="/dashboard"
              className="px-4 py-2 text-sm bg-white/10 hover:bg-white/15 text-white rounded-lg transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        }
      />

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setFilter("all")}
          className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
            filter === "all"
              ? "bg-white/20 text-white"
              : "bg-white/5 text-white/60 hover:bg-white/10"
          }`}
        >
          All ({filteredCards.length})
        </button>
        {(["metric_snapshot", "task_suggestion", "document_summary", "recommendation"] as const).map(
          (type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                filter === type
                  ? "bg-white/20 text-white"
                  : "bg-white/5 text-white/60 hover:bg-white/10"
              }`}
            >
              {typeLabels[type]} ({typeCounts[type] || 0})
            </button>
          )
        )}
      </div>

      {/* Cards Grid */}
      {filteredCards.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCards.map((card) => {
            const isExpanded = expandedCardId === card.id;
            const isCustom = card.id.startsWith("custom-");

            return (
              <GlassCard
                key={card.id}
                className={`flex flex-col hover:bg-white/5 transition-all ${isExpanded ? "md:col-span-2 lg:col-span-3" : ""}`}
              >
                {/* Card Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-lg ${typeColors[card.type]}`}>
                      {domainIcons[card.domain]}
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${typeColors[card.type]}`}>
                      {typeLabels[card.type]}
                    </span>
                    {isCustom && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                        Custom
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <GlassBadge variant={priorityColors[card.priority]}>
                      {card.priority}
                    </GlassBadge>
                    <button
                      onClick={() => setExpandedCardId(isExpanded ? null : card.id)}
                      className="p-1 text-white/40 hover:text-white/60 transition-colors"
                      title={isExpanded ? "Collapse" : "Expand"}
                    >
                      <svg className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Card Content */}
                <h3 className="font-semibold text-white mb-2">{card.title}</h3>
                <p className={`text-sm text-white/60 flex-1 mb-4 ${isExpanded ? "" : "line-clamp-2"}`}>
                  {card.description}
                </p>

                {/* Expanded Data */}
                {isExpanded && card.data && Object.keys(card.data).length > 0 && (
                  <div className="mb-4 p-3 rounded-xl bg-white/5">
                    <h4 className="text-xs font-semibold text-white/50 mb-2">Card Data</h4>
                    <pre className="text-xs text-white/70 overflow-auto">
                      {JSON.stringify(card.data, null, 2)}
                    </pre>
                  </div>
                )}

                {/* Card Actions */}
                <div className="flex flex-wrap gap-2 pt-3 border-t border-white/10">
                  {card.actions.map((action, idx) => {
                    if (action.type === "navigate" && action.href) {
                      return (
                        <Link
                          key={idx}
                          href={action.href}
                          className="px-3 py-1.5 text-xs bg-white/10 hover:bg-white/15 text-white rounded-lg transition-colors"
                        >
                          {action.label}
                        </Link>
                      );
                    }
                    if (action.type === "dismiss") {
                      return (
                        <button
                          key={idx}
                          onClick={() => handleDismiss(card.id)}
                          className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-white/50 rounded-lg transition-colors"
                        >
                          {action.label}
                        </button>
                      );
                    }
                    if (action.type === "snooze") {
                      return (
                        <button
                          key={idx}
                          onClick={() => handleSnooze(card.id)}
                          className="px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 text-white/50 rounded-lg transition-colors"
                        >
                          {action.label}
                        </button>
                      );
                    }
                    if (action.type === "create_task") {
                      return (
                        <button
                          key={idx}
                          onClick={() => handleCreateTask(card)}
                          className="px-3 py-1.5 text-xs bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors"
                        >
                          {action.label}
                        </button>
                      );
                    }
                    return null;
                  })}
                  {isCustom && (
                    <button
                      onClick={() => handleDeleteCustomCard(card.id)}
                      className="px-3 py-1.5 text-xs bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      ) : (
        <GlassCard>
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {filter === "all" ? "No AI Cards" : `No ${typeLabels[filter]} Cards`}
            </h3>
            <p className="text-white/50 mb-4">
              {dismissedIds.size > 0
                ? "All cards have been dismissed. New cards will appear as the system detects insights."
                : "AI-generated insights will appear here based on your business data."}
            </p>
            <GlassButton onClick={() => setCreateOpen(true)}>
              Create Your First Card
            </GlassButton>
          </div>
        </GlassCard>
      )}

      {/* Create Card SlideOver */}
      <SlideOver
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setNewCard(defaultNewCard);
        }}
        title="Create AI Card"
      >
        <div className="space-y-4">
          <GlassInput
            label="Title"
            value={newCard.title}
            onChange={(e) => setNewCard((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Card title"
          />

          <GlassTextarea
            label="Description"
            value={newCard.description}
            onChange={(e) => setNewCard((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="Card description"
            rows={3}
          />

          <GlassSelect
            label="Type"
            value={newCard.type}
            onChange={(e) => setNewCard((prev) => ({ ...prev, type: e.target.value as AICard["type"] }))}
            options={[
              { value: "metric_snapshot", label: "Metric Snapshot" },
              { value: "task_suggestion", label: "Task Suggestion" },
              { value: "document_summary", label: "Document Summary" },
              { value: "recommendation", label: "Recommendation" },
            ]}
          />

          <GlassSelect
            label="Priority"
            value={newCard.priority}
            onChange={(e) => setNewCard((prev) => ({ ...prev, priority: e.target.value as "high" | "medium" | "low" }))}
            options={[
              { value: "high", label: "High" },
              { value: "medium", label: "Medium" },
              { value: "low", label: "Low" },
            ]}
          />

          <GlassSelect
            label="Domain"
            value={newCard.domain}
            onChange={(e) => setNewCard((prev) => ({ ...prev, domain: e.target.value }))}
            options={[
              { value: "finance", label: "Finance" },
              { value: "sales", label: "Sales" },
              { value: "procurement", label: "Procurement" },
              { value: "inventory", label: "Inventory" },
              { value: "operations", label: "Operations" },
              { value: "general", label: "General" },
            ]}
          />

          <div className="flex gap-3 pt-4">
            <GlassButton onClick={handleCreateCard} className="flex-1">
              Create Card
            </GlassButton>
            <GlassButton
              variant="ghost"
              onClick={() => {
                setCreateOpen(false);
                setNewCard(defaultNewCard);
              }}
            >
              Cancel
            </GlassButton>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}

export default function CardStudioPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>}>
      <CardStudioPageContent />
    </Suspense>
  );
}
