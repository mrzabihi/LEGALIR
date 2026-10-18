// ============================================================
// LEGALIR — Judicial services configuration (server-only)
// ============================================================
// The admin-editable release control for the judicial sub-services. One row
// per service in `judicial_service_config`, seeded once with the product's
// real capabilities and then owned by the admin.
//
// The honesty rule this module exists to enforce:
//
//   a service is offered ONLY when its configured status is `available`
//   AND its feature flag is enabled AND no declared external requirement
//   is still unconfigured.
//
// Nothing in the UI decides availability on its own, and no label change in
// the admin panel can make a provider-dependent service look live: the
// `availability` projection is computed server-side from all three facts and
// every mutating route re-checks it.
// ============================================================

import { readTable, writeTable } from "@/lib/db";
import {
  currentEnvironment,
  isFlagEnabled,
  type FlagContext,
} from "@/lib/admin/flags";
import { JUDICIAL_FAMILY_ID } from "@legalir/types";
import type {
  JudicialDocumentType,
  JudicialServiceAccess,
  JudicialServiceConfig,
  JudicialServiceId,
  JudicialServiceRequirement,
  JudicialServiceStatus,
  JudicialServiceSurfaces,
  JudicialServiceView,
} from "@legalir/types";

const TABLE = "judicial_service_config";

/** The config table's own schema version, migrated additively. */
export const JUDICIAL_CONFIG_VERSION = 1;

/** The feature-flag key that gates each service. */
export const JUDICIAL_FLAG_KEY: Record<JudicialServiceId, string> = {
  judicial_statement: "judicial_statement",
  judicial_brief: "judicial_brief",
  judicial_petition: "judicial_petition",
  judicial_complaint: "judicial_complaint",
  judicial_criminal_record: "judicial_criminal_record",
  judicial_credit_check: "judicial_credit_check",
};

export const JUDICIAL_SERVICE_IDS: readonly JudicialServiceId[] = [
  "judicial_statement",
  "judicial_brief",
  "judicial_petition",
  "judicial_complaint",
  "judicial_criminal_record",
  "judicial_credit_check",
];

// Drafting is charged through the Entitlement & Usage Engine's single
// registry entry; the price itself lives there (and in the admin energy
// profiles), never as a second copy on the service row.
const AI_ACCESS: JudicialServiceAccess = {
  mode: "energy",
  activity: "JUDICIAL_DRAFT",
};

const INTERNAL: JudicialServiceRequirement = {
  kind: "internal",
  providerFa: null,
  configured: true,
  noteFa: null,
};

/** Criminal record needs an authorized certificate-issuing integration. */
const CRIMINAL_REQUIREMENT: JudicialServiceRequirement = {
  kind: "external",
  providerFa: "سامانهٔ رسمی صدور گواهی عدم سوءپیشینه",
  configured: false,
  noteFa:
    "صدور و دریافت گواهی تنها از طریق سامانهٔ رسمی امکان‌پذیر است و این اتصال هنوز برقرار نشده است. تا آن زمان هیچ درخواستی ثبت یا هیچ گواهی‌ای تولید نمی‌شود.",
};

/** Credit check needs the subject's verifiable consent plus a real provider. */
const CREDIT_REQUIREMENT: JudicialServiceRequirement = {
  kind: "external",
  providerFa: "ارائه‌دهندهٔ رسمی استعلام اعتبار",
  configured: false,
  noteFa:
    "استعلام اعتبار معاملاتی نیازمند رضایت قابل‌اثبات صاحب داده و ارائه‌دهندهٔ رسمی استعلام است. این زیرساخت هنوز متصل نشده و هیچ نتیجه‌ای شبیه‌سازی نمی‌شود.",
};

interface SeedDef {
  id: JudicialServiceId;
  documentType: JudicialDocumentType | null;
  order: number;
  titleFa: string;
  shortTitleFa: string;
  descriptionFa: string;
  ctaFa: string;
  status: JudicialServiceStatus;
  statusNoteFa: string | null;
  surfaces: JudicialServiceSurfaces;
  access: JudicialServiceAccess;
  requirement: JudicialServiceRequirement;
}

