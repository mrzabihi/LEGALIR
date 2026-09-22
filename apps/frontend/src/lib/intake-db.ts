// ============================================================
// LEGALIR — Intake Draft Store (PART 5)
// ============================================================
// Table: intake_drafts — one row per in-flight wizard draft. Drafts are
// resumable: the schemaVersion is stored so a draft started against an
// older schema is never silently reinterpreted against a newer one.
// ============================================================

import { readTable, writeTable } from "./db";
import type { IntakeDraft } from "@legalir/types";

export function listDraftsForUser(userId: string): IntakeDraft[] {
  return readTable<IntakeDraft>("intake_drafts")
    .filter((d) => d.userId === userId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getDraft(userId: string, id: string): IntakeDraft | undefined {
  return readTable<IntakeDraft>("intake_drafts").find((d) => d.id === id && d.userId === userId);
}

export function createDraft(draft: IntakeDraft): IntakeDraft {
  const rows = readTable<IntakeDraft>("intake_drafts");
  rows.push(draft);
  writeTable("intake_drafts", rows);
  return draft;
}

/** Patch a draft. Ownership is enforced by the caller (route handler). */
export function updateDraft(
  userId: string,
  id: string,
  patch: Partial<Pick<IntakeDraft, "currentStep" | "answers" | "savedAt">>
): IntakeDraft | undefined {
  const rows = readTable<IntakeDraft>("intake_drafts");
  const idx = rows.findIndex((d) => d.id === id && d.userId === userId);
  if (idx === -1) return undefined;
  const next: IntakeDraft = {
    ...rows[idx]!,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  rows[idx] = next;
  writeTable("intake_drafts", rows);
  return next;
}

export function deleteDraft(userId: string, id: string): boolean {
  const rows = readTable<IntakeDraft>("intake_drafts");
  const next = rows.filter((d) => !(d.id === id && d.userId === userId));
  if (next.length === rows.length) return false;
  writeTable("intake_drafts", next);
  return true;
}
