// ============================================================
// LEGALIR — Internationalization
// ============================================================

import { faIR } from "./fa-IR";
import { en } from "./en";

export type Locale = "fa-IR" | "en";

type MessageTree = { readonly [key: string]: string | MessageTree };

const messages: Record<Locale, MessageTree> = {
  "fa-IR": faIR as unknown as MessageTree,
  en: en as unknown as MessageTree,
};

export function getMessages(locale: Locale): MessageTree {
  return messages[locale];
}

// Template interpolation utilities
export { t, createTranslator, getNestedValue, translatePath } from "./interpolate";

// React context & hooks
export { LocaleProvider, useLocale, useT } from "./locale-context";

// Locale files
export { faIR, en };
