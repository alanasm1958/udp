"use client";

import * as React from "react";
import {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassSelect,
  GlassTable,
  GlassBadge,
  GlassTextarea,
  PageHeader,
  Spinner,
  Skeleton,
  SkeletonTable,
  SlideOver,
  ConfirmDialog,
  ErrorAlert,
  useToast,
} from "@/components/ui/glass";
import { formatDateTime } from "@/lib/http";

interface Tenant {
  id: string;
  name: string;
  baseCurrency: string;
  isPlatformOwner: boolean;
  status: "active" | "suspended" | "archived";
  suspendedAt: string | null;
  suspendedReason: string | null;
  archivedAt: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  userCount: number;
  activeUserCount: number;
  subscription: {
    planCode: string;
    status: string;
    currentPeriodEnd: string;
  } | null;
}

interface TenantUser {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: string[];
  createdAt: string;
}

interface TenantDetail {
  tenant: Tenant;
  stats: {
    users: {
      total: number;
      active: number;
    };
  };
  subscription: {
    planCode: string;
    status: string;
    currentPeriodEnd: string;
  } | null;
  recentPayments: Array<{
    id: string;
    amount: string;
    currency: string;
    status: string;
    createdAt: string;
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    occurredAt: string;
  }>;
}

const AVAILABLE_ROLES = ["admin", "finance", "inventory", "sales", "procurement"];

