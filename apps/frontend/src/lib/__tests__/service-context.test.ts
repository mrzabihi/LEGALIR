// ============================================================
// LEGALIR — Service context: one resolver for client and server
// ============================================================
// Pins the guarantees §3 and §15 depend on:
//   1. A chosen service really changes the prompt overlay (a real backend
//      effect, not just a label).
//   2. The server validates the client's value: an unknown service is
//      rejected with a flag so the gateway degrades honestly.
//   3. A tampered URL can only ever select a REAL service — never an
//      arbitrary string, never a capability the product lacks.
//   4. URL, legacy `?category=` aliases and the default all resolve through
//      the same table, so a refresh cannot land on a different service.
// ============================================================

import { describe, it, expect } from "vitest";

import {
  SERVICE_CONTEXTS,
  categoryToServiceType,
  composerPlaceholder,
  getServiceContext,
  isServiceType,
  resolveServiceType,
  servicePromptOverlay,
  serviceTypeFromQuery,
  type ServiceType,
} from "../ai/service-context";

const ALL_SERVICES = Object.keys(SERVICE_CONTEXTS) as ServiceType[];

// ============================================================
// The registry
// ============================================================

describe("SERVICE_CONTEXTS", () => {
  it("has a Persian label and description for every service", () => {
    for (const service of ALL_SERVICES) {
      const ctx = SERVICE_CONTEXTS[service];
      expect(ctx.serviceType, service).toBe(service);
      expect(ctx.label.trim(), service).toBeTruthy();
      expect(ctx.description.trim(), service).toBeTruthy();
    }
  });

  it("has distinct labels so the context card is unambiguous", () => {
    const labels = ALL_SERVICES.map((s) => SERVICE_CONTEXTS[s].label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it("recognises only real service ids", () => {
    expect(isServiceType("legal_consultation")).toBe(true);
    expect(isServiceType("law_search")).toBe(true);
    expect(isServiceType("unknown_service")).toBe(false);
    expect(isServiceType(null)).toBe(false);
    expect(isServiceType(42)).toBe(false);
  });
});

// ============================================================
// getServiceContext — safe degradation for display
// ============================================================

describe("getServiceContext", () => {
  it("returns the requested service", () => {
    expect(getServiceContext("contract_review").serviceType).toBe("contract_review");
  });

  it("degrades an unknown or missing service to legal consultation", () => {
    expect(getServiceContext("nope").serviceType).toBe("legal_consultation");
    expect(getServiceContext(undefined).serviceType).toBe("legal_consultation");
    expect(getServiceContext(null).serviceType).toBe("legal_consultation");
  });
});

// ============================================================
// resolveServiceType — the server's authority
// ============================================================

describe("resolveServiceType", () => {
  it("accepts every real service unchanged and does not flag it", () => {
    for (const service of ALL_SERVICES) {
      const resolved = resolveServiceType(service);
      expect(resolved.serviceType).toBe(service);
      expect(resolved.wasRejected).toBe(false);
      expect(resolved.rawValue).toBe(service);
    }
  });

  it("treats an absent value as the default without calling it a rejection", () => {
    for (const raw of [undefined, null, ""]) {
      const resolved = resolveServiceType(raw);
      expect(resolved.serviceType).toBe("legal_consultation");
      expect(resolved.wasRejected).toBe(false);
      expect(resolved.rawValue).toBeNull();
    }
  });

  it("rejects an unknown service and degrades to the default", () => {
    const resolved = resolveServiceType("super_admin_tool");
    expect(resolved.serviceType).toBe("legal_consultation");
    expect(resolved.wasRejected).toBe(true);
    expect(resolved.rawValue).toBe("super_admin_tool");
  });

  it("never echoes an unbounded raw value back to the client", () => {
    const huge = "x".repeat(500);
    const resolved = resolveServiceType(huge);
    expect(resolved.wasRejected).toBe(true);
    expect(resolved.rawValue!.length).toBeLessThanOrEqual(64);
  });

  it("rejects a non-string value without throwing", () => {
    const resolved = resolveServiceType({ service: "law_search" });
    expect(resolved.wasRejected).toBe(true);
    expect(resolved.serviceType).toBe("legal_consultation");
    expect(resolved.rawValue).toBeNull();
  });
});

// ============================================================
// servicePromptOverlay — choosing a service changes the request
// ============================================================

describe("servicePromptOverlay", () => {
  it("gives every service its own instruction", () => {
    const overlays = ALL_SERVICES.map((s) => servicePromptOverlay(s));
    expect(new Set(overlays).size).toBe(overlays.length);
  });

  it("names the service in its own overlay so the model cannot drift", () => {
    for (const service of ALL_SERVICES) {
      expect(servicePromptOverlay(service)).toContain(SERVICE_CONTEXTS[service].label);
    }
  });

  it("keeps the deliverable honest — no lawyer/official claim", () => {
    for (const service of ALL_SERVICES) {
      const overlay = servicePromptOverlay(service);
      expect(overlay).not.toContain("وکیل هستی");
      expect(overlay).not.toContain("قاضی هستی");
    }
  });
});

// ============================================================
// composerPlaceholder — the input reflects the real task
// ============================================================

describe("composerPlaceholder", () => {
  it("returns a service-specific hint", () => {
    expect(composerPlaceholder("law_search")).toContain("قانون");
    expect(composerPlaceholder("contract_drafting")).toContain("قرارداد");
  });

  it("falls back to a generic prompt for unknown services", () => {
    expect(composerPlaceholder(undefined)).toBeTruthy();
    expect(composerPlaceholder("nope")).toBeTruthy();
  });
});

// ============================================================
// URL resolution — a refresh cannot change the service
// ============================================================

describe("serviceTypeFromQuery", () => {
  it("reads `?service=` and returns the canonical id", () => {
    expect(serviceTypeFromQuery("?service=law_search")).toBe("law_search");
    expect(serviceTypeFromQuery("?foo=1&service=contract_review")).toBe("contract_review");
  });

  it("maps legacy `?category=` aliases through the same table", () => {
    expect(serviceTypeFromQuery("?category=calculator")).toBe("legal_calculation");
    expect(serviceTypeFromQuery("?category=notice")).toBe("legal_notice");
  });

  it("prefers `?service=` over `?category=`", () => {
    expect(serviceTypeFromQuery("?service=law_search&category=calculator")).toBe("law_search");
  });

  it("never lets a tampered value escape the real service set", () => {
    for (const raw of ["?service=../../etc/passwd", "?service=%00", "?service=<script>"]) {
      const resolved = serviceTypeFromQuery(raw);
      expect(ALL_SERVICES).toContain(resolved);
    }
  });

  it("degrades an empty or missing query to legal consultation", () => {
    expect(serviceTypeFromQuery("")).toBe("legal_consultation");
    expect(serviceTypeFromQuery(null)).toBe("legal_consultation");
    expect(serviceTypeFromQuery(undefined)).toBe("legal_consultation");
    expect(serviceTypeFromQuery("?service=")).toBe("legal_consultation");
  });
});

describe("categoryToServiceType", () => {
  it("maps every known alias inside the real service set", () => {
    const aliases = [
      "formal_letter",
      "notice",
      "calculator",
      "calculation",
      "contract_review",
      "contract",
      "document",
      "law",
      "law_search",
      "case",
    ];
    for (const alias of aliases) {
      expect(ALL_SERVICES, alias).toContain(categoryToServiceType(alias));
    }
  });

  it("falls back to legal consultation for an unknown alias", () => {
    expect(categoryToServiceType("mystery")).toBe("legal_consultation");
    expect(categoryToServiceType(null)).toBe("legal_consultation");
  });
});
