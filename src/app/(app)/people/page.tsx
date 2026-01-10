"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import {
  GlassCard,
  GlassButton,
  GlassBadge,
  GlassInput,
  GlassSelect,
  SlideOver,
  PageHeader,
  Spinner,
  SkeletonTable,
  useToast,
} from "@/components/ui/glass";
import { apiGet, formatDate, formatCurrency } from "@/lib/http";
import { useAIValidator } from "@/hooks/useAIValidator";
import { AIHintBanner } from "@/components/operations/AIHintBanner";

// Tab Components
import { PeopleTab } from "./components/PeopleTab";
import { PayrollTab } from "./components/PayrollTab";
import { PerformanceTab } from "./components/PerformanceTab";
import { DocumentsTab } from "./components/DocumentsTab";
import { SettingsTab } from "./components/SettingsTab";

/* =============================================================================
   TYPES
   ============================================================================= */

interface Person {
  id: string;
  fullName: string;
  displayName: string | null;
  types: string[];
  primaryEmail: string | null;
  primaryPhone: string | null;
  whatsappNumber: string | null;
  preferredChannel: string | null;
  linkedPartyId: string | null;
  linkedUserId: string | null;
  jobTitle: string | null;
  isQuickAdd: boolean;
  createdAt: string;
}

interface Department {
  id: string;
  name: string;
  code: string | null;
}

interface Party {
  id: string;
  name: string;
  type: string;
}

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  domain: string | null;
  dueAt: string | null;
  createdAt: string;
}

interface Alert {
  id: string;
  type: string;
  severity: string;
  title: string;
  description: string;
  domain: string;
  createdAt: string;
}

interface HRMetrics {
  totalPeople: number;
  staffCount: number;
  contractorCount: number;
  quickAddCount: number;
  newHires30d: number;
  leavers90d: number;
  payrollCostMTD: number;
  expiringDocs: number;
}

type TabType = "people" | "payroll" | "performance" | "documents" | "settings";

/* =============================================================================
   ICONS
   ============================================================================= */

const Icons = {
  bolt: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  ),
  user: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  ),
  users: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
    </svg>
  ),
  briefcase: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
    </svg>
  ),
  building: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
    </svg>
  ),
  sparkles: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  ),
  clock: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  warning: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
    </svg>
  ),
  chevronRight: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  ),
  chevronLeft: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  ),
  check: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  ),
  currency: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  document: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
};

/* =============================================================================
   PERSON TYPE OPTIONS
   ============================================================================= */

const personTypes = [
  { value: "staff", label: "Staff", description: "Full-time employee" },
  { value: "contractor", label: "Contractor", description: "External contractor" },
  { value: "sales_rep", label: "Sales Rep", description: "Sales representative" },
  { value: "service_provider", label: "Service Provider", description: "External service provider" },
  { value: "supplier_contact", label: "Supplier Contact", description: "Vendor/supplier contact" },
  { value: "customer_contact", label: "Customer Contact", description: "Customer point of contact" },
  { value: "partner_contact", label: "Partner Contact", description: "Business partner contact" },
];

const channelOptions = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "sms", label: "SMS" },
];

/* =============================================================================
   METRIC CARD
   ============================================================================= */

interface MetricCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger";
  subtext?: string;
}