export default function TenantManagementPage() {
  const { addToast } = useToast();

  // Tenant list state
  const [tenants, setTenants] = React.useState<Tenant[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("");

  // Create tenant state
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createForm, setCreateForm] = React.useState({
    tenantName: "",
    baseCurrency: "USD",
    adminEmail: "",
    adminFullName: "",
    adminPassword: "",
    planCode: "free",
  });
  const [creating, setCreating] = React.useState(false);

  // View/Edit tenant state
  const [selectedTenant, setSelectedTenant] = React.useState<Tenant | null>(null);
  const [tenantDetail, setTenantDetail] = React.useState<TenantDetail | null>(null);
  const [tenantUsers, setTenantUsers] = React.useState<TenantUser[]>([]);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailTab, setDetailTab] = React.useState<"overview" | "users" | "payments" | "activity">("overview");

  // Edit tenant state
  const [editMode, setEditMode] = React.useState(false);
  const [editForm, setEditForm] = React.useState({ name: "", status: "", suspendedReason: "", planCode: "" });
  const [saving, setSaving] = React.useState(false);

  // Create user in tenant state
  const [createUserOpen, setCreateUserOpen] = React.useState(false);
  const [userForm, setUserForm] = React.useState({
    email: "",
    fullName: "",
    password: "",
    roleNames: ["finance"] as string[],
  });
  const [creatingUser, setCreatingUser] = React.useState(false);

  // Delete confirmations
  const [deleteTenant, setDeleteTenant] = React.useState<Tenant | null>(null);
  const [deleteUser, setDeleteUser] = React.useState<TenantUser | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);

  // Load tenants
  const loadTenants = React.useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/tenant-management?${params}`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("You don't have access to tenant management.");
          return;
        }
        throw new Error("Failed to load tenants");
      }
      const data = await res.json();
      setTenants(data.tenants || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load tenants");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  React.useEffect(() => {
    loadTenants();
  }, [loadTenants]);

  // Load tenant details
  const loadTenantDetail = React.useCallback(async (tenant: Tenant) => {
    setSelectedTenant(tenant);
    setDetailLoading(true);
    setDetailTab("overview");
    setEditMode(false);

    try {
      // Load tenant detail and users in parallel
      const [detailRes, usersRes] = await Promise.all([
        fetch(`/api/tenant-management/${tenant.id}`),
        fetch(`/api/tenant-management/${tenant.id}/users`),
      ]);

      if (!detailRes.ok) throw new Error("Failed to load tenant details");
      if (!usersRes.ok) throw new Error("Failed to load tenant users");

      const detail = await detailRes.json();
      const usersData = await usersRes.json();

      setTenantDetail(detail);
      setTenantUsers(usersData.users || []);
      setEditForm({
        name: detail.tenant.name,
        status: detail.tenant.status,
        suspendedReason: detail.tenant.suspendedReason || "",
        planCode: detail.subscription?.planCode || "free",
      });
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to load tenant");
      setSelectedTenant(null);
    } finally {
      setDetailLoading(false);
    }
  }, [addToast]);

  // Create tenant
  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch("/api/tenant-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create tenant");
      }

      addToast("success", `Tenant "${createForm.tenantName}" created successfully`);
      setCreateForm({
        tenantName: "",
        baseCurrency: "USD",
        adminEmail: "",
        adminFullName: "",
        adminPassword: "",
        planCode: "free",
      });
      setCreateOpen(false);
      await loadTenants();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to create tenant");
    } finally {
      setCreating(false);
    }
  };

  // Update tenant
  const handleUpdateTenant = async () => {
    if (!selectedTenant) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/tenant-management/${selectedTenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update tenant");
      }

      addToast("success", "Tenant updated successfully");
      setEditMode(false);
      await loadTenants();
      await loadTenantDetail(selectedTenant);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to update tenant");
    } finally {
      setSaving(false);
    }
  };

  // Delete (archive) tenant
  const handleDeleteTenant = async () => {
    if (!deleteTenant) return;
    setActionLoading(true);

    try {
      const res = await fetch(`/api/tenant-management/${deleteTenant.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to archive tenant");
      }

      addToast("success", `Tenant "${deleteTenant.name}" has been archived`);
      setDeleteTenant(null);
      setSelectedTenant(null);
      await loadTenants();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to archive tenant");
    } finally {
      setActionLoading(false);
    }
  };

  // Create user in tenant
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTenant) return;
    setCreatingUser(true);

    try {
      const res = await fetch(`/api/tenant-management/${selectedTenant.id}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userForm),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create user");
      }

      addToast("success", `User "${userForm.fullName}" created successfully`);
      setUserForm({ email: "", fullName: "", password: "", roleNames: ["finance"] });
      setCreateUserOpen(false);

      // Reload users
      const usersRes = await fetch(`/api/tenant-management/${selectedTenant.id}/users`);
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setTenantUsers(usersData.users || []);
      }
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreatingUser(false);
    }
  };

  // Delete (deactivate) user
  const handleDeleteUser = async () => {
    if (!deleteUser || !selectedTenant) return;
    setActionLoading(true);

    try {
      const res = await fetch(`/api/tenant-management/${selectedTenant.id}/users/${deleteUser.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to deactivate user");
      }

      addToast("success", `User "${deleteUser.fullName}" has been deactivated`);
      setDeleteUser(null);

      // Reload users
      const usersRes = await fetch(`/api/tenant-management/${selectedTenant.id}/users`);
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        setTenantUsers(usersData.users || []);
      }
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to deactivate user");
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <GlassBadge variant="success">Active</GlassBadge>;
      case "suspended":
        return <GlassBadge variant="warning">Suspended</GlassBadge>;
      case "archived":
        return <GlassBadge variant="danger">Archived</GlassBadge>;
      default:
        return <GlassBadge variant="default">{status}</GlassBadge>;
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenant Management"
        description="Manage all tenants on the platform"
        actions={
          <GlassButton variant="primary" onClick={() => setCreateOpen(true)}>
            + New Tenant
          </GlassButton>
        }
      />

      {error && !loading && (
        <ErrorAlert message={error} onDismiss={() => setError(null)} />
      )}

      {/* Filters */}
      <div className="flex gap-4 items-end">
        <div className="flex-1 max-w-md">
          <GlassInput
            placeholder="Search tenants..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && loadTenants()}
          />
        </div>
        <GlassSelect
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-40"
          options={[
            { value: "", label: "All Status" },
            { value: "active", label: "Active" },
            { value: "suspended", label: "Suspended" },
            { value: "archived", label: "Archived" },
          ]}
        />
        <GlassButton onClick={loadTenants}>Search</GlassButton>
      </div>

      {/* Stats */}
      {!loading && !error && (
        <div className="flex gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <span className="text-white/50 text-xs">Total Tenants</span>
            <span className="ml-2 text-white font-medium">{tenants.length}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-emerald-400/70 text-xs">Active</span>
            <span className="ml-2 text-emerald-400 font-medium">
              {tenants.filter((t) => t.status === "active").length}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <span className="text-amber-400/70 text-xs">Suspended</span>
            <span className="ml-2 text-amber-400 font-medium">
              {tenants.filter((t) => t.status === "suspended").length}
            </span>
          </div>
        </div>
      )}

      {/* Tenants Table */}
      <GlassCard padding="none">
        {loading ? (
          <div className="p-6">
            <SkeletonTable rows={5} columns={6} />
          </div>
        ) : (
          <GlassTable
            headers={["Tenant", "Status", "Users", "Plan", "Last Activity", "Actions"]}
            rows={tenants.map((tenant) => [
              <div key={tenant.id}>
                <div className="font-medium text-white flex items-center gap-2">
                  {tenant.name}
                  {tenant.isPlatformOwner && (
                    <span className="px-1.5 py-0.5 text-[10px] bg-purple-500/20 text-purple-300 rounded">
                      Platform Owner
                    </span>
                  )}
                </div>
                <div className="text-xs text-white/50">{tenant.id.slice(0, 8)}...</div>
              </div>,
              getStatusBadge(tenant.status),
              <div key={`users-${tenant.id}`} className="text-white/70">
                <span className="text-white">{tenant.activeUserCount}</span>
                <span className="text-white/40"> / {tenant.userCount}</span>
              </div>,
              <GlassBadge key={`plan-${tenant.id}`} variant="default">
                {tenant.subscription?.planCode || "none"}
              </GlassBadge>,
              <span key={`activity-${tenant.id}`} className="text-white/60 text-xs">
                {tenant.lastActivityAt ? formatDateTime(tenant.lastActivityAt) : "Never"}
              </span>,
              <div key={`actions-${tenant.id}`} className="flex gap-2">
                <GlassButton size="sm" onClick={() => loadTenantDetail(tenant)}>
                  View
                </GlassButton>
                {!tenant.isPlatformOwner && tenant.status !== "archived" && (
                  <GlassButton
                    size="sm"
                    variant="danger"
                    onClick={() => setDeleteTenant(tenant)}
                  >
                    Archive
                  </GlassButton>
                )}
              </div>,
            ])}
            emptyMessage="No tenants found."
          />
        )}
      </GlassCard>

      {/* Create Tenant SlideOver */}
      <SlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create New Tenant"
      >
        <form onSubmit={handleCreateTenant} className="space-y-4">
          <div className="text-sm text-white/60 mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            This will create a new tenant organization with an initial admin user.
          </div>

          <GlassInput
            label="Tenant Name"
            value={createForm.tenantName}
            onChange={(e) => setCreateForm({ ...createForm, tenantName: e.target.value })}
            placeholder="Acme Inc."
            required
            disabled={creating}
          />

          <GlassSelect
            label="Base Currency"
            value={createForm.baseCurrency}
            onChange={(e) => setCreateForm({ ...createForm, baseCurrency: e.target.value })}
            disabled={creating}
            options={[
              { value: "USD", label: "USD - US Dollar" },
              { value: "EUR", label: "EUR - Euro" },
              { value: "GBP", label: "GBP - British Pound" },
            ]}
          />

          <GlassSelect
            label="Subscription Plan"
            value={createForm.planCode}
            onChange={(e) => setCreateForm({ ...createForm, planCode: e.target.value })}
            disabled={creating}
            options={[
              { value: "free", label: "Free" },
              { value: "starter", label: "Starter" },
              { value: "pro", label: "Pro" },
            ]}
          />

          <div className="border-t border-white/10 pt-4 mt-4">
            <div className="text-xs font-medium text-white/70 mb-3">Initial Admin User</div>

            <GlassInput
              label="Admin Email"
              type="email"
              value={createForm.adminEmail}
              onChange={(e) => setCreateForm({ ...createForm, adminEmail: e.target.value })}
              placeholder="admin@example.com"
              required
              disabled={creating}
            />

            <GlassInput
              label="Admin Full Name"
              value={createForm.adminFullName}
              onChange={(e) => setCreateForm({ ...createForm, adminFullName: e.target.value })}
              placeholder="John Doe"
              required
              disabled={creating}
            />

            <GlassInput
              label="Admin Password"
              type="password"
              value={createForm.adminPassword}
              onChange={(e) => setCreateForm({ ...createForm, adminPassword: e.target.value })}
              placeholder="Min 8 characters"
              required
              minLength={8}
              disabled={creating}
            />
          </div>

          <div className="pt-4 flex gap-3">
            <GlassButton
              type="button"
              variant="ghost"
              onClick={() => setCreateOpen(false)}
              className="flex-1"
            >
              Cancel
            </GlassButton>
            <GlassButton
              type="submit"
              variant="primary"
              disabled={creating}
              className="flex-1"
            >
              {creating ? <Spinner size="sm" /> : "Create Tenant"}
            </GlassButton>
          </div>
        </form>
      </SlideOver>

      {/* Tenant Detail SlideOver */}
      <SlideOver
        open={!!selectedTenant}
        onClose={() => setSelectedTenant(null)}
        title={selectedTenant?.name || "Tenant Details"}
        width="lg"
      >
        {detailLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : tenantDetail ? (
          <div className="space-y-6">
            {/* Tabs */}
            <div className="flex gap-1 p-1 bg-white/5 rounded-lg">
              {(["overview", "users", "payments", "activity"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setDetailTab(tab)}
                  className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    detailTab === tab
                      ? "bg-white/10 text-white"
                      : "text-white/50 hover:text-white"
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Overview Tab */}
            {detailTab === "overview" && (
              <div className="space-y-4">
                {editMode ? (
                  <>
                    <GlassInput
                      label="Tenant Name"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                    <GlassSelect
                      label="Status"
                      value={editForm.status}
                      onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      disabled={tenantDetail.tenant.isPlatformOwner}
                      options={[
                        { value: "active", label: "Active" },
                        { value: "suspended", label: "Suspended" },
                        { value: "archived", label: "Archived" },
                      ]}
                    />
                    {editForm.status === "suspended" && (
                      <GlassTextarea
                        label="Suspension Reason"
                        value={editForm.suspendedReason}
                        onChange={(e) => setEditForm({ ...editForm, suspendedReason: e.target.value })}
                        placeholder="Reason for suspension..."
                      />
                    )}
                    <GlassSelect
                      label="Subscription Plan"
                      value={editForm.planCode}
                      onChange={(e) => setEditForm({ ...editForm, planCode: e.target.value })}
                      options={[
                        { value: "free", label: "Free" },
                        { value: "starter", label: "Starter" },
                        { value: "pro", label: "Pro" },
                      ]}
                    />
                    <div className="flex gap-3 pt-4">
                      <GlassButton variant="ghost" onClick={() => setEditMode(false)} className="flex-1">
                        Cancel
                      </GlassButton>
                      <GlassButton variant="primary" onClick={handleUpdateTenant} disabled={saving} className="flex-1">
                        {saving ? <Spinner size="sm" /> : "Save Changes"}
                      </GlassButton>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-white/5 rounded-lg">
                        <div className="text-xs text-white/50 mb-1">Status</div>
                        {getStatusBadge(tenantDetail.tenant.status)}
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg">
                        <div className="text-xs text-white/50 mb-1">Plan</div>
                        <div className="text-white">{tenantDetail.subscription?.planCode || "None"}</div>
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg">
                        <div className="text-xs text-white/50 mb-1">Users</div>
                        <div className="text-white">
                          {tenantDetail.stats.users.active} active / {tenantDetail.stats.users.total} total
                        </div>
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg">
                        <div className="text-xs text-white/50 mb-1">Currency</div>
                        <div className="text-white">{tenantDetail.tenant.baseCurrency}</div>
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg">
                        <div className="text-xs text-white/50 mb-1">Created</div>
                        <div className="text-white text-sm">{formatDateTime(tenantDetail.tenant.createdAt)}</div>
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg">
                        <div className="text-xs text-white/50 mb-1">Last Activity</div>
                        <div className="text-white text-sm">
                          {tenantDetail.tenant.lastActivityAt ? formatDateTime(tenantDetail.tenant.lastActivityAt) : "Never"}
                        </div>
                      </div>
                    </div>
                    {tenantDetail.tenant.suspendedReason && (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <div className="text-xs text-amber-400/70 mb-1">Suspension Reason</div>
                        <div className="text-amber-200 text-sm">{tenantDetail.tenant.suspendedReason}</div>
                      </div>
                    )}
                    {!tenantDetail.tenant.isPlatformOwner && (
                      <GlassButton onClick={() => setEditMode(true)} className="w-full">
                        Edit Tenant
                      </GlassButton>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Users Tab */}
            {detailTab === "users" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div className="text-sm text-white/70">
                    {tenantUsers.length} user{tenantUsers.length !== 1 ? "s" : ""}
                  </div>
                  <GlassButton size="sm" variant="primary" onClick={() => setCreateUserOpen(true)}>
                    + Add User
                  </GlassButton>
                </div>
                <div className="space-y-2">
                  {tenantUsers.map((user) => (
                    <div
                      key={user.id}
                      className="p-3 bg-white/5 rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <div className="text-white font-medium">{user.fullName}</div>
                        <div className="text-xs text-white/50">{user.email}</div>
                        <div className="flex gap-1 mt-1">
                          {user.roles.map((role) => (
                            <span key={role} className="px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-300 rounded">
                              {role}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <GlassBadge variant={user.isActive ? "success" : "danger"}>
                          {user.isActive ? "Active" : "Inactive"}
                        </GlassBadge>
                        {user.isActive && (
                          <GlassButton
                            size="sm"
                            variant="danger"
                            onClick={() => setDeleteUser(user)}
                          >
                            Deactivate
                          </GlassButton>
                        )}
                      </div>
                    </div>
                  ))}
                  {tenantUsers.length === 0 && (
                    <div className="text-center py-8 text-white/50">No users found</div>
                  )}
                </div>
              </div>
            )}

            {/* Payments Tab */}
            {detailTab === "payments" && (
              <div className="space-y-2">
                {tenantDetail.recentPayments.length > 0 ? (
                  tenantDetail.recentPayments.map((payment) => (
                    <div key={payment.id} className="p-3 bg-white/5 rounded-lg flex justify-between">
                      <div>
                        <div className="text-white">
                          {payment.currency} {payment.amount}
                        </div>
                        <div className="text-xs text-white/50">{formatDateTime(payment.createdAt)}</div>
                      </div>
                      <GlassBadge variant={payment.status === "succeeded" ? "success" : "warning"}>
                        {payment.status}
                      </GlassBadge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-white/50">No payment history</div>
                )}
              </div>
            )}

            {/* Activity Tab */}
            {detailTab === "activity" && (
              <div className="space-y-2">
                {tenantDetail.recentActivity.length > 0 ? (
                  tenantDetail.recentActivity.map((activity) => (
                    <div key={activity.id} className="p-3 bg-white/5 rounded-lg">
                      <div className="text-white text-sm">{activity.action}</div>
                      <div className="text-xs text-white/50">
                        {activity.entityType} • {formatDateTime(activity.occurredAt)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 text-white/50">No recent activity</div>
                )}
              </div>
            )}
          </div>
        ) : null}
      </SlideOver>

      {/* Create User in Tenant SlideOver */}
      <SlideOver
        open={createUserOpen}
        onClose={() => setCreateUserOpen(false)}
        title={`Add User to ${selectedTenant?.name}`}
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <GlassInput
            label="Email"
            type="email"
            value={userForm.email}
            onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
            placeholder="user@example.com"
            required
            disabled={creatingUser}
          />

          <GlassInput
            label="Full Name"
            value={userForm.fullName}
            onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
            placeholder="John Doe"
            required
            disabled={creatingUser}
          />

          <GlassInput
            label="Password"
            type="password"
            value={userForm.password}
            onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
            placeholder="Min 8 characters"
            required
            minLength={8}
            disabled={creatingUser}
          />

          <div>
            <label className="text-xs font-medium text-white/70 pl-1 block mb-2">Roles</label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_ROLES.map((role) => (
                <label
                  key={role}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer border transition-all duration-150 ${
                    userForm.roleNames.includes(role)
                      ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                      : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={userForm.roleNames.includes(role)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setUserForm({ ...userForm, roleNames: [...userForm.roleNames, role] });
                      } else {
                        setUserForm({ ...userForm, roleNames: userForm.roleNames.filter((r) => r !== role) });
                      }
                    }}
                    disabled={creatingUser}
                    className="sr-only"
                  />
                  <span className="text-sm capitalize">{role}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="pt-4 flex gap-3">
            <GlassButton type="button" variant="ghost" onClick={() => setCreateUserOpen(false)} className="flex-1">
              Cancel
            </GlassButton>
            <GlassButton type="submit" variant="primary" disabled={creatingUser || userForm.roleNames.length === 0} className="flex-1">
              {creatingUser ? <Spinner size="sm" /> : "Create User"}
            </GlassButton>
          </div>
        </form>
      </SlideOver>

      {/* Delete Tenant Confirmation */}
      <ConfirmDialog
        open={!!deleteTenant}
        onClose={() => setDeleteTenant(null)}
        onConfirm={handleDeleteTenant}
        title="Archive Tenant"
        message={`Are you sure you want to archive "${deleteTenant?.name}"? All users will be deactivated and the tenant will no longer be accessible.`}
        confirmLabel="Archive"
        variant="danger"
        loading={actionLoading}
      />

      {/* Delete User Confirmation */}
      <ConfirmDialog
        open={!!deleteUser}
        onClose={() => setDeleteUser(null)}
        onConfirm={handleDeleteUser}
        title="Deactivate User"
        message={`Are you sure you want to deactivate "${deleteUser?.fullName}"? They will no longer be able to sign in.`}
        confirmLabel="Deactivate"
        variant="danger"
        loading={actionLoading}
      />
    </div>
  );
}
