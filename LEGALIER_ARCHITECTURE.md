# LEGALIER — Platform Architecture

> The full legal operating platform: intake → AI analysis → lawyer matching →
> legal request → case management. **Case Management is the architectural
> center**; chat is one entry point into it, not the product.

---

## 1. Layering

```
┌──────────────────────────────────────────────────────────────┐
│  Next.js App Router (apps/frontend)                          │
│  app/(app)/*  — RTL, Persian-first, MD3 design system        │
│  app/api/v1/* — route handlers (the ONLY backend)            │
└───────────────┬──────────────────────────────────────────────┘
                │  same-origin fetch (apiClient)
┌───────────────▼──────────────────────────────────────────────┐
│  Domain libraries (apps/frontend/src/lib/*)                  │
│  rbac · lawyer-db · lawyer-match · legal-request-db          │
│  case-db · intake-db · contract-catalog · legal-library-db   │
│  ai/grounding · ai/workflow                                  │
└───────────────┬──────────────────────────────────────────────┘
                │  readTable / writeTable
┌───────────────▼──────────────────────────────────────────────┐
│  JSON tables (.data/*.json)                                  │
│  mtime+size cached; every write primes the cache             │
└──────────────────────────────────────────────────────────────┘
```

There is **no Postgres**. Persistence is JSON tables accessed through
`readTable<T>` / `writeTable<T>`. All schema evolution is **additive** —
new fields are optional, new tables are new files, existing rows keep
working unchanged.

---

## 2. Identity model (PART 1)

Two orthogonal axes — never conflate them:

| Axis | Type | Values |
|---|---|---|
| **Account type** (what the account *is*) | `PlatformAccountType` | `PERSONAL`, `LAWYER`, `BUSINESS` |
| **RBAC role** (what the account *may do*) | `PlatformRole` | `USER`, `LAWYER`, `COMPANY_OWNER`, `COMPANY_ADMIN`, `COMPANY_MEMBER`, `SUPPORT`, `ADMIN`, `SUPER_ADMIN` |

Legacy rows store `individual` / `legal`; `normalizeAccountType()` maps
them forward (`individual → PERSONAL`, `legal → BUSINESS`) so no data
migration is required.

**Authorization is always server-side.** `requireAuth(request)` (in
`lib/rbac.ts`) returns `{ ok, ctx }` or a ready-made 401/403 response.
The frontend uses `Permission` keys only to *hide* affordances — it is
never the enforcement point.

---

## 3. Lawyer domain (PARTs 2–4)

### LawyerProfile

`LawyerProfile` (packages/types/src/platform.ts) carries:

- `verificationStatus`: `UNVERIFIED → VERIFIED | REJECTED | SUSPENDED`
- `specializations[]` — `{ category, yearsExperience }`
- `pricing` — consultation / hourly / contract-review fees in Toman
- `availability[]` — weekday + time window
- `locations[]` — province, city, remote flag
- `languages[]`
- `performance` — **derived on read**, never stored as a fabricated win-rate

`computePerformance()` derives rating, accepted requests, completed cases
and median response time from real events. When there is no data the
fields are `null` and the UI renders `—`, not a made-up number.

### Marketplace

`GET /api/v1/lawyers` — list with filters (`category`, `province`,
`maxFee`, `remote`, `language`, `search`, `verifiedOnly`).
`GET /api/v1/lawyers/[id]` — detail; 404 unless `VERIFIED`.
Demo lawyers are seeded by `lib/lawyer-seed.ts` (10 profiles, `isDemo:true`)
and are **clearly badged «نمونه»** in the UI.

### Matching engine (PART 4)

`lib/lawyer-match.ts` — two stages:

1. **Hard filters** (`hardFilterReason`): must be VERIFIED, accepting
   requests, category match, province (if required), fee ceiling,
   language, remote capability. A candidate failing any filter is excluded
   with a reason.
2. **Weighted ranking** (`scoreCandidate`, 0–100): six factors combined
   into a normalized weighted sum.

`matchLawyers(criteria)` returns `{ candidates, eligibleCount, excludedCount }`
with `DEFAULT_MATCH_LIMIT = 3`.

