// ============================================================
// LEGALIR — i18n Template Interpolation
// ============================================================

/**
 * Simple template interpolation.
 * Replaces {key} placeholders with values from the params object.
 *
 * Example:
 *   t("Hello, {name}", { name: "World" }) => "Hello, World"
 *
 * Supports pluralization with {count}:
 *   t("{count} messages", { count: 5 }) => "5 messages"
 */
export function t(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    if (key in params) {
      const val = params[key];
      return val !== undefined ? String(val) : `{${key}}`;
    }
    return `{${key}}`;
  });
}

/**
 * Type-safe translator factory for a given locale.
 */
export function createTranslator<T extends Record<string, unknown>>(messages: T) {
  return function translate<K extends keyof T>(key: K, params?: Record<string, string | number>): T[K] {
    const template = messages[key];
    if (typeof template === "string") {
      return t(template, params) as T[K];
    }
    return template;
  };
}

/**
 * Deep access helper: "auth.mobileTitle" => faIR.auth.mobileTitle
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce((acc: unknown, key: string) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export function translatePath(
  messages: Record<string, unknown>,
  path: string,
  params?: Record<string, string | number>
): string {
  const value = getNestedValue(messages, path);
  if (typeof value === "string") {
    return t(value, params);
  }
  if (typeof value === "object" && value !== null && ("zero" in value || "other" in value)) {
    // Pluralization object
    const count = params?.["count"] ?? 0;
    const plural = value as Record<string, string>;
    const form =
      count === 0 ? "zero" : count === 1 ? "one" : count === 2 ? "two" : "other";
    return t(plural[form] ?? plural["other"] ?? path, params);
  }
  return path;
}
