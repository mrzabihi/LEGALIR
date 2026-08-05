// ============================================================
// LEGALIR — Health / Status Development Page
// ============================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { env as appEnv } from "@legalir/config";

interface CheckResult {
  name: string;
  status: "ok" | "warn" | "fail";
  detail: string;
}

interface ModuleCheck {
  name: string;
  check: () => Promise<CheckResult> | CheckResult;
}

function useHealthCheck() {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);

  const run = useCallback(async () => {
    setRunning(true);
    const checks: ModuleCheck[] = [
      {
        name: "Environment Config",
        check: () => {
          try {
            return {
              name: "Environment Config",
              status: "ok" as const,
              detail: `API Mode: ${appEnv.apiMode}, Base URL: ${appEnv.apiBaseUrl}`,
            };
          } catch {
            return { name: "Environment Config", status: "fail", detail: "Config load failed" };
          }
        },
      },
      {
        name: "Browser Runtime",
        check: () => ({
          name: "Browser Runtime",
          status: typeof window !== "undefined" ? ("ok" as const) : ("fail" as const),
          detail: `User Agent: ${typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 60) : "N/A"}...`,
        }),
      },
      {
        name: "Persian Font (Vazir)",
        check: () => {
          if (typeof document === "undefined") {
            return { name: "Persian Font (Vazir)", status: "warn", detail: "SSR — cannot probe" };
          }
          const testEl = document.createElement("span");
          testEl.style.fontFamily = "Vazirmatn, Vazir";
          testEl.style.fontSize = "72px";
          testEl.textContent =
            "آزمایش متن فارسی برای بررسی فونت وزیر";
          testEl.style.position = "absolute";
          testEl.style.visibility = "hidden";
          document.body.appendChild(testEl);
          const width = testEl.offsetWidth;
          document.body.removeChild(testEl);
          const isFontLoaded = width > 200;
          return {
            name: "Persian Font (Vazir)",
            status: isFontLoaded ? ("ok" as const) : ("warn" as const),
            detail: isFontLoaded
              ? `Rendered width ${width}px — font appears loaded`
              : `Width ${width}px — font may not have loaded yet`,
          };
        },
      },
      {
        name: "MSW Mock API",
        check: async () => {
          try {
            const isActive = typeof window !== "undefined" && "serviceWorker" in navigator;
            return {
              name: "MSW Mock API",
              status: isActive ? ("ok" as const) : ("warn" as const),
              detail: isActive
                ? "Service Worker API available — MSW can be initialized"
                : "Service Worker API not available (SSR or unsupported browser)",
            };
          } catch {
            return { name: "MSW Mock API", status: "warn", detail: "Could not probe MSW status" };
          }
        },
      },
      {
        name: "RTL Direction",
        check: () => {
          const dir =
            typeof document !== "undefined"
              ? document.documentElement.dir
              : "rtl";
          return {
            name: "RTL Direction",
            status: dir === "rtl" ? ("ok" as const) : ("warn" as const),
            detail: `Document direction: ${dir}`,
          };
        },
      },
      {
        name: "Theme",
        check: () => {
          const theme =
            typeof document !== "undefined"
              ? document.documentElement.getAttribute("data-theme")
              : null;
          return {
            name: "Theme",
            status: theme ? ("ok" as const) : ("warn" as const),
            detail: theme ? `Active theme: ${theme}` : "No theme set",
          };
        },
      },
      {
        name: "LocalStorage Access",
        check: () => {
          try {
            if (typeof localStorage === "undefined") {
              return {
                name: "LocalStorage Access",
                status: "warn" as const,
                detail: "Not available (SSR)",
              };
            }
            localStorage.setItem("__health_check__", "1");
            localStorage.removeItem("__health_check__");
            return {
              name: "LocalStorage Access",
              status: "ok" as const,
              detail: "Read/Write OK",
            };
          } catch {
            return {
              name: "LocalStorage Access",
              status: "fail",
              detail: "Blocked or unavailable",
            };
          }
        },
      },
      {
        name: "API Endpoint Probe",
        check: async () => {
          try {
            const response = await fetch("/api/health", { method: "HEAD" });
            return {
              name: "API Endpoint Probe",
              status: response.ok ? ("ok" as const) : ("warn" as const),
              detail: response.ok
                ? `Status ${response.status}`
                : `Status ${response.status} — may be expected in mock mode`,
            };
          } catch {
            return {
              name: "API Endpoint Probe",
              status: "warn",
              detail: "Request failed — may be expected in mock mode",
            };
          }
        },
      },
      {
        name: "Viewport Size",
        check: () => ({
          name: "Viewport Size",
          status: "ok",
          detail:
            typeof window !== "undefined"
              ? `${window.innerWidth}x${window.innerHeight} (DPR: ${window.devicePixelRatio})`
              : "SSR",
        }),
      },
    ];

    const outcomes = await Promise.all(
      checks.map(async (c) => {
        try {
          return await c.check();
        } catch (err) {
          return {
            name: c.name,
            status: "fail" as const,
            detail: err instanceof Error ? err.message : "Unknown error",
          };
        }
      })
    );

    setResults(outcomes);
    setRunning(false);
    setLastRun(new Date().toLocaleTimeString("fa-IR"));
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  return { results, running, lastRun, rerun: run };
}

export default function HealthPage() {
  const { results, running, lastRun, rerun } = useHealthCheck();

  const statusBadge = (status: CheckResult["status"]) => {
    const map = {
      ok: { bg: "bg-success/10 text-success", label: "OK" },
      warn: { bg: "bg-warning/10 text-warning", label: "WARN" },
      fail: { bg: "bg-error/10 text-error", label: "FAIL" },
    };
    const s = map[status];
    return (
      <span
        className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${s.bg}`}
      >
        {s.label}
      </span>
    );
  };

  const okCount = results.filter((r) => r.status === "ok").length;
  const warnCount = results.filter((r) => r.status === "warn").length;
  const failCount = results.filter((r) => r.status === "fail").length;

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8" dir="rtl">
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-h1 text-on-surface">وضعیت سیستم</h1>
            <p className="text-body-2 text-muted mt-1">
              LEGALIR Frontend Health Check
            </p>
          </div>
          <div className="flex items-center gap-3">
            {lastRun && (
              <span className="text-caption text-muted">
                آخرین بررسی: {lastRun}
              </span>
            )}
            <button
              onClick={rerun}
              disabled={running}
              className="rounded-medium bg-primary px-4 py-2 text-sm text-white font-button hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {running ? "در حال بررسی..." : "بررسی مجدد"}
            </button>
          </div>
        </header>

        {/* Summary cards */}
        <div className="mb-6 grid grid-cols-4 gap-3">
          <SummaryCard label="کل" value={results.length} />
          <SummaryCard label="سالم" value={okCount} color="text-success" />
          <SummaryCard label="هشدار" value={warnCount} color="text-warning" />
          <SummaryCard label="خطا" value={failCount} color="text-error" />
        </div>

        {/* Results */}
        <div className="rounded-large border border-muted/10 bg-surface">
          {results.length === 0 && (
            <div className="p-8 text-center text-muted">در حال بررسی...</div>
          )}
          {results.map((r) => (
            <div
              key={r.name}
              className="flex items-center justify-between gap-4 border-b border-muted/5 px-6 py-4 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-body-2 text-on-surface font-medium">{r.name}</p>
                <p className="text-caption text-muted mt-0.5 truncate">{r.detail}</p>
              </div>
              <div className="shrink-0">{statusBadge(r.status)}</div>
            </div>
          ))}
        </div>

        {/* App info */}
        <footer className="mt-8 rounded-large border border-muted/10 bg-surface p-6">
          <h2 className="text-h3 text-on-surface mb-3">اطلاعات برنامه</h2>
          <div className="grid gap-2 text-body-2">
            <InfoRow label="محیط" value={appEnv.isProduction ? "Production" : appEnv.isTest ? "Test" : "Development"} />
            <InfoRow label="API Mode" value={appEnv.apiMode} />
            <InfoRow label="Base URL" value={appEnv.apiBaseUrl} />
            <InfoRow label="Node Env" value={process.env["NODE_ENV"] ?? "N/A"} />
            <InfoRow
              label="Next.js"
              value={process.env["NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA"]?.slice(0, 8) ?? "development"}
            />
          </div>
        </footer>

        <p className="mt-4 text-center text-caption text-muted">
          این صفحه فقط در محیط توسعه قابل دسترسی است.
        </p>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color = "text-on-surface",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="rounded-medium border border-muted/10 bg-surface p-4 text-center">
      <p className={`text-h2 ${color}`}>{value}</p>
      <p className="text-caption text-muted mt-1">{label}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-muted shrink-0">{label}:</span>
      <span className="font-medium font-mono text-sm" dir="ltr">
        {value}
      </span>
    </div>
  );
}
