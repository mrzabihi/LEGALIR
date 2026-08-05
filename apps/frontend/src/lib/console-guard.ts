// ============================================================
// LEGALIR — Console Guard (Phase 12)
// Strips sensitive data from console output in production.
// ============================================================

const SENSITIVE_KEYS = [
  "password",
  "token",
  "sessionId",
  "session",
  "secret",
  "apiKey",
  "authorization",
  "cookie",
  "mobileE164",
  "creditCard",
  "ssn",
  "nationalId",
];

function isSensitive(key: string): boolean {
  return SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k.toLowerCase()));
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  if (!obj || typeof obj !== "object") return obj;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitive(key)) {
      result[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      result[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Install console guards that strip sensitive data from logs in production.
 * Call once at app boot.
 */
export function installConsoleGuard(): void {
  if (process.env.NODE_ENV !== "production") return;

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  const noop = () => {};

  // In production, completely disable debug and trace logs
  // eslint-disable-next-line no-console
  console.debug = noop;
  // eslint-disable-next-line no-console
  console.trace = noop;

  // Wrap console.log to sanitize objects
  // eslint-disable-next-line no-console
  const originalLog = console.log.bind(console);
  // eslint-disable-next-line no-console
  console.log = (...args: unknown[]) => {
    const sanitized = args.map((arg) => {
      if (typeof arg === "object" && arg !== null) {
        return sanitizeObject(arg as Record<string, unknown>);
      }
      return arg;
    });
    originalLog(...sanitized);
  };

  // Wrap console.error to sanitize but keep error reporting
  const originalError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const sanitized = args.map((arg) => {
      if (typeof arg === "object" && arg !== null) {
        return sanitizeObject(arg as Record<string, unknown>);
      }
      return arg;
    });
    originalError(...sanitized);
  };
}
