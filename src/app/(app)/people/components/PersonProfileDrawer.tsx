"use client";

import * as React from "react";
import {
  GlassCard,
  GlassButton,
  GlassBadge,
  SlideOver,
  Spinner,
} from "@/components/ui/glass";
import { apiGet, formatDate } from "@/lib/http";

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
  departmentId: string | null;
  departmentName?: string | null;
  isQuickAdd: boolean;
  isActive: boolean;
  createdAt: string;
  notes?: string | null;
}

interface Employee {
  id: string;
  employeeNumber: string;
  hireDate: string | null;
  employmentStatus: string;
  employmentType: string;
  terminationDate: string | null;
  flsaStatus: string | null;
}

interface Compensation {
  id: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  payType: string;
  payFrequency: string;
  payRate: string;
  currency: string;
}

interface Document {
  id: string;
  originalFilename: string;
  mimeType: string;
  documentCategory?: string;
  expiryDate?: string;
  verificationStatus?: string;
  createdAt: string;
}

interface Activity {
  id: string;
  action: string;
  occurredAt: string;
  metadata: Record<string, unknown>;
}

/* =============================================================================
   ICONS
   ============================================================================= */

const Icons = {
  user: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
    </svg>
  ),
  briefcase: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 00.75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 00-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0112 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 01-.673-.38m0 0A2.18 2.18 0 013 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 013.413-.387m7.5 0V5.25A2.25 2.25 0 0013.5 3h-3a2.25 2.25 0 00-2.25 2.25v.894m7.5 0a48.667 48.667 0 00-7.5 0M12 12.75h.008v.008H12v-.008z" />
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
  clock: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  email: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  ),
  phone: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  ),
  edit: (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
    </svg>
  ),
};

/* =============================================================================
   TAB COMPONENTS
   ============================================================================= */

type TabType = "summary" | "employment" | "payroll" | "documents" | "activity";

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}

