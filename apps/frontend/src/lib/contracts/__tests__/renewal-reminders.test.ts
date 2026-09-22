// ============================================================
// LEGALIR — Contract renewal reminder tests
// ============================================================
// A renewal reminder is a legal deadline derived from the contract's
// own term — never invented. These tests pin:
//   • only live (in-force) contracts produce a reminder
//   • only rent contracts have a term to renew
//   • the 60-day window boundary
//   • expired terms are flagged, not dropped
//   • ordering is soonest-first
// ============================================================

import { describe, it, expect } from "vitest";
import type { PropertyContract } from "@legalir/types";
import { deriveRenewalReminders, RENEWAL_WINDOW_DAYS } from "../db";

function rentContract(overrides: Partial<PropertyContract> = {}): PropertyContract {
  return {
    id: "ct-1",
    userId: "user-A",
    domain: "property",
    type: "property_rent",
    typeFa: "اجاره‌نامه",
    title: "اجاره‌نامه",
    state: "SIGNED",
    currentStep: "review",
    progress: 100,
    referenceCode: "RENT-1",
    publicVerificationId: "pub-1",
    finalVersionId: null,
    finalizedAt: null,
    data: { durations: { endDate: "2026-10-01" } } as never,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  } as PropertyContract;
}

const NOW = new Date("2026-09-21T12:00:00Z");

describe("deriveRenewalReminders", () => {
  it("returns a reminder for a rent contract ending inside the window", () => {
    const reminders = deriveRenewalReminders(
      [rentContract({ data: { durations: { endDate: "2026-10-01" } } as never })],
      NOW
    );
    expect(reminders).toHaveLength(1);
    expect(reminders[0]!.daysRemaining).toBe(10);
    expect(reminders[0]!.expired).toBe(false);
  });

  it("ignores a term that ends beyond the window", () => {
    const reminders = deriveRenewalReminders(
      [rentContract({ data: { durations: { endDate: "2027-06-01" } } as never })],
      NOW
    );
    expect(reminders).toHaveLength(0);
  });

  it("includes a term ending exactly on the window boundary", () => {
    const end = new Date(NOW);
    end.setDate(end.getDate() + RENEWAL_WINDOW_DAYS);
    const iso = end.toISOString().slice(0, 10);
    const reminders = deriveRenewalReminders(
      [rentContract({ data: { durations: { endDate: iso } } as never })],
      NOW
    );
    expect(reminders).toHaveLength(1);
  });

  it("flags an already-expired term instead of dropping it", () => {
    const reminders = deriveRenewalReminders(
      [rentContract({ data: { durations: { endDate: "2026-09-01" } } as never })],
      NOW
    );
    expect(reminders).toHaveLength(1);
    expect(reminders[0]!.expired).toBe(true);
    expect(reminders[0]!.daysRemaining).toBeLessThan(0);
  });

  it("ignores drafts — a draft has no live term", () => {
    expect(deriveRenewalReminders([rentContract({ state: "DRAFT" })], NOW)).toHaveLength(0);
  });

  it("ignores cancelled and archived contracts", () => {
    const reminders = deriveRenewalReminders(
      [rentContract({ id: "c1", state: "CANCELLED" }), rentContract({ id: "c2", state: "ARCHIVED" })],
      NOW
    );
    expect(reminders).toHaveLength(0);
  });

  it("ignores sale contracts — they have no renewable term", () => {
    expect(deriveRenewalReminders([rentContract({ type: "property_sale" })], NOW)).toHaveLength(0);
  });

  it("ignores a contract with no end date", () => {
    const reminders = deriveRenewalReminders(
      [rentContract({ data: { durations: { endDate: null } } as never })],
      NOW
    );
    expect(reminders).toHaveLength(0);
  });

  it("orders reminders soonest-ending first", () => {
    const reminders = deriveRenewalReminders(
      [
        rentContract({ id: "late", data: { durations: { endDate: "2026-11-01" } } as never }),
        rentContract({ id: "soon", data: { durations: { endDate: "2026-09-25" } } as never }),
      ],
      NOW
    );
    expect(reminders.map((r) => r.contractId)).toEqual(["soon", "late"]);
  });
});
