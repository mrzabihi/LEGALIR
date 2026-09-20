// ============================================================
// LEGALIR — Snapshot hashing tests
// ============================================================
// A version's document hash is the anchor of the whole trust story:
// the PDF, the verification page and the audit trail all quote it.
// It must be deterministic (same content → same hash) and sensitive
// (any change → different hash), regardless of key order.
// ============================================================

import { describe, it, expect } from "vitest";
import type {
  ContractDocument,
  ContractParty,
  ContractVersionSnapshot,
  PropertyContract,
} from "@legalir/types";
import { hashSnapshot, buildSnapshot } from "../snapshot";

function snapshot(overrides: Partial<ContractVersionSnapshot> = {}): ContractVersionSnapshot {
  return {
    data: { schemaVersion: 1, propertyKind: "apartment" } as never,
    parties: [],
    payments: [],
    documentsManifest: [],
    ...overrides,
  };
}

describe("snapshot — hash determinism", () => {
  it("produces the same hash for identical content", () => {
    expect(hashSnapshot(snapshot())).toBe(hashSnapshot(snapshot()));
  });

  it("is independent of object key order", () => {
    const a = snapshot({ data: { a: 1, b: 2 } as never });
    const b = snapshot({ data: { b: 2, a: 1 } as never });
    expect(hashSnapshot(a)).toBe(hashSnapshot(b));
  });

  it("produces a 64-char SHA-256 hex digest", () => {
    expect(hashSnapshot(snapshot())).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes when the domain data changes", () => {
    const a = snapshot({ data: { area: 90 } as never });
    const b = snapshot({ data: { area: 91 } as never });
    expect(hashSnapshot(a)).not.toBe(hashSnapshot(b));
  });

  it("changes when a party changes", () => {
    const p = { id: "pty-1", role: "landlord" } as unknown as ContractParty;
    const a = snapshot({ parties: [p] });
    const b = snapshot({ parties: [{ ...p, role: "tenant" } as unknown as ContractParty] });
    expect(hashSnapshot(a)).not.toBe(hashSnapshot(b));
  });

  it("changes when a document hash changes", () => {
    const a = snapshot({
      documentsManifest: [{ id: "d1", category: "deed", hash: "aaa", fileName: "f.pdf" }],
    });
    const b = snapshot({
      documentsManifest: [{ id: "d1", category: "deed", hash: "bbb", fileName: "f.pdf" }],
    });
    expect(hashSnapshot(a)).not.toBe(hashSnapshot(b));
  });

  it("changes when the payment schedule changes", () => {
    const a = snapshot({
      payments: [{ id: "p1", amount: { amount: 100, currency: "IRR" } } as never],
    });
    const b = snapshot({
      payments: [{ id: "p1", amount: { amount: 200, currency: "IRR" } } as never],
    });
    expect(hashSnapshot(a)).not.toBe(hashSnapshot(b));
  });
});

describe("snapshot — buildSnapshot", () => {
  it("stores document ids and hashes but never the bytes", () => {
    const contract = { data: { x: 1 } } as unknown as PropertyContract;
    const docs = [
      {
        id: "doc-1",
        category: "deed",
        hash: "abc",
        fileName: "deed.pdf",
        storageKey: "secret/path",
        mime: "application/pdf",
        sizeBytes: 999,
      } as unknown as ContractDocument,
    ];
    const built = buildSnapshot(contract, [], [], docs);
    expect(built.documentsManifest).toEqual([
      { id: "doc-1", category: "deed", hash: "abc", fileName: "deed.pdf" },
    ]);
    // The storage key must not leak into the hashed snapshot.
    expect(JSON.stringify(built)).not.toContain("secret/path");
  });
});
