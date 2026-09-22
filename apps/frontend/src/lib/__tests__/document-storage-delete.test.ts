// ============================================================
// LEGALIR — deleteDocumentFile safety tests
// ============================================================
// The delete helper must remove a document's bytes from the private
// root, but must never be tricked into unlinking a file outside it
// (path traversal) and must never touch committed public fixtures.
// ============================================================

import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { deleteDocumentFile, saveDocumentFile } from "../document-storage";

const PRIVATE_ROOT = path.resolve(process.cwd(), ".data", "demo-documents");

const created: string[] = [];

afterEach(() => {
  for (const p of created.splice(0)) {
    try {
      fs.unlinkSync(p);
    } catch {
      // already gone
    }
  }
});

describe("deleteDocumentFile", () => {
  it("removes a stored file from the private root", () => {
    const key = saveDocumentFile("doc-del-test", "x.pdf", Buffer.from("hello"));
    const stored = path.resolve(PRIVATE_ROOT, path.basename(key));
    created.push(stored);
    expect(fs.existsSync(stored)).toBe(true);

    deleteDocumentFile(key);
    expect(fs.existsSync(stored)).toBe(false);
  });

  it("is a no-op for a null reference", () => {
    expect(() => deleteDocumentFile(null)).not.toThrow();
  });

  it("ignores traversal attempts instead of unlinking outside the root", () => {
    // A crafted reference must not escape the private root.
    expect(() => deleteDocumentFile("../../package.json")).not.toThrow();
    expect(fs.existsSync(path.resolve(process.cwd(), "package.json"))).toBe(true);
  });

  it("does not throw when the file is already gone", () => {
    expect(() => deleteDocumentFile("demo-documents/does-not-exist.pdf")).not.toThrow();
  });
});
