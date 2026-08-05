"use client";

import React, { createContext, useContext, useCallback, useMemo } from "react";
import { faIR } from "./fa-IR";
import { en } from "./en";

export type Locale = "fa-IR" | "en";

type MessageTree = { readonly [key: string]: string | MessageTree };
type Messages = MessageTree;

interface LocaleContextValue {
  locale: Locale;
  messages: Messages;
  t: (path: string, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

const allMessages: Record<Locale, Messages> = {
  "fa-IR": faIR as unknown as Messages,
  en: en as unknown as Messages,
};

function getNested(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }
  return typeof current === "string" ? current : path;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
    if (key in params) {
      const val = params[key];
      return val !== undefined ? String(val) : `{${key}}`;
    }
    return `{${key}}`;
  });
}

export function LocaleProvider({
  locale = "fa-IR",
  children,
}: {
  locale?: Locale;
  children: React.ReactNode;
}) {
  const messages = allMessages[locale];

  const t = useCallback(
    (path: string, params?: Record<string, string | number>): string => {
      const value = getNested(messages as Record<string, unknown>, path);
      return interpolate(value, params);
    },
    [messages]
  );

  const value = useMemo(() => ({ locale, messages, t }), [locale, messages, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    throw new Error("useLocale must be used within a LocaleProvider");
  }
  return ctx;
}

/** Standalone t function using fa-IR by default */
export function useT() {
  const { t } = useLocale();
  return t;
}