function TabButton({ active, onClick, children }: TabButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        px-3 py-2 text-sm font-medium rounded-lg transition-colors
        ${active
          ? "bg-white/10 text-white"
          : "text-white/50 hover:text-white/70 hover:bg-white/5"
        }
      `}
    >
      {children}
    </button>
  );
}

/* =============================================================================
   INFO ROW COMPONENT
   ============================================================================= */

interface InfoRowProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
}

function InfoRow({ label, value, icon }: InfoRowProps) {
  return (
    <div className="flex items-start gap-3 py-2">
      {icon && <div className="text-white/40 mt-0.5">{icon}</div>}
      <div className="flex-1">
        <div className="text-xs text-white/40 uppercase tracking-wide">{label}</div>
        <div className="text-sm text-white mt-0.5">{value || <span className="text-white/30">Not set</span>}</div>
      </div>
    </div>
  );
}

/* =============================================================================
   MAIN COMPONENT
   ============================================================================= */

interface PersonProfileDrawerProps {
  open: boolean;
  onClose: () => void;
  personId: string | null;
  onEdit?: (person: Person) => void;
}

export function PersonProfileDrawer({ open, onClose, personId, onEdit }: PersonProfileDrawerProps) {
  const [activeTab, setActiveTab] = React.useState<TabType>("summary");
  const [loading, setLoading] = React.useState(true);
  const [person, setPerson] = React.useState<Person | null>(null);
  const [employee, setEmployee] = React.useState<Employee | null>(null);
  const [compensation, setCompensation] = React.useState<Compensation[]>([]);
  const [documents, setDocuments] = React.useState<Document[]>([]);
  const [activities, setActivities] = React.useState<Activity[]>([]);

  // Load person data
  React.useEffect(() => {
    if (!open || !personId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setActiveTab("summary");

    // Fetch person details
    Promise.all([
      apiGet<{ person: Person }>(`/api/people/${personId}`).catch(() => ({ person: null })),
    ]).then(([personRes]) => {
      setPerson(personRes.person);

      // If person is staff, try to fetch employee data
      if (personRes.person?.types?.includes("staff")) {
        apiGet<{ employee: Employee }>(`/api/payroll/employees?personId=${personId}`)
          .then((res) => {
            if (res.employee) {
              setEmployee(res.employee);
              // Fetch compensation for this employee
              apiGet<{ items: Compensation[] }>(`/api/payroll/employees/${res.employee.id}/compensation`)
                .then((compRes) => setCompensation(compRes.items || []))
                .catch(() => setCompensation([]));
            }
          })
          .catch(() => setEmployee(null));
      }

      setLoading(false);
    });
  }, [open, personId]);

  // Load documents when tab changes
  React.useEffect(() => {
    if (activeTab === "documents" && personId) {
      apiGet<{ items: Document[] }>(`/api/people/${personId}/documents`)
        .then((res) => setDocuments(res.items || []))
        .catch(() => setDocuments([]));
    }
  }, [activeTab, personId]);

  // Load activities when tab changes
  React.useEffect(() => {
    if (activeTab === "activity" && personId) {
      apiGet<{ items: Activity[] }>(`/api/grc/audit?entityType=person&entityId=${personId}&limit=20`)
        .then((res) => setActivities(res.items || []))
        .catch(() => setActivities([]));
    }
  }, [activeTab, personId]);

  const handleClose = () => {
    setPerson(null);
    setEmployee(null);
    setCompensation([]);
    setDocuments([]);
    setActivities([]);
    onClose();
  };

  const personTypes: Record<string, string> = {
    staff: "Staff",
    contractor: "Contractor",
    sales_rep: "Sales Rep",
    service_provider: "Service Provider",
    supplier_contact: "Supplier Contact",
    customer_contact: "Customer Contact",
    partner_contact: "Partner Contact",
  };

  const employmentStatusColors: Record<string, string> = {
    active: "success",
    on_leave: "warning",
    suspended: "warning",
    terminated: "danger",
    retired: "default",
  };

  return (
    <SlideOver
      open={open}
      onClose={handleClose}
      title={person?.fullName || "Person Details"}
      width="lg"
    >
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Spinner size="lg" />
        </div>
      ) : !person ? (
        <div className="text-center py-12 text-white/50">
          Person not found
        </div>
      ) : (
        <div className="space-y-6">
          {/* Header with Edit Button */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center text-2xl font-bold text-white">
                {person.fullName.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-white">{person.fullName}</h2>
                {person.displayName && (
                  <p className="text-sm text-white/50">"{person.displayName}"</p>
                )}
                <div className="flex flex-wrap gap-1 mt-2">
                  {person.types.map((type) => (
                    <GlassBadge key={type} variant="default">
                      {personTypes[type] || type}
                    </GlassBadge>
                  ))}
                  {person.isQuickAdd && (
                    <GlassBadge variant="warning">Quick-Add</GlassBadge>
                  )}
                  {!person.isActive && (
                    <GlassBadge variant="danger">Inactive</GlassBadge>
                  )}
                </div>
              </div>
            </div>
            {onEdit && (
              <GlassButton variant="ghost" size="sm" onClick={() => onEdit(person)}>
                {Icons.edit}
                <span className="ml-1">Edit</span>
              </GlassButton>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-white/5 rounded-xl overflow-x-auto">
            <TabButton active={activeTab === "summary"} onClick={() => setActiveTab("summary")}>
              Summary
            </TabButton>
            {person.types.includes("staff") && (
              <>
                <TabButton active={activeTab === "employment"} onClick={() => setActiveTab("employment")}>
                  Employment
                </TabButton>
                <TabButton active={activeTab === "payroll"} onClick={() => setActiveTab("payroll")}>
                  Payroll
                </TabButton>
              </>
            )}
            <TabButton active={activeTab === "documents"} onClick={() => setActiveTab("documents")}>
              Documents
            </TabButton>
            <TabButton active={activeTab === "activity"} onClick={() => setActiveTab("activity")}>
              Activity
            </TabButton>
          </div>

          {/* Tab Content */}
          <div className="min-h-[300px]">
            {/* Summary Tab */}
            {activeTab === "summary" && (
              <div className="space-y-4">
                <GlassCard padding="sm">
                  <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-3">
                    Contact Information
                  </h3>
                  <div className="space-y-1">
                    <InfoRow
                      label="Email"
                      value={person.primaryEmail}
                      icon={Icons.email}
                    />
                    <InfoRow
                      label="Phone"
                      value={person.primaryPhone}
                      icon={Icons.phone}
                    />
                    {person.whatsappNumber && (
                      <InfoRow
                        label="WhatsApp"
                        value={person.whatsappNumber}
                      />
                    )}
                    <InfoRow
                      label="Preferred Channel"
                      value={person.preferredChannel?.toUpperCase()}
                    />
                  </div>
                </GlassCard>

                <GlassCard padding="sm">
                  <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-3">
                    Work Information
                  </h3>
                  <div className="space-y-1">
                    <InfoRow
                      label="Job Title"
                      value={person.jobTitle}
                      icon={Icons.briefcase}
                    />
                    <InfoRow
                      label="Department"
                      value={person.departmentName}
                    />
                    <InfoRow
                      label="Added"
                      value={formatDate(person.createdAt)}
                      icon={Icons.clock}
                    />
                  </div>
                </GlassCard>

                {person.notes && (
                  <GlassCard padding="sm">
                    <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-3">
                      Notes
                    </h3>
                    <p className="text-sm text-white/70 whitespace-pre-wrap">{person.notes}</p>
                  </GlassCard>
                )}
              </div>
            )}

            {/* Employment Tab */}
            {activeTab === "employment" && (
              <div className="space-y-4">
                {employee ? (
                  <>
                    <GlassCard padding="sm">
                      <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-3">
                        Employment Details
                      </h3>
                      <div className="space-y-1">
                        <InfoRow
                          label="Employee Number"
                          value={employee.employeeNumber}
                        />
                        <InfoRow
                          label="Status"
                          value={
                            <GlassBadge variant={employmentStatusColors[employee.employmentStatus] as "success" | "warning" | "danger" | "default" || "default"}>
                              {employee.employmentStatus.replace("_", " ").toUpperCase()}
                            </GlassBadge>
                          }
                        />
                        <InfoRow
                          label="Type"
                          value={employee.employmentType.replace("_", " ")}
                        />
                        <InfoRow
                          label="Hire Date"
                          value={employee.hireDate ? formatDate(employee.hireDate) : null}
                        />
                        {employee.terminationDate && (
                          <InfoRow
                            label="Termination Date"
                            value={formatDate(employee.terminationDate)}
                          />
                        )}
                        {employee.flsaStatus && (
                          <InfoRow
                            label="FLSA Status"
                            value={employee.flsaStatus}
                          />
                        )}
                      </div>
                    </GlassCard>
                  </>
                ) : (
                  <GlassCard padding="sm">
                    <div className="text-center py-8">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-white/10 flex items-center justify-center">
                        {Icons.briefcase}
                      </div>
                      <p className="text-sm text-white/50 mb-4">No employee record found</p>
                      <GlassButton variant="primary" size="sm">
                        Create Employee Record
                      </GlassButton>
                    </div>
                  </GlassCard>
                )}
              </div>
            )}

            {/* Payroll Tab */}
            {activeTab === "payroll" && (
              <div className="space-y-4">
                {compensation.length > 0 ? (
                  <GlassCard padding="sm">
                    <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-3">
                      Compensation History
                    </h3>
                    <div className="space-y-3">
                      {compensation.map((comp, index) => (
                        <div
                          key={comp.id}
                          className={`p-3 rounded-lg ${index === 0 ? "bg-blue-500/10 border border-blue-500/20" : "bg-white/5"}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-white">
                              {comp.currency} {parseFloat(comp.payRate).toLocaleString()}
                            </span>
                            {index === 0 && (
                              <GlassBadge variant="info">Current</GlassBadge>
                            )}
                          </div>
                          <div className="text-xs text-white/50">
                            {comp.payType} / {comp.payFrequency}
                          </div>
                          <div className="text-xs text-white/40 mt-1">
                            Effective: {formatDate(comp.effectiveFrom)}
                            {comp.effectiveTo && ` - ${formatDate(comp.effectiveTo)}`}
                          </div>
                        </div>
                      ))}
                    </div>
                  </GlassCard>
                ) : (
                  <GlassCard padding="sm">
                    <div className="text-center py-8">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-white/10 flex items-center justify-center">
                        {Icons.currency}
                      </div>
                      <p className="text-sm text-white/50 mb-4">No compensation records</p>
                      {employee && (
                        <GlassButton variant="primary" size="sm">
                          Add Compensation
                        </GlassButton>
                      )}
                    </div>
                  </GlassCard>
                )}
              </div>
            )}

            {/* Documents Tab */}
            {activeTab === "documents" && (
              <div className="space-y-4">
                {documents.length > 0 ? (
                  <div className="space-y-2">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/8 transition-colors"
                      >
                        <div className="p-2 rounded-lg bg-white/10 text-white/60">
                          {Icons.document}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">
                            {doc.originalFilename}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            {doc.documentCategory && (
                              <GlassBadge variant="default">{doc.documentCategory}</GlassBadge>
                            )}
                            {doc.verificationStatus && (
                              <GlassBadge
                                variant={doc.verificationStatus === "verified" ? "success" : "warning"}
                              >
                                {doc.verificationStatus}
                              </GlassBadge>
                            )}
                            <span className="text-xs text-white/40">
                              {formatDate(doc.createdAt)}
                            </span>
                          </div>
                          {doc.expiryDate && (
                            <div className="text-xs text-amber-400 mt-1">
                              Expires: {formatDate(doc.expiryDate)}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <GlassCard padding="sm">
                    <div className="text-center py-8">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-white/10 flex items-center justify-center">
                        {Icons.document}
                      </div>
                      <p className="text-sm text-white/50 mb-4">No documents uploaded</p>
                      <GlassButton variant="primary" size="sm">
                        Upload Document
                      </GlassButton>
                    </div>
                  </GlassCard>
                )}
              </div>
            )}

            {/* Activity Tab */}
            {activeTab === "activity" && (
              <div className="space-y-2">
                {activities.length > 0 ? (
                  activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 p-3 rounded-lg bg-white/5"
                    >
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2" />
                      <div className="flex-1">
                        <div className="text-sm text-white">{activity.action}</div>
                        <div className="text-xs text-white/40 mt-1">
                          {formatDate(activity.occurredAt)}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-white/50">
                    <p className="text-sm">No activity recorded</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="pt-4 border-t border-white/10">
            <h3 className="text-xs font-semibold text-white/50 uppercase tracking-wide mb-3">
              Quick Actions
            </h3>
            <div className="flex flex-wrap gap-2">
              <GlassButton variant="ghost" size="sm">
                Record Time Off
              </GlassButton>
              <GlassButton variant="ghost" size="sm">
                Add Note
              </GlassButton>
              <GlassButton variant="ghost" size="sm">
                Upload Document
              </GlassButton>
            </div>
          </div>
        </div>
      )}
    </SlideOver>
  );
}