function MetricCard({ label, value, icon, variant = "default", subtext }: MetricCardProps) {
  const colorMap = {
    default: "bg-white/5 text-white",
    success: "bg-emerald-500/10 text-emerald-400",
    warning: "bg-amber-500/10 text-amber-400",
    danger: "bg-red-500/10 text-red-400",
  };

  const iconColorMap = {
    default: "bg-white/10 text-white/60",
    success: "bg-emerald-500/20 text-emerald-400",
    warning: "bg-amber-500/20 text-amber-400",
    danger: "bg-red-500/20 text-red-400",
  };

  return (
    <div className={`rounded-2xl border border-white/10 p-4 ${colorMap[variant]}`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${iconColorMap[variant]}`}>
          {icon}
        </div>
        <div>
          <div className="text-xs text-white/50 uppercase tracking-wide">{label}</div>
          <div className="text-xl font-semibold">{value}</div>
          {subtext && <div className="text-xs text-white/40">{subtext}</div>}
        </div>
      </div>
    </div>
  );
}

/* =============================================================================
   TASKS & ALERTS SECTION
   ============================================================================= */

function TasksAlertsSection({ tasks, alerts, loading }: { tasks: Task[]; alerts: Alert[]; loading: boolean }) {
  const [collapsed, setCollapsed] = React.useState(false);

  const priorityColors: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-amber-500",
    normal: "bg-blue-500",
    low: "bg-gray-500",
  };

  const severityStyles: Record<string, { bg: string; border: string; dot: string }> = {
    critical: { bg: "bg-red-500/10", border: "border-red-500/30", dot: "bg-red-500" },
    warning: { bg: "bg-amber-500/10", border: "border-amber-500/30", dot: "bg-amber-500" },
    info: { bg: "bg-blue-500/10", border: "border-blue-500/30", dot: "bg-blue-500" },
  };

  if (loading) {
    return (
      <GlassCard>
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-white/10 rounded w-1/4" />
          <div className="h-12 bg-white/5 rounded" />
          <div className="h-12 bg-white/5 rounded" />
        </div>
      </GlassCard>
    );
  }

  const totalItems = tasks.length + alerts.length;
  if (totalItems === 0) {
    return null;
  }

  return (
    <GlassCard>
      <button
        type="button"
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-white/70 uppercase tracking-wide">
            To-Do & Alerts
          </h3>
          <GlassBadge variant={alerts.some(a => a.severity === "critical") ? "danger" : "warning"}>
            {totalItems}
          </GlassBadge>
        </div>
        <div className={`text-white/40 transition-transform ${collapsed ? "" : "rotate-90"}`}>
          {Icons.chevronRight}
        </div>
      </button>

      {!collapsed && (
        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Tasks */}
          <div className="space-y-2">
            <h4 className="text-xs text-white/40 uppercase tracking-wide">Tasks</h4>
            {tasks.length === 0 ? (
              <div className="text-sm text-white/30 py-2">All caught up!</div>
            ) : (
              tasks.slice(0, 3).map((task) => (
                <div
                  key={task.id}
                  className="flex items-start gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors cursor-pointer"
                >
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${priorityColors[task.priority] || "bg-gray-500"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{task.title}</p>
                    {task.dueAt && (
                      <span className="text-xs text-white/40">Due {formatDate(task.dueAt)}</span>
                    )}
                  </div>
                </div>
              ))
            )}
            {tasks.length > 3 && (
              <p className="text-xs text-white/40 text-center">+{tasks.length - 3} more</p>
            )}
          </div>

          {/* Alerts */}
          <div className="space-y-2">
            <h4 className="text-xs text-white/40 uppercase tracking-wide">Alerts</h4>
            {alerts.length === 0 ? (
              <div className="text-sm text-white/30 py-2">No active alerts</div>
            ) : (
              alerts.slice(0, 3).map((alert) => {
                const styles = severityStyles[alert.severity] || severityStyles.info;
                return (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-3 p-3 rounded-xl border ${styles.bg} ${styles.border}`}
                  >
                    <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${styles.dot}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{alert.title}</p>
                      <p className="text-xs text-white/40 truncate">{alert.description}</p>
                    </div>
                  </div>
                );
              })
            )}
            {alerts.length > 3 && (
              <p className="text-xs text-white/40 text-center">+{alerts.length - 3} more</p>
            )}
          </div>
        </div>
      )}
    </GlassCard>
  );
}

/* =============================================================================
   TAB NAVIGATION
   ============================================================================= */

interface TabNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

