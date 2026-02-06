"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { CopilotSidebar } from "@/components/ai/CopilotSidebar";
import { OmniWindow } from "@/components/ai/OmniWindow";
import { useRbac } from "@/lib/rbac-context";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  children?: { label: string; href: string }[];
  adminOnly?: boolean;
  platformOwnerOnly?: boolean;
}

interface UserInfo {
  id: string;
  email: string;
  fullName: string;
  roles: string[];
  tenant?: {
    id: string;
    name: string;
    isPlatformOwner?: boolean;
  };
}

// Unified Navigation - Consolidated structure with Operations hub
const navigation: NavItem[] = [
  // 1. Dashboard
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
      </svg>
    ),
  },
  // 2. HR & People (Remodel 2)
  {
    label: "HR & People",
    href: "/hr-people",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
  },
  // 4. Sales & Customers (Unified)
  {
    label: "Sales & Customers",
    href: "/sales-customers",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
      </svg>
    ),
  },
  // 5. Operations Hub (Remodeled - single entry point)
  {
    label: "Operations",
    href: "/operations",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
      </svg>
    ),
  },
  // 6. Finance & Cash Management
  {
    label: "Finance",
    href: "/finance",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  // 7. Marketing & Demand Generation
  {
    label: "Marketing",
    href: "/marketing",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 110-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 01-1.44-4.282m3.102.069a18.03 18.03 0 01-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 018.835 2.535M10.34 6.66a23.847 23.847 0 008.835-2.535m0 0A23.74 23.74 0 0018.795 3m.38 1.125a23.91 23.91 0 011.014 5.395m-1.014 8.855c-.118.38-.245.754-.38 1.125m.38-1.125a23.91 23.91 0 001.014-5.395m0-3.46c.495.413.811 1.035.811 1.73 0 .695-.316 1.317-.811 1.73m0-3.46a24.347 24.347 0 010 3.46" />
      </svg>
    ),
  },
  // 8. Settings
  {
    label: "Settings",
    href: "/settings",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    adminOnly: true,
    children: [
      { label: "General", href: "/settings" },
      { label: "Users", href: "/settings/users" },
      { label: "Permissions", href: "/settings/permissions" },
      { label: "Integrations", href: "/settings/integrations" },
      { label: "Billing", href: "/settings/billing" },
    ],
  },
  // 9. Tenant Management (Platform Owner Only)
  {
    label: "Tenants",
    href: "/tenant-management",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
      </svg>
    ),
    platformOwnerOnly: true,
  },
];

