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

const AVAILABLE_ROLES = ["admin", "finance", "inventory", "sales", "procurement"];

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Manage users and their roles"
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
              <GlassButton
                key={`action-${user.id}`}
                size="sm"
                variant={user.isActive ? "danger" : "default"}
                onClick={() => setDeactivateUser(user)}
              >
                {user.isActive ? "Deactivate" : "Activate"}
              </GlassButton>,
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
