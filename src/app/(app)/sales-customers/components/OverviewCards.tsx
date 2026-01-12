"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { GlassCard, Spinner } from "@/components/ui/glass";
import { apiGet } from "@/lib/http";

interface CardData {
  id: string;
  title: string;
  description: string;
  value: string | number;
  action: { type: "filter" | "navigate"; tab?: string; filter?: Record<string, string>; href?: string };
}

interface LeadStats {
  total: number;
  new: number;
  contacted: number;
  qualified: number;
}

interface QuoteStats {
  total: number;
  draft: number;
  sent: number;
  expiringSoon: number;
}

interface InvoiceStats {
  total: number;
  mtdCount: number;
  mtdAmount: number;
}

export function OverviewCards() {
  const router = useRouter();
  const [loading, setLoading] = React.useState(true);
  const [cards, setCards] = React.useState<CardData[]>([]);

  React.useEffect(() => {
    async function loadData() {
      try {
        // Fetch stats from multiple endpoints in parallel
        const [leadsRes, quotesRes, invoicesRes] = await Promise.allSettled([
          apiGet<LeadStats>("/api/sales-customers/leads/stats"),
          apiGet<QuoteStats>("/api/sales-customers/quotes/stats"),
          apiGet<InvoiceStats>("/api/sales-customers/invoices/stats"),
        ]);

        const leadStats = leadsRes.status === "fulfilled" ? leadsRes.value : { total: 0, new: 0, contacted: 0, qualified: 0 };
        const quoteStats = quotesRes.status === "fulfilled" ? quotesRes.value : { total: 0, draft: 0, sent: 0, expiringSoon: 0 };
        const invoiceStats = invoicesRes.status === "fulfilled" ? invoicesRes.value : { total: 0, mtdCount: 0, mtdAmount: 0 };

        const cardList: CardData[] = [
          {
            id: "new_leads",
            title: "New Leads",
            description: "People who contacted you recently and need a response.",
            value: leadStats.new,
            action: { type: "filter", tab: "leads", filter: { status: "new" } },
          },
          {
            id: "followups_due",
            title: "Follow-ups Due",
            description: "Leads and quotes that need a follow-up soon.",
            value: leadStats.contacted + leadStats.qualified,
            action: { type: "filter", tab: "leads", filter: { status: "contacted,qualified" } },
          },
          {
            id: "quotes_waiting",
            title: "Quotes Waiting",
            description: "Quotes you sent that are still waiting for an answer.",
            value: quoteStats.sent,
            action: { type: "filter", tab: "quotes", filter: { status: "sent" } },
          },
          {
            id: "quotes_expiring",
            title: "Quotes Expiring",
            description: "Quotes expiring soon so you can renew or follow up.",
            value: quoteStats.expiringSoon,
            action: { type: "filter", tab: "quotes", filter: { status: "expiring" } },
          },
          {
            id: "sales_created",
            title: "Sales Created",
            description: "Invoices created this month (confirmed sales).",
            value: invoiceStats.mtdCount,
            action: { type: "filter", tab: "invoices", filter: { period: "mtd" } },
          },
        ];

        setCards(cardList);
      } catch {
        // Show empty cards on error
        setCards([]);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleCardClick = (card: CardData) => {
    if (card.action.type === "filter" && card.action.tab) {
      const params = new URLSearchParams();
      params.set("tab", card.action.tab);
      if (card.action.filter) {
        Object.entries(card.action.filter).forEach(([key, value]) => {
          params.set(key, value);
        });
      }
      router.push(`/sales-customers?${params.toString()}`);
    } else if (card.action.type === "navigate" && card.action.href) {
      router.push(card.action.href);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="md" />
      </div>
    );
  }

  if (cards.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {cards.map((card) => (
        <GlassCard
          key={card.id}
          className="hover:bg-white/10 transition-colors cursor-pointer"
          onClick={() => handleCardClick(card)}
        >
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-white text-sm">{card.title}</h3>
              <span className="text-2xl font-bold text-white">{card.value}</span>
            </div>
            <p className="text-xs text-white/50 flex-1">{card.description}</p>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}
