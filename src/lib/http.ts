/**
 * HTTP fetch wrapper with tenant headers
 *
 * Automatically includes x-tenant-id and x-user-id headers for all API calls.
 * Uses localStorage for values in browser, falls back to defaults for dev.
 */

// Default IDs for dev mode (matches seed data)
const DEFAULT_TENANT_ID = "19ff1b5c-3d71-4f83-a622-cb54c73d6056";
const DEFAULT_USER_ID = "9373c649-8db3-41f6-8f93-4b864839e78a";

function getTenantId(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("tenantId") || DEFAULT_TENANT_ID;
  }
  return DEFAULT_TENANT_ID;
}

function getUserId(): string {
  if (typeof window !== "undefined") {
    return localStorage.getItem("userId") || DEFAULT_USER_ID;
  }
  return DEFAULT_USER_ID;
}

interface FetchOptions extends RequestInit {
  skipTenantHeaders?: boolean;
}

/**
 * Fetch wrapper that includes tenant headers automatically.
 */
export async function api<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const { skipTenantHeaders, headers: customHeaders, ...restOptions } = options;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(customHeaders as Record<string, string>),
  };

  if (!skipTenantHeaders) {
    (headers as Record<string, string>)["x-tenant-id"] = getTenantId();
    (headers as Record<string, string>)["x-user-id"] = getUserId();
  }

  const response = await fetch(url, {
    ...restOptions,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Shorthand for GET requests.
 */
export function apiGet<T = unknown>(url: string, options?: FetchOptions): Promise<T> {
  return api<T>(url, { ...options, method: "GET" });
}

/**
 * Shorthand for POST requests.
 */
export function apiPost<T = unknown>(
  url: string,
  body?: unknown,
  options?: FetchOptions
): Promise<T> {
  return api<T>(url, {
    ...options,
    method: "POST",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Shorthand for PUT requests.
 */
export function apiPut<T = unknown>(
  url: string,
  body?: unknown,
  options?: FetchOptions
): Promise<T> {
  return api<T>(url, {
    ...options,
    method: "PUT",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Shorthand for DELETE requests.
 */
export function apiDelete<T = unknown>(url: string, options?: FetchOptions): Promise<T> {
  return api<T>(url, { ...options, method: "DELETE" });
}

/**
 * Shorthand for PATCH requests.
 */
export function apiPatch<T = unknown>(
  url: string,
  body?: unknown,
  options?: FetchOptions
): Promise<T> {
  return api<T>(url, {
    ...options,
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  });
}

/**
 * Format currency values for display.
 */
export function formatCurrency(amount: number | string, currency = "USD"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Format date for display.
 */
export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format datetime for display.
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
