// ============================================================
// LEGALIR — Service Registry unit tests
// ============================================================
// The registry is the single source of truth for service identity.
// These tests lock the contract that Route, URL, Page Context,
// Header and Breadcrumb all derive from.
// ============================================================

import { describe, it, expect } from "vitest";
import {
  LEGAL_SERVICES,
  SERVICE_QUERY_KEY,
  serviceHref,
  getServiceById,
  getDefaultServiceForRoute,
  resolveService,
} from "@/lib/services";
import { SERVICE_CONTEXTS } from "@/lib/ai/service-context";

describe("LEGAL_SERVICES registry", () => {
  it("registers the six dashboard services", () => {
    expect(LEGAL_SERVICES).toHaveLength(6);
    expect(LEGAL_SERVICES.map((s) => s.id)).toEqual([
      "legal_consultation",
      "contract_review",
      "contract_drafting",
      "legal_notice",
      "document_analysis",
      "legal_calculation",
    ]);
  });

  it("derives every title/description from SERVICE_CONTEXTS (no drift)", () => {
    for (const service of LEGAL_SERVICES) {
      expect(service.title).toBe(SERVICE_CONTEXTS[service.id].label);
      expect(service.description).toBe(SERVICE_CONTEXTS[service.id].description);
    }
  });

  it("gives every service a route, href, gradient and icon", () => {
    for (const service of LEGAL_SERVICES) {
      expect(service.route).toMatch(/^\//);
      expect(service.href).toBe(`${service.route}?${SERVICE_QUERY_KEY}=${service.id}`);
      expect(service.gradient).toMatch(/^from-/);
      expect(service.icon).toBeTruthy();
    }
  });

  it("uses unique ids and hrefs", () => {
    const ids = LEGAL_SERVICES.map((s) => s.id);
    const hrefs = LEGAL_SERVICES.map((s) => s.href);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});

describe("serviceHref", () => {
  it("builds a deep-linkable href carrying the service context", () => {
    expect(serviceHref("legal_notice", "/chat")).toBe("/chat?service=legal_notice");
  });
});

describe("getServiceById", () => {
  it("finds a registered service", () => {
    expect(getServiceById("contract_review")?.route).toBe("/documents");
  });

  it("returns undefined for unknown or empty ids", () => {
    expect(getServiceById("nope")).toBeUndefined();
    expect(getServiceById(null)).toBeUndefined();
    expect(getServiceById(undefined)).toBeUndefined();
  });
});

describe("getDefaultServiceForRoute", () => {
  it("maps each base route to its default service", () => {
    expect(getDefaultServiceForRoute("/chat")?.id).toBe("legal_consultation");
    expect(getDefaultServiceForRoute("/documents")?.id).toBe("document_analysis");
    expect(getDefaultServiceForRoute("/contracts")?.id).toBe("contract_drafting");
  });

  it("returns undefined for unregistered routes", () => {
    expect(getDefaultServiceForRoute("/dashboard")).toBeUndefined();
  });
});

describe("resolveService", () => {
  it("resolves the canonical ?service= param", () => {
    expect(resolveService("/chat", "?service=legal_notice")?.id).toBe("legal_notice");
    expect(resolveService("/documents", "?service=contract_review")?.id).toBe("contract_review");
    expect(resolveService("/contracts", "?service=contract_drafting")?.id).toBe("contract_drafting");
  });

  it("accepts a URLSearchParams instance", () => {
    const params = new URLSearchParams("service=legal_calculation");
    expect(resolveService("/chat", params)?.id).toBe("legal_calculation");
  });

  it("still resolves legacy ?category= aliases (backward compatible)", () => {
    expect(resolveService("/chat", "?category=notice")?.id).toBe("legal_notice");
    expect(resolveService("/contracts", "?category=contract")?.id).toBe("contract_drafting");
    expect(resolveService("/documents", "?category=document")?.id).toBe("document_analysis");
  });

  it("falls back to the route default when no param is present", () => {
    expect(resolveService("/chat", "")?.id).toBe("legal_consultation");
    expect(resolveService("/documents", null)?.id).toBe("document_analysis");
    expect(resolveService("/contracts", undefined)?.id).toBe("contract_drafting");
  });

  it("ignores a service that does not belong to the current route", () => {
    // legal_notice lives on /chat, not /documents → route default wins.
    expect(resolveService("/documents", "?service=legal_notice")?.id).toBe("document_analysis");
  });

  it("ignores unknown service values and uses the route default", () => {
    expect(resolveService("/chat", "?service=bogus")?.id).toBe("legal_consultation");
  });

  it("returns undefined for routes with no registered service", () => {
    expect(resolveService("/dashboard", "?service=legal_notice")).toBeUndefined();
    expect(resolveService("/settings", "")).toBeUndefined();
  });

  it("is refresh-safe: same URL always yields the same service", () => {
    const url = "?service=contract_review";
    expect(resolveService("/documents", url)?.id).toBe(resolveService("/documents", url)?.id);
  });
});
