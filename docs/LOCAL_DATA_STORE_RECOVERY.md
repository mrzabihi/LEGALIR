# LEGALIR — Recovering the local JSON data store

> What to do when `apps/frontend/.data/*.json` is corrupted, how the 2026-10-20
> incident was repaired, and which values are intentionally left empty so no
> future contributor "fixes" them with invented data.

---

## 1. What the store is

`apps/frontend/.data/` is a **local, gitignored** JSON store (`.gitignore` →
`.data/`). Every table is a flat JSON array of records, read and written by
`apps/frontend/src/lib/db.ts`:

| Concern | Detail |
| --- | --- |
| Read path | `readTable()` caches on `stat.mtimeMs` **and** `size`, so editing a file on disk is picked up without restarting the dev server. |
| Write path | `writeFileSync(tmp, JSON.stringify(data, null, 2), "utf-8")` — **no trailing newline**; a round-trip is byte-identical. |
| Scope | Demo and dev data only. Nothing here reaches production; a fresh clone regenerates seeds. |

Because it is gitignored, **no repair to it ever appears in `git status`**. That
is expected — a clean tree does not mean the store is healthy.

---

## 2. The 2026-10-20 corruption

Every non-ASCII code point in 14 tables had been replaced **1-for-1 by `?`
(U+003F)**: 167 runs plus 7 corrupted object keys. There was **no U+FFFD**
anywhere, so the files were written by something that dropped UTF-8 rather than
by a partial read.

Two consequences shaped the whole repair:

1. **The bytes are gone.** `?` carries no information about the original code
   point — recovery from the file alone is impossible.
2. **Word shapes survive.** Substitution is 1-for-1, so `"دیوارها و رنگ"`
   becomes `"??????? ? ???"` — the number of `?` per word is still exact. That
   signature is what makes a value *provable* rather than *guessable*.

Detect it with a recursive walk over every `.json`:

```js
const isCorrupt = (v) => typeof v === "string" && /\?{2,}/u.test(v);
// …and check object KEYS too — `intakeAnswers` had a corrupted key.
```

Do **not** use a single-`?` test alone: URL query strings (`avatarUrl:
"/api/.../avatar?v=…"`) are legitimate and produce ~44 false positives.

---

## 3. Repair policy — evidence only, three tiers

Never write a Persian value that no source in the repo justifies. Classify every
corrupt field into exactly one tier:

| Tier | Rule | Example |
| --- | --- | --- |
| **CANONICAL** | A repo source determines the value. | Handover labels come from `DEFAULT_HANDOVER_ITEMS` (`apps/frontend/src/lib/contracts/registry.ts`); category labels from `LEGAL_CATEGORY_FA` (`packages/types/src/platform.ts`) or `CASE_CATEGORY_FA` (`packages/types/src/index.ts`); a contract title falls back to the record's own intact `typeFa`. |
| **BLANK** | No source exists. Set `""`. | Party names, check numbers, message bodies, user-typed answers, vehicle brand/model/colour/plate. |
| **UNTOUCHED** | Already readable. | Everything else. |

`""` is not a placeholder for "unknown" here — it is the value every draft
record in these tables already uses, so the UI renders an empty field rather
than a fabricated one.

Two category vocabularies coexist: `LEGAL_CATEGORY_FA` has no `property` key,
while `CASE_CATEGORY_FA` does (`property: "ملکی"`). Resolve with the request
vocabulary first, then the case vocabulary:

```js
const labelFor = (c) => LEGAL_CATEGORY_FA[c] ?? CASE_CATEGORY_FA[c] ?? null;
```

Generated sentences are rebuilt from the app's own template strings, never
paraphrased — e.g. `پرونده ایجادشده از درخواست «${title}»`
(`api/v1/legal-requests/[id]/respond/route.ts`) and
`قرارداد «${title}» ایجاد شد.`.

---

## 4. Twin clone — when an identical record survives

If a second record exists whose non-corrupt values match on many independent
fields *and* whose word shapes match every lost field, it is a **structural
twin** and its values can be restored with proof.

`cnt-310a7710` (property sale) was restored from `cnt-3befa9eb` this way — 103
fields across `property-contracts.json`, `contract-versions.json` (v1 + v2),
`contract-parties.json` and `contract-payments.json`. Evidence:

```
title              "???? ? ???? ???????? ???"  4+1+4+8+3  →  "خرید و فروش آپارتمان ونک"
obligations.includedEquipment
                   "???? ????? ????? ??????"   4+5+5+6    →  "کولر گازی، پکیج، کابینت"
parties[seller].address
                   "?????? ????????"           6+8        →  "تهران، پاسداران"
payments[pay-2].holderName
                   "??? ?????"                 3+5        →  "علی رضایی"
```

Independent corroboration: identical national IDs, birth dates, mobiles,
postal codes, area, price, penalties, notary and deed date.

**Every twin write must assert two things before it lands:**

```js
if (cur !== "") throw new Error("target is not in the blanked state");
if (shape(corruptOriginal) !== shape(twinValue)) throw new Error("shape mismatch");
```

The first keeps the pass idempotent (a second run is a no-op); the second makes
a wrong twin impossible to apply silently. Read `corruptOriginal` from a
pre-repair backup, not from the live file.

A twin clone is **not** licence to copy a record's free text. Any field whose
shape does not match exactly stays blank.

---

## 5. What is intentionally still blank

These have no surviving source and no twin. They will stay empty until real
usage writes them again — **do not "complete" them**:

| Location | Fields |
| --- | --- |
| `property-contracts.json` `cnt-f1f219e9…` | `data.values` brand, model, colour, plateNumber |
| `property-contracts.json` `cnt-d29c2d8d…` | title — fell back to its own `typeFa` |
| `legal_requests.json` (6 rows) | custom titles — replaced by the category label |
| `cases.json`, `activities.json` | free-text descriptions, `lifecycle_reason` |
| `case_deadlines.json` | titles |
| `case_parties.json` | names |
| `case_timeline.json` | free-text descriptions |
| `secure_messages.json` | message bodies |
| `legal_request_events.json` | decline note |
| `contract-audit-logs.json` | operator comment (`metadata.comment`) |

One orphaned `admin_audit_log.json` row (`after.code = "probe-plan"`) was
deliberately **kept** — an audit log should not lose entries, so only its
`nameFa` was derived from its own surviving `code`.

---

## 6. Verification checklist

Run all six; a repair is not done until each passes.

1. Recursive `?`-run scan over every `.json` → **0 hits** (excluding `?v=`
   URL query strings).
2. Re-run the repair — it must report **0 files written** (idempotence).
3. Every file `JSON.parse`s; record counts match the pre-repair backup 1:1.
4. A diff against the backup touches **only** the intended records.
5. Live API returns the repaired values, e.g.
   `GET /api/v1/property-contracts/<id>` and its `/pdf` route (expect `200`,
   `application/pdf`).
6. Render the owning page at 390 px: no `??` in the DOM, no horizontal
   overflow, no page errors. Then `npx vitest run`.

---

## 7. Backup rule

Keep a pre-repair copy at `apps/frontend/.data/_backup-<YYYYMMDD>/` — inside the
already-ignored `.data/`, so it never reaches Git. Repair scripts should
**refuse to run** unless it exists:

```js
if (!fs.existsSync(BACKUP) || fs.readdirSync(BACKUP).length < 90) {
  throw new Error("backup missing or incomplete — refusing to write");
}
```

Never copy the backup outside `.data/`, and never commit it: `users.json` alone
holds 656 personal records.
