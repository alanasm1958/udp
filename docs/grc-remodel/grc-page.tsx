'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  GlassCard,
  GlassButton,
  GlassBadge,
  Spinner,
  useToast,
} from '@/components/ui/glass';
import {
  ModulePageHeader,
  AnalyticsSection,
  AnalyticsCard,
  TodoAlertsSection,
  TodoPanel,
  AlertsPanel,
  QuickAccessSection,
  QuickAccessCard,
} from '@/components/layout/module-layout';
import {
  ShieldCheckIcon,
  ExclamationTriangleIcon,
  DocumentTextIcon,
  CalendarIcon,
  ScaleIcon,
  DocumentChartBarIcon,
  ClipboardDocumentCheckIcon,
  BuildingLibraryIcon,
  ClockIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline';
import { apiGet } from '@/lib/http';

// ============================================================================
// TYPES
// ============================================================================

interface GrcAnalytics {
  compliance: {
    overallScore: number;
    satisfiedCount: number;
    unsatisfiedCount: number;
    atRiskCount: number;
    unknownCount: number;
    totalRequirements: number;
  };
  riskProfile: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  upcomingDeadlines: {
    overdue: number;
    thisWeek: number;
    thisMonth: number;
    nextQuarter: number;
  };
  byCategory: Record<
    string,
    {
      satisfied: number;
      unsatisfied: number;
      percentage: number;
    }
  >;
}

interface GrcTask {
  id: string;
  requirementId: string;
  requirementTitle: string;
  title: string;
  description: string;
  status: 'open' | 'blocked' | 'completed';
  assignedTo?: string;
  assignedToName?: string;
  dueDate?: string;
  priority?: number;
  createdAt: string;
}

interface GrcAlert {
  id: string;
  requirementId: string;
  requirementTitle: string;
  title: string;
  message: string;
  alertType: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'active' | 'resolved';
  createdAt: string;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function GrcPage() {
  const router = useRouter();
  const { addToast } = useToast();

  // State
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<GrcAnalytics | null>(null);
  const [tasks, setTasks] = useState<GrcTask[]>([]);
  const [alerts, setAlerts] = useState<GrcAlert[]>([]);

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        // Fetch analytics
        const analyticsRes = await apiGet<GrcAnalytics>('/api/grc/analytics');
        setAnalytics(analyticsRes);

        // Fetch open tasks
        const tasksRes = await apiGet<{ tasks: GrcTask[] }>(
          '/api/grc/tasks?status=open&limit=10'
        );
        setTasks(tasksRes.tasks);

        // Fetch active alerts
        const alertsRes = await apiGet<{ alerts: GrcAlert[] }>(
          '/api/grc/alerts?status=active&limit=10'
        );
        setAlerts(alertsRes.alerts);
      } catch (error) {
        console.error('Error fetching GRC data:', error);
        addToast('error', 'Failed to load GRC data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [addToast]);

  // Loading state
  if (loading || !analytics) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  // Calculate compliance status
  const getComplianceStatus = (score: number) => {
    if (score >= 90) return { label: 'Excellent', variant: 'success' as const };
    if (score >= 75) return { label: 'Good', variant: 'default' as const };
    if (score >= 60) return { label: 'Fair', variant: 'warning' as const };
    return { label: 'Needs Attention', variant: 'danger' as const };
  };

  const complianceStatus = getComplianceStatus(analytics.compliance.overallScore);

  // Calculate risk status
  const totalHighRisk = analytics.riskProfile.critical + analytics.riskProfile.high;
  const getRiskStatus = () => {
    if (totalHighRisk === 0) return { label: 'Low Risk', variant: 'success' as const };
    if (totalHighRisk <= 3) return { label: 'Moderate', variant: 'warning' as const };
    return { label: 'High Risk', variant: 'danger' as const };
  };

  const riskStatus = getRiskStatus();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <ModulePageHeader
          title="Governance, Risk & Compliance"
          description="Requirements-driven compliance management"
          actions={
            <>
              <GlassButton
                variant="ghost"
                onClick={() => router.push('/grc/requirements')}
              >
                <ClipboardDocumentCheckIcon className="w-5 h-5 mr-2" />
                All Requirements
              </GlassButton>
              <GlassButton
                variant="primary"
                onClick={() => router.push('/grc/profile')}
              >
                <BuildingLibraryIcon className="w-5 h-5 mr-2" />
                Business Profile
              </GlassButton>
            </>
          }
        />

        {/* Analytics Section */}
        <AnalyticsSection>
          {/* Overall Compliance Score */}
          <AnalyticsCard
            variant={complianceStatus.variant}
            label="Compliance Score"
            value={`${analytics.compliance.overallScore}%`}
            status={complianceStatus.label}
            icon={<ShieldCheckIcon className="w-6 h-6" />}
            subtitle={`${analytics.compliance.satisfiedCount} of ${analytics.compliance.totalRequirements} satisfied`}
          />

          {/* Risk Profile */}
          <AnalyticsCard
            variant={riskStatus.variant}
            label="Risk Profile"
            value={totalHighRisk.toString()}
            status={riskStatus.label}
            icon={<ExclamationTriangleIcon className="w-6 h-6" />}
            subtitle={`${analytics.riskProfile.critical} critical, ${analytics.riskProfile.high} high`}
          />

          {/* Upcoming Deadlines */}
          <AnalyticsCard
            variant={
              analytics.upcomingDeadlines.overdue > 0
                ? 'danger'
                : analytics.upcomingDeadlines.thisWeek > 0
                ? 'warning'
                : 'default'
            }
            label="Upcoming Deadlines"
            value={analytics.upcomingDeadlines.thisWeek.toString()}
            status={
              analytics.upcomingDeadlines.overdue > 0
                ? `${analytics.upcomingDeadlines.overdue} Overdue`
                : 'This Week'
            }
            icon={<ClockIcon className="w-6 h-6" />}
            subtitle={`${analytics.upcomingDeadlines.thisMonth} this month`}
          />

          {/* Unsatisfied Requirements */}
          <AnalyticsCard
            variant={
              analytics.compliance.unsatisfiedCount > 10
                ? 'danger'
                : analytics.compliance.unsatisfiedCount > 5
                ? 'warning'
                : 'default'
            }
            label="Open Requirements"
            value={analytics.compliance.unsatisfiedCount.toString()}
            status={
              analytics.compliance.unsatisfiedCount > 10
                ? 'Action Required'
                : 'In Progress'
            }
            icon={<DocumentTextIcon className="w-6 h-6" />}
            subtitle={`${analytics.compliance.atRiskCount} at risk`}
          />
        </AnalyticsSection>

        {/* Category Breakdown */}
        <GlassCard>
          <div className="p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              Compliance by Category
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(analytics.byCategory).map(([category, data]) => (
                <div
                  key={category}
                  className="p-4 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white/80 capitalize">
                      {category.replace('_', ' ')}
                    </span>
                    <GlassBadge
                      variant={
                        data.percentage >= 90
                          ? 'success'
                          : data.percentage >= 75
                          ? 'default'
                          : 'warning'
                      }
                    >
                      {data.percentage}%
                    </GlassBadge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-white/60">
                    <span>
                      <CheckCircleIcon className="w-4 h-4 inline mr-1" />
                      {data.satisfied} satisfied
                    </span>
                    <span>
                      <ExclamationTriangleIcon className="w-4 h-4 inline mr-1" />
                      {data.unsatisfied} open
                    </span>
                  </div>
                  {/* Progress Bar */}
                  <div className="mt-2 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-300"
                      style={{
                        width: `${data.percentage}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>

        {/* Tasks & Alerts Section */}
        <TodoAlertsSection>
          {/* Tasks Panel */}
          <TodoPanel
            title="Compliance Tasks"
            emptyMessage="No open tasks"
            viewAllLink="/grc/tasks"
            todos={tasks.map((task) => ({
              id: task.id,
              title: task.title,
              description: task.requirementTitle,
              priority: task.priority || 5,
              dueDate: task.dueDate,
              category: 'compliance',
            }))}
            onTodoClick={(taskId) => router.push(`/grc/tasks/${taskId}`)}
          />

          {/* Alerts Panel */}
          <AlertsPanel
            title="Compliance Alerts"
            emptyMessage="No active alerts"
            viewAllLink="/grc/alerts"
            alerts={alerts.map((alert) => ({
              id: alert.id,
              title: alert.title,
              message: alert.message,
              severity: alert.severity,
              timestamp: alert.createdAt,
            }))}
            onAlertClick={(alertId) => {
              const alert = alerts.find((a) => a.id === alertId);
              if (alert) {
                router.push(`/grc/requirements/${alert.requirementId}`);
              }
            }}
          />
        </TodoAlertsSection>

        {/* Quick Access Section */}
        <QuickAccessSection>
          <QuickAccessCard
            title="Tax History"
            description="View all tax filings and payments"
            icon={<ScaleIcon className="w-6 h-6" />}
            href="/grc/tax-history"
          />
          <QuickAccessCard
            title="Licenses & Permits"
            description="Track licenses and renewals"
            icon={<DocumentChartBarIcon className="w-6 h-6" />}
            href="/grc/licenses"
          />
          <QuickAccessCard
            title="Audit History"
            description="Complete compliance audit trail"
            icon={<ClipboardDocumentCheckIcon className="w-6 h-6" />}
            href="/grc/audit"
          />
          <QuickAccessCard
            title="Compliance Calendar"
            description="Upcoming deadlines and events"
            icon={<CalendarIcon className="w-6 h-6" />}
            href="/grc/calendar"
          />
          <QuickAccessCard
            title="Documents"
            description="All compliance documents"
            icon={<DocumentTextIcon className="w-6 h-6" />}
            href="/grc/documents"
          />
          <QuickAccessCard
            title="Business Profile"
            description="Update business information"
            icon={<BuildingLibraryIcon className="w-6 h-6" />}
            href="/grc/profile"
          />
        </QuickAccessSection>
      </div>
    </div>
  );
}
