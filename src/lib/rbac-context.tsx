"use client";

import * as React from "react";

interface PageAccess {
  pageId: string;
  pageCode: string;
  pageName: string;
  route: string;
  module: string;
  hasAccess: boolean;
  isAlwaysAccessible: boolean;
}

interface RbacContextValue {
  accessiblePages: PageAccess[];
  accessibleRoutes: Set<string>;
  isLoading: boolean;
  isAdmin: boolean;
  hasPageAccess: (route: string) => boolean;
  refresh: () => Promise<void>;
}

const RbacContext = React.createContext<RbacContextValue | null>(null);

export function RbacProvider({ children }: { children: React.ReactNode }) {
  const [accessiblePages, setAccessiblePages] = React.useState<PageAccess[]>([]);
  const [accessibleRoutes, setAccessibleRoutes] = React.useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = React.useState(true);
  const [isAdmin, setIsAdmin] = React.useState(false);

  const loadAccessiblePages = React.useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/auth/accessible-pages");
      if (res.ok) {
        const data = await res.json();
        setAccessiblePages(data.pages || []);
        setAccessibleRoutes(new Set(data.routes || []));
        setIsAdmin(data.isAdmin || false);
      }
    } catch (error) {
      console.error("Failed to load accessible pages:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadAccessiblePages();
  }, [loadAccessiblePages]);

  const hasPageAccess = React.useCallback(
    (route: string): boolean => {
      // Admin has access to everything
      if (isAdmin) return true;

      // Check if route is in accessible routes
      if (accessibleRoutes.has(route)) return true;

      // Check for partial match (e.g., /finance matches /finance/journals)
      for (const accessibleRoute of accessibleRoutes) {
        if (route.startsWith(accessibleRoute + "/")) return true;
      }

      // If RBAC data hasn't loaded yet, default to allowing (avoid flicker)
      if (isLoading) return true;

      // If route is not in our system at all, allow (backwards compatibility)
      const isInRbacSystem = accessiblePages.some(
        (p) => route === p.route || route.startsWith(p.route + "/")
      );
      if (!isInRbacSystem) return true;

      return false;
    },
    [accessibleRoutes, accessiblePages, isAdmin, isLoading]
  );

  const value = React.useMemo(
    () => ({
      accessiblePages,
      accessibleRoutes,
      isLoading,
      isAdmin,
      hasPageAccess,
      refresh: loadAccessiblePages,
    }),
    [accessiblePages, accessibleRoutes, isLoading, isAdmin, hasPageAccess, loadAccessiblePages]
  );

  return <RbacContext.Provider value={value}>{children}</RbacContext.Provider>;
}

export function useRbac(): RbacContextValue {
  const context = React.useContext(RbacContext);
  if (!context) {
    throw new Error("useRbac must be used within an RbacProvider");
  }
  return context;
}

/**
 * Hook to check if the current user has access to a specific action
 */
export function useActionAccess(pageCode: string, actionCode: string) {
  const [hasAccess, setHasAccess] = React.useState<boolean | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    async function checkAccess() {
      try {
        const res = await fetch(
          `/api/auth/check-action?pageCode=${pageCode}&actionCode=${actionCode}`
        );
        if (res.ok) {
          const data = await res.json();
          setHasAccess(data.hasAccess);
        } else {
          setHasAccess(false);
        }
      } catch {
        setHasAccess(false);
      } finally {
        setIsLoading(false);
      }
    }
    checkAccess();
  }, [pageCode, actionCode]);

  return { hasAccess, isLoading };
}
