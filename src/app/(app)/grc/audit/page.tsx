"use client";

import * as React from "react";
import { GlassCard, PageHeader, Spinner, GlassBadge } from "@/components/ui/glass";
import { apiGet, formatDateTime } from "@/lib/http";

interface AuditEvent {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

interface DashboardData {
  recentActivity: AuditEvent[];
}

export default function AuditLogPage() {
  const [events, setEvents] = React.useState<AuditEvent[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadData() {
      try {
        const data = await apiGet<DashboardData>("/api/reports/dashboard");
        setEvents(data.recentActivity || []);
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const formatAction = (action: string): string => {
    return action
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const getActionColor = (action: string): "success" | "warning" | "danger" | "info" | "default" => {
    if (action.includes("create") || action.includes("post")) return "success";
    if (action.includes("update") || action.includes("change")) return "info";
    if (action.includes("delete") || action.includes("void")) return "danger";
    if (action.includes("login") || action.includes("auth")) return "warning";
    return "default";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="System activity and change history"
      />

      <GlassCard>
        {events.length > 0 ? (
          <div className="divide-y divide-white/5">
            {events.map((event) => (
              <div key={event.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white">
                          {formatAction(event.action)}
                        </span>
                        <GlassBadge variant={getActionColor(event.action)}>
                          {event.entityType}
                        </GlassBadge>
                      </div>
                      <p className="text-sm text-white/50">
                        Entity ID: {event.entityId?.substring(0, 8)}...
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-white/40">
                    {formatDateTime(event.occurredAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-white/50">No audit events found</p>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
