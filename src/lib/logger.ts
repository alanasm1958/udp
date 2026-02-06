/**
 * Structured logging for server-side operations.
 * Outputs JSON in production for log aggregation, human-readable in development.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  tenantId?: string;
  userId?: string;
  requestId?: string;
  route?: string;
  method?: string;
  durationMs?: number;
  [key: string]: unknown;
}

function formatLog(level: LogLevel, message: string, context?: LogContext, error?: unknown): string {
  const timestamp = new Date().toISOString();

  if (process.env.NODE_ENV === "production") {
    const entry: Record<string, unknown> = {
      timestamp,
      level,
      message,
      ...context,
    };
    if (error instanceof Error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }
    return JSON.stringify(entry);
  }

  // Development: human-readable format
  const ctx = context
    ? ` ${Object.entries(context).map(([k, v]) => `${k}=${v}`).join(" ")}`
    : "";
  const errStr = error instanceof Error ? ` | ${error.message}` : "";
  return `[${timestamp}] ${level.toUpperCase()} ${message}${ctx}${errStr}`;
}

export const logger = {
  debug(message: string, context?: LogContext): void {
    if (process.env.NODE_ENV === "development") {
      console.debug(formatLog("debug", message, context));
    }
  },

  info(message: string, context?: LogContext): void {
    console.info(formatLog("info", message, context));
  },

  warn(message: string, context?: LogContext): void {
    console.warn(formatLog("warn", message, context));
  },

  error(message: string, error?: unknown, context?: LogContext): void {
    console.error(formatLog("error", message, context, error));
  },
};

/**
 * Create a request-scoped logger with pre-filled context.
 */
export function createRequestLogger(context: LogContext) {
  return {
    debug: (message: string, extra?: LogContext) =>
      logger.debug(message, { ...context, ...extra }),
    info: (message: string, extra?: LogContext) =>
      logger.info(message, { ...context, ...extra }),
    warn: (message: string, extra?: LogContext) =>
      logger.warn(message, { ...context, ...extra }),
    error: (message: string, error?: unknown, extra?: LogContext) =>
      logger.error(message, error, { ...context, ...extra }),
  };
}
