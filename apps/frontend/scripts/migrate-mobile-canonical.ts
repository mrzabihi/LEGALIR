// ============================================================
// LEGALIR — Migrate stored mobiles to canonical E.164
// ============================================================
// Rewrites the `mobile` field of every row in `.data/users.json` to the
// canonical E.164 form (`+989123456789`) using the SAME normalization
// module the app uses — so the migration can never disagree with runtime.
//
// Safety model (per the task's data-migration requirements):
//   * DRY-RUN by default — nothing is written unless `--apply` is passed.
//   * Invalid numbers are reported and LEFT UNTOUCHED (never guessed).
//   * Rows that would collide after normalization are reported and LEFT
//     UNTOUCHED — accounts are never auto-merged or deleted.
//   * `--apply` writes a timestamped backup first; `--rollback` restores it.
//   * All output is masked — full numbers never appear in the report.
//
// Usage:
//   npx tsx scripts/migrate-mobile-canonical.ts                 # dry-run
//   npx tsx scripts/migrate-mobile-canonical.ts --apply         # migrate
//   npx tsx scripts/migrate-mobile-canonical.ts --rollback <bak># restore
// ============================================================

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeIranMobile, maskMobile } from "../../../packages/validation/src/phone";

interface UserRow {
  id: string;
  mobile: string;
  [key: string]: unknown;
}

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(here, "..", ".data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

function readUsers(): UserRow[] {
  if (!fs.existsSync(USERS_FILE)) {
    throw new Error(`users.json not found at ${USERS_FILE}`);
  }
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8")) as UserRow[];
}

function writeUsers(rows: UserRow[]): void {
  fs.writeFileSync(USERS_FILE, JSON.stringify(rows, null, 2), "utf8");
}

interface Plan {
  alreadyCanonical: number;
  changes: { id: string; from: string; to: string }[];
  invalid: { id: string; masked: string }[];
  collisions: { canonical: string; ids: string[] }[];
}

/** Compute the migration plan without touching the file. */
function buildPlan(rows: UserRow[]): Plan {
  const plan: Plan = { alreadyCanonical: 0, changes: [], invalid: [], collisions: [] };

  // canonical value -> the ids that would occupy it after migration
  const byCanonical = new Map<string, string[]>();

  for (const row of rows) {
    const raw = String(row.mobile ?? "");
    const canonical = normalizeIranMobile(raw);
    if (!canonical) {
      plan.invalid.push({ id: row.id, masked: maskMobile(raw) });
      continue;
    }
    const ids = byCanonical.get(canonical) ?? [];
    ids.push(row.id);
    byCanonical.set(canonical, ids);

    if (canonical === raw) plan.alreadyCanonical += 1;
    else plan.changes.push({ id: row.id, from: raw, to: canonical });
  }

  // Any canonical value claimed by more than one row is a collision.
  const collidingIds = new Set<string>();
  for (const [canonical, ids] of byCanonical) {
    if (ids.length > 1) {
      plan.collisions.push({ canonical, ids });
      for (const id of ids) collidingIds.add(id);
    }
  }

  // Drop colliding rows from the change set — they must be reviewed by hand.
  plan.changes = plan.changes.filter((c) => !collidingIds.has(c.id));
  return plan;
}

function printPlan(plan: Plan, rows: UserRow[]): void {
  console.log("── Mobile canonicalization — plan ──────────────────────");
  console.log(`  total rows            : ${rows.length}`);
  console.log(`  already canonical     : ${plan.alreadyCanonical}`);
  console.log(`  to migrate            : ${plan.changes.length}`);
  console.log(`  invalid (left as-is)  : ${plan.invalid.length}`);
  console.log(`  collisions (left as-is): ${plan.collisions.length}`);

  if (plan.changes.length > 0) {
    console.log("\n  Sample changes (masked):");
    for (const c of plan.changes.slice(0, 5)) {
      console.log(`    ${maskMobile(c.from)}  →  ${maskMobile(c.to)}`);
    }
  }
  if (plan.invalid.length > 0) {
    console.log("\n  Invalid numbers (masked) — review manually:");
    for (const i of plan.invalid.slice(0, 10)) {
      console.log(`    id=${i.id}  ${i.masked}`);
    }
  }
  if (plan.collisions.length > 0) {
    console.log("\n  COLLISIONS — accounts NOT merged, review manually:");
    for (const c of plan.collisions) {
      console.log(`    ${maskMobile(c.canonical)}  claimed by ${c.ids.length} rows: ${c.ids.join(", ")}`);
    }
  }
  console.log("────────────────────────────────────────────────────────");
}

function apply(rows: UserRow[], plan: Plan): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backup = `${USERS_FILE}.bak-${stamp}`;
  fs.copyFileSync(USERS_FILE, backup);

  const toCanonical = new Map(plan.changes.map((c) => [c.id, c.to]));
  const next = rows.map((row) =>
    toCanonical.has(row.id) ? { ...row, mobile: toCanonical.get(row.id)! } : row
  );
  writeUsers(next);
  return backup;
}

function rollback(backupPath: string): void {
  if (!fs.existsSync(backupPath)) {
    throw new Error(`backup not found: ${backupPath}`);
  }
  fs.copyFileSync(backupPath, USERS_FILE);
  console.log(`Restored ${USERS_FILE} from ${backupPath}`);
}

function main(): void {
  const args = process.argv.slice(2);

  const rollbackIdx = args.indexOf("--rollback");
  if (rollbackIdx !== -1) {
    const backup = args[rollbackIdx + 1];
    if (!backup) throw new Error("--rollback requires a backup file path");
    rollback(backup);
    return;
  }

  const rows = readUsers();
  const plan = buildPlan(rows);
  printPlan(plan, rows);

  if (!args.includes("--apply")) {
    console.log("\nDRY-RUN — no changes written. Re-run with --apply to migrate.");
    return;
  }

  if (plan.changes.length === 0) {
    console.log("\nNothing to migrate.");
    return;
  }

  const backup = apply(rows, plan);
  console.log(`\nApplied ${plan.changes.length} change(s).`);
  console.log(`Backup written to: ${backup}`);
  console.log(`Rollback with: npx tsx scripts/migrate-mobile-canonical.ts --rollback "${backup}"`);
}

main();
