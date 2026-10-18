// ============================================================
// LEGALIR — Judicial HTTP helpers (server-only)
// ============================================================
// Two things every judicial route needs and none of them should re-implement:
//
//   • an error envelope with a Persian message and NO internal detail — a
//     stack trace or a provider message must never reach the client;
//   • the availability gate. Hiding a button is presentation; this is the
//     control. Every mutating route calls it against the CALLER's flags.
// ============================================================

import { NextResponse } from "next/server";
import type { FlagContext } from "@/lib/admin/flags";
import type { JudicialServiceId } from "@legalir/types";
import { getJudicialServiceView } from "./service-config";

export interface JudicialErrorBody {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
  /** The retry is meaningful for transient failures only. */
  retryable?: boolean;
}

export function judicialError(
  status: number,
  code: string,
  message: string,
  extra?: { fieldErrors?: Record<string, string>; retryable?: boolean }
): NextResponse {
  const body: JudicialErrorBody = { code, message };
  if (extra?.fieldErrors) body.fieldErrors = extra.fieldErrors;
  if (extra?.retryable) body.retryable = true;
  return NextResponse.json(body, { status });
}

/** A 404 for a foreign id — identical to a missing one, by design. */
export function notFoundRequest(): NextResponse {
  return judicialError(404, "NOT_FOUND", "درخواست یافت نشد");
}

/** Parse a JSON body, or return null so the caller can send a 400. */
export async function readJson<T>(request: Request): Promise<T | null> {
  try {
    const raw = (await request.json()) as unknown;
    if (!raw || typeof raw !== "object") return null;
    return raw as T;
  } catch {
    return null;
  }
}

/**
 * The availability gate. Returns `null` when the service may be entered,
 * otherwise the response the route must return verbatim.
 *
 * This deliberately re-reads the config for every call: an operator switching
 * a service off takes effect on the next request, not on the next deploy.
 */
export function requireServiceAvailable(
  serviceId: JudicialServiceId,
  ctx: FlagContext
): NextResponse | null {
  const view = getJudicialServiceView(serviceId, ctx);
  if (!view) {
    return judicialError(404, "SERVICE_NOT_FOUND", "این خدمت وجود ندارد");
  }
  if (view.availability === "available") return null;

  return judicialError(
    409,
    "SERVICE_UNAVAILABLE",
    view.availability === "soon"
      ? view.availabilityNoteFa ?? "این خدمت هنوز فعال نشده است و در حال آماده‌سازی است."
      : "این خدمت در حال حاضر در دسترس نیست."
  );
}
