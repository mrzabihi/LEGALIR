// ============================================================
// LEGALIR — Legal Service Registry (Single Source of Truth)
// ============================================================
// Every surface that identifies a service — dashboard cards,
// breadcrumb, page header, icon, deep-link href — derives from
// this registry. Nothing else may hard-code service metadata.
//
// Titles/descriptions come from `@/lib/ai/service-context` so the
// AI gateway vocabulary and the UI vocabulary can never drift.
// ============================================================

import type { ComponentType } from "react";
import {
  SERVICE_CONTEXTS,
  serviceTypeFromQuery,
  type ServiceType,
} from "@/lib/ai/service-context";
import {
  IconChat,
  IconFileSearch,
  IconFilePen,
  IconFileText,
  IconFiles,
  IconCalculator,
} from "@/lib/icons";

/** Icon component shape produced by `@/lib/icons`. */
export type ServiceIcon = ComponentType<{ size?: number; className?: string }>;

export interface LegalService {
  /** Stable identifier — equals the AI `ServiceType`. */
  id: ServiceType;
  /** Display title (e.g. «مشاوره حقوقی»). */
  title: string;
  /** Short subtitle shown under the title (e.g. «سوال خود را بپرسید»). */
  subtitle: string;
  /** Longer description used by the AI context card. */
  description: string;
  /** Base route this service lives on (e.g. `/chat`). */
  route: string;
  /** Deep-linkable href carrying the service context in the URL. */
  href: string;
  /** Tailwind gradient classes for the dashboard card chip. */
  gradient: string;
  /** Semantic icon from the shared icon library. */
  icon: ServiceIcon;
}

/** Canonical query-param key that carries service context in the URL. */
export const SERVICE_QUERY_KEY = "service";

/** Builds the deep-link href for a service type. */
export function serviceHref(type: ServiceType, route: string): string {
  return `${route}?${SERVICE_QUERY_KEY}=${type}`;
}

interface ServiceSeed {
  id: ServiceType;
  subtitle: string;
  route: string;
  gradient: string;
  icon: ServiceIcon;
}

// The six dashboard services, in display order.
const SEEDS: ServiceSeed[] = [
  {
    id: "legal_consultation",
    subtitle: "سوال خود را بپرسید",
    route: "/chat",
    gradient: "from-blue-500 to-blue-600",
    icon: IconChat,
  },
  {
    id: "contract_review",
    subtitle: "تحلیل ریسک و شروط",
    route: "/documents",
    gradient: "from-emerald-500 to-emerald-600",
    icon: IconFileSearch,
  },
  {
    id: "contract_drafting",
    subtitle: "پیش‌نویس هوشمند",
    route: "/contracts",
    gradient: "from-violet-500 to-violet-600",
    icon: IconFilePen,
  },
  {
    id: "legal_notice",
    subtitle: "نامه‌نگاری حقوقی",
    route: "/chat",
    gradient: "from-orange-500 to-orange-600",
    icon: IconFileText,
  },
  {
    id: "document_analysis",
    subtitle: "بررسی مستندات",
    route: "/documents",
    gradient: "from-cyan-500 to-cyan-600",
    icon: IconFiles,
  },
  {
    id: "legal_calculation",
    subtitle: "خسارت، ارث، دیه",
    route: "/chat",
    gradient: "from-rose-500 to-rose-600",
    icon: IconCalculator,
  },
];

export const LEGAL_SERVICES: LegalService[] = SEEDS.map((seed) => {
  const ctx = SERVICE_CONTEXTS[seed.id];
  return {
    id: seed.id,
    title: ctx.label,
    subtitle: seed.subtitle,
    description: ctx.description,
    route: seed.route,
    href: serviceHref(seed.id, seed.route),
    gradient: seed.gradient,
    icon: seed.icon,
  };
});

/** Default service shown when a route is opened without a valid context. */
const ROUTE_DEFAULTS: Record<string, ServiceType> = {
  "/chat": "legal_consultation",
  "/documents": "document_analysis",
  "/contracts": "contract_drafting",
};

export function getServiceById(id: string | null | undefined): LegalService | undefined {
  if (!id) return undefined;
  return LEGAL_SERVICES.find((s) => s.id === id);
}

/** Returns the default service for a base route, if one is registered. */
export function getDefaultServiceForRoute(pathname: string): LegalService | undefined {
  const type = ROUTE_DEFAULTS[pathname];
  return type ? getServiceById(type) : undefined;
}

/**
 * Resolves the active service from the URL. The URL is the single
 * source of truth, so this is refresh-safe and deep-linkable.
 *
 * Resolution order:
 *   1. `?service=` / `?category=` param, if it maps to a service
 *      registered on this route.
 *   2. The route's default service.
 *   3. `undefined` (no service context — render nothing).
 */
export function resolveService(
  pathname: string,
  search: string | URLSearchParams | null | undefined,
): LegalService | undefined {
  const params =
    search instanceof URLSearchParams ? search : new URLSearchParams(search ?? "");
  const raw = params.get(SERVICE_QUERY_KEY) ?? params.get("category");

  if (raw) {
    // Reuse the isomorphic mapper so legacy `?category=` values keep working.
    const type = serviceTypeFromQuery(`${SERVICE_QUERY_KEY}=${encodeURIComponent(raw)}`);
    const service = getServiceById(type);
    if (service && service.route === pathname) return service;
  }

  return getDefaultServiceForRoute(pathname);
}
