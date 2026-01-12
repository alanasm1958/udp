"use client";

import * as React from "react";
import { GlassCard, PageHeader, Spinner, GlassButton, SlideOver, GlassInput, GlassTextarea, GlassSelect, GlassTabs, EmptyState, useToast } from "@/components/ui/glass";
import { apiGet, apiPatch, apiPost, apiDelete } from "@/lib/http";

interface TenantInfo {
  tenant: {
    id: string;
    name: string;
    baseCurrency: string;
    createdAt: string;
    userCount: number;
    activeUserCount: number;
  };
}

interface LegalProfile {
  id?: string;
  legalName: string | null;
  registrationNumber: string | null;
  taxId: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  notes: string | null;
  updatedAt?: string;
}

interface Department {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  parentDepartmentId: string | null;
  isActive: boolean;
  children?: Department[];
}

interface OrgUser {
  id: string;
  userId: string;
  name: string;
  email: string;
  jobTitle: string | null;
  departmentId: string | null;
  managerId: string | null;
  directReports: OrgUser[];
}

interface OrgData {
  departments: Department[];
  topManagers: OrgUser[];
  unassignedUsers: OrgUser[];
  stats: {
    totalDepartments: number;
    totalUsers: number;
    visibleUsers: number;
  };
}

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "legal", label: "Legal & Tax" },
  { id: "departments", label: "Departments" },
  { id: "org-chart", label: "Org Chart" },
];

