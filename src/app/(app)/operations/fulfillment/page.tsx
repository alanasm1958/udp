"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  GlassCard,
  GlassButton,
  GlassTable,
  GlassBadge,
  GlassTabs,
  PageHeader,
  Spinner,
  SkeletonTable,
  SlideOver,
  useToast,
} from "@/components/ui/glass";
import { apiGet, formatCurrency, formatDate } from "@/lib/http";

interface SalesDoc {
  id: string;
  docNumber: string;
  docType: string;
  status: string;
  partyId: string | null;
  partyName?: string;
  docDate: string;
  totalAmount: string;
}

interface SalesLine {
  id: string;
  lineNo: number;
  productId: string;
  productName?: string;
  productSku?: string;
  qty: number;
  reservedQty: number;
  shippedQty: number;
  unitPrice: string;
}

interface Fulfillment {
  id: string;
  salesDocId: string;
  salesLineId: string;
  type: "reservation" | "shipment";
  qty: number;
  status: string;
  createdAt: string;
  warehouseId?: string;
  warehouseName?: string;
}

const tabs = [
  { id: "pending", label: "Pending" },
  { id: "reserved", label: "Reserved" },
  { id: "shipped", label: "Shipped" },
  { id: "all", label: "All Orders" },
];

function FulfillmentContent() {
  const searchParams = useSearchParams();
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = React.useState("pending");
  const [docs, setDocs] = React.useState<SalesDoc[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [selectedDoc, setSelectedDoc] = React.useState<SalesDoc | null>(null);
  const [lines, setLines] = React.useState<SalesLine[]>([]);
  const [fulfillments, setFulfillments] = React.useState<Fulfillment[]>([]);
  const [linesLoading, setLinesLoading] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);

  // Sync tab from URL
  React.useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && tabs.some((t) => t.id === tab)) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Load orders
  const loadDocs = React.useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<{ items: SalesDoc[] }>("/api/sales/docs?status=posted&limit=100");
      setDocs(data.items || []);
    } catch {
      // Silently handle
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadDocs();
  }, [loadDocs]);

  // Load order lines when selected
  const loadOrderDetails = async (doc: SalesDoc) => {
    setSelectedDoc(doc);
    setLinesLoading(true);
    try {
      const [linesRes, fulfillRes] = await Promise.all([
        apiGet<{ items: SalesLine[] }>(`/api/sales/docs/${doc.id}/lines`),
        apiGet<{ items: Fulfillment[] }>(`/api/sales/docs/${doc.id}/fulfillments`),
      ]);
      setLines(linesRes.items || []);
      setFulfillments(fulfillRes.items || []);
    } catch {
      setLines([]);
      setFulfillments([]);
    } finally {
      setLinesLoading(false);
    }
  };

  // Reserve inventory action
  const handleReserve = async (line: SalesLine) => {
    if (!selectedDoc) return;
    const toReserve = line.qty - line.reservedQty;
    if (toReserve <= 0) {
      addToast("info", "All units already reserved");
      return;
    }

    setActionLoading(`reserve-${line.id}`);
    try {
      const res = await fetch(`/api/sales/docs/${selectedDoc.id}/lines/${line.id}/reserve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qty: toReserve }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reserve");
      }

      addToast("success", `Reserved ${toReserve} units`);
      loadOrderDetails(selectedDoc);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Reserve failed");
    } finally {
      setActionLoading(null);
    }
  };

  // Ship action
  const handleShip = async (line: SalesLine) => {
    if (!selectedDoc) return;
    const toShip = line.reservedQty - line.shippedQty;
    if (toShip <= 0) {
      addToast("info", "No reserved units to ship");
      return;
    }

    setActionLoading(`ship-${line.id}`);
    try {
      const res = await fetch(`/api/sales/docs/${selectedDoc.id}/lines/${line.id}/ship`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qty: toShip }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to ship");
      }

      addToast("success", `Shipped ${toShip} units`);
      loadOrderDetails(selectedDoc);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Ship failed");
    } finally {
      setActionLoading(null);
    }
  };

  // Get fulfillment status for a doc
  const getDocFulfillmentStatus = (doc: SalesDoc): "pending" | "reserved" | "partial" | "shipped" => {
    // Mock implementation - in production, aggregate from lines
    const amount = parseFloat(doc.totalAmount);
    if (amount > 10000) return "shipped";
    if (amount > 5000) return "partial";
    if (amount > 1000) return "reserved";
    return "pending";
  };

  // Filter docs based on tab
  const filteredDocs = docs.filter((doc) => {
    const status = getDocFulfillmentStatus(doc);
    switch (activeTab) {
      case "pending":
        return status === "pending";
      case "reserved":
        return status === "reserved" || status === "partial";
      case "shipped":
        return status === "shipped";
      default:
        return true;
    }
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "shipped":
        return <GlassBadge variant="success">Shipped</GlassBadge>;
      case "reserved":
        return <GlassBadge variant="info">Reserved</GlassBadge>;
      case "partial":
        return <GlassBadge variant="warning">Partial</GlassBadge>;
      default:
        return <GlassBadge variant="default">Pending</GlassBadge>;
    }
  };

  const getLineStatus = (line: SalesLine) => {
    if (line.shippedQty >= line.qty) return "shipped";
    if (line.reservedQty >= line.qty) return "reserved";
    if (line.reservedQty > 0 || line.shippedQty > 0) return "partial";
    return "pending";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fulfillment"
        description="Order fulfillment, reservations, and shipments"
        actions={
          <Link
            href="/sales"
            className="px-4 py-2 text-sm bg-white/10 hover:bg-white/15 text-white rounded-lg transition-colors"
          >
            View All Orders
          </Link>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard padding="sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/50 uppercase">Pending</p>
              <p className="text-2xl font-bold text-white">{docs.filter((d) => getDocFulfillmentStatus(d) === "pending").length}</p>
            </div>
            <div className="p-2 rounded-lg bg-amber-500/20">
              <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </GlassCard>

        <GlassCard padding="sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/50 uppercase">Reserved</p>
              <p className="text-2xl font-bold text-blue-400">{docs.filter((d) => getDocFulfillmentStatus(d) === "reserved").length}</p>
            </div>
            <div className="p-2 rounded-lg bg-blue-500/20">
              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </GlassCard>

        <GlassCard padding="sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/50 uppercase">Partial</p>
              <p className="text-2xl font-bold text-purple-400">{docs.filter((d) => getDocFulfillmentStatus(d) === "partial").length}</p>
            </div>
            <div className="p-2 rounded-lg bg-purple-500/20">
              <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
              </svg>
            </div>
          </div>
        </GlassCard>

        <GlassCard padding="sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-white/50 uppercase">Shipped</p>
              <p className="text-2xl font-bold text-emerald-400">{docs.filter((d) => getDocFulfillmentStatus(d) === "shipped").length}</p>
            </div>
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
              </svg>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Tabs */}
      <GlassTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Orders Table */}
      <GlassCard padding="none">
        {loading ? (
          <div className="p-6">
            <SkeletonTable rows={5} columns={6} />
          </div>
        ) : filteredDocs.length > 0 ? (
          <GlassTable
            headers={["Order #", "Date", "Customer", "Amount", "Status", ""]}
            monospaceColumns={[0]}
            rightAlignColumns={[3]}
            rows={filteredDocs.map((doc) => [
              doc.docNumber,
              formatDate(doc.docDate),
              doc.partyName || "-",
              formatCurrency(parseFloat(doc.totalAmount)),
              getStatusBadge(getDocFulfillmentStatus(doc)),
              <GlassButton
                key={doc.id}
                size="sm"
                variant="ghost"
                onClick={() => loadOrderDetails(doc)}
              >
                Fulfill
              </GlassButton>,
            ])}
            emptyMessage="No orders found"
          />
        ) : (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/20 flex items-center justify-center">
              <svg className="w-8 h-8 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">
              {activeTab === "pending" ? "No Pending Orders" : "No Orders Found"}
            </h3>
            <p className="text-white/50">
              {activeTab === "pending"
                ? "All orders have been processed."
                : "No orders in this category."}
            </p>
          </div>
        )}
      </GlassCard>

      {/* Order Detail SlideOver */}
      <SlideOver
        open={!!selectedDoc}
        onClose={() => setSelectedDoc(null)}
        title={`Fulfill Order ${selectedDoc?.docNumber || ""}`}
      >
        {selectedDoc && (
          <div className="space-y-6">
            {/* Order Summary */}
            <div className="p-4 rounded-lg bg-white/5">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-white/50">Customer</span>
                  <p className="text-white font-medium">{selectedDoc.partyName || "-"}</p>
                </div>
                <div>
                  <span className="text-white/50">Order Date</span>
                  <p className="text-white font-medium">{formatDate(selectedDoc.docDate)}</p>
                </div>
                <div>
                  <span className="text-white/50">Total Amount</span>
                  <p className="text-white font-medium">{formatCurrency(parseFloat(selectedDoc.totalAmount))}</p>
                </div>
                <div>
                  <span className="text-white/50">Status</span>
                  <p>{getStatusBadge(getDocFulfillmentStatus(selectedDoc))}</p>
                </div>
              </div>
            </div>

            {/* Lines */}
            <div>
              <h4 className="text-sm font-medium text-white mb-3">Order Lines</h4>
              {linesLoading ? (
                <SkeletonTable rows={3} columns={5} />
              ) : lines.length > 0 ? (
                <div className="space-y-3">
                  {lines.map((line) => {
                    const lineStatus = getLineStatus(line);
                    const canReserve = line.reservedQty < line.qty;
                    const canShip = line.reservedQty > line.shippedQty;

                    return (
                      <div
                        key={line.id}
                        className="p-4 rounded-lg bg-white/5 border border-white/10"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-white font-medium">{line.productName || "Product"}</p>
                            <p className="text-xs text-white/50 font-mono">{line.productSku || line.productId}</p>
                          </div>
                          {getStatusBadge(lineStatus)}
                        </div>

                        {/* Progress bars */}
                        <div className="space-y-2 mb-4">
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-white/50">Reserved</span>
                              <span className="text-white">{line.reservedQty} / {line.qty}</span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 transition-all"
                                style={{ width: `${(line.reservedQty / line.qty) * 100}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-white/50">Shipped</span>
                              <span className="text-white">{line.shippedQty} / {line.qty}</span>
                            </div>
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 transition-all"
                                style={{ width: `${(line.shippedQty / line.qty) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                          <GlassButton
                            size="sm"
                            variant="primary"
                            disabled={!canReserve || actionLoading === `reserve-${line.id}`}
                            onClick={() => handleReserve(line)}
                          >
                            {actionLoading === `reserve-${line.id}` ? (
                              <Spinner size="sm" />
                            ) : (
                              <>
                                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                </svg>
                                Reserve ({line.qty - line.reservedQty})
                              </>
                            )}
                          </GlassButton>
                          <GlassButton
                            size="sm"
                            variant="primary"
                            disabled={!canShip || actionLoading === `ship-${line.id}`}
                            onClick={() => handleShip(line)}
                          >
                            {actionLoading === `ship-${line.id}` ? (
                              <Spinner size="sm" />
                            ) : (
                              <>
                                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
                                </svg>
                                Ship ({line.reservedQty - line.shippedQty})
                              </>
                            )}
                          </GlassButton>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-white/50 text-sm">No lines found for this order.</p>
              )}
            </div>

            {/* Fulfillment History */}
            {fulfillments.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-white mb-3">Fulfillment History</h4>
                <div className="space-y-2">
                  {fulfillments.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between p-3 rounded-lg bg-white/5 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        {f.type === "reservation" ? (
                          <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-xs">Reserved</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-xs">Shipped</span>
                        )}
                        <span className="text-white">{f.qty} units</span>
                      </div>
                      <span className="text-white/40">{formatDate(f.createdAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </SlideOver>
    </div>
  );
}

export default function FulfillmentPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>}>
      <FulfillmentContent />
    </Suspense>
  );
}
