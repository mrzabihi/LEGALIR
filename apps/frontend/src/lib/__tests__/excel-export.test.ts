// ============================================================
// LEGALIR — Excel writer + admin export tests
// ============================================================
// Validates that `buildXlsx` produces a structurally-valid OOXML container
// (parseable ZIP → expected parts → well-formed worksheet XML) and that the
// admin export adapters emit a non-empty workbook per surface.
// ============================================================

import { describe, it, expect } from "vitest";
import { buildXlsx, exportFilename, type SheetSpec } from "@/lib/excel/xlsx";
import {
  buildAdminExport,
  isAdminExportKind,
  ADMIN_EXPORT_KINDS,
  ADMIN_EXPORT_KIND_FA,
} from "@/lib/admin/export";
import { ADMIN_EXPORT_PERMISSION, roleHasPermission, STAFF_ROLES } from "@legalir/types";

// --- Minimal stored-ZIP reader (test-only) ---------------------------------

interface ZipReadEntry {
  name: string;
  content: string;
}

/** Parse a "stored"-method ZIP buffer produced by `buildXlsx`. */
function readStoredZip(buf: Buffer): Map<string, ZipReadEntry> {
  // Locate the End-of-Central-Directory record (signature 0x06054b50).
  let eocd = -1;
  for (let i = buf.length - 22; i >= 0; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  expect(eocd, "EOCD record not found").toBeGreaterThanOrEqual(0);
  const count = buf.readUInt16LE(eocd + 10);
  let ptr = buf.readUInt32LE(eocd + 16);

  const entries = new Map<string, ZipReadEntry>();
  for (let i = 0; i < count; i++) {
    expect(buf.readUInt32LE(ptr)).toBe(0x02014b50); // central dir signature
    const method = buf.readUInt16LE(ptr + 10);
    expect(method).toBe(0); // stored
    const compSize = buf.readUInt32LE(ptr + 20);
    const nameLen = buf.readUInt16LE(ptr + 28);
    const extraLen = buf.readUInt16LE(ptr + 30);
    const commentLen = buf.readUInt16LE(ptr + 32);
    const localOffset = buf.readUInt32LE(ptr + 42);
    const name = buf.toString("utf8", ptr + 46, ptr + 46 + nameLen);

    // Read the local header to find where the data begins.
    expect(buf.readUInt32LE(localOffset)).toBe(0x04034b50);
    const localNameLen = buf.readUInt16LE(localOffset + 26);
    const localExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const content = buf.toString("utf8", dataStart, dataStart + compSize);
    entries.set(name, { name, content });

    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

const SAMPLE: SheetSpec[] = [
  {
    name: "وکلا",
    columns: [
      { key: "name", header: "نام" },
      { key: "count", header: "تعداد" },
    ],
    rows: [
      { name: "وکیل الف", count: 12 },
      { name: "وکیل & ب", count: 3 },
      { name: null, count: null },
    ],
  },
];

describe("buildXlsx", () => {
  it("produces a ZIP with the required OOXML parts", () => {
    const bytes = buildXlsx(SAMPLE);
    expect(bytes.subarray(0, 4).toString("latin1")).toBe("PK\u0003\u0004");

    const files = readStoredZip(bytes);
    expect([...files.keys()]).toEqual(
      expect.arrayContaining([
        "[Content_Types].xml",
        "_rels/.rels",
        "xl/workbook.xml",
        "xl/_rels/workbook.xml.rels",
        "xl/styles.xml",
        "xl/worksheets/sheet1.xml",
      ])
    );
  });

  it("writes inline strings, escapes XML, and numbers as raw cells", () => {
    const files = readStoredZip(buildXlsx(SAMPLE));
    const sheet = files.get("xl/worksheets/sheet1.xml")!.content;

    // Header is a bold inline string in the frozen first row.
    expect(sheet).toContain("<pane ySplit=\"1\"");
    expect(sheet).toContain(">نام<");
    // Ampersand is escaped.
    expect(sheet).toContain("وکیل &amp; ب");
    // Integer is emitted as a numeric value cell (no inlineStr).
    expect(sheet).toMatch(/<c r="B2" s="2"><v>12<\/v><\/c>/);
    // A null row is fully empty — the row element exists but has no cells.
    expect(sheet).toMatch(/<row r="4"><\/row>/);
  });

  it("declares one worksheet part per sheet", () => {
    const files = readStoredZip(
      buildXlsx([
        { name: "A", columns: [{ key: "x", header: "X" }], rows: [{ x: 1 }] },
        { name: "B", columns: [{ key: "x", header: "X" }], rows: [] },
      ])
    );
    expect(files.has("xl/worksheets/sheet1.xml")).toBe(true);
    expect(files.has("xl/worksheets/sheet2.xml")).toBe(true);
    expect(files.get("xl/workbook.xml")!.content).toContain("sheetId=\"2\"");
  });

  it("never throws on an empty sheet list", () => {
    expect(() => buildXlsx([])).not.toThrow();
  });
});

describe("exportFilename", () => {
  it("appends a date stamp and .xlsx suffix", () => {
    const name = exportFilename("admin-users", new Date("2026-10-06T00:00:00Z"));
    expect(name).toBe("admin-users-2026-10-06.xlsx");
  });
});

describe("buildAdminExport", () => {
  it("recognises its own kind list", () => {
    for (const kind of ADMIN_EXPORT_KINDS) expect(isAdminExportKind(kind)).toBe(true);
    expect(isAdminExportKind("nope")).toBe(false);
  });

  it("builds a valid workbook for every surface", () => {
    for (const kind of ADMIN_EXPORT_KINDS) {
      const res = buildAdminExport(kind);
      expect("error" in res, `${kind} errored`).toBe(false);
      if ("error" in res) continue;
      expect(res.fileName.endsWith(".xlsx")).toBe(true);
      expect(res.bytes.length).toBeGreaterThan(0);
      // ZIP magic "PK" (0x50 0x4b) — bytes is a Uint8Array, so compare numerically.
      expect([res.bytes[0], res.bytes[1]]).toEqual([0x50, 0x4b]);
    }
  });

  it("emits a stable, collision-free filename per surface", () => {
    const names = new Set<string>();
    for (const kind of ADMIN_EXPORT_KINDS) {
      const res = buildAdminExport(kind);
      if ("error" in res) continue;
      names.add(res.fileName.replace(/-\d{4}-\d{2}-\d{2}\.xlsx$/, ""));
    }
    // One distinct file stem per kind — no two surfaces clobber each other.
    expect(names.size).toBe(ADMIN_EXPORT_KINDS.length);
  });
});

// ---------------------------------------------------------------------------
// Export surface — permission mapping (shared with the API dispatcher)
// ---------------------------------------------------------------------------
// `permissionFor("GET", ["exports", kind])` reads `ADMIN_EXPORT_PERMISSION`
// straight from @legalir/types, so a kind whose mapped permission is not a
// real admin permission — or a kind missing from the map — would silently
// widen or break access. These assertions lock the contract the dispatcher
// depends on.
describe("ADMIN_EXPORT_PERMISSION contract", () => {
  it("maps every export kind to a permission", () => {
    for (const kind of ADMIN_EXPORT_KINDS) {
      expect(ADMIN_EXPORT_PERMISSION[kind], `${kind} has no permission`).toBeTruthy();
    }
    // No stray keys beyond the declared kinds.
    expect(Object.keys(ADMIN_EXPORT_PERMISSION).sort()).toEqual([...ADMIN_EXPORT_KINDS].sort());
  });

  it("maps only to real admin:* read permissions", () => {
    for (const kind of ADMIN_EXPORT_KINDS) {
      const perm = ADMIN_EXPORT_PERMISSION[kind];
      expect(perm.startsWith("admin:")).toBe(true);
      // Export is a read operation — never a manage/secret/approve power.
      expect(perm.endsWith(":read"), `${kind} → ${perm} must be a read permission`).toBe(true);
    }
  });

  it("hands every surface to at least one staff role (no orphaned export)", () => {
    for (const kind of ADMIN_EXPORT_KINDS) {
      const perm = ADMIN_EXPORT_PERMISSION[kind];
      const holders = STAFF_ROLES.filter((r) => roleHasPermission(r, perm));
      expect(holders.length, `${kind} (${perm}) is unreachable by any staff role`).toBeGreaterThan(0);
    }
  });

  it("refuses export to ordinary users", () => {
    for (const kind of ADMIN_EXPORT_KINDS) {
      const perm = ADMIN_EXPORT_PERMISSION[kind];
      for (const role of ["USER", "LAWYER", "COMPANY_OWNER"] as const) {
        expect(roleHasPermission(role, perm), `${role} must not export ${kind}`).toBe(false);
      }
    }
  });

  it("gives the audit export its own read permission, not the generic one", () => {
    // A regression guard: audit must never be exported under a broad generic
    // permission — it is a sensitive, actor-identifying surface.
    expect(ADMIN_EXPORT_PERMISSION.audit).toBe("admin:audit:read");
    expect(ADMIN_EXPORT_PERMISSION.users).not.toBe(ADMIN_EXPORT_PERMISSION.audit);
  });
});

describe("ADMIN_EXPORT_KIND_FA", () => {
  it("labels every kind in Persian, without blanks", () => {
    for (const kind of ADMIN_EXPORT_KINDS) {
      const label = ADMIN_EXPORT_KIND_FA[kind];
      expect(typeof label, `${kind} label`).toBe("string");
      expect(label.trim().length, `${kind} label is blank`).toBeGreaterThan(0);
    }
    expect(Object.keys(ADMIN_EXPORT_KIND_FA).sort()).toEqual([...ADMIN_EXPORT_KINDS].sort());
  });
});
