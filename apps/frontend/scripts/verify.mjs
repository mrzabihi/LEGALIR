#!/usr/bin/env node
// ============================================================
// verify — the three static gates, concurrently
// ============================================================
// `check:assets`, `tsc --noEmit` and `eslint` answer three unrelated
// questions and share no state: assets reads the public tree for broken
// references, tsc builds a type program, eslint walks the source with its
// content-hashed cache. Running them in sequence buys nothing except the
// sum of their runtimes — measured on this machine at 0.5s + 3.9s + 2.6s
// plus the 1.6s harness self-check = 8.6s, against a 4.0–5.2s wall when
// run together (26.6s sequential when the eslint cache is cold).
//
// They are now started together. The wall clock is the slowest gate
// instead of the total, and a failure in one never hides a failure in
// another: every gate runs to completion and every failure is reported.
//
// Deliberately NOT changed:
//   • the gates themselves — same commands, same arguments, same caches;
//   • exit status — non-zero if ANY gate fails, exactly like the `&&` chain;
//   • output — each gate's stdout/stderr is buffered and printed as one
//     block, so ESLint's findings never interleave with tsc's diagnostics.
//
// Usage:
//   node scripts/verify.mjs           # all three gates
//   node scripts/verify.mjs --quiet   # only failures + the timing table
//   node scripts/verify.mjs --json    # machine-readable timing report
//   node scripts/verify.mjs --only=types,lint

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(HERE, "..");
const ROOT = path.resolve(APP, "../..");

const argv = process.argv.slice(2);
const flag = (name) => argv.some((a) => a === `--${name}`);
const onlyArg = argv.find((a) => a.startsWith("--only="));
const only = onlyArg ? onlyArg.slice("--only=".length).split(",").map((s) => s.trim()) : null;
const quiet = flag("quiet");
const json = flag("json");

/**
 * Each gate is the exact command the old `verify` chain ran, with `npx`
 * dropped: npm already puts `node_modules/.bin` on PATH, and resolving
 * through `npx` cost 1.5–2.5s per invocation in a previous measurement.
 * The binaries are invoked through `node` with an absolute path so the
 * script behaves identically whether it is run from the repo root, from
 * `apps/frontend`, or by a hook.
 */
const GATES = [
  {
    name: "assets",
    what: "asset references resolve",
    cmd: process.execPath,
    args: [path.join(APP, "scripts", "check-assets.mjs")],
    cwd: APP,
  },
  {
    name: "types",
    what: "TypeScript program is clean",
    cmd: process.execPath,
    args: [path.join(ROOT, "node_modules", "typescript", "bin", "tsc"), "--noEmit", "-p", "tsconfig.json"],
    cwd: APP,
  },
  {
    name: "lint",
    what: "ESLint has no findings",
    cmd: process.execPath,
    args: [
      path.join(ROOT, "node_modules", "eslint", "bin", "eslint.js"),
      "src",
      "--ext", ".ts,.tsx",
      "--cache",
      "--cache-location", "node_modules/.cache/eslint/.eslintcache",
    ],
    cwd: APP,
  },
  {
    // The test selector decides which tests run during iteration. If it
    // silently under-selects, nothing reports the tests it dropped — the
    // run is just green for the wrong reason. That is a failure mode no
    // other gate here can catch, so the selector checks itself.
    name: "harness",
    what: "test selection invariants hold",
    cmd: process.execPath,
    args: [path.join(APP, "scripts", "affected.mjs"), "--selftest"],
    cwd: APP,
  },
];

const selected = only ? GATES.filter((g) => only.includes(g.name)) : GATES;
if (selected.length === 0) {
  console.error(`verify: no gate matched --only= (known: ${GATES.map((g) => g.name).join(", ")})`);
  process.exit(2);
}

function runGate(gate) {
  return new Promise((resolve) => {
    const started = process.hrtime.bigint();
    const child = spawn(gate.cmd, gate.args, {
      cwd: gate.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      // No shell: arguments are passed verbatim, so a path with a space in
      // it (this repo lives under "d:/LegalIR Project") can never split.
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));

    child.on("error", (err) => {
      resolve({
        ...gate,
        ok: false,
        code: -1,
        ms: Number(process.hrtime.bigint() - started) / 1e6,
        stdout,
        stderr: `${stderr}${err.stack ?? err.message}`,
      });
    });

    child.on("close", (code) => {
      resolve({
        ...gate,
        ok: code === 0,
        code: code ?? -1,
        ms: Number(process.hrtime.bigint() - started) / 1e6,
        stdout,
        stderr,
      });
    });
  });
}

const startedAll = process.hrtime.bigint();
const results = await Promise.all(selected.map(runGate));
const wall = Number(process.hrtime.bigint() - startedAll) / 1e6;

const failed = results.filter((r) => !r.ok);

if (json) {
  process.stdout.write(
    JSON.stringify(
      {
        wallMs: Math.round(wall),
        gates: results.map((r) => ({
          name: r.name,
          ok: r.ok,
          code: r.code,
          ms: Math.round(r.ms),
        })),
      },
      null,
      2,
    ) + "\n"
  );
} else {
  for (const r of results) {
    const body = `${r.stdout}${r.stderr}`.trim();
    if (r.ok && quiet) continue;

    if (!r.ok) {
      process.stdout.write(`\n✗ ${r.name} — ${r.what} (exit ${r.code})\n`);
      if (body) process.stdout.write(body.split("\n").map((l) => `  ${l}`).join("\n") + "\n");
    } else {
      process.stdout.write(`\n✓ ${r.name} — ${r.what}\n`);
      if (body) process.stdout.write(body.split("\n").map((l) => `  ${l}`).join("\n") + "\n");
    }
  }

  // The table is the point of the script existing: it makes the parallel
  // win visible, and it makes a gate that quietly got slower visible too.
  const slowest = Math.max(...results.map((r) => r.ms));
  const sequential = results.reduce((a, r) => a + r.ms, 0);
  const pad = (s, n) => String(s).padEnd(n);
  process.stdout.write(`\n${pad("gate", 8)}${pad("result", 9)}${pad("time", 9)}${"share of wall"}\n`);
  for (const r of [...results].sort((a, b) => b.ms - a.ms)) {
    process.stdout.write(
      `${pad(r.name, 8)}${pad(r.ok ? "pass" : "FAIL", 9)}${pad(`${r.ms.toFixed(0)}ms`, 9)}${Math.round((r.ms / wall) * 100)}%\n`
    );
  }
  process.stdout.write(
    `\n${pad("wall", 8)}${pad(failed.length ? "FAIL" : "pass", 9)}${pad(`${wall.toFixed(0)}ms`, 9)}` +
      `${results.length > 1 ? `(sequential would be ${sequential.toFixed(0)}ms, slowest gate ${slowest.toFixed(0)}ms)` : ""}\n`
  );
}

process.exit(failed.length ? 1 : 0);
