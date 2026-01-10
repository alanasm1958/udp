"use client";

import * as React from "react";
import {
  GlassCard,
  GlassButton,
  GlassBadge,
  GlassSelect,
  GlassTable,
  GlassTextarea,
  SkeletonTable,
  SlideOver,
} from "@/components/ui/glass";
import { apiGet, apiPatch, formatDate } from "@/lib/http";

/* =============================================================================
   TYPES
   ============================================================================= */

interface LinkedEntity {
  entityType: string;
  entityId: string;
  linkType: string;
  name?: string;
}

interface HRDocument {
  id: string;
  storageKey: string;
  originalFilename: string;
  mimeType: string;
  category: string | null;
  expiryDate: string | null;
  expiryAlertDays: number | null;
  verificationStatus: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  notes: string | null;
  createdAt: string;
  linkedEntities: LinkedEntity[];
}

/* =============================================================================
   ICONS
   ============================================================================= */

const Icons = {
  upload: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  ),
  document: (
    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  check: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  x: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  eye: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
};

/* =============================================================================
   CONSTANTS
   ============================================================================= */

const documentCategories = [
  { value: "", label: "All Categories" },
  { value: "id", label: "ID Documents" },
  { value: "contract", label: "Contracts" },
  { value: "certificate", label: "Certificates" },
  { value: "visa", label: "Visas & Permits" },
  { value: "license", label: "Licenses" },
  { value: "policy", label: "Policies" },
  { value: "tax", label: "Tax Documents" },
  { value: "other", label: "Other" },
];

const categoryLabels: Record<string, string> = {
  id: "ID Document",
  contract: "Contract",
  certificate: "Certificate",
  visa: "Visa/Permit",
  license: "License",
  policy: "Policy",
  tax: "Tax Document",
  other: "Other",
};

const verificationStatuses: Record<string, { label: string; variant: "default" | "warning" | "success" | "danger" }> = {
  pending: { label: "Pending", variant: "warning" },
  verified: { label: "Verified", variant: "success" },
  rejected: { label: "Rejected", variant: "danger" },
  expired: { label: "Expired", variant: "danger" },
};

/* =============================================================================
   DOCUMENT DETAIL DRAWER
   ============================================================================= */

