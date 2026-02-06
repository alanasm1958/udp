/**
 * HTTP fetch wrapper
 *
 * Tenant context is injected server-side by middleware from the JWT session.
 * Client-side code should NOT set x-tenant-id or x-user-id headers directly.
 */

type FetchOptions = RequestInit;

/**
 * Fetch wrapper with JSON defaults and error handling.
 * Tenant context is handled by middleware via session cookies.
 */
export async function api<T = unknown>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const { headers: customHeaders, ...restOptions } = options;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(customHeaders as Record<string, string>),
  };

  const response = await fetch(url, {
    ...restOptions,
    headers,
    credentials: "same-origin",
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