function seedDefs(): SeedDef[] {
  const allSurfaces: JudicialServiceSurfaces = {
    home: true,
    services: true,
    new: true,
    cases: true,
  };

  return [
    {
      id: "judicial_statement",
      documentType: "statement",
      order: 10,
      titleFa: "تنظیم اظهارنامه قضایی",
      shortTitleFa: "اظهارنامه",
      descriptionFa:
        "شرح موضوع را بنویس، پرسش‌های مرتبط را پاسخ بده و مدارک را وصل کن تا پیش‌نویس اظهارنامه برای بازبینی آماده شود.",
      ctaFa: "تنظیم اظهارنامه",
      status: "available",
      statusNoteFa: null,
      surfaces: allSurfaces,
      access: AI_ACCESS,
      requirement: INTERNAL,
    },
    {
      id: "judicial_brief",
      documentType: "brief",
      order: 20,
      titleFa: "تنظیم لایحه",
      shortTitleFa: "لایحه",
      descriptionFa:
        "با تکیه بر روایت پرونده و مدارک خودت، پیش‌نویس لایحه را آماده کن و پیش از هر اقدامی آن را بازبینی کن.",
      ctaFa: "تنظیم لایحه",
      status: "available",
      statusNoteFa: null,
      surfaces: allSurfaces,
      access: AI_ACCESS,
      requirement: INTERNAL,
    },
    {
      id: "judicial_petition",
      documentType: "petition",
      order: 30,
      titleFa: "تنظیم دادخواست حقوقی",
      shortTitleFa: "دادخواست",
      descriptionFa:
        "خواسته، طرفین و مستندات را مشخص کن تا پیش‌نویس دادخواست به‌صورت ساختارمند آماده شود.",
      ctaFa: "تنظیم دادخواست",
      status: "available",
      statusNoteFa: null,
      surfaces: allSurfaces,
      access: AI_ACCESS,
      requirement: INTERNAL,
    },
    {
      id: "judicial_complaint",
      documentType: "complaint",
      order: 40,
      titleFa: "تنظیم شکواییه کیفری",
      shortTitleFa: "شکواییه",
      descriptionFa:
        "شرح وقوع جرم و مستندات را وارد کن تا پیش‌نویس شکواییه برای بازبینی آماده شود.",
      ctaFa: "تنظیم شکواییه",
      status: "available",
      statusNoteFa: null,
      surfaces: allSurfaces,
      access: AI_ACCESS,
      requirement: INTERNAL,
    },
    {
      id: "judicial_criminal_record",
      documentType: null,
      order: 50,
      titleFa: "گواهی عدم سوءپیشینه",
      shortTitleFa: "عدم سوءپیشینه",
      descriptionFa:
        "درخواست گواهی عدم سوءپیشینه از مرجع رسمی. این خدمت به اتصال رسمی نیاز دارد و هنوز فعال نشده است.",
      ctaFa: "جزئیات خدمت",
      status: "soon",
      statusNoteFa: CRIMINAL_REQUIREMENT.noteFa,
      surfaces: allSurfaces,
      access: { mode: "free", activity: null },
      requirement: CRIMINAL_REQUIREMENT,
    },
    {
      id: "judicial_credit_check",
      documentType: null,
      order: 60,
      titleFa: "استعلام اعتبار معاملاتی",
      shortTitleFa: "اعتبار معاملاتی",
      descriptionFa:
        "بررسی سابقهٔ اعتباری اشخاص با رضایت آن‌ها. این خدمت به ارائه‌دهندهٔ رسمی و تأیید هویت نیاز دارد و هنوز فعال نشده است.",
      ctaFa: "جزئیات خدمت",
      status: "soon",
      statusNoteFa: CREDIT_REQUIREMENT.noteFa,
      surfaces: allSurfaces,
      access: { mode: "free", activity: null },
      requirement: CREDIT_REQUIREMENT,
    },
  ];
}

