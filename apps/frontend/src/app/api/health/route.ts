// ============================================================
// LEGALIR — Liveness probe (`GET|HEAD /api/health`)
// ============================================================
// Deliberately tiny and side-effect free. A container supervisor asks this
// every 30s; it must not touch the JSON data directory, seed anything, render
// a page, or require a session. It proves exactly two things:
//
//   • the Node process is answering HTTP, and
//   • it knows which release it is running.
//
// It reports nothing about user data, configuration values, or dependency
// health — those belong to the admin «وضعیت سامانه» page, which is
// permission-gated. Nothing here is secret: the version is already public in
// package.json, and the uptime is process-local.
// ============================================================

import { NextResponse } from "next/server";
import pkg from "../../../../package.json";

/** Process start time, read once per server process. */
const startedAt = Date.now();

export const dynamic = "force-dynamic";

function probe(): NextResponse {
  return NextResponse.json(
    {
      status: "ok",
      version: pkg.version,
      uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
      time: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        // A probe result is never worth caching — a stale "ok" would mask an
        // outage for the cache TTL.
        "Cache-Control": "no-store",
      },
    }
  );
}

export function GET(): NextResponse {
  return probe();
}

/** `apps/frontend/src/app/health/page.tsx:153` probes with HEAD. */
export function HEAD(): NextResponse {
  return new NextResponse(null, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Everything else answers 405 rather than a framework 404, so a misconfigured
 * probe (e.g. `curl -X POST`) reports "wrong method" instead of "no such
 * route" — which would send an operator hunting for the wrong problem.
 */
export function OPTIONS(): NextResponse {
  return new NextResponse(null, {
    status: 405,
    headers: { Allow: "GET, HEAD, OPTIONS", "Cache-Control": "no-store" },
  });
}