function DocumentDetailDrawer({
  document,
  onClose,
  onVerify,
  onReject,
  isSubmitting,
}: {
  document: HRDocument | null;
  onClose: () => void;
  onVerify: () => void;
  onReject: (reason: string) => void;
  isSubmitting: boolean;
}) {
  const [rejectionReason, setRejectionReason] = React.useState("");
  const [showRejectForm, setShowRejectForm] = React.useState(false);

  if (!document) return null;

  const personEntity = document.linkedEntities.find((e) => e.entityType === "person" || e.entityType === "employee");
  const isExpired = document.expiryDate && new Date(document.expiryDate) <= new Date();
  const isExpiring = document.expiryDate && !isExpired && (() => {
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return new Date(document.expiryDate!) <= thirtyDaysFromNow;
  })();

  const handleReject = () => {
    if (!rejectionReason.trim()) return;
    onReject(rejectionReason);
    setRejectionReason("");
    setShowRejectForm(false);
  };

  return (
    <SlideOver title="Document Details" open={true} onClose={onClose} width="md">
      <div className="p-6 space-y-6">
        {/* Document Info */}
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-400">
            {Icons.document}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-medium text-white truncate">{document.originalFilename}</h3>
            <p className="text-sm text-white/50">{document.mimeType}</p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex items-center gap-3">
          {document.verificationStatus && (
            <GlassBadge variant={verificationStatuses[document.verificationStatus]?.variant || "default"}>
              {verificationStatuses[document.verificationStatus]?.label || document.verificationStatus}
            </GlassBadge>
          )}
          {isExpired && (
            <GlassBadge variant="danger">Expired</GlassBadge>
          )}
          {isExpiring && (
            <GlassBadge variant="warning">Expiring Soon</GlassBadge>
          )}
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-white/5">
          <div>
            <div className="text-xs text-white/40 mb-1">Category</div>
            <div className="text-sm text-white/70">
              {document.category ? categoryLabels[document.category] || document.category : "Not set"}
            </div>
          </div>
          <div>
            <div className="text-xs text-white/40 mb-1">Person/Employee</div>
            <div className="text-sm text-white/70">{personEntity?.name || "Not linked"}</div>
          </div>
          <div>
            <div className="text-xs text-white/40 mb-1">Expiry Date</div>
            <div className={`text-sm ${isExpired ? "text-red-400" : isExpiring ? "text-amber-400" : "text-white/70"}`}>
              {document.expiryDate ? formatDate(document.expiryDate) : "No expiry"}
            </div>
          </div>
          <div>
            <div className="text-xs text-white/40 mb-1">Uploaded</div>
            <div className="text-sm text-white/70">{formatDate(document.createdAt)}</div>
          </div>
          {document.verifiedAt && (
            <div className="col-span-2">
              <div className="text-xs text-white/40 mb-1">Verified At</div>
              <div className="text-sm text-white/70">{formatDate(document.verifiedAt)}</div>
            </div>
          )}
        </div>

        {/* Rejection Reason */}
        {document.rejectionReason && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <div className="text-xs text-red-400/70 mb-1">Rejection Reason</div>
            <div className="text-sm text-red-400">{document.rejectionReason}</div>
          </div>
        )}

        {/* Notes */}
        {document.notes && (
          <div>
            <div className="text-xs text-white/40 mb-2">Notes</div>
            <div className="text-sm text-white/70 p-3 rounded-lg bg-white/5">{document.notes}</div>
          </div>
        )}

        {/* Verification Actions */}
        {document.verificationStatus === "pending" && (
          <div className="pt-4 border-t border-white/10">
            <h4 className="text-sm font-medium text-white mb-4">Verification Actions</h4>

            {!showRejectForm ? (
              <div className="flex gap-3">
                <GlassButton
                  variant="primary"
                  onClick={onVerify}
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {Icons.check}
                  <span className="ml-2">Verify Document</span>
                </GlassButton>
                <GlassButton
                  variant="ghost"
                  onClick={() => setShowRejectForm(true)}
                  disabled={isSubmitting}
                  className="flex-1 text-red-400 hover:bg-red-500/10"
                >
                  {Icons.x}
                  <span className="ml-2">Reject</span>
                </GlassButton>
              </div>
            ) : (
              <div className="space-y-4">
                <GlassTextarea
                  label="Rejection Reason"
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="Explain why this document is being rejected..."
                  rows={3}
                />
                <div className="flex gap-3">
                  <GlassButton
                    variant="ghost"
                    onClick={() => {
                      setShowRejectForm(false);
                      setRejectionReason("");
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </GlassButton>
                  <GlassButton
                    variant="primary"
                    onClick={handleReject}
                    disabled={isSubmitting || !rejectionReason.trim()}
                    className="bg-red-500/20 hover:bg-red-500/30 text-red-400"
                  >
                    Confirm Rejection
                  </GlassButton>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </SlideOver>
  );
}

/* =============================================================================
   MAIN COMPONENT
   ============================================================================= */

export function DocumentsTab() {
  const [documents, setDocuments] = React.useState<HRDocument[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [categoryFilter, setCategoryFilter] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");
  const [expiryFilter, setExpiryFilter] = React.useState<"all" | "expiring" | "expired">("all");
  const [selectedDocument, setSelectedDocument] = React.useState<HRDocument | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const fetchDocuments = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "100");
      if (categoryFilter) params.set("category", categoryFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (expiryFilter === "expiring") params.set("expiringWithinDays", "30");

      const res = await apiGet<{ items: HRDocument[] }>(`/api/people/documents?${params.toString()}`);
      setDocuments(res.items || []);
    } catch {
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, statusFilter, expiryFilter]);

  React.useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUpload = () => {
    // TODO: Open upload wizard
    console.log("Upload document - coming soon");
  };

  const handleVerify = async () => {
    if (!selectedDocument) return;
    setIsSubmitting(true);
    try {
      await apiPatch(`/api/people/documents/${selectedDocument.id}`, {
        verificationStatus: "verified",
      });
      setSelectedDocument(null);
      fetchDocuments();
    } catch (error) {
      console.error("Failed to verify document:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async (reason: string) => {
    if (!selectedDocument) return;
    setIsSubmitting(true);
    try {
      await apiPatch(`/api/people/documents/${selectedDocument.id}`, {
        verificationStatus: "rejected",
        rejectionReason: reason,
      });
      setSelectedDocument(null);
      fetchDocuments();
    } catch (error) {
      console.error("Failed to reject document:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filter documents for expired view
  const filteredDocs = React.useMemo(() => {
    let result = documents;

    if (expiryFilter === "expired") {
      result = result.filter((d) => {
        if (!d.expiryDate) return false;
        return new Date(d.expiryDate) <= new Date();
      });
    }

    return result;
  }, [documents, expiryFilter]);

  // Count stats
  const pendingCount = documents.filter((d) => d.verificationStatus === "pending").length;
  const expiringCount = documents.filter((d) => {
    if (!d.expiryDate) return false;
    const expiry = new Date(d.expiryDate);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expiry <= thirtyDaysFromNow && expiry > new Date();
  }).length;
  const expiredCount = documents.filter((d) => {
    if (!d.expiryDate) return false;
    return new Date(d.expiryDate) <= new Date();
  }).length;

  return (
    <div className="space-y-6">
      {/* Header with Action */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">HR Documents</h2>
          <p className="text-sm text-white/50">Manage employee documents, IDs, and compliance files</p>
        </div>
        <GlassButton variant="primary" onClick={handleUpload}>
          {Icons.upload}
          <span className="ml-2">Upload Document</span>
        </GlassButton>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard padding="sm">
          <div className="text-center">
            <div className="text-2xl font-semibold text-white">{documents.length}</div>
            <div className="text-xs text-white/50">Total Documents</div>
          </div>
        </GlassCard>
        <GlassCard padding="sm" className={pendingCount > 0 ? "border-amber-500/30 bg-amber-500/5" : ""}>
          <div className="text-center">
            <div className={`text-2xl font-semibold ${pendingCount > 0 ? "text-amber-400" : "text-white"}`}>
              {pendingCount}
            </div>
            <div className="text-xs text-white/50">Pending Verification</div>
          </div>
        </GlassCard>
        <GlassCard padding="sm" className={expiringCount > 0 ? "border-amber-500/30 bg-amber-500/5" : ""}>
          <div className="text-center">
            <div className={`text-2xl font-semibold ${expiringCount > 0 ? "text-amber-400" : "text-white"}`}>
              {expiringCount}
            </div>
            <div className="text-xs text-white/50">Expiring Soon</div>
          </div>
        </GlassCard>
        <GlassCard padding="sm" className={expiredCount > 0 ? "border-red-500/30 bg-red-500/5" : ""}>
          <div className="text-center">
            <div className={`text-2xl font-semibold ${expiredCount > 0 ? "text-red-400" : "text-white"}`}>
              {expiredCount}
            </div>
            <div className="text-xs text-white/50">Expired</div>
          </div>
        </GlassCard>
      </div>

      {/* Alert Cards */}
      {(expiringCount > 0 || expiredCount > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {expiredCount > 0 && (
            <GlassCard padding="sm" className="border-red-500/30 bg-red-500/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-500/20 text-red-400">
                  {Icons.warning}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-red-400">{expiredCount} Expired Documents</div>
                  <div className="text-xs text-white/50">Require immediate attention</div>
                </div>
                <GlassButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpiryFilter("expired")}
                >
                  View
                </GlassButton>
              </div>
            </GlassCard>
          )}
          {expiringCount > 0 && (
            <GlassCard padding="sm" className="border-amber-500/30 bg-amber-500/5">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                  {Icons.warning}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-amber-400">{expiringCount} Expiring Soon</div>
                  <div className="text-xs text-white/50">Within the next 30 days</div>
                </div>
                <GlassButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpiryFilter("expiring")}
                >
                  View
                </GlassButton>
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* Filters */}
      <GlassCard padding="sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-48">
            <GlassSelect
              label="Category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              options={documentCategories}
            />
          </div>
          <div className="w-48">
            <GlassSelect
              label="Verification Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={[
                { value: "", label: "All Statuses" },
                { value: "pending", label: "Pending" },
                { value: "verified", label: "Verified" },
                { value: "rejected", label: "Rejected" },
                { value: "expired", label: "Expired" },
              ]}
            />
          </div>
          <div className="w-48">
            <GlassSelect
              label="Expiry Status"
              value={expiryFilter}
              onChange={(e) => setExpiryFilter(e.target.value as "all" | "expiring" | "expired")}
              options={[
                { value: "all", label: "All Documents" },
                { value: "expiring", label: "Expiring Soon" },
                { value: "expired", label: "Expired" },
              ]}
            />
          </div>
          {(categoryFilter || statusFilter || expiryFilter !== "all") && (
            <GlassButton
              variant="ghost"
              size="sm"
              onClick={() => {
                setCategoryFilter("");
                setStatusFilter("");
                setExpiryFilter("all");
              }}
            >
              Clear Filters
            </GlassButton>
          )}
        </div>
      </GlassCard>

      {/* Documents Table */}
      <GlassCard padding="none">
        {loading ? (
          <div className="p-6">
            <SkeletonTable rows={5} columns={6} />
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400">
              {Icons.document}
            </div>
            <p className="text-white/70 font-medium mb-2">No documents found</p>
            <p className="text-sm text-white/40 mb-6 max-w-md mx-auto">
              {documents.length === 0
                ? "Upload employee documents like IDs, contracts, and certificates"
                : "No documents match your current filters"}
            </p>
            {documents.length === 0 && (
              <GlassButton variant="primary" onClick={handleUpload}>
                {Icons.upload}
                <span className="ml-2">Upload First Document</span>
              </GlassButton>
            )}
          </div>
        ) : (
          <GlassTable
            headers={["Document", "Person", "Category", "Expiry", "Status", ""]}
            rows={filteredDocs.map((doc) => {
              const personEntity = doc.linkedEntities.find(
                (e) => e.entityType === "person" || e.entityType === "employee"
              );
              const isExpired = doc.expiryDate && new Date(doc.expiryDate) <= new Date();
              const isExpiring = doc.expiryDate && !isExpired && (() => {
                const thirtyDaysFromNow = new Date();
                thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
                return new Date(doc.expiryDate!) <= thirtyDaysFromNow;
              })();

              return [
                // Document
                <div key="doc" className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white truncate max-w-[200px]">
                      {doc.originalFilename}
                    </div>
                    <div className="text-xs text-white/40">{formatDate(doc.createdAt)}</div>
                  </div>
                </div>,
                // Person
                <span key="person" className="text-white/70">{personEntity?.name || "-"}</span>,
                // Category
                <GlassBadge key="cat" variant="default">
                  {doc.category ? categoryLabels[doc.category] || doc.category : "uncategorized"}
                </GlassBadge>,
                // Expiry
                <span
                  key="expiry"
                  className={
                    isExpired
                      ? "text-red-400"
                      : isExpiring
                      ? "text-amber-400"
                      : "text-white/70"
                  }
                >
                  {doc.expiryDate ? formatDate(doc.expiryDate) : "-"}
                  {isExpired && " (Expired)"}
                  {isExpiring && " (Soon)"}
                </span>,
                // Status
                doc.verificationStatus ? (
                  <GlassBadge
                    key="status"
                    variant={verificationStatuses[doc.verificationStatus]?.variant || "default"}
                  >
                    {verificationStatuses[doc.verificationStatus]?.label || doc.verificationStatus}
                  </GlassBadge>
                ) : (
                  <span key="status" className="text-white/30">-</span>
                ),
                // Actions
                <GlassButton
                  key="actions"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDocument(doc)}
                >
                  {Icons.eye}
                </GlassButton>,
              ];
            })}
            emptyMessage="No documents found"
          />
        )}
      </GlassCard>

      {/* Document Detail Drawer */}
      {selectedDocument && (
        <DocumentDetailDrawer
          document={selectedDocument}
          onClose={() => setSelectedDocument(null)}
          onVerify={handleVerify}
          onReject={handleReject}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
