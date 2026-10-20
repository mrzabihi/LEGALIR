// ============================================================
// LEGALIR — `/api/health` liveness contract
// ============================================================
// This endpoint is consumed by machines, not people:
//
//   • docker-compose.prod.yml runs it every 30s and restarts the
//     container after three consecutive failures;
//   • HANDOFF.md tells operators it is how a deployed release
//     identifies itself.
//
// That makes every field a contract. A rename, a missing
// `Cache-Control`, or an accidental extra key (an env value, a
// config path) would either break deploys or leak internals, and
// neither failure is visible in the UI. These tests pin the shape.
//
// The route is deliberately dependency-free, so it is called
// directly — no server, no store, no session.
// ============================================================

import { describe, it, expect } from "vitest";
import { GET, HEAD, OPTIONS } from "@/app/api/health/route";
import manifest from "../../../package.json";

/** The complete public surface of the probe. Adding a key must be deliberate. */
const EXPECTED_KEYS = ["status", "time", "uptimeSeconds", "version"];

describe("GET /api/health", () => {
  it("answers 200 for an anonymous caller — the probe has no session", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("reports the running release, so a deploy can be identified without shell access", async () => {
    const body = await (await GET()).json();
    expect(body.version).toBe(manifest.version);
  });

  it("reports a process-local uptime that is a whole, non-negative number of seconds", async () => {
    const body = await (await GET()).json();
    expect(Number.isInteger(body.uptimeSeconds)).toBe(true);
    expect(body.uptimeSeconds).toBeGreaterThanOrEqual(0);
  });

  it("stamps an ISO-8601 instant the caller can parse", async () => {
    const body = await (await GET()).json();
    expect(new Date(body.time).toISOString()).toBe(body.time);
  });

  it("never exposes anything beyond the four documented fields", async () => {
    const body = await (await GET()).json();
    // Exact set, not a subset: an env value or filesystem path smuggled in
    // here would be readable by anyone who can reach the port.
    expect(Object.keys(body).sort()).toEqual(EXPECTED_KEYS);
  });

  it("forbids caching — a cached `ok` would hide an outage for the whole TTL", async () => {
    const res = await GET();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("HEAD /api/health", () => {
  it("answers 200 with no body", async () => {
    const res = await HEAD();
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });

  it("is just as uncacheable as GET", async () => {
    const res = await HEAD();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});

describe("OPTIONS /api/health", () => {
  it("rejects a misconfigured probe as 405 — not a routing 404", async () => {
    const res = await OPTIONS();
    // A 404 would send an operator hunting for a missing route; 405 says the
    // route exists and the METHOD is wrong.
    expect(res.status).toBe(405);
  });

  it("names the methods that are actually served", async () => {
    const res = await OPTIONS();
    expect(res.headers.get("allow")).toBe("GET, HEAD, OPTIONS");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
});