const SIDEBAR_OPEN_KEY = "udp-sidebar-open";
const SIDEBAR_EXPANDED_KEY = "udp-sidebar-expanded";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { hasPageAccess, isLoading: rbacLoading } = useRbac();
  const [sidebarOpen, setSidebarOpen] = React.useState(true);
  const [expandedItems, setExpandedItems] = React.useState<string[]>([]);
  const [userMenuOpen, setUserMenuOpen] = React.useState(false);
  const [user, setUser] = React.useState<UserInfo | null>(null);
  const [copilotOpen, setCopilotOpen] = React.useState(false);
  const [omniOpen, setOmniOpen] = React.useState(false);
  const [accessDeniedToast, setAccessDeniedToast] = React.useState(false);
  // Mobile menu state - used in route change effect
  const [, setMobileMenuOpen] = React.useState(false);
  const userMenuRef = React.useRef<HTMLDivElement>(null);
  const initializedRef = React.useRef(false);

  // Check for access denied redirect
  React.useEffect(() => {
    if (searchParams.get("access_denied") === "1") {
      setAccessDeniedToast(true);
      // Remove the query param from URL
      const url = new URL(window.location.href);
      url.searchParams.delete("access_denied");
      router.replace(url.pathname);
      // Auto-hide toast
      setTimeout(() => setAccessDeniedToast(false), 5000);
    }
  }, [searchParams, router]);

  // Load sidebar state from localStorage on mount
  React.useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    try {
      const savedSidebarOpen = localStorage.getItem(SIDEBAR_OPEN_KEY);
      if (savedSidebarOpen !== null) {
        setSidebarOpen(savedSidebarOpen === "true");
      }

      const savedExpanded = localStorage.getItem(SIDEBAR_EXPANDED_KEY);
      if (savedExpanded) {
        const parsed = JSON.parse(savedExpanded);
        if (Array.isArray(parsed)) {
          setExpandedItems(parsed);
        }
      }
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Save sidebar open state to localStorage
  const handleSidebarToggle = React.useCallback(() => {
    setSidebarOpen((prev) => {
      const newValue = !prev;
      try {
        localStorage.setItem(SIDEBAR_OPEN_KEY, String(newValue));
      } catch {
        // Ignore localStorage errors
      }
      return newValue;
    });
  }, []);

  // Fetch user info
  React.useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (data?.user) {
          setUser({
            id: data.user.id,
            email: data.user.email,
            fullName: data.user.fullName,
            roles: data.user.roles || [],
            tenant: data.tenant,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Close user menu on outside click
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto-expand parent when child is active + close mobile menu on navigation
  React.useEffect(() => {
    // Close mobile menu on route change
    setMobileMenuOpen(false);

    // Auto-expand parent of active route
    navigation.forEach((item) => {
      if (item.children?.some((child) => pathname.startsWith(child.href))) {
        setExpandedItems((prev) => {
          if (prev.includes(item.href)) return prev;
          const newItems = [...prev, item.href];
          try {
            localStorage.setItem(SIDEBAR_EXPANDED_KEY, JSON.stringify(newItems));
          } catch {
            // Ignore localStorage errors
          }
          return newItems;
        });
      }
    });
  }, [pathname]);

  // Keyboard shortcuts for AI
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K for Omni Window
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOmniOpen((prev) => !prev);
      }
      // Cmd/Ctrl + / for Copilot Sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === "/") {
        e.preventDefault();
        setCopilotOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const toggleExpanded = React.useCallback((href: string) => {
    setExpandedItems((prev) => {
      const newItems = prev.includes(href)
        ? prev.filter((h) => h !== href)
        : [...prev, href];
      try {
        localStorage.setItem(SIDEBAR_EXPANDED_KEY, JSON.stringify(newItems));
      } catch {
        // Ignore localStorage errors
      }
      return newItems;
    });
  }, []);

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");
  const isAdmin = user?.roles.includes("admin") ?? false;
  const isPlatformOwner = (user?.tenant?.isPlatformOwner && isAdmin) ?? false;

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  // Filter navigation based on role, platform owner status, and RBAC page access
  const filteredNavigation = React.useMemo(() => {
    return navigation.filter((item) => {
      // Admin-only check
      if (item.adminOnly && !isAdmin) return false;
      // Platform owner check
      if (item.platformOwnerOnly && !isPlatformOwner) return false;
      // RBAC page access check (skip for admins - they have full access)
      if (!isAdmin && !rbacLoading && !hasPageAccess(item.href)) return false;
      return true;
    }).map((item) => {
      // Also filter children based on RBAC
      if (item.children && !isAdmin) {
        const filteredChildren = item.children.filter(
          (child) => rbacLoading || hasPageAccess(child.href)
        );
        // If all children are filtered out, hide the parent too
        if (filteredChildren.length === 0) return null;
        return { ...item, children: filteredChildren };
      }
      return item;
    }).filter((item): item is NavItem => item !== null);
  }, [isAdmin, isPlatformOwner, hasPageAccess, rbacLoading]);

  // Get current section name for breadcrumb
  const getCurrentSection = () => {
    for (const item of navigation) {
      if (item.children) {
        const child = item.children.find((c) => pathname.startsWith(c.href));
        if (child) return child.label;
      }
      if (pathname === item.href || pathname.startsWith(item.href + "/")) {
        return item.label;
      }
    }
    return "Dashboard";
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Background blobs */}
      <div className="glass-bg-blob-1" />
      <div className="glass-bg-blob-2" />

      {/* Sidebar */}
      <aside
        className={`
          glass-sidebar flex flex-col
          transition-all duration-300 ease-in-out
          ${sidebarOpen ? "w-64" : "w-16"}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 h-16 px-4 border-b border-white/8">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-sm">U</span>
          </div>
          {sidebarOpen && (
            <span className="font-semibold text-white tracking-tight">UDP ERP</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-2">
          <ul className="space-y-1">
            {filteredNavigation.map((item) => {
              const hasChildren = item.children && item.children.length > 0;
              const isExpanded = expandedItems.includes(item.href);
              const itemActive = isActive(item.href);

              return (
                <li key={item.href}>
                  {hasChildren ? (
                    <>
                      <button
                        onClick={() => toggleExpanded(item.href)}
                        className={`
                          w-full flex items-center gap-3 px-3 py-2.5 rounded-xl
                          text-sm font-medium transition-all duration-150
                          ${itemActive ? "bg-white/10 text-white" : "text-white/60 hover:text-white hover:bg-white/5"}
                        `}
                      >
                        <span className={itemActive ? "text-white" : "text-white/50"}>{item.icon}</span>
                        {sidebarOpen && (
                          <>
                            <span className="flex-1 text-left">{item.label}</span>
                            <svg
                              className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </>
                        )}
                      </button>
                      {sidebarOpen && isExpanded && item.children && (
                        <ul className="mt-1 ml-8 space-y-0.5">
                          {item.children.map((child) => (
                            <li key={child.href}>
                              <Link
                                href={child.href}
                                className={`
                                  block px-3 py-2 rounded-lg text-sm
                                  transition-all duration-150
                                  ${pathname === child.href
                                    ? "text-white bg-white/10"
                                    : "text-white/50 hover:text-white hover:bg-white/5"
                                  }
                                `}
                              >
                                {child.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      )}
                    </>
                  ) : (
                    <Link
                      href={item.href}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-xl
                        text-sm font-medium transition-all duration-150
                        ${itemActive ? "bg-white/10 text-white" : "text-white/60 hover:text-white hover:bg-white/5"}
                      `}
                    >
                      <span className={itemActive ? "text-white" : "text-white/50"}>{item.icon}</span>
                      {sidebarOpen && <span>{item.label}</span>}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Sidebar toggle */}
        <div className="p-2 border-t border-white/8">
          <button
            onClick={handleSidebarToggle}
            className="w-full flex items-center justify-center p-2 rounded-xl text-white/50 hover:text-white hover:bg-white/5 transition-all"
          >
            <svg
              className={`w-5 h-5 transition-transform ${sidebarOpen ? "" : "rotate-180"}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <header className="glass-header h-16 flex items-center justify-between px-6">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-white/40">{user?.tenant?.name || "Workspace"}</span>
            <span className="text-white/20">/</span>
            <span className="text-white/70 font-medium">{getCurrentSection()}</span>
          </div>

          {/* AI Buttons */}
          <div className="flex items-center gap-2 mr-4">
            <button
              onClick={() => setOmniOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
              title="Quick search (⌘K)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline px-1.5 py-0.5 text-xs bg-white/10 rounded">⌘K</kbd>
            </button>
            <button
              onClick={() => setCopilotOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-white/60 hover:text-white bg-gradient-to-r from-purple-500/20 to-blue-500/20 hover:from-purple-500/30 hover:to-blue-500/30 border border-purple-500/20 rounded-lg transition-colors"
              title="AI Copilot (⌘/)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              <span className="hidden sm:inline">Copilot</span>
            </button>
          </div>

          {/* User menu */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="flex items-center gap-3 px-2 py-1.5 rounded-xl hover:bg-white/5 transition-colors"
            >
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-white/90">{user?.fullName || "Loading..."}</p>
                <p className="text-xs text-white/50">{user?.email}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center">
                <span className="text-white text-sm font-medium">
                  {user?.fullName?.charAt(0)?.toUpperCase() || "?"}
                </span>
              </div>
            </button>

            {/* Dropdown */}
            {userMenuOpen && (
              <div className="absolute right-0 mt-2 w-56 py-2 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-xl animate-scale-up">
                <div className="px-4 py-2 border-b border-white/10">
                  <p className="text-sm font-medium text-white">{user?.fullName}</p>
                  <p className="text-xs text-white/50">{user?.email}</p>
                  {isAdmin && (
                    <span className="inline-block mt-1 px-2 py-0.5 text-xs bg-blue-500/20 text-blue-400 rounded-md">
                      Admin
                    </span>
                  )}
                </div>
                <div className="py-1">
                  {isAdmin && (
                    <Link
                      href="/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Settings
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                    </svg>
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>

      {/* AI Components */}
      <CopilotSidebar
        open={copilotOpen}
        onClose={() => setCopilotOpen(false)}
      />
      <OmniWindow
        open={omniOpen}
        onClose={() => setOmniOpen(false)}
        onOpenCopilot={() => {
          setOmniOpen(false);
          setCopilotOpen(true);
        }}
      />

      {/* Access Denied Toast */}
      {accessDeniedToast && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
          <div className="flex items-center gap-3 px-4 py-3 bg-red-500/90 backdrop-blur-xl text-white rounded-xl shadow-xl border border-red-400/20">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span className="text-sm font-medium">You don't have access to that page</span>
            <button
              onClick={() => setAccessDeniedToast(false)}
              className="p-1 hover:bg-white/20 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
