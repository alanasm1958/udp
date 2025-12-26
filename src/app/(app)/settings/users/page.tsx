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
} from "@/components/ui/glass";
import { apiGet, apiPost, apiPatch, formatDateTime } from "@/lib/http";

interface User {
  id: string;
  email: string;
  fullName: string;
  isActive: boolean;
  roles: string[];
  createdAt: string;
}

interface UsersResponse {
  users: User[];
}

const AVAILABLE_ROLES = ["admin", "finance", "inventory", "sales", "procurement"];

export default function SettingsUsersPage() {
  const [users, setUsers] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Create user form state
  const [showCreateForm, setShowCreateForm] = React.useState(false);
  const [newEmail, setNewEmail] = React.useState("");
  const [newFullName, setNewFullName] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [newRoles, setNewRoles] = React.useState<string[]>(["finance"]);
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);

  const loadUsers = React.useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiGet<UsersResponse>("/api/admin/users");
      setUsers(data.users);
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
    setCreateError(null);

    try {
      await apiPost("/api/admin/users", {
        email: newEmail,
        fullName: newFullName,
        password: newPassword,
        roles: newRoles,
      });

      // Reset form and reload users
      setNewEmail("");
      setNewFullName("");
      setNewPassword("");
      setNewRoles(["finance"]);
      setShowCreateForm(false);
      await loadUsers();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await apiPatch(`/api/admin/users/${user.id}`, {
        isActive: !user.isActive,
      });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user");
    }
  };

  const handleToggleRole = async (user: User, role: string) => {
    const hasRole = user.roles.includes(role);
    const updatedRoles = hasRole
      ? user.roles.filter((r) => r !== role)
      : [...user.roles, role];

    if (updatedRoles.length === 0) {
      setError("User must have at least one role");
      return;
    }

    try {
      await apiPatch(`/api/admin/users/${user.id}`, { roles: updatedRoles });
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user roles");
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
        title="User Management"
        description="Manage users and their roles"
        actions={
          <GlassButton
            variant="primary"
            onClick={() => setShowCreateForm(!showCreateForm)}
          >
            {showCreateForm ? "Cancel" : "New User"}
          </GlassButton>
        }
      />

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">{error}</p>
          <button
            className="text-xs text-red-300 underline mt-1"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create User Form */}
      {showCreateForm && (
        <GlassCard>
          <h2 className="text-lg font-semibold text-white mb-4">Create New User</h2>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <GlassInput
                label="Email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="user@example.com"
                required
                disabled={creating}
              />
              <GlassInput
                label="Full Name"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="John Doe"
                required
                disabled={creating}
              />
              <GlassInput
                label="Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Min 8 characters"
                required
                disabled={creating}
              />
            </div>

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
                        newRoles.includes(role)
                          ? "bg-blue-500/20 border-blue-500/40 text-blue-300"
                          : "bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
                      }
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={newRoles.includes(role)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewRoles([...newRoles, role]);
                        } else {
                          setNewRoles(newRoles.filter((r) => r !== role));
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

            {createError && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-sm text-red-400">{createError}</p>
              </div>
            )}

            <div className="flex justify-end">
              <GlassButton type="submit" variant="primary" disabled={creating}>
                {creating ? (
                  <>
                    <Spinner size="sm" />
                    Creating...
                  </>
                ) : (
                  "Create User"
                )}
              </GlassButton>
            </div>
          </form>
        </GlassCard>
      )}

      {/* Users Table */}
      <GlassCard padding="none">
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
              onClick={() => handleToggleActive(user)}
            >
              {user.isActive ? "Deactivate" : "Activate"}
            </GlassButton>,
          ])}
          emptyMessage="No users found"
        />
      </GlassCard>
    </div>
  );
}
