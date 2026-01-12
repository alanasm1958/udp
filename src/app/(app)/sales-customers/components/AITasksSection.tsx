"use client";

import * as React from "react";
import { GlassCard, GlassBadge, GlassButton, Spinner, useToast } from "@/components/ui/glass";
import { apiGet } from "@/lib/http";

interface AICard {
    id: string;
    type: string;
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
    domain: string;
    createdAt: string;
    actions: Array<{
        label: string;
        type: "navigate" | "create_task" | "dismiss" | "snooze";
        href?: string;
    }>;
}

interface AICardsResponse {
    items: AICard[];
}

const PRIORITY_VARIANTS: Record<string, "danger" | "warning" | "default"> = {
    high: "danger",
    medium: "warning",
    low: "default",
};

interface AITasksSectionProps {
    onViewAll: () => void;
}

export function AITasksSection({ onViewAll }: AITasksSectionProps) {
    const { addToast } = useToast();
    const [cards, setCards] = React.useState<AICard[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());

    React.useEffect(() => {
        async function loadData() {
            try {
                const data = await apiGet<AICardsResponse>("/api/ai/cards?domain=sales-customers&limit=3");
                setCards(data.items || []);
            } catch {
                setCards([]);
            } finally {
                setLoading(false);
            }
        }
        loadData();

        // Load dismissed from localStorage
        try {
            const savedDismissed = localStorage.getItem("udp-ai-tasks-dismissed");
            if (savedDismissed) {
                setDismissed(new Set(JSON.parse(savedDismissed)));
            }
        } catch {
            // Ignore
        }
    }, []);

    const handleDismiss = (cardId: string) => {
        const newDismissed = new Set(dismissed);
        newDismissed.add(cardId);
        setDismissed(newDismissed);
        localStorage.setItem("udp-ai-tasks-dismissed", JSON.stringify([...newDismissed]));
        addToast("success", "Task dismissed");
    };

    const handleAction = (card: AICard, action: AICard["actions"][0]) => {
        if (action.type === "dismiss") {
            handleDismiss(card.id);
        } else if (action.type === "navigate" && action.href) {
            window.location.href = action.href;
        } else if (action.type === "create_task") {
            addToast("info", "Task creation coming soon");
        } else if (action.type === "snooze") {
            handleDismiss(card.id);
            addToast("success", "Task snoozed for 24 hours");
        }
    };

    const visibleCards = cards.filter((c) => !dismissed.has(c.id)).slice(0, 3);

    if (loading) {
        return (
            <GlassCard padding="sm">
                <div className="flex items-center justify-center py-4">
                    <Spinner size="sm" />
                </div>
            </GlassCard>
        );
    }

    if (visibleCards.length === 0) {
        return null; // Don't show section if no AI tasks
    }

    return (
        <div className="space-y-3">
            {/* Section Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-purple-500/20">
                        <svg className="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                    </div>
                    <h3 className="text-sm font-medium text-white">AI Suggestions</h3>
                    <span className="text-xs text-white/40">({visibleCards.length})</span>
                </div>
                <button
                    onClick={onViewAll}
                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                >
                    View All →
                </button>
            </div>

            {/* Compact Task Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {visibleCards.map((card) => (
                    <GlassCard key={card.id} padding="sm">
                        <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <h4 className="text-sm font-medium text-white truncate">{card.title}</h4>
                                    <GlassBadge variant={PRIORITY_VARIANTS[card.priority]}>
                                        {card.priority}
                                    </GlassBadge>
                                </div>
                                <p className="text-xs text-white/50 line-clamp-2 mb-2">{card.description}</p>
                                <div className="flex flex-wrap gap-1">
                                    {card.actions.slice(0, 2).map((action, idx) => (
                                        <GlassButton
                                            key={idx}
                                            size="sm"
                                            variant={action.type === "dismiss" || action.type === "snooze" ? "ghost" : "primary"}
                                            onClick={() => handleAction(card, action)}
                                        >
                                            {action.label}
                                        </GlassButton>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </GlassCard>
                ))}
            </div>
        </div>
    );
}
