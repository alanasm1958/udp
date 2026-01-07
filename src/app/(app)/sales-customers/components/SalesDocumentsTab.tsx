"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import {
  GlassCard,
  GlassTable,
  GlassBadge,
  GlassInput,
  GlassSelect,
  Spinner,
  useToast,
} from "@/components/ui/glass";
import { apiGet, formatCurrency, formatDate } from "@/lib/http";

interface SalesDoc {
  id: string;
  docNumber: string;
  docType: string;
  docDate: string;
  dueDate: string | null;
  partyId: string;
  partyName?: string;
  status: string;
  totalAmount: string;
  notes: string | null;
}

interface Lead {
  id: string;
  contactName: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  source: string | null;
  estimatedValue: string | null;
  createdAt: string;
}

interface SalesDocsResponse {
  items: SalesDoc[];
  total: number;
}

interface LeadsResponse {
  items: Lead[];
  total: number;
}

const DOC_TYPE_VARIANTS: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  invoice: "info",
  quote: "success",
  order: "warning",
};

const LEAD_STATUS_VARIANTS: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  new: "default",
  contacted: "info",
  qualified: "warning",
  disqualified: "danger",
  won: "success",
  lost: "danger",
};

const STATUS_VARIANTS: Record<string, "default" | "success" | "warning" | "danger"> = {
  draft: "default",
  sent: "warning",
  posted: "success",
  cancelled: "danger",
};

type ViewType = "all" | "invoices" | "quotes" | "leads";

interface SalesDocumentsTabProps {
  initialView?: ViewType;
}

export function SalesDocumentsTab({ initialView = "all" }: SalesDocumentsTabProps) {
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const [viewType, setViewType] = React.useState<ViewType>(initialView);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("all");
  const [docs, setDocs] = React.useState<SalesDoc[]>([]);
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [loading, setLoading] = React.useState(true);

  // Sync viewType with URL parameter or initialView prop
  React.useEffect(() => {
    const viewParam = searchParams.get("view");
    if (viewParam && ["all", "invoices", "quotes", "leads"].includes(viewParam)) {
      setViewType(viewParam as ViewType);
    } else if (initialView) {
      setViewType(initialView);
    }
  }, [searchParams, initialView]);

  React.useEffect(() => {
    loadData();
  }, [viewType, statusFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (viewType === "leads" || viewType === "all") {
        const leadsRes = await apiGet<LeadsResponse>("/api/sales-customers/leads");
        setLeads(leadsRes.items || []);
      } else {
        setLeads([]);
      }

      if (viewType !== "leads") {
        const docTypeFilter = viewType === "invoices" ? "invoice" : viewType === "quotes" ? "quote" : undefined;
        let url = "/api/sales/docs";
        const params = new URLSearchParams();
        if (docTypeFilter) params.set("type", docTypeFilter);
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (params.toString()) url += `?${params.toString()}`;

        const docsRes = await apiGet<SalesDocsResponse>(url);
        setDocs(docsRes.items || []);
      } else {
        setDocs([]);
      }
    } catch (error) {
      addToast("error", "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const filteredDocs = React.useMemo(() => {
    let filtered = docs;
    if (searchQuery) {
      filtered = filtered.filter(
        (d) =>
          d.docNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.partyName?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered;
  }, [docs, searchQuery]);

  const filteredLeads = React.useMemo(() => {
    let filtered = leads;
    if (searchQuery) {
      filtered = filtered.filter(
        (l) =>
          l.contactName.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          l.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter((l) => l.status === statusFilter);
    }
    return filtered;
  }, [leads, searchQuery, statusFilter]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <GlassCard padding="sm">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <GlassInput
              placeholder="Search by number, customer, or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <GlassSelect
              value={viewType}
              onChange={(e) => setViewType(e.target.value as ViewType)}
              options={[
                { value: "all", label: "All" },
                { value: "invoices", label: "Invoices" },
                { value: "quotes", label: "Quotes" },
                { value: "leads", label: "Leads" },
              ]}
            />
            {viewType !== "leads" && (
              <GlassSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: "all", label: "All Status" },
                  { value: "draft", label: "Draft" },
                  { value: "sent", label: "Sent" },
                  { value: "posted", label: "Posted" },
                ]}
              />
            )}
            {viewType === "leads" && (
              <GlassSelect
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                options={[
                  { value: "all", label: "All Status" },
                  { value: "new", label: "New" },
                  { value: "contacted", label: "Contacted" },
                  { value: "qualified", label: "Qualified" },
                  { value: "won", label: "Won" },
                  { value: "lost", label: "Lost" },
                ]}
              />
            )}
          </div>
        </div>
      </GlassCard>

      {/* Documents Table */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      ) : viewType === "leads" || viewType === "all" ? (
        <>
          {viewType === "all" && filteredDocs.length > 0 && (
            <GlassCard>
              <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-4">
                Sales Documents
              </h3>
              <GlassTable
                headers={["Number", "Type", "Customer", "Date", "Status", "Amount"]}
                rows={filteredDocs.map((d) => [
                  d.docNumber,
                  <GlassBadge key={`type-${d.id}`} variant={DOC_TYPE_VARIANTS[d.docType] || "default"}>
                    {d.docType}
                  </GlassBadge>,
                  d.partyName || "-",
                  formatDate(d.docDate),
                  <GlassBadge key={`status-${d.id}`} variant={STATUS_VARIANTS[d.status] || "default"}>
                    {d.status}
                  </GlassBadge>,
                  formatCurrency(parseFloat(d.totalAmount)),
                ])}
              />
            </GlassCard>
          )}

          {(viewType === "leads" || viewType === "all") && filteredLeads.length > 0 && (
            <GlassCard>
              <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide mb-4">
                Leads
              </h3>
              <GlassTable
                headers={["Contact", "Company", "Email", "Status", "Value", "Created"]}
                rows={filteredLeads.map((l) => [
                  l.contactName,
                  l.company || "-",
                  l.email || "-",
                  <GlassBadge key={`status-${l.id}`} variant={LEAD_STATUS_VARIANTS[l.status] || "default"}>
                    {l.status}
                  </GlassBadge>,
                  l.estimatedValue ? formatCurrency(parseFloat(l.estimatedValue)) : "-",
                  formatDate(l.createdAt),
                ])}
              />
            </GlassCard>
          )}

          {filteredDocs.length === 0 && filteredLeads.length === 0 && (
            <GlassCard>
              <div className="text-center py-12">
                <p className="text-white/50">No items found</p>
              </div>
            </GlassCard>
          )}
        </>
      ) : (
        <GlassCard>
          <GlassTable
            headers={["Number", "Type", "Customer", "Date", "Status", "Amount"]}
            rows={filteredDocs.map((d) => [
              d.docNumber,
              <GlassBadge key={`type-${d.id}`} variant={DOC_TYPE_VARIANTS[d.docType] || "default"}>
                {d.docType}
              </GlassBadge>,
              d.partyName || "-",
              formatDate(d.docDate),
              <GlassBadge key={`status-${d.id}`} variant={STATUS_VARIANTS[d.status] || "default"}>
                {d.status}
              </GlassBadge>,
              formatCurrency(parseFloat(d.totalAmount)),
            ])}
          />
        </GlassCard>
      )}
    </div>
  );
}