function TabNav({ activeTab, onTabChange }: TabNavProps) {
  const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
    { id: "people", label: "People", icon: Icons.users },
    { id: "payroll", label: "Payroll", icon: Icons.currency },
    { id: "performance", label: "Performance", icon: Icons.sparkles },
    { id: "documents", label: "Documents", icon: Icons.document },
    { id: "settings", label: "Settings", icon: Icons.building },
  ];

  return (
    <div className="flex gap-1 p-1 bg-white/5 rounded-xl overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={`
            flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium
            transition-all duration-200 whitespace-nowrap
            ${activeTab === tab.id
              ? "bg-white/10 text-white shadow-sm"
              : "text-white/50 hover:text-white/70 hover:bg-white/5"
            }
          `}
        >
          <span className={activeTab === tab.id ? "text-white" : "text-white/40"}>
            {tab.icon}
          </span>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/* =============================================================================
   RECORD ACTIVITY DRAWER
   ============================================================================= */

interface RecordActivityDrawerProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  people: Person[];
}

type DrawerStep =
  | "menu"
  | "add-person"
  | "quick-add"
  | "add-department"
  | "record-time-off"
  | "run-payroll"
  | "performance-note";

function RecordActivityDrawer({ open, onClose, onSuccess, people }: RecordActivityDrawerProps) {
  const { addToast } = useToast();
  const [step, setStep] = React.useState<DrawerStep>("menu");
  const [loading, setLoading] = React.useState(false);

  // Data
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [parties, setParties] = React.useState<Party[]>([]);
  const [loadingData, setLoadingData] = React.useState(false);

  // Person form
  const [personForm, setPersonForm] = React.useState({
    fullName: "",
    displayName: "",
    types: ["staff"] as string[],
    primaryEmail: "",
    primaryPhone: "",
    whatsappNumber: "",
    preferredChannel: "whatsapp",
    jobTitle: "",
    departmentId: "",
    linkedPartyId: "",
    notes: "",
  });

  // Quick add form
  const [quickAddForm, setQuickAddForm] = React.useState({
    fullName: "",
    primaryEmail: "",
    primaryPhone: "",
    types: ["staff"] as string[],
  });

  // Department form
  const [deptForm, setDeptForm] = React.useState({
    name: "",
    code: "",
    parentId: "",
  });

  // Time off form
  const [timeOffForm, setTimeOffForm] = React.useState({
    personId: "",
    leaveType: "vacation" as "vacation" | "sick" | "personal" | "other",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  // Payroll form
  const [payrollForm, setPayrollForm] = React.useState({
    payPeriod: new Date().toISOString().slice(0, 7),
    payDate: new Date().toISOString().split("T")[0],
    totalAmount: "",
    notes: "",
  });

  // Performance note form
  const [perfNoteForm, setPerfNoteForm] = React.useState({
    personId: "",
    noteType: "praise" as "praise" | "coaching" | "warning" | "general",
    title: "",
    content: "",
    isPrivate: false,
  });

  // AI Validation for person form
  const personAIContext = React.useMemo(() => ({
    fullName: personForm.fullName || undefined,
    primaryEmail: personForm.primaryEmail || undefined,
    primaryPhone: personForm.primaryPhone || undefined,
    whatsappNumber: personForm.whatsappNumber || undefined,
    types: personForm.types,
  }), [personForm.fullName, personForm.primaryEmail, personForm.primaryPhone, personForm.whatsappNumber, personForm.types]);

  const { hints: personHints, loading: personHintsLoading, dismissHint: dismissPersonHint } = useAIValidator(personAIContext, {
    domain: "people",
    endpoint: "/api/people/ai/validate",
    debounceMs: 800,
    enabled: step === "add-person" && (!!personForm.fullName || !!personForm.primaryEmail),
  });

  // Load data on open
  React.useEffect(() => {
    if (!open) return;

    async function loadData() {
      setLoadingData(true);
      try {
        const [deptRes, partiesRes] = await Promise.all([
          apiGet<{ items: Department[] }>("/api/company/departments?limit=100").catch(() => ({ items: [] })),
          apiGet<{ items: Party[] }>("/api/master/parties?limit=200").catch(() => ({ items: [] })),
        ]);
        setDepartments(deptRes.items || []);
        setParties(partiesRes.items || []);
      } catch {
        // Silently fail
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, [open]);

  // Reset on close
  const handleClose = () => {
    setStep("menu");
    setPersonForm({
      fullName: "",
      displayName: "",
      types: ["staff"],
      primaryEmail: "",
      primaryPhone: "",
      whatsappNumber: "",
      preferredChannel: "whatsapp",
      jobTitle: "",
      departmentId: "",
      linkedPartyId: "",
      notes: "",
    });
    setQuickAddForm({
      fullName: "",
      primaryEmail: "",
      primaryPhone: "",
      types: ["staff"],
    });
    setDeptForm({ name: "", code: "", parentId: "" });
    setTimeOffForm({
      personId: "",
      leaveType: "vacation",
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
      notes: "",
    });
    setPayrollForm({
      payPeriod: new Date().toISOString().slice(0, 7),
      payDate: new Date().toISOString().split("T")[0],
      totalAmount: "",
      notes: "",
    });
    setPerfNoteForm({
      personId: "",
      noteType: "praise",
      title: "",
      content: "",
      isPrivate: false,
    });
    onClose();
  };

  // Submit person
  const handleSubmitPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: personForm.fullName,
          displayName: personForm.displayName || undefined,
          types: personForm.types,
          primaryEmail: personForm.primaryEmail || undefined,
          primaryPhone: personForm.primaryPhone || undefined,
          whatsappNumber: personForm.whatsappNumber || undefined,
          preferredChannel: personForm.preferredChannel,
          jobTitle: personForm.jobTitle || undefined,
          departmentId: personForm.departmentId || undefined,
          linkedPartyId: personForm.linkedPartyId || undefined,
          notes: personForm.notes || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add person");
      }

      addToast("success", "Person added successfully");
      handleClose();
      onSuccess();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to add person");
    } finally {
      setLoading(false);
    }
  };

  // Quick add
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: quickAddForm.fullName,
          primaryEmail: quickAddForm.primaryEmail || undefined,
          primaryPhone: quickAddForm.primaryPhone || undefined,
          types: quickAddForm.types,
          isQuickAdd: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add person");
      }

      addToast("success", "Person added. AI task created to complete profile.");
      handleClose();
      onSuccess();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to add person");
    } finally {
      setLoading(false);
    }
  };

  // Add department
  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/company/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: deptForm.name,
          code: deptForm.code || undefined,
          parentId: deptForm.parentId || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create department");
      }

      addToast("success", "Department created successfully");
      handleClose();
      onSuccess();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to create department");
    } finally {
      setLoading(false);
    }
  };

  // Back button
  const BackButton = () => (
    <button
      type="button"
      onClick={() => setStep("menu")}
      className="flex items-center gap-1 text-white/50 hover:text-white/70 text-sm mb-4"
    >
      {Icons.chevronLeft}
      <span>Back</span>
    </button>
  );

  // Title based on step
  const getTitle = () => {
    switch (step) {
      case "add-person": return "Add Person";
      case "quick-add": return "Quick Add";
      case "add-department": return "Add Department";
      case "record-time-off": return "Record Time Off";
      case "run-payroll": return "Run Payroll";
      case "performance-note": return "Performance Note";
      default: return "Record Activity";
    }
  };

  return (
    <SlideOver open={open} onClose={handleClose} title={getTitle()}>
      {/* Main Menu */}
      {step === "menu" && (
        <div className="space-y-3">
          <p className="text-white/50 text-sm mb-4">What would you like to do?</p>

          <div className="grid grid-cols-1 gap-3">
            <button
              type="button"
              onClick={() => setStep("add-person")}
              className="flex items-center gap-4 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors text-left"
            >
              <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400">
                {Icons.user}
              </div>
              <div className="flex-1">
                <div className="font-medium text-white">Add Person</div>
                <div className="text-sm text-white/50">Full profile with contact info</div>
              </div>
              {Icons.chevronRight}
            </button>

            <button
              type="button"
              onClick={() => setStep("quick-add")}
              className="flex items-center gap-4 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors text-left"
            >
              <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400">
                {Icons.sparkles}
              </div>
              <div className="flex-1">
                <div className="font-medium text-white">Quick Add</div>
                <div className="text-sm text-white/50">Minimal info, complete later via AI task</div>
              </div>
              {Icons.chevronRight}
            </button>

            <button
              type="button"
              onClick={() => setStep("add-department")}
              className="flex items-center gap-4 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-colors text-left"
            >
              <div className="p-2 rounded-lg bg-purple-500/20 text-purple-400">
                {Icons.building}
              </div>
              <div className="flex-1">
                <div className="font-medium text-white">Add Department</div>
                <div className="text-sm text-white/50">Create team or department</div>
              </div>
              {Icons.chevronRight}
            </button>

            <button
              type="button"
              onClick={() => setStep("record-time-off")}
              className="flex items-center gap-4 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/20 transition-colors text-left"
            >
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-medium text-white">Record Time Off</div>
                <div className="text-sm text-white/50">Log vacation, sick leave</div>
              </div>
              {Icons.chevronRight}
            </button>

            <button
              type="button"
              onClick={() => setStep("run-payroll")}
              className="flex items-center gap-4 p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20 hover:bg-cyan-500/20 transition-colors text-left"
            >
              <div className="p-2 rounded-lg bg-cyan-500/20 text-cyan-400">
                {Icons.currency}
              </div>
              <div className="flex-1">
                <div className="font-medium text-white">Run Payroll</div>
                <div className="text-sm text-white/50">Record monthly salary payment</div>
              </div>
              {Icons.chevronRight}
            </button>

            <button
              type="button"
              onClick={() => setStep("performance-note")}
              className="flex items-center gap-4 p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors text-left"
            >
              <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="font-medium text-white">Performance Note</div>
                <div className="text-sm text-white/50">Log praise or coaching</div>
              </div>
              {Icons.chevronRight}
            </button>
          </div>

          {/* Quick Links */}
          <div className="pt-6 border-t border-white/10">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-3">Quick Links</p>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/settings/users" className="text-sm text-blue-400 hover:text-blue-300 p-2 rounded-lg hover:bg-white/5">
                Manage Users
              </Link>
              <Link href="/company/organization" className="text-sm text-blue-400 hover:text-blue-300 p-2 rounded-lg hover:bg-white/5">
                Org Chart
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Add Person Form */}
      {step === "add-person" && (
        <>
          <BackButton />
          <AIHintBanner
            hints={personHints}
            onDismiss={dismissPersonHint}
            loading={personHintsLoading}
            compact
            className="mb-4"
          />
          <form onSubmit={handleSubmitPerson} className="space-y-4">
            <GlassInput
              label="Full Name *"
              value={personForm.fullName}
              onChange={(e) => setPersonForm({ ...personForm, fullName: e.target.value })}
              placeholder="John Smith"
              required
            />
            <GlassInput
              label="Display Name"
              value={personForm.displayName}
              onChange={(e) => setPersonForm({ ...personForm, displayName: e.target.value })}
              placeholder="Johnny (optional)"
            />
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Type(s)</label>
              <div className="flex flex-wrap gap-2">
                {personTypes.map((type) => (
                  <label key={type.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={personForm.types.includes(type.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setPersonForm({ ...personForm, types: [...personForm.types, type.value] });
                        } else {
                          setPersonForm({ ...personForm, types: personForm.types.filter((t) => t !== type.value) });
                        }
                      }}
                      className="w-4 h-4 rounded border-white/30 bg-white/10 text-blue-500"
                    />
                    <span className="text-sm text-white/70">{type.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <GlassInput
              label="Email"
              type="email"
              value={personForm.primaryEmail}
              onChange={(e) => setPersonForm({ ...personForm, primaryEmail: e.target.value })}
              placeholder="john@example.com"
            />
            <GlassInput
              label="Phone"
              value={personForm.primaryPhone}
              onChange={(e) => setPersonForm({ ...personForm, primaryPhone: e.target.value })}
              placeholder="+1 555 123 4567"
            />
            <GlassInput
              label="WhatsApp"
              value={personForm.whatsappNumber}
              onChange={(e) => setPersonForm({ ...personForm, whatsappNumber: e.target.value })}
              placeholder="+1 555 123 4567"
            />
            <GlassSelect
              label="Preferred Contact"
              value={personForm.preferredChannel}
              onChange={(e) => setPersonForm({ ...personForm, preferredChannel: e.target.value })}
              options={channelOptions}
            />
            <GlassInput
              label="Job Title"
              value={personForm.jobTitle}
              onChange={(e) => setPersonForm({ ...personForm, jobTitle: e.target.value })}
              placeholder="Software Engineer"
            />
            <GlassSelect
              label="Department"
              value={personForm.departmentId}
              onChange={(e) => setPersonForm({ ...personForm, departmentId: e.target.value })}
              options={[
                { value: "", label: loadingData ? "Loading..." : "Select department" },
                ...departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
            <GlassSelect
              label="Linked Organization"
              value={personForm.linkedPartyId}
              onChange={(e) => setPersonForm({ ...personForm, linkedPartyId: e.target.value })}
              options={[
                { value: "", label: "None" },
                ...parties.map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
            <div className="pt-4 flex gap-3">
              <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">
                Cancel
              </GlassButton>
              <GlassButton type="submit" variant="primary" disabled={loading} className="flex-1">
                {loading ? <Spinner size="sm" /> : "Add Person"}
              </GlassButton>
            </div>
          </form>
        </>
      )}

      {/* Quick Add Form */}
      {step === "quick-add" && (
        <>
          <BackButton />
          <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-sm text-amber-300">
              Quick add creates a minimal record. An AI task will be created to complete the profile later.
            </p>
          </div>
          <form onSubmit={handleQuickAdd} className="space-y-4">
            <GlassInput
              label="Full Name *"
              value={quickAddForm.fullName}
              onChange={(e) => setQuickAddForm({ ...quickAddForm, fullName: e.target.value })}
              placeholder="John Smith"
              required
            />
            <GlassInput
              label="Email"
              type="email"
              value={quickAddForm.primaryEmail}
              onChange={(e) => setQuickAddForm({ ...quickAddForm, primaryEmail: e.target.value })}
              placeholder="john@example.com"
            />
            <GlassInput
              label="Phone"
              value={quickAddForm.primaryPhone}
              onChange={(e) => setQuickAddForm({ ...quickAddForm, primaryPhone: e.target.value })}
              placeholder="+1 555 123 4567"
            />
            <GlassSelect
              label="Type"
              value={quickAddForm.types[0]}
              onChange={(e) => setQuickAddForm({ ...quickAddForm, types: [e.target.value] })}
              options={personTypes.map((t) => ({ value: t.value, label: t.label }))}
            />
            <div className="pt-4 flex gap-3">
              <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">
                Cancel
              </GlassButton>
              <GlassButton type="submit" variant="primary" disabled={loading} className="flex-1">
                {loading ? <Spinner size="sm" /> : "Quick Add"}
              </GlassButton>
            </div>
          </form>
        </>
      )}

      {/* Add Department Form */}
      {step === "add-department" && (
        <>
          <BackButton />
          <form onSubmit={handleAddDepartment} className="space-y-4">
            <GlassInput
              label="Department Name *"
              value={deptForm.name}
              onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
              placeholder="Engineering"
              required
            />
            <GlassInput
              label="Code"
              value={deptForm.code}
              onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
              placeholder="ENG"
            />
            <GlassSelect
              label="Parent Department"
              value={deptForm.parentId}
              onChange={(e) => setDeptForm({ ...deptForm, parentId: e.target.value })}
              options={[
                { value: "", label: "None (top-level)" },
                ...departments.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
            <div className="pt-4 flex gap-3">
              <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">
                Cancel
              </GlassButton>
              <GlassButton type="submit" variant="primary" disabled={loading} className="flex-1">
                {loading ? <Spinner size="sm" /> : "Create Department"}
              </GlassButton>
            </div>
          </form>
        </>
      )}

      {/* Record Time Off Form */}
      {step === "record-time-off" && (
        <>
          <BackButton />
          <form onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            try {
              const res = await fetch("/api/people/time-off", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(timeOffForm),
              });
              if (!res.ok) throw new Error("Failed to record time off");
              addToast("success", "Time off recorded");
              handleClose();
              onSuccess();
            } catch {
              addToast("error", "Failed to record time off");
            } finally {
              setLoading(false);
            }
          }} className="space-y-4">
            <GlassSelect
              label="Employee"
              value={timeOffForm.personId}
              onChange={(e) => setTimeOffForm({ ...timeOffForm, personId: e.target.value })}
              options={[
                { value: "", label: "Select employee" },
                ...people.filter(p => p.types.includes("staff")).map((p) => ({ value: p.id, label: p.fullName })),
              ]}
            />
            <GlassSelect
              label="Leave Type"
              value={timeOffForm.leaveType}
              onChange={(e) => setTimeOffForm({ ...timeOffForm, leaveType: e.target.value as typeof timeOffForm.leaveType })}
              options={[
                { value: "vacation", label: "Vacation" },
                { value: "sick", label: "Sick Leave" },
                { value: "personal", label: "Personal Day" },
                { value: "other", label: "Other" },
              ]}
            />
            <GlassInput
              label="Start Date"
              type="date"
              value={timeOffForm.startDate}
              onChange={(e) => setTimeOffForm({ ...timeOffForm, startDate: e.target.value })}
              required
            />
            <GlassInput
              label="End Date"
              type="date"
              value={timeOffForm.endDate}
              onChange={(e) => setTimeOffForm({ ...timeOffForm, endDate: e.target.value })}
              required
            />
            <GlassInput
              label="Notes"
              value={timeOffForm.notes}
              onChange={(e) => setTimeOffForm({ ...timeOffForm, notes: e.target.value })}
              placeholder="Reason or additional details"
            />
            <div className="pt-4 flex gap-3">
              <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">Cancel</GlassButton>
              <GlassButton type="submit" variant="primary" disabled={loading} className="flex-1">
                {loading ? <Spinner size="sm" /> : "Record Time Off"}
              </GlassButton>
            </div>
          </form>
        </>
      )}

      {/* Run Payroll Form */}
      {step === "run-payroll" && (
        <>
          <BackButton />
          <form onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            try {
              const res = await fetch("/api/people/payroll", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payrollForm),
              });
              if (!res.ok) throw new Error("Failed to run payroll");
              addToast("success", "Payroll recorded");
              handleClose();
              onSuccess();
            } catch {
              addToast("error", "Failed to run payroll");
            } finally {
              setLoading(false);
            }
          }} className="space-y-4">
            <GlassInput
              label="Pay Period"
              type="month"
              value={payrollForm.payPeriod}
              onChange={(e) => setPayrollForm({ ...payrollForm, payPeriod: e.target.value })}
              required
            />
            <GlassInput
              label="Pay Date"
              type="date"
              value={payrollForm.payDate}
              onChange={(e) => setPayrollForm({ ...payrollForm, payDate: e.target.value })}
              required
            />
            <GlassInput
              label="Total Amount"
              type="number"
              step="0.01"
              min="0"
              value={payrollForm.totalAmount}
              onChange={(e) => setPayrollForm({ ...payrollForm, totalAmount: e.target.value })}
              placeholder="0.00"
              required
            />
            <GlassInput
              label="Notes"
              value={payrollForm.notes}
              onChange={(e) => setPayrollForm({ ...payrollForm, notes: e.target.value })}
              placeholder="Any additional details"
            />
            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm text-blue-300">
                This creates a payroll expense journal entry. Individual employee payments should be managed through payroll software.
              </p>
            </div>
            <div className="pt-4 flex gap-3">
              <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">Cancel</GlassButton>
              <GlassButton type="submit" variant="primary" disabled={loading} className="flex-1">
                {loading ? <Spinner size="sm" /> : "Record Payroll"}
              </GlassButton>
            </div>
          </form>
        </>
      )}

      {/* Performance Note Form */}
      {step === "performance-note" && (
        <>
          <BackButton />
          <form onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            try {
              const res = await fetch("/api/people/performance-notes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(perfNoteForm),
              });
              if (!res.ok) throw new Error("Failed to add note");
              addToast("success", "Performance note added");
              handleClose();
              onSuccess();
            } catch {
              addToast("error", "Failed to add note");
            } finally {
              setLoading(false);
            }
          }} className="space-y-4">
            <GlassSelect
              label="Employee *"
              value={perfNoteForm.personId}
              onChange={(e) => setPerfNoteForm({ ...perfNoteForm, personId: e.target.value })}
              options={[
                { value: "", label: "Select employee" },
                ...people.filter(p => p.types.includes("staff")).map((p) => ({ value: p.id, label: p.fullName })),
              ]}
              required
            />
            <GlassSelect
              label="Type"
              value={perfNoteForm.noteType}
              onChange={(e) => setPerfNoteForm({ ...perfNoteForm, noteType: e.target.value as typeof perfNoteForm.noteType })}
              options={[
                { value: "praise", label: "Praise / Recognition" },
                { value: "coaching", label: "Coaching / Feedback" },
                { value: "warning", label: "Warning / Concern" },
                { value: "general", label: "General Note" },
              ]}
            />
            <GlassInput
              label="Title *"
              value={perfNoteForm.title}
              onChange={(e) => setPerfNoteForm({ ...perfNoteForm, title: e.target.value })}
              placeholder="Brief summary"
              required
            />
            <div>
              <label className="block text-sm font-medium text-white/70 mb-2">Details *</label>
              <textarea
                className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                rows={4}
                value={perfNoteForm.content}
                onChange={(e) => setPerfNoteForm({ ...perfNoteForm, content: e.target.value })}
                placeholder="Describe the situation, behavior, and impact..."
                required
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={perfNoteForm.isPrivate}
                onChange={(e) => setPerfNoteForm({ ...perfNoteForm, isPrivate: e.target.checked })}
                className="w-4 h-4 rounded border-white/30 bg-white/10 text-blue-500"
              />
              <span className="text-sm text-white/70">Private (only visible to HR)</span>
            </label>
            <div className="pt-4 flex gap-3">
              <GlassButton type="button" variant="ghost" onClick={handleClose} className="flex-1">Cancel</GlassButton>
              <GlassButton type="submit" variant="primary" disabled={loading} className="flex-1">
                {loading ? <Spinner size="sm" /> : "Add Note"}
              </GlassButton>
            </div>
          </form>
        </>
      )}
    </SlideOver>
  );
}

/* =============================================================================
   MAIN PAGE CONTENT
   ============================================================================= */

function PeoplePageContent() {
  const [activeTab, setActiveTab] = React.useState<TabType>("people");
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [people, setPeople] = React.useState<Person[]>([]);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [alerts, setAlerts] = React.useState<Alert[]>([]);
  const [metrics, setMetrics] = React.useState<HRMetrics | null>(null);
  const [loading, setLoading] = React.useState(true);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [peopleRes, tasksRes, alertsRes] = await Promise.all([
        apiGet<{ people: Person[] }>("/api/people?limit=100"),
        apiGet<{ tasks: Task[] }>("/api/operations/tasks?domain=hr&status=open&limit=10").catch(() => ({ tasks: [] })),
        apiGet<{ items: Alert[] }>("/api/grc/alerts?status=active&limit=20").catch(() => ({ items: [] })),
      ]);

      const allPeople = peopleRes.people || [];
      setPeople(allPeople);

      // Filter HR-related tasks and alerts
      setTasks((tasksRes.tasks || []).filter((t) => t.domain === "hr" || !t.domain));
      setAlerts((alertsRes.items || []).filter((a) => a.domain === "hr"));

      // Calculate metrics
      const staff = allPeople.filter((p) => p.types.includes("staff"));
      const contractors = allPeople.filter((p) => p.types.includes("contractor"));
      const quickAdd = allPeople.filter((p) => p.isQuickAdd);

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const newHires = allPeople.filter((p) => new Date(p.createdAt) >= thirtyDaysAgo && p.types.includes("staff"));

      setMetrics({
        totalPeople: allPeople.length,
        staffCount: staff.length,
        contractorCount: contractors.length,
        quickAddCount: quickAdd.length,
        newHires30d: newHires.length,
        leavers90d: 0, // Would need employment status tracking
        payrollCostMTD: 0, // Would need payroll data
        expiringDocs: 0, // Would need document expiry data
      });
    } catch (err) {
      console.error("Failed to load HR data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRecordActivityOpen = () => {
    setDrawerOpen(true);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">HR & People</h1>
          <p className="text-sm text-white/50 mt-1">
            Manage staff, payroll, performance, and compliance
          </p>
        </div>
        <GlassButton
          variant="primary"
          size="lg"
          onClick={handleRecordActivityOpen}
          className="group"
        >
          <span className="flex items-center gap-2">
            <span className="p-1 rounded-lg bg-white/20 group-hover:bg-white/30 transition-colors">
              {Icons.bolt}
            </span>
            Record Activity
          </span>
        </GlassButton>
      </div>

      {/* Analytics Cards */}
      <section>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricCard
            label="Headcount"
            value={loading ? "-" : metrics?.staffCount ?? 0}
            icon={Icons.users}
            variant="default"
          />
          <MetricCard
            label="New Hires (30d)"
            value={loading ? "-" : metrics?.newHires30d ?? 0}
            icon={Icons.user}
            variant={metrics?.newHires30d && metrics.newHires30d > 0 ? "success" : "default"}
          />
          <MetricCard
            label="Contractors"
            value={loading ? "-" : metrics?.contractorCount ?? 0}
            icon={Icons.briefcase}
            variant="default"
          />
          <MetricCard
            label="Quick-Add"
            value={loading ? "-" : metrics?.quickAddCount ?? 0}
            icon={Icons.sparkles}
            variant={metrics?.quickAddCount && metrics.quickAddCount > 0 ? "warning" : "default"}
            subtext={metrics?.quickAddCount && metrics.quickAddCount > 0 ? "need completion" : undefined}
          />
        </div>
      </section>

      {/* Tasks & Alerts */}
      <TasksAlertsSection tasks={tasks} alerts={alerts} loading={loading} />

      {/* Tab Navigation */}
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === "people" && (
          <PeopleTab onRecordActivity={handleRecordActivityOpen} />
        )}
        {activeTab === "payroll" && (
          <PayrollTab onRecordActivity={handleRecordActivityOpen} />
        )}
        {activeTab === "performance" && (
          <PerformanceTab />
        )}
        {activeTab === "documents" && (
          <DocumentsTab />
        )}
        {activeTab === "settings" && (
          <SettingsTab />
        )}
      </div>

      {/* Record Activity Drawer */}
      <RecordActivityDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSuccess={loadData}
        people={people}
      />
    </div>
  );
}

/* =============================================================================
   MAIN PAGE EXPORT
   ============================================================================= */

export default function PeoplePage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><Spinner size="lg" /></div>}>
      <PeoplePageContent />
    </Suspense>
  );
}