type StoredConfig = Omit<JudicialServiceConfig, "family"> & {
  family?: typeof JUDICIAL_FAMILY_ID;
  schemaVersion?: number;
};

function seed(): JudicialServiceConfig[] {
  const now = new Date().toISOString();
  const rows: JudicialServiceConfig[] = seedDefs().map((d) => ({
    ...d,
    family: JUDICIAL_FAMILY_ID,
    requiresAuth: true,
    version: 1,
    updatedAt: now,
    updatedBy: null,
  }));
  writeTable(TABLE, rows.map((r) => ({ ...r, schemaVersion: JUDICIAL_CONFIG_VERSION })));
  return rows;
}

/**
 * All service configs, seeding on first access.
 *
 * A database seeded by an earlier build may be missing a newly shipped
 * service — new seed rows are appended; existing rows (an operator's edits)
 * are never overwritten.
 */
export function listJudicialServices(): JudicialServiceConfig[] {
  const stored = readTable<StoredConfig>(TABLE);
  if (stored.length === 0) return seed();

  const present = new Set(stored.map((r) => r.id));
  const now = new Date().toISOString();
  const missing = seedDefs().filter((d) => !present.has(d.id));
  if (missing.length === 0) return stored.map(normalize);

  const appended: StoredConfig[] = missing.map((d) => ({
    ...d,
    family: JUDICIAL_FAMILY_ID,
    requiresAuth: true,
    version: 1,
    updatedAt: now,
    updatedBy: null,
    schemaVersion: JUDICIAL_CONFIG_VERSION,
  }));
  const next = [...stored, ...appended];
  writeTable(TABLE, next);
  return next.map(normalize);
}

/**
 * Normalize a stored row: a config written before `energyCost` or `cases`
 * existed gains them with honest defaults rather than being dropped.
 */
function normalize(row: StoredConfig): JudicialServiceConfig {
  const surfaces = row.surfaces as Partial<JudicialServiceSurfaces> | undefined;
  return {
    ...row,
    family: JUDICIAL_FAMILY_ID,
    // A row written before `cases` existed inherits the other surfaces'
    // visibility rather than silently disappearing from /cases.
    surfaces: {
      home: surfaces?.home ?? true,
      services: surfaces?.services ?? true,
      new: surfaces?.new ?? true,
      cases: surfaces?.cases ?? surfaces?.services ?? true,
    },
    access: {
      mode: row.access?.mode ?? "energy",
      activity: row.access?.activity ?? null,
    },
  };
}

export function getJudicialService(id: string): JudicialServiceConfig | undefined {
  return listJudicialServices().find((s) => s.id === id);
}

export function getJudicialServiceForDocumentType(
  documentType: JudicialDocumentType
): JudicialServiceConfig | undefined {
  return listJudicialServices().find((s) => s.documentType === documentType);
}

/**
 * Effective status: `available` requires the config to say so AND the flag to
 * be on AND any declared requirement to be configured. Any failing condition
 * downgrades — never silently upgrades.
 */
function projectAvailability(
  cfg: JudicialServiceConfig,
  flagEnabled: boolean
): { availability: JudicialServiceStatus; note: string | null } {
  if (cfg.requirement.kind === "external" && !cfg.requirement.configured) {
    return {
      availability: cfg.status === "unavailable" ? "unavailable" : "soon",
      note: cfg.requirement.noteFa ?? cfg.statusNoteFa,
    };
  }
  if (cfg.status !== "available") {
    return { availability: cfg.status, note: cfg.statusNoteFa };
  }
  if (!flagEnabled) {
    return { availability: "unavailable", note: null };
  }
  return { availability: "available", note: cfg.statusNoteFa };
}

