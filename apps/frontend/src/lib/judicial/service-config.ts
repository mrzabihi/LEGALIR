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

/**
 * The config table's own schema version, migrated additively.
 *
 * v3 renamed the statement service to the declaration entry point (and its
 * copy) so every «تولید اظهارنامه» entry in the product names the same
 * service the same way.
 */
export const JUDICIAL_CONFIG_VERSION = 3;

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

/**
 * Criminal record: the CERTIFICATE can only be issued by the official
 * authority. Ligalir does not issue it, so the service is `request_only` —
 * a real, tracked request whose status an operator moves by hand. When the
 * official integration is connected the flag `configured` flips and the
 * service may be published as fully available.
 */
const CRIMINAL_REQUIREMENT: JudicialServiceRequirement = {
  kind: "external",
  providerFa: "سامانهٔ رسمی صدور گواهی عدم سوءپیشینه",
  configured: false,
  noteFa:
    "گواهی را فقط مرجع رسمی صادر می‌کند و لیگالیر گواهی صادر یا شبیه‌سازی نمی‌کند. درخواست شما ثبت و توسط کارشناس پیگیری می‌شود؛ تحویل گواهی تنها پس از اتصال رسمی ممکن است.",
};

/** Credit check needs the subject's verifiable consent plus a real provider. */
const CREDIT_REQUIREMENT: JudicialServiceRequirement = {
  kind: "external",
  providerFa: "ارائه‌دهندهٔ رسمی استعلام اعتبار",
  configured: false,
  noteFa:
    "استعلام اعتبار نیازمند رضایت قابل‌اثبات صاحب داده و ارائه‌دهندهٔ رسمی است. لیگالیر هیچ نتیجه‌ای شبیه‌سازی نمی‌کند؛ درخواست شما ثبت و پیگیری می‌شود تا زیرساخت رسمی متصل شود.",
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
      // Same identity as the /cases card: one eyebrow-free title, a plain
      // declaration description, and the CTA that the discovery surfaces show.
      titleFa: "تنظیم اظهارنامه تخصصی",
      shortTitleFa: "اظهارنامه",
      descriptionFa:
        "موضوع اظهارنامه را توضیح دهید، به پرسش‌های لازم پاسخ دهید و پیش‌نویس خود را مرحله‌به‌مرحله آماده کنید.",
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
        "درخواست گواهی عدم سوءپیشینه را ثبت کنید، مدارک را پیوست کنید و وضعیت پیگیری را ببینید. گواهی را فقط مرجع رسمی صادر می‌کند.",
      ctaFa: "ثبت درخواست گواهی",
      status: "request_only",
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
        "با رضایت صاحب داده، درخواست استعلام اعتبار را ثبت کنید و روند بررسی را پیگیری کنید. نتیجه فقط از ارائه‌دهندهٔ رسمی می‌آید.",
      ctaFa: "ثبت درخواست استعلام",
      status: "request_only",
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

  const { rows, changed } = migrateLegacy(stored);
  const present = new Set(rows.map((r) => r.id));
  const now = new Date().toISOString();
  const missing = seedDefs().filter((d) => !present.has(d.id));
  if (missing.length === 0 && !changed) return rows.map(normalize);

  const appended: StoredConfig[] = missing.map((d) => ({
    ...d,
    family: JUDICIAL_FAMILY_ID,
    requiresAuth: true,
    version: 1,
    updatedAt: now,
    updatedBy: null,
    schemaVersion: JUDICIAL_CONFIG_VERSION,
  }));
  const next = [...rows, ...appended];
  writeTable(TABLE, next);
  return next.map(normalize);
}

/**
 * Additive schema migration. An untouched seed row (`updatedBy === null`)
 * follows the current product definition — that is how the two provider
 * services moved from a bare `soon` placeholder to a real `request_only`
 * intake. A row an operator has edited is never rewritten: it only gains the
 * new schema marker.
 */
function migrateLegacy(rows: StoredConfig[]): {
  rows: StoredConfig[];
  changed: boolean;
} {
  const defs = new Map(seedDefs().map((d) => [d.id, d]));
  const now = new Date().toISOString();
  let changed = false;

  const migrated = rows.map((row) => {
    const version = row.schemaVersion ?? 1;
    if (version >= JUDICIAL_CONFIG_VERSION) return row;
    changed = true;

    const def = defs.get(row.id);
    if (!def || row.updatedBy !== null) {
      return { ...row, schemaVersion: JUDICIAL_CONFIG_VERSION };
    }
    const migrated: StoredConfig = {
      ...row,
      ...def,
      family: JUDICIAL_FAMILY_ID,
      requiresAuth: true,
      version: row.version + 1,
      updatedAt: now,
      updatedBy: null,
      schemaVersion: JUDICIAL_CONFIG_VERSION,
    };
    return migrated;
  });

  return { rows: migrated, changed };
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
 *
 * `request_only` is the honest middle state for a service whose deliverable
 * comes from an external authority that is not connected yet: a tracked
 * request is accepted and an operator moves it forward by hand, but nothing
 * is issued automatically and the label never claims availability.
 */
function projectAvailability(
  cfg: JudicialServiceConfig,
  flagEnabled: boolean
): { availability: JudicialServiceStatus; note: string | null } {
  const unconfiguredExternal =
    cfg.requirement.kind === "external" && !cfg.requirement.configured;

  if (unconfiguredExternal) {
    if (cfg.status === "request_only" && flagEnabled) {
      return {
        availability: "request_only",
        note: cfg.requirement.noteFa ?? cfg.statusNoteFa,
      };
    }
    return {
      availability: cfg.status === "unavailable" ? "unavailable" : "soon",
      note: cfg.requirement.noteFa ?? cfg.statusNoteFa,
    };
  }

  if (cfg.status !== "available" && cfg.status !== "request_only") {
    return { availability: cfg.status, note: cfg.statusNoteFa };
  }
  if (!flagEnabled) {
    return { availability: "unavailable", note: null };
  }
  return { availability: cfg.status, note: cfg.statusNoteFa };
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
 * Whether the drafting WIZARD may be entered RIGHT NOW. Every mutating
 * drafting route calls this — hiding a button is not access control.
 */
export function isJudicialServiceEnterable(id: string, ctx?: Partial<FlagContext>): boolean {
  return getJudicialServiceView(id, ctx)?.availability === "available";
}

/**
 * Whether a tracked ORDER request may be submitted RIGHT NOW (the
 * `request_only` lane). Orderable and draftable are deliberately separate:
 * a drafting service never collects an order and an order-only service never
 * pretends to draft.
 */
export function isJudicialServiceOrderable(id: string, ctx?: Partial<FlagContext>): boolean {
  return getJudicialServiceView(id, ctx)?.availability === "request_only";
}

/**
 * The one real start path a service has for this caller, or `null` when the
 * service may not be started at all. Both the /cases cards and the discovery
 * surfaces read this instead of re-deriving availability.
 */
export function judicialEntryMode(
  id: string,
  ctx?: Partial<FlagContext>
): "draft" | "order" | null {
  const availability = getJudicialServiceView(id, ctx)?.availability;
  if (availability === "available") return "draft";
  if (availability === "request_only") return "order";
  return null;
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
