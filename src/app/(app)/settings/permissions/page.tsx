"use client";

import * as React from "react";
import {
  GlassCard,
  PageHeader,
  Spinner,
  useToast,
} from "@/components/ui/glass";
import { MODULE_ORDER } from "@/lib/permissions";

interface Permission {
  id: string;
  code: string;
  module: string;
  action: string;
  description: string | null;
}

interface Role {
  id: string;
  name: string;
  permissionCount: number;
}

interface RolePermissions {
  role: Role;
  permissionIds: string[];
}

export default function PermissionsPage() {
  const { addToast } = useToast();
  const [permissions, setPermissions] = React.useState<Record<string, Permission[]>>({});
  const [roles, setRoles] = React.useState<Role[]>([]);
  const [rolePermissions, setRolePermissions] = React.useState<Map<string, Set<string>>>(new Map());
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState<string | null>(null);

  // Load all permissions and roles
  React.useEffect(() => {
    async function load() {
      try {
        const [permsRes, rolesRes] = await Promise.all([
          fetch("/api/admin/permissions"),
          fetch("/api/admin/roles"),
        ]);

        if (!permsRes.ok || !rolesRes.ok) {
          throw new Error("Failed to load data");
        }

        const permsData = await permsRes.json();
        const rolesData = await rolesRes.json();

        setPermissions(permsData.permissions);

        // Filter out admin role (has implicit access to all)
        const nonAdminRoles = (rolesData.roles as Role[]).filter((r) => r.name !== "admin");
        setRoles(nonAdminRoles);

        // Load permissions for each non-admin role
        const permMap = new Map<string, Set<string>>();
        for (const role of nonAdminRoles) {
          const rolePermsRes = await fetch(`/api/admin/roles/${role.id}/permissions`);
          if (rolePermsRes.ok) {
            const rolePermsData: RolePermissions = await rolePermsRes.json();
            permMap.set(role.id, new Set(rolePermsData.permissionIds));
          }
        }
        setRolePermissions(permMap);
      } catch (err) {
        console.error("Error loading permissions:", err);
        addToast("error", "Failed to load permissions data");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [addToast]);

  const handleToggle = async (roleId: string, permissionId: string) => {
    const currentPerms = rolePermissions.get(roleId) || new Set();
    const hasPermission = currentPerms.has(permissionId);

    // Optimistically update UI
    const newPerms = new Set(currentPerms);
    if (hasPermission) {
      newPerms.delete(permissionId);
    } else {
      newPerms.add(permissionId);
    }
    setRolePermissions(new Map(rolePermissions).set(roleId, newPerms));

    // Save to server
    setSaving(roleId);
    try {
      const res = await fetch(`/api/admin/roles/${roleId}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionIds: Array.from(newPerms) }),
      });

      if (!res.ok) {
        // Revert on error
        setRolePermissions(new Map(rolePermissions).set(roleId, currentPerms));
        const data = await res.json();
        throw new Error(data.error || "Failed to update permissions");
      }

      addToast("success", "Permissions updated");
    } catch (err) {
      addToast("error", err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(null);
    }
  };

  // Get ordered modules that have permissions
  const orderedModules = MODULE_ORDER.filter((m) => permissions[m]?.length > 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Role Permissions"
          description="Configure granular permissions for each role"
        />
        <GlassCard className="flex items-center justify-center py-12">
          <Spinner size="lg" />
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Role Permissions"
        description="Configure granular permissions for each role. Admin role has implicit access to all permissions."
      />

      <GlassCard padding="none" className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {/* Module headers */}
            <tr className="border-b border-white/10">
              <th className="sticky left-0 bg-black/40 backdrop-blur-sm p-4 text-left text-white/70 font-medium w-40">
                Role
              </th>
              {orderedModules.map((mod) => (
                <th
                  key={mod}
                  colSpan={permissions[mod]?.length || 1}
                  className="p-3 text-center text-white/70 font-medium capitalize border-l border-white/10"
                >
                  {mod}
                </th>
              ))}
            </tr>
            {/* Action sub-headers */}
            <tr className="border-b border-white/10 text-xs">
              <th className="sticky left-0 bg-black/40 backdrop-blur-sm"></th>
              {orderedModules.map((mod) =>
                (permissions[mod] || []).map((p) => (
                  <th
                    key={p.id}
                    className="p-2 text-center text-white/50 capitalize font-normal min-w-[60px]"
                    title={p.description || p.code}
                  >
                    {p.action}
                  </th>
                ))
              )}
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => {
              const rolePerms = rolePermissions.get(role.id) || new Set();
              const isRoleSaving = saving === role.id;

              return (
                <tr
                  key={role.id}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors"
                >
                  <td className="sticky left-0 bg-black/40 backdrop-blur-sm p-4 font-medium text-white capitalize">
                    <div className="flex items-center gap-2">
                      {role.name}
                      {isRoleSaving && <Spinner size="sm" />}
                    </div>
                  </td>
                  {orderedModules.map((mod) =>
                    (permissions[mod] || []).map((p) => {
                      const hasPermission = rolePerms.has(p.id);
                      return (
                        <td key={p.id} className="p-2 text-center">
                          <button
                            onClick={() => handleToggle(role.id, p.id)}
                            disabled={isRoleSaving}
                            className={`w-5 h-5 rounded border transition-all ${
                              hasPermission
                                ? "bg-emerald-500 border-emerald-400"
                                : "bg-white/5 border-white/20 hover:border-white/40"
                            } ${isRoleSaving ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                            title={`${hasPermission ? "Remove" : "Grant"} ${p.code} permission`}
                          >
                            {hasPermission && (
                              <svg
                                className="w-full h-full text-white"
                                viewBox="0 0 20 20"
                                fill="currentColor"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </button>
                        </td>
                      );
                    })
                  )}
                </tr>
              );
            })}
            {/* Admin row (informational) */}
            <tr className="bg-white/5">
              <td className="sticky left-0 bg-black/20 backdrop-blur-sm p-4 font-medium text-white/50">
                admin
                <span className="ml-2 text-xs text-white/30">(all access)</span>
              </td>
              <td
                colSpan={orderedModules.reduce((acc, m) => acc + (permissions[m]?.length || 0), 0)}
                className="p-4 text-center text-white/30 text-sm"
              >
                Admin role has implicit access to all permissions and cannot be modified
              </td>
            </tr>
          </tbody>
        </table>
      </GlassCard>

      {/* Legend */}
      <GlassCard className="flex items-center gap-6 text-sm text-white/60">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border bg-emerald-500 border-emerald-400" />
          <span>Permission granted</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded border bg-white/5 border-white/20" />
          <span>Permission denied</span>
        </div>
        <div className="flex-1" />
        <span className="text-white/40">
          Click a checkbox to toggle the permission for that role
        </span>
      </GlassCard>
    </div>
  );
}