/** Project every service for one caller (plan-aware flag evaluation). */
export function listJudicialServiceViews(ctx?: Partial<FlagContext>): JudicialServiceView[] {
  const env = ctx?.env ?? currentEnvironment();
  return listJudicialServices()
    .sort((a, b) => a.order - b.order)
    .map((cfg) => {
      const flagEnabled = isFlagEnabled(JUDICIAL_FLAG_KEY[cfg.id], {
        env,
        planCode: ctx?.planCode ?? null,
        orgId: ctx?.orgId ?? null,
        bucket: ctx?.bucket,
      });
      const { availability, note } = projectAvailability(cfg, flagEnabled);
      return { ...cfg, flagEnabled, availability, availabilityNoteFa: note };
    });
}

export function getJudicialServiceView(
  id: string,
  ctx?: Partial<FlagContext>
): JudicialServiceView | undefined {
  return listJudicialServiceViews(ctx).find((s) => s.id === id);
}

/**
 * Whether the wizard may be entered RIGHT NOW. Every mutating route calls
 * this — hiding a button is not access control.
 */
export function isJudicialServiceEnterable(id: string, ctx?: Partial<FlagContext>): boolean {
  return getJudicialServiceView(id, ctx)?.availability === "available";
}

// ------------------------------------------------------------
// Admin updates
// ------------------------------------------------------------

export interface JudicialServiceUpdate {
  titleFa?: string;
  shortTitleFa?: string;
  descriptionFa?: string;
  ctaFa?: string;
  status?: JudicialServiceStatus;
  statusNoteFa?: string | null;
  order?: number;
  surfaces?: Partial<JudicialServiceSurfaces>;
  requiresAuth?: boolean;
  access?: Partial<JudicialServiceAccess>;
  requirement?: Partial<JudicialServiceRequirement>;
}

/**
 * Apply an admin edit. Identity (`id`, `family`, `documentType`) is never
 * mutable — a service cannot be repointed at a different document family.
 * Returns undefined when the target does not exist or the edit would publish a
 * provider-dependent service as available.
 */
export function updateJudicialService(
  id: string,
  updates: JudicialServiceUpdate,
  changedBy: string
): JudicialServiceConfig | undefined {
  const stored = readTable<StoredConfig>(TABLE);
  const rows: StoredConfig[] = stored.length > 0 ? stored : listJudicialServices();
  const idx = rows.findIndex((r) => r.id === id);
  if (idx === -1) return undefined;

  const current = normalize(rows[idx]!);

  // A provider-dependent service can never be marked `available` while its
  // provider is unconfigured — the server refuses instead of lying.
  const nextRequirement: JudicialServiceRequirement = {
    ...current.requirement,
    ...(updates.requirement ?? {}),
  };
  const requestedStatus = updates.status ?? current.status;
  if (
    requestedStatus === "available" &&
    nextRequirement.kind === "external" &&
    !nextRequirement.configured
  ) {
    return undefined;
  }

  const next: StoredConfig = {
    ...current,
    ...(updates.titleFa !== undefined ? { titleFa: updates.titleFa } : {}),
    ...(updates.shortTitleFa !== undefined ? { shortTitleFa: updates.shortTitleFa } : {}),
    ...(updates.descriptionFa !== undefined ? { descriptionFa: updates.descriptionFa } : {}),
    ...(updates.ctaFa !== undefined ? { ctaFa: updates.ctaFa } : {}),
    ...(updates.status !== undefined ? { status: updates.status } : {}),
    ...(updates.statusNoteFa !== undefined ? { statusNoteFa: updates.statusNoteFa } : {}),
    ...(updates.order !== undefined ? { order: updates.order } : {}),
    ...(updates.surfaces ? { surfaces: { ...current.surfaces, ...updates.surfaces } } : {}),
    ...(updates.requiresAuth !== undefined ? { requiresAuth: updates.requiresAuth } : {}),
    ...(updates.access ? { access: { ...current.access, ...updates.access } } : {}),
    requirement: nextRequirement,
    version: current.version + 1,
    updatedAt: new Date().toISOString(),
    updatedBy: changedBy,
    schemaVersion: JUDICIAL_CONFIG_VERSION,
  };

  rows[idx] = next;
  writeTable(TABLE, rows);
  return normalize(next);
}
