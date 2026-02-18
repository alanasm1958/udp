"use client";

import * as React from "react";
import {
  GlassCard,
  GlassButton,
  GlassInput,
  GlassTable,
  GlassBadge,
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

interface User {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: string[];
  createdAt: string;
}

interface PageAction {
  id: string;
  code: string;
  name: string;
  description: string | null;
  actionType: string;
  requiresPermission: string | null;
  displayOrder: number;
  hasAccess: boolean;
}

interface PageItem {
  id: string;
  code: string;
  name: string;
  route: string;
  module: string;
  description: string | null;
  icon: string | null;
  isAlwaysAccessible: boolean;
  displayOrder: number;
  parentPageCode: string | null;
  hasAccess: boolean;
  actions: PageAction[];
}

interface UserAccessData {
  user: { id: string; fullName: string };
  pagesByModule: Record<string, PageItem[]>;
  summary: {
    totalPages: number;
    accessiblePages: number;
    totalActions: number;
    accessibleActions: number;
  };
}

const AVAILABLE_ROLES = ["admin", "finance", "inventory", "sales", "procurement"];

const MODULE_DISPLAY_NAMES: Record<string, string> = {
  dashboard: "Dashboard",
  finance: "Finance",
  sales: "Sales",
  procurement: "Procurement",
  inventory: "Inventory",
  operations: "Operations",
  people: "People & HR",
  marketing: "Marketing",
  strategy: "Strategy",
  company: "Company",
  settings: "Settings",
  other: "Other",
};

export default function SettingsUsersPage() {
  const { addToast } = useToast();
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Create user form state
  const [createOpen, setCreateOpen] = React.useState(false);
  const [formData, setFormData] = React.useState({
    email: "",
    fullName: "",
    password: "",
    roles: ["finance"] as string[],
  });
  const [creating, setCreating] = React.useState(false);

  // Deactivation confirmation
  const [deactivateUser, setDeactivateUser] = React.useState<User | null>(null);
  const [actionLoading, setActionLoading] = React.useState(false);

  // Access management state
  const [accessUser, setAccessUser] = React.useState<User | null>(null);
  const [accessData, setAccessData] = React.useState<UserAccessData | null>(null);
  const [accessLoading, setAccessLoading] = React.useState(false);
  const [expandedModules, setExpandedModules] = React.useState<Set<string>>(new Set());
  const [expandedPages, setExpandedPages] = React.useState<Set<string>>(new Set());
  const [savingAccess, setSavingAccess] = React.useState(false);
  const [pendingChanges, setPendingChanges] = React.useState<{
    pageAccess: { pageId: string; hasAccess: boolean }[];
    actionAccess: { actionId: string; hasAccess: boolean }[];
  }>({ pageAccess: [], actionAccess: [] });

  const loadUsers = React.useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/admin/users");
      if (!res.ok) throw new Error("Failed to load users");
      const data = await res.json();
      setUsers(data.users || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Load user access data
  const loadUserAccess = React.useCallback(async (user: User) => {
    setAccessUser(user);
    setAccessLoading(true);
    setAccessData(null);
    setPendingChanges({ pageAccess: [], actionAccess: [] });
    setExpandedModules(new Set());
    setExpandedPages(new Set());

    try {
      const res = await fetch(`/api/admin/users/${user.id}/access`);
      if (!res.ok) throw new Error("Failed to load user access");
      const data = await res.json();
      setAccessData(data);
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to load access data");
      setAccessUser(null);
    } finally {
      setAccessLoading(false);
    }
  }, [addToast]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create user");
      }

      addToast("success", `${formData.fullName} has been added as a user`);
      setFormData({ email: "", fullName: "", password: "", roles: ["finance"] });
      setCreateOpen(false);
      await loadUsers();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async () => {
    if (!deactivateUser) return;
    setActionLoading(true);

    try {
      const res = await fetch(`/api/admin/users/${deactivateUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !deactivateUser.isActive }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update user");
      }

      addToast(
        "success",
        deactivateUser.isActive
          ? `${deactivateUser.fullName} has been deactivated`
          : `${deactivateUser.fullName} has been activated`
      );
      setDeactivateUser(null);
      await loadUsers();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleRole = async (user: User, role: string) => {
    const hasRole = user.roles.includes(role);
    const updatedRoles = hasRole
      ? user.roles.filter((r) => r !== role)
      : [...user.roles, role];

    if (updatedRoles.length === 0) {
      addToast("warning", "User must have at least one role");
      return;
    }

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roles: updatedRoles }),
      });

      if (!res.ok) throw new Error("Failed to update roles");

      addToast("success", `${role} role ${hasRole ? "removed from" : "added to"} ${user.fullName}`);
      await loadUsers();
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to update roles");
    }
  };

  // Handle page access toggle
  const handlePageAccessToggle = (pageId: string, currentAccess: boolean) => {
    // Update local state optimistically
    if (accessData) {
      const newData = { ...accessData };
      for (const moduleName of Object.keys(newData.pagesByModule)) {
        newData.pagesByModule[moduleName] = newData.pagesByModule[moduleName].map((page) =>
          page.id === pageId ? { ...page, hasAccess: !currentAccess } : page
        );
      }
      setAccessData(newData);
    }

    // Track pending change
    setPendingChanges((prev) => {
      const existing = prev.pageAccess.findIndex((p) => p.pageId === pageId);
      const newPageAccess = [...prev.pageAccess];
      if (existing >= 0) {
        newPageAccess[existing] = { pageId, hasAccess: !currentAccess };
      } else {
        newPageAccess.push({ pageId, hasAccess: !currentAccess });
      }
      return { ...prev, pageAccess: newPageAccess };
    });
  };

  // Handle action access toggle
  const handleActionAccessToggle = (actionId: string, currentAccess: boolean) => {
    // Update local state optimistically
    if (accessData) {
      const newData = { ...accessData };
      for (const moduleName of Object.keys(newData.pagesByModule)) {
        newData.pagesByModule[moduleName] = newData.pagesByModule[moduleName].map((page) => ({
          ...page,
          actions: page.actions.map((action) =>
            action.id === actionId ? { ...action, hasAccess: !currentAccess } : action
          ),
        }));
      }
      setAccessData(newData);
    }

    // Track pending change
    setPendingChanges((prev) => {
      const existing = prev.actionAccess.findIndex((a) => a.actionId === actionId);
      const newActionAccess = [...prev.actionAccess];
      if (existing >= 0) {
        newActionAccess[existing] = { actionId, hasAccess: !currentAccess };
      } else {
        newActionAccess.push({ actionId, hasAccess: !currentAccess });
      }
      return { ...prev, actionAccess: newActionAccess };
    });
  };

  // Save access changes
  const handleSaveAccess = async () => {
    if (!accessUser) return;
    if (pendingChanges.pageAccess.length === 0 && pendingChanges.actionAccess.length === 0) {
      addToast("info", "No changes to save");
      return;
    }

    setSavingAccess(true);
    try {
      const res = await fetch(`/api/admin/users/${accessUser.id}/access`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingChanges),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save access");
      }

      const result = await res.json();
      addToast("success", result.message);
      setPendingChanges({ pageAccess: [], actionAccess: [] });
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to save access");
    } finally {
      setSavingAccess(false);
    }
  };

  // Toggle module expansion
  const toggleModule = (module: string) => {
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(module)) {
        next.delete(module);
      } else {
        next.add(module);
      }
      return next;
    });
  };

  // Toggle page expansion (to show actions)
  const togglePage = (pageId: string) => {
    setExpandedPages((prev) => {
      const next = new Set(prev);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  };

  // Grant all access for a module
  const grantAllModuleAccess = (module: string) => {
    if (!accessData) return;
    const pages = accessData.pagesByModule[module] || [];

    pages.forEach((page) => {
      if (!page.isAlwaysAccessible && !page.hasAccess) {
        handlePageAccessToggle(page.id, false);
      }
      page.actions.forEach((action) => {
        if (!action.hasAccess) {
          handleActionAccessToggle(action.id, false);
        }
      });
    });
  };

  // Revoke all access for a module
  const revokeAllModuleAccess = (module: string) => {
    if (!accessData) return;
    const pages = accessData.pagesByModule[module] || [];

    pages.forEach((page) => {
      if (!page.isAlwaysAccessible && page.hasAccess) {
        handlePageAccessToggle(page.id, true);
      }
      page.actions.forEach((action) => {
        if (action.hasAccess) {
          handleActionAccessToggle(action.id, true);
        }
      });
    });
  };

  const hasPendingChanges = pendingChanges.pageAccess.length > 0 || pendingChanges.actionAccess.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Manage users, roles, and page-level access"
        actions={
          <GlassButton variant="primary" onClick={() => setCreateOpen(true)}>
            + New User
          </GlassButton>
        }
      />

      {error && !loading && (
        <ErrorAlert message={error} onDismiss={() => setError(null)} />
      )}

      {/* Stats */}
      {!loading && !error && (
        <div className="flex gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <span className="text-white/50 text-xs">Total</span>
            <span className="ml-2 text-white font-medium">{users.length}</span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <span className="text-emerald-400/70 text-xs">Active</span>
            <span className="ml-2 text-emerald-400 font-medium">
              {users.filter((u) => u.isActive).length}
            </span>
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20">
            <span className="text-red-400/70 text-xs">Inactive</span>
            <span className="ml-2 text-red-400 font-medium">
              {users.filter((u) => !u.isActive).length}
            </span>
          </div>
        </div>
      )}

      {/* Users Table */}
      <GlassCard padding="none">
        {loading ? (
          <div className="p-6">
            <div className="flex gap-3 mb-6">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-24" />
            </div>
            <SkeletonTable rows={5} columns={5} />
          </div>
        ) : (
          <GlassTable
            headers={["User", "Status", "Roles", "Created", "Actions"]}
            rows={users.map((user) => [
              <div key={user.id}>
                <div className="font-medium text-white">{user.fullName}</div>
                <div className="text-xs text-white/50">{user.email}</div>
              </div>,
              <GlassBadge
                key={`status-${user.id}`}
                variant={user.isActive ? "success" : "danger"}
              >
                {user.isActive ? "Active" : "Inactive"}
              </GlassBadge>,
              <div key={`roles-${user.id}`} className="flex flex-wrap gap-1">
                {AVAILABLE_ROLES.map((role) => (
                  <button
                    key={role}
                    onClick={() => handleToggleRole(user, role)}
                    className={`
                      px-2 py-0.5 rounded text-xs font-medium transition-all
                      ${
                        user.roles.includes(role)
                          ? "bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
                          : "bg-white/5 text-white/30 hover:bg-white/10 hover:text-white/50"
                      }
                    `}
                    title={`Click to ${user.roles.includes(role) ? "remove" : "add"} ${role} role`}
                  >
                    {role}
                  </button>
                ))}
              </div>,
              <span key={`date-${user.id}`} className="text-white/60 text-xs">
                {formatDateTime(user.createdAt)}
              </span>,
              <div key={`actions-${user.id}`} className="flex gap-2">
                <GlassButton size="sm" onClick={() => loadUserAccess(user)}>
                  Access
                </GlassButton>
                <GlassButton
                  size="sm"
                  variant={user.isActive ? "danger" : "default"}
                  onClick={() => setDeactivateUser(user)}
                >
                  {user.isActive ? "Deactivate" : "Activate"}
                </GlassButton>
              </div>,
            ])}
            emptyMessage="No users found. Create your first user to get started."
          />
        )}
      </GlassCard>

      {/* Create User SlideOver */}
      <SlideOver
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New User"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          <GlassInput
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="user@example.com"
            required
            disabled={creating}
          />

          <GlassInput
            label="Full Name"
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            placeholder="John Doe"
            required
            disabled={creating}
          />

          <GlassInput
            label="Password"
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            placeholder="Min 8 characters"
            required
            minLength={8}
            disabled={creating}
          />

          <div>
            <label className="text-xs font-medium text-white/70 pl-1 block mb-2">
              Roles
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_ROLES.map((role) => (
                <label
                  key={role}
                  className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer
                    border transition-all duration-150
                    ${
                      formData.roles.includes(role)
                        ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                        : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                    }
                  `}
                >
                  <input
                    type="checkbox"
                    checked={formData.roles.includes(role)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, roles: [...formData.roles, role] });
                      } else {
                        setFormData({ ...formData, roles: formData.roles.filter((r) => r !== role) });
                      }
                    }}
                    disabled={creating}
                    className="sr-only"
                  />
                  <span className="text-sm capitalize">{role}</span>
                </label>
              ))}
            </div>
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
              disabled={creating || formData.roles.length === 0}
              className="flex-1"
            >
              {creating ? <Spinner size="sm" /> : "Create User"}
            </GlassButton>
          </div>
        </form>
      </SlideOver>

      {/* Access Management SlideOver */}
      <SlideOver
        open={!!accessUser}
        onClose={() => {
          if (hasPendingChanges) {
            if (confirm("You have unsaved changes. Are you sure you want to close?")) {
              setAccessUser(null);
            }
          } else {
            setAccessUser(null);
          }
        }}
        title={`Access Control: ${accessUser?.fullName || ""}`}
        width="lg"
      >
        {accessLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : accessData ? (
          <div className="space-y-4">
            {/* Summary & Actions */}
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
              <div className="text-sm">
                <span className="text-white/50">Pages: </span>
                <span className="text-emerald-400">{accessData.summary.accessiblePages}</span>
                <span className="text-white/30">/{accessData.summary.totalPages}</span>
                <span className="text-white/50 ml-4">Actions: </span>
                <span className="text-emerald-400">{accessData.summary.accessibleActions}</span>
                <span className="text-white/30">/{accessData.summary.totalActions}</span>
              </div>
              <GlassButton
                size="sm"
                variant="primary"
                onClick={handleSaveAccess}
                disabled={savingAccess || !hasPendingChanges}
              >
                {savingAccess ? <Spinner size="sm" /> : "Save Changes"}
              </GlassButton>
            </div>

            {hasPendingChanges && (
              <div className="text-xs text-amber-400/70 p-2 bg-amber-500/10 rounded border border-amber-500/20">
                {pendingChanges.pageAccess.length + pendingChanges.actionAccess.length} unsaved change(s)
              </div>
            )}

            {/* Modules */}
            <div className="space-y-2">
              {Object.entries(accessData.pagesByModule).map(([module, pages]) => {
                const isExpanded = expandedModules.has(module);
                const accessibleCount = pages.filter((p) => p.isAlwaysAccessible || p.hasAccess).length;

                return (
                  <div key={module} className="border border-white/10 rounded-lg overflow-hidden">
                    {/* Module Header */}
                    <div
                      className="flex items-center justify-between p-3 bg-white/5 cursor-pointer hover:bg-white/8"
                      onClick={() => toggleModule(module)}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-white/30">{isExpanded ? "▼" : "▶"}</span>
                        <span className="font-medium text-white">
                          {MODULE_DISPLAY_NAMES[module] || module}
                        </span>
                        <span className="text-xs text-white/40">
                          {accessibleCount}/{pages.length} pages
                        </span>
                      </div>
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => grantAllModuleAccess(module)}
                          className="px-2 py-1 text-xs text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-500/10 rounded"
                        >
                          Grant All
                        </button>
                        <button
                          onClick={() => revokeAllModuleAccess(module)}
                          className="px-2 py-1 text-xs text-red-400/70 hover:text-red-400 hover:bg-red-500/10 rounded"
                        >
                          Revoke All
                        </button>
                      </div>
                    </div>

                    {/* Module Pages */}
                    {isExpanded && (
                      <div className="divide-y divide-white/5">
                        {pages.map((page) => {
                          const isPageExpanded = expandedPages.has(page.id);
                          const hasActions = page.actions.length > 0;

                          return (
                            <div key={page.id}>
                              {/* Page Row */}
                              <div className="flex items-center justify-between p-3 pl-8 hover:bg-white/5">
                                <div className="flex items-center gap-3 flex-1">
                                  {hasActions && (
                                    <button
                                      onClick={() => togglePage(page.id)}
                                      className="text-white/30 hover:text-white/50"
                                    >
                                      {isPageExpanded ? "▼" : "▶"}
                                    </button>
                                  )}
                                  {!hasActions && <span className="w-4" />}
                                  <div className="flex-1">
                                    <div className="text-sm text-white flex items-center gap-2">
                                      {page.name}
                                      {page.isAlwaysAccessible && (
                                        <span className="px-1.5 py-0.5 text-[10px] bg-blue-500/20 text-blue-300 rounded">
                                          Always Accessible
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs text-white/40">{page.route}</div>
                                  </div>
                                </div>
                                {!page.isAlwaysAccessible && (
                                  <button
                                    onClick={() => handlePageAccessToggle(page.id, page.hasAccess)}
                                    className={`
                                      relative w-10 h-5 rounded-full transition-colors
                                      ${page.hasAccess ? "bg-emerald-500" : "bg-white/20"}
                                    `}
                                  >
                                    <span
                                      className={`
                                        absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
                                        ${page.hasAccess ? "left-5" : "left-0.5"}
                                      `}
                                    />
                                  </button>
                                )}
                              </div>

                              {/* Page Actions */}
                              {isPageExpanded && hasActions && (
                                <div className="bg-white/3 py-2">
                                  {page.actions.map((action) => (
                                    <div
                                      key={action.id}
                                      className="flex items-center justify-between px-3 py-2 pl-16 hover:bg-white/5"
                                    >
                                      <div className="flex-1">
                                        <div className="text-xs text-white/70 flex items-center gap-2">
                                          <span
                                            className={`
                                              px-1.5 py-0.5 rounded text-[10px] uppercase
                                              ${action.actionType === "create" ? "bg-emerald-500/20 text-emerald-300" : ""}
                                              ${action.actionType === "update" ? "bg-blue-500/20 text-blue-300" : ""}
                                              ${action.actionType === "delete" ? "bg-red-500/20 text-red-300" : ""}
                                              ${action.actionType === "view" ? "bg-white/10 text-white/50" : ""}
                                              ${action.actionType === "approve" ? "bg-amber-500/20 text-amber-300" : ""}
                                              ${action.actionType === "export" ? "bg-purple-500/20 text-purple-300" : ""}
                                            `}
                                          >
                                            {action.actionType}
                                          </span>
                                          {action.name}
                                        </div>
                                        {action.description && (
                                          <div className="text-[10px] text-white/30 mt-0.5">{action.description}</div>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => handleActionAccessToggle(action.id, action.hasAccess)}
                                        className={`
                                          relative w-8 h-4 rounded-full transition-colors
                                          ${action.hasAccess ? "bg-emerald-500" : "bg-white/20"}
                                        `}
                                      >
                                        <span
                                          className={`
                                            absolute top-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform
                                            ${action.hasAccess ? "left-4" : "left-0.5"}
                                          `}
                                        />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Save Button at Bottom */}
            {hasPendingChanges && (
              <div className="sticky bottom-0 pt-4 pb-2 bg-gradient-to-t from-black/80 to-transparent">
                <GlassButton
                  variant="primary"
                  onClick={handleSaveAccess}
                  disabled={savingAccess}
                  className="w-full"
                >
                  {savingAccess ? <Spinner size="sm" /> : `Save ${pendingChanges.pageAccess.length + pendingChanges.actionAccess.length} Change(s)`}
                </GlassButton>
              </div>
            )}
          </div>
        ) : null}
      </SlideOver>

      {/* Deactivation Confirmation Dialog */}
      <ConfirmDialog
        open={!!deactivateUser}
        onClose={() => setDeactivateUser(null)}
        onConfirm={handleToggleActive}
        title={deactivateUser?.isActive ? "Deactivate User" : "Activate User"}
        message={
          deactivateUser?.isActive
            ? `Are you sure you want to deactivate ${deactivateUser.fullName}? They will no longer be able to sign in.`
            : `Are you sure you want to activate ${deactivateUser?.fullName}? They will be able to sign in again.`
        }
        confirmLabel={deactivateUser?.isActive ? "Deactivate" : "Activate"}
        variant={deactivateUser?.isActive ? "danger" : "default"}
        loading={actionLoading}
      />
    </div>
  );
}
