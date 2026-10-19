// ============================================================
// LEGALIR — response-header policy
// ============================================================
// The app-wide policy is deliberately strict: nothing may be framed, by
// anyone. That is right for PAGES and wrong for DOCUMENTS — the product
// previews its own PDFs in an <iframe> (the admin review drawer's sealed
// contract, a contract's uploaded attachments, the demo PDFs). Under
// `frame-ancestors 'none'` the browser answers `net::ERR_BLOCKED_BY_RESPONSE`
// and the user sees an empty box instead of the file they are asked to
// read or verify, with no error they could act on.
//
// These tests pin BOTH halves: the blanket rule stays `DENY`, and the
// document routes relax it to the SAME ORIGIN only — never `*`, never a
// list of third-party hosts.
// ============================================================

import { describe, it, expect } from "vitest";
import nextConfig from "../../../next.config";

interface HeaderRule {
  source: string;
  headers: { key: string; value: string }[];
}

async function rules(): Promise<HeaderRule[]> {
  const headers = nextConfig.headers;
  if (!headers) throw new Error("next.config declares no headers()");
  return (await headers()) as HeaderRule[];
}

/** The headers Next would apply to `path`, later rules overriding earlier. */
async function headersFor(path: string): Promise<Record<string, string>> {
  // Next's matcher semantics: a rule applies when its source matches. These
  // sources are either the catch-all or a prefix with `:param` / `:path*`
  // segments, so a prefix match is faithful here.
  const matches = (source: string, p: string): boolean => {
    if (source === "/(.*)") return true;
    const pattern = new RegExp(
      "^" +
        source
          .replace(/[.]/g, "\\.")
          .replace(/\/:path\*$/, "(?:/.*)?")
          .replace(/:[A-Za-z]+/g, "[^/]+") +
        "$"
    );
    return pattern.test(p);
  };

  const out: Record<string, string> = {};
  for (const rule of await rules()) {
    if (!matches(rule.source, path)) continue;
    for (const h of rule.headers) out[h.key.toLowerCase()] = h.value;
  }
  return out;
}

describe("security headers — framing policy", () => {
  it("keeps every ordinary page unframable by anyone", async () => {
    for (const path of ["/", "/contracts", "/admin/contracts", "/chat/1"]) {
      const h = await headersFor(path);
      expect(h["x-frame-options"], path).toBe("DENY");
      expect(h["content-security-policy"], path).toContain("frame-ancestors 'none'");
    }
  });

  it("lets the admin shell frame the sealed final PDF, and nobody else", async () => {
    const h = await headersFor("/api/v1/admin/contracts/cnt-1/final-document");
    expect(h["x-frame-options"]).toBe("SAMEORIGIN");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'self'");
    // The bytes stay opaque: no script, no same-origin privileges.
    expect(h["content-security-policy"]).toContain("sandbox");
  });

  it("lets the app frame a contract's uploaded attachments", async () => {
    const h = await headersFor("/api/v1/property-contracts/cnt-1/documents/doc-1");
    expect(h["x-frame-options"]).toBe("SAMEORIGIN");
    expect(h["content-security-policy"]).toContain("frame-ancestors 'self'");
  });

  it("lets the app frame the demo PDFs it ships", async () => {
    const h = await headersFor("/demo-documents/قرارداد-اجاره-مسکونی.pdf");
    expect(h["x-frame-options"]).toBe("SAMEORIGIN");
    // These are plain static files, so the blanket CSP — which forbids
    // framing — must not survive on them either.
    expect(h["content-security-policy"] ?? "").not.toContain("frame-ancestors 'none'");
  });

  it("never opens framing to a third-party origin", async () => {
    for (const path of [
      "/api/v1/admin/contracts/cnt-1/final-document",
      "/api/v1/property-contracts/cnt-1/documents/doc-1",
      "/demo-documents/توافقنامه-محرمانگی-NDA.pdf",
    ]) {
      const h = await headersFor(path);
      const csp = h["content-security-policy"] ?? "";
      expect(csp, path).not.toMatch(/frame-ancestors[^;]*(\*|https?:)/);
      expect(h["x-frame-options"], path).not.toBe("ALLOW-FROM *");
      expect(h["x-frame-options"], path).not.toBe("ALLOWALL");
    }
  });

  it("matches only the artifact routes, not their siblings", async () => {
    // The relaxation is scoped to a single sub-path: listing and review
    // endpoints on the same prefix must stay unframable.
    for (const path of [
      "/api/v1/admin/contracts/cnt-1",
      "/api/v1/admin/contracts/cnt-1/review",
      "/api/v1/admin/contracts",
    ]) {
      const h = await headersFor(path);
      expect(h["x-frame-options"], path).toBe("DENY");
    }
  });
});