export default function OrganizationPage() {
  const [activeTab, setActiveTab] = React.useState("overview");
  const [data, setData] = React.useState<TenantInfo | null>(null);
  const [legal, setLegal] = React.useState<LegalProfile | null>(null);
  const [depts, setDepts] = React.useState<Department[]>([]);
  const [deptTree, setDeptTree] = React.useState<Department[]>([]);
  const [orgData, setOrgData] = React.useState<OrgData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [editingLegal, setEditingLegal] = React.useState(false);
  const [legalForm, setLegalForm] = React.useState<LegalProfile>({
    legalName: null,
    registrationNumber: null,
    taxId: null,
    address: null,
    city: null,
    region: null,
    country: null,
    postalCode: null,
    phone: null,
    email: null,
    website: null,
    notes: null,
  });
  const [deptSlideOver, setDeptSlideOver] = React.useState<{ open: boolean; mode: "create" | "edit"; dept?: Department }>({ open: false, mode: "create" });
  const [deptForm, setDeptForm] = React.useState({ name: "", code: "", description: "", parentDepartmentId: "" });
  const { addToast } = useToast();

  // Load all data
  React.useEffect(() => {
    async function loadData() {
      try {
        const [tenantResult, legalResult, deptResult, orgResult] = await Promise.all([
          apiGet<TenantInfo>("/api/admin/tenant"),
          apiGet<{ profile: LegalProfile }>("/api/company/legal"),
          apiGet<{ items: Department[]; tree: Department[] }>("/api/company/departments"),
          apiGet<OrgData>("/api/company/org"),
        ]);
        setData(tenantResult);
        setLegal(legalResult.profile);
        setLegalForm(legalResult.profile);
        setDepts(deptResult.items);
        setDeptTree(deptResult.tree);
        setOrgData(orgResult);
      } catch {
        // Silently handle
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleSaveLegal = async () => {
    try {
      setSaving(true);
      const result = await apiPatch<{ success: boolean; profile: LegalProfile }>("/api/company/legal", legalForm);
      if (result.success) {
        setLegal(result.profile);
        setEditingLegal(false);
        addToast("success", "Legal profile updated");
      }
    } catch {
      addToast("error", "Failed to save legal profile");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateDept = async () => {
    if (!deptForm.name.trim()) {
      addToast("error", "Department name is required");
      return;
    }

    try {
      setSaving(true);
      const result = await apiPost<{ success: boolean; department: Department }>("/api/company/departments", {
        name: deptForm.name.trim(),
        code: deptForm.code.trim() || null,
        description: deptForm.description.trim() || null,
        parentDepartmentId: deptForm.parentDepartmentId || null,
      });
      if (result.success) {
        setDepts((prev) => [...prev, result.department]);
        setDeptSlideOver({ open: false, mode: "create" });
        setDeptForm({ name: "", code: "", description: "", parentDepartmentId: "" });
        addToast("success", "Department created");
        // Reload to get updated tree
        const deptResult = await apiGet<{ items: Department[]; tree: Department[] }>("/api/company/departments");
        setDepts(deptResult.items);
        setDeptTree(deptResult.tree);
      }
    } catch {
      addToast("error", "Failed to create department");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateDept = async () => {
    if (!deptSlideOver.dept || !deptForm.name.trim()) {
      addToast("error", "Department name is required");
      return;
    }

    try {
      setSaving(true);
      const result = await apiPatch<{ success: boolean; department: Department }>(
        `/api/company/departments/${deptSlideOver.dept.id}`,
        {
          name: deptForm.name.trim(),
          code: deptForm.code.trim() || null,
          description: deptForm.description.trim() || null,
          parentDepartmentId: deptForm.parentDepartmentId || null,
        }
      );
      if (result.success) {
        setDepts((prev) => prev.map((d) => (d.id === result.department.id ? result.department : d)));
        setDeptSlideOver({ open: false, mode: "create" });
        setDeptForm({ name: "", code: "", description: "", parentDepartmentId: "" });
        addToast("success", "Department updated");
        // Reload to get updated tree
        const deptResult = await apiGet<{ items: Department[]; tree: Department[] }>("/api/company/departments");
        setDepts(deptResult.items);
        setDeptTree(deptResult.tree);
      }
    } catch {
      addToast("error", "Failed to update department");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteDept = async (id: string) => {
    if (!confirm("Are you sure you want to delete this department?")) return;

    try {
      await apiDelete(`/api/company/departments/${id}`);
      setDepts((prev) => prev.filter((d) => d.id !== id));
      addToast("success", "Department deleted");
      // Reload to get updated tree
      const deptResult = await apiGet<{ items: Department[]; tree: Department[] }>("/api/company/departments");
      setDepts(deptResult.items);
      setDeptTree(deptResult.tree);
    } catch (error: unknown) {
      const err = error as { message?: string };
      addToast("error", err?.message || "Failed to delete department");
    }
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
        title="Organization"
        description="Company profile, legal information, and org structure"
      />

      <GlassTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <GlassCard>
            <h3 className="text-lg font-semibold text-white mb-4">Company Details</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-white/50 block mb-1">
                  Company Name
                </label>
                <p className="text-white">{data?.tenant.name || "—"}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-white/50 block mb-1">
                  Base Currency
                </label>
                <p className="text-white">{data?.tenant.baseCurrency || "USD"}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-white/50 block mb-1">
                  Created
                </label>
                <p className="text-white">
                  {data?.tenant.createdAt
                    ? new Date(data.tenant.createdAt).toLocaleDateString()
                    : "—"}
                </p>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <h3 className="text-lg font-semibold text-white mb-4">Team</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-white/50 block mb-1">
                  Total Users
                </label>
                <p className="text-2xl font-bold text-white">{data?.tenant.userCount || 0}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-white/50 block mb-1">
                  Active Users
                </label>
                <p className="text-2xl font-bold text-emerald-400">{data?.tenant.activeUserCount || 0}</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <h3 className="text-lg font-semibold text-white mb-4">Organization Structure</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-white/50 block mb-1">
                  Departments
                </label>
                <p className="text-2xl font-bold text-blue-400">{orgData?.stats.totalDepartments || 0}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-white/50 block mb-1">
                  Users in Org Chart
                </label>
                <p className="text-2xl font-bold text-purple-400">{orgData?.stats.visibleUsers || 0}</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard>
            <h3 className="text-lg font-semibold text-white mb-4">Legal Status</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-white/50 block mb-1">
                  Legal Name
                </label>
                <p className="text-white">{legal?.legalName || "Not set"}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-white/50 block mb-1">
                  Tax ID
                </label>
                <p className="text-white">{legal?.taxId || "Not set"}</p>
              </div>
              <GlassButton
                size="sm"
                variant="ghost"
                onClick={() => setActiveTab("legal")}
              >
                View Details
              </GlassButton>
            </div>
          </GlassCard>
        </div>
      )}

      {activeTab === "legal" && (
        <GlassCard>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Legal & Tax Information</h3>
            <GlassButton
              size="sm"
              variant={editingLegal ? "ghost" : "primary"}
              onClick={() => {
                if (editingLegal) {
                  setLegalForm(legal || {
                    legalName: null,
                    registrationNumber: null,
                    taxId: null,
                    address: null,
                    city: null,
                    region: null,
                    country: null,
                    postalCode: null,
                    phone: null,
                    email: null,
                    website: null,
                    notes: null,
                  });
                }
                setEditingLegal(!editingLegal);
              }}
            >
              {editingLegal ? "Cancel" : "Edit"}
            </GlassButton>
          </div>

          {editingLegal ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <GlassInput
                  label="Legal Name"
                  value={legalForm.legalName || ""}
                  onChange={(e) => setLegalForm((f) => ({ ...f, legalName: e.target.value }))}
                  placeholder="Full legal company name"
                />
                <GlassInput
                  label="Registration Number"
                  value={legalForm.registrationNumber || ""}
                  onChange={(e) => setLegalForm((f) => ({ ...f, registrationNumber: e.target.value }))}
                  placeholder="Company registration number"
                />
                <GlassInput
                  label="Tax ID"
                  value={legalForm.taxId || ""}
                  onChange={(e) => setLegalForm((f) => ({ ...f, taxId: e.target.value }))}
                  placeholder="Tax identification number"
                />
                <GlassInput
                  label="Phone"
                  value={legalForm.phone || ""}
                  onChange={(e) => setLegalForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="Main phone number"
                />
                <GlassInput
                  label="Email"
                  value={legalForm.email || ""}
                  onChange={(e) => setLegalForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="Official email address"
                />
                <GlassInput
                  label="Website"
                  value={legalForm.website || ""}
                  onChange={(e) => setLegalForm((f) => ({ ...f, website: e.target.value }))}
                  placeholder="https://example.com"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-white/70 block mb-2">Address</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <GlassInput
                    label="Street Address"
                    value={legalForm.address || ""}
                    onChange={(e) => setLegalForm((f) => ({ ...f, address: e.target.value }))}
                    placeholder="Street address"
                  />
                  <GlassInput
                    label="City"
                    value={legalForm.city || ""}
                    onChange={(e) => setLegalForm((f) => ({ ...f, city: e.target.value }))}
                    placeholder="City"
                  />
                  <GlassInput
                    label="State/Region"
                    value={legalForm.region || ""}
                    onChange={(e) => setLegalForm((f) => ({ ...f, region: e.target.value }))}
                    placeholder="State or region"
                  />
                  <GlassInput
                    label="Postal Code"
                    value={legalForm.postalCode || ""}
                    onChange={(e) => setLegalForm((f) => ({ ...f, postalCode: e.target.value }))}
                    placeholder="Postal code"
                  />
                  <GlassInput
                    label="Country"
                    value={legalForm.country || ""}
                    onChange={(e) => setLegalForm((f) => ({ ...f, country: e.target.value }))}
                    placeholder="Country"
                  />
                </div>
              </div>

              <GlassTextarea
                label="Notes"
                value={legalForm.notes || ""}
                onChange={(e) => setLegalForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Additional legal notes..."
                rows={3}
              />

              <div className="flex justify-end gap-2">
                <GlassButton variant="ghost" onClick={() => setEditingLegal(false)}>
                  Cancel
                </GlassButton>
                <GlassButton variant="primary" onClick={handleSaveLegal} disabled={saving}>
                  {saving ? "Saving..." : "Save Changes"}
                </GlassButton>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="text-xs font-medium text-white/50 block mb-1">Legal Name</label>
                  <p className="text-white">{legal?.legalName || "—"}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-white/50 block mb-1">Registration Number</label>
                  <p className="text-white">{legal?.registrationNumber || "—"}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-white/50 block mb-1">Tax ID</label>
                  <p className="text-white">{legal?.taxId || "—"}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-white/50 block mb-1">Phone</label>
                  <p className="text-white">{legal?.phone || "—"}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-white/50 block mb-1">Email</label>
                  <p className="text-white">{legal?.email || "—"}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-white/50 block mb-1">Website</label>
                  <p className="text-white">{legal?.website || "—"}</p>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-white/50 block mb-1">Address</label>
                <p className="text-white">
                  {[legal?.address, legal?.city, legal?.region, legal?.postalCode, legal?.country]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </p>
              </div>

              {legal?.notes && (
                <div>
                  <label className="text-xs font-medium text-white/50 block mb-1">Notes</label>
                  <p className="text-white whitespace-pre-wrap">{legal.notes}</p>
                </div>
              )}

              {legal?.updatedAt && (
                <p className="text-xs text-white/30">
                  Last updated: {new Date(legal.updatedAt).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </GlassCard>
      )}

      {activeTab === "departments" && (
        <GlassCard>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-white">Departments</h3>
            <GlassButton
              size="sm"
              variant="primary"
              onClick={() => {
                setDeptForm({ name: "", code: "", description: "", parentDepartmentId: "" });
                setDeptSlideOver({ open: true, mode: "create" });
              }}
            >
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              Add Department
            </GlassButton>
          </div>

          {depts.length === 0 ? (
            <EmptyState
              title="No departments"
              description="Create departments to organize your team."
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
                </svg>
              }
            />
          ) : (
            <div className="space-y-2">
              {depts.map((dept) => (
                <div
                  key={dept.id}
                  className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/8 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white font-medium">{dept.name}</p>
                      <p className="text-xs text-white/40">
                        {dept.code && <span className="mr-2">{dept.code}</span>}
                        {dept.parentDepartmentId && (
                          <span>
                            Parent: {depts.find((d) => d.id === dept.parentDepartmentId)?.name || "Unknown"}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setDeptForm({
                          name: dept.name,
                          code: dept.code || "",
                          description: dept.description || "",
                          parentDepartmentId: dept.parentDepartmentId || "",
                        });
                        setDeptSlideOver({ open: true, mode: "edit", dept });
                      }}
                      className="p-1.5 text-white/40 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteDept(dept.id)}
                      className="p-1.5 text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {activeTab === "org-chart" && (
        <GlassCard>
          <h3 className="text-lg font-semibold text-white mb-6">Organization Chart</h3>

          {(!orgData?.topManagers?.length && !orgData?.departments?.length) ? (
            <EmptyState
              title="No org chart data"
              description="Add departments and assign users to see the org chart."
              icon={
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              }
            />
          ) : (
            <div className="space-y-8">
              {/* Top Managers / Executives */}
              {orgData?.topManagers && orgData.topManagers.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-white/50 mb-4">Leadership</h4>
                  <div className="flex flex-wrap gap-4 justify-center">
                    {orgData.topManagers.map((user) => (
                      <OrgUserCard key={user.userId} user={user} />
                    ))}
                  </div>
                </div>
              )}

              {/* Departments with members */}
              {orgData?.departments && orgData.departments.length > 0 && (
                <div className="space-y-6">
                  {orgData.departments.map((dept) => (
                    <DepartmentSection key={dept.id} dept={dept} />
                  ))}
                </div>
              )}

              {/* Unassigned users */}
              {orgData?.unassignedUsers && orgData.unassignedUsers.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-white/50 mb-4">Unassigned</h4>
                  <div className="flex flex-wrap gap-4">
                    {orgData.unassignedUsers.map((user) => (
                      <OrgUserCard key={user.userId} user={user} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </GlassCard>
      )}

      {/* Department SlideOver */}
      <SlideOver
        open={deptSlideOver.open}
        onClose={() => setDeptSlideOver({ open: false, mode: "create" })}
        title={deptSlideOver.mode === "create" ? "Create Department" : "Edit Department"}
      >
        <div className="space-y-4">
          <GlassInput
            label="Name"
            value={deptForm.name}
            onChange={(e) => setDeptForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Department name"
            required
          />
          <GlassInput
            label="Code"
            value={deptForm.code}
            onChange={(e) => setDeptForm((f) => ({ ...f, code: e.target.value }))}
            placeholder="Short code (optional)"
          />
          <GlassTextarea
            label="Description"
            value={deptForm.description}
            onChange={(e) => setDeptForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Department description..."
            rows={2}
          />
          <GlassSelect
            label="Parent Department"
            value={deptForm.parentDepartmentId}
            onChange={(e) => setDeptForm((f) => ({ ...f, parentDepartmentId: e.target.value }))}
            options={[
              { value: "", label: "None (top-level)" },
              ...depts
                .filter((d) => d.id !== deptSlideOver.dept?.id)
                .map((d) => ({ value: d.id, label: d.name })),
            ]}
          />
          <div className="flex gap-2 pt-4">
            <GlassButton
              variant="primary"
              className="flex-1"
              disabled={saving}
              onClick={deptSlideOver.mode === "create" ? handleCreateDept : handleUpdateDept}
            >
              {saving ? "Saving..." : deptSlideOver.mode === "create" ? "Create" : "Save Changes"}
            </GlassButton>
            <GlassButton variant="ghost" onClick={() => setDeptSlideOver({ open: false, mode: "create" })}>
              Cancel
            </GlassButton>
          </div>
        </div>
      </SlideOver>
    </div>
  );
}

function OrgUserCard({ user }: { user: OrgUser }) {
  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10 min-w-[200px]">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-medium">
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <p className="text-white font-medium">{user.name}</p>
          <p className="text-xs text-white/40">{user.jobTitle || "No title"}</p>
        </div>
      </div>
      <p className="text-xs text-white/30">{user.email}</p>
      {user.directReports.length > 0 && (
        <div className="mt-3 pt-3 border-t border-white/10">
          <p className="text-xs text-white/40 mb-2">{user.directReports.length} direct report(s)</p>
          <div className="space-y-1">
            {user.directReports.slice(0, 3).map((report) => (
              <p key={report.userId} className="text-xs text-white/60">{report.name}</p>
            ))}
            {user.directReports.length > 3 && (
              <p className="text-xs text-white/40">+{user.directReports.length - 3} more</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DepartmentSection({ dept }: { dept: Department & { members?: OrgUser[]; children?: Department[] } }) {
  return (
    <div className="border border-white/10 rounded-xl p-4">
      <h4 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
          <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3H21m-3.75 3H21" />
          </svg>
        </div>
        {dept.name}
        {dept.code && <span className="text-sm text-white/40">({dept.code})</span>}
      </h4>

      {dept.members && dept.members.length > 0 ? (
        <div className="flex flex-wrap gap-4">
          {dept.members.map((user) => (
            <OrgUserCard key={user.userId} user={user} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-white/40">No members assigned</p>
      )}

      {dept.children && dept.children.length > 0 && (
        <div className="mt-4 ml-8 space-y-4">
          {dept.children.map((child) => (
            <DepartmentSection key={child.id} dept={child} />
          ))}
        </div>
      )}
    </div>
  );
}