> **The engine never picks a lawyer.** It proposes several suitable
> candidates; the **user chooses**. There is no "AI picks the best lawyer".

---

## 4. Intake & AI analysis (PARTs 5–6)

### Versioned intake schemas

`lib/intake-schemas.ts` — `INTAKE_SCHEMA_VERSION = 1`. Nine shared steps
(subject, parties, timeline, documents, goal, location, prior_actions,
budget, review) plus per-category extra fields injected into the subject
step. `buildIntakeSchema(category)` returns an `IntakeSchema`; the wizard
renders entirely from the schema, so adding a category is data, not UI.

Drafts persist in the `intake_drafts` table (`lib/intake-db.ts`), all
operations scoped by `userId`.

### Source-grounded analysis (PART 6, PART 12)

`lib/ai/grounding.ts` retrieves verified sources from the Legal Library,
the 16-file official law catalog, and the ingested legal corpus. It
returns `{ sources, contextBlock, references }`.

> **No-citation rule:** if no reliable source is found, the source list is
> **empty** and the gateway must refrain from fabricating article numbers.
> The AI never invents a citation.

---

## 5. Legal Request state machine (PART 7)

`LegalRequestState` has 16 states. `LEGAL_REQUEST_TRANSITIONS` is the
authoritative adjacency map; `canTransitionLegalRequest(from, to)` is the
single predicate.

```
DRAFT → AI_INTAKE → AI_ANALYSIS_READY → LAWYER_REQUESTED → MATCHING
      → LAWYER_PROPOSED → LAWYER_SELECTED → WAITING_FOR_ACCEPTANCE
      → ACCEPTED → SCHEDULED → IN_PROGRESS
      → { WAITING_FOR_CLIENT | WAITING_FOR_LAWYER } → COMPLETED → CLOSED
```

`CANCELLED` is reachable from every active state; `CLOSED` is terminal.

**The server is the gate.** `POST /api/v1/legal-requests/[id]/transition`
validates the move *before any side effect* and returns `409
ILLEGAL_TRANSITION` with a Persian message otherwise. The UI can only
*request* a transition. Every accepted move is appended to
`legal_request_events` with the actor taken from the session — never from
the client body.

---

## 6. Case Management — the center (PART 10)

Tables: `cases`, `case_timeline`, `case_tasks` (`lib/case-db.ts`).

- **Timeline** — append-only `case_timeline` events.
- **Tasks** — `todo | in_progress | done` with priority and optional due date.
- **Documents / contracts** — linked by id, counted in the list view.

### Cross-module flow (PART 11)

When a legal request transitions to `ACCEPTED`, the transition handler
creates a `Case` **once** and writes `caseId` back onto the request. The
case is the durable artifact; the request is the intake that seeds it.
The legality check runs first, so a rejected transition can never leave an
orphaned case.

Contracts link to cases the same way: `POST /api/v1/property-contracts`
accepts an optional `caseId`, verifies the case belongs to the session
user (rejecting a foreign id with `CASE_NOT_FOUND`), stamps it on the
contract, and appends a `contract_linked` event to the case timeline.
`GET /api/v1/cases/[id]` returns the linked contracts, and the case
detail page renders them under the «قراردادها» tab.

---

## 7. Security posture (PARTs 14, 22)

- **IDOR/BOLA:** every owner-scoped read returns **404** (not 403) for a
  resource belonging to another user — a foreign id is indistinguishable
  from a missing one.
- **Actor integrity:** transition/event actors come from the session
  (`auth.ctx.userId`), never from the request body.
- **Validation at the boundary:** route handlers validate enum membership
  (e.g. `VALID_STATES`) and required fields before touching the domain.
- **No secrets in the client:** session tokens live in the `legalir-session`
  cookie; the client never reads them.

---

## 8. Design system

Material Design 3 tokens in `globals.css` are the source of truth
(`bg-surface`, `text-on-surface`, `text-muted`, `border-divider`,
`text-h2/h3`, `text-body-1/2`, `rounded-large`, `shadow-elevation-1`).
Legacy raw-palette markup is bridged by hue aliases in `tailwind.config`.
Persian-first, RTL-first (`dir="rtl"`), Vazirmatn, Persian digits via
`toPersianNumber`.
