# LEGALIER — User Flows

Persian-first, RTL-first. Every flow below is implemented end-to-end
(UI → route handler → domain lib → JSON table).

---

## Flow A — From a legal problem to a case

```
/intake (category picker)
   │  choose category → buildIntakeSchema(category)
   ▼
9-step wizard  ──►  intake_drafts (resumable, owner-scoped)
   │  submit
   ▼
legal_requests row (state = DRAFT)
   │  AI analysis grounded in verified sources (no fabricated citations)
   ▼
AI_ANALYSIS_READY
   │  user asks for a lawyer
   ▼
LAWYER_REQUESTED → MATCHING
   │  matchLawyers(criteria) → up to 3 candidates
   ▼
LAWYER_PROPOSED  ──►  user reviews profiles and CHOOSES one
   │
   ▼
LAWYER_SELECTED → WAITING_FOR_ACCEPTANCE → ACCEPTED
   │
   ▼
Case created + linked (caseId written back onto the request)
   │
   ▼
/cases/[id] — timeline, tasks, documents
```

**Key rule:** at `LAWYER_PROPOSED` the system has *proposed* candidates.
The user selects. The engine never auto-assigns.

---

## Flow B — Browse the lawyer marketplace

```
/lawyers
  ├─ category chips · search · sort · remote toggle
  ├─ each card badged «نمونه» when isDemo
  └─ click → /lawyers/[id]
                ├─ performance (derived, «—» when no data)
                ├─ specializations · pricing · availability
                ├─ reviews
                └─ CTA → /new?lawyerId=<id>
```

---

## Flow C — Track a legal request

```
/requests
  └─ row → /requests/[id]
             ├─ current state badge
             ├─ timeline (legal_request_events, newest last)
             ├─ «اقدام بعدی» — only the LEGAL next states are offered
             │     click → POST .../transition
             │       200 → badge + timeline update together
             │       409 → Persian error, state unchanged
             └─ intake answers · link to selected lawyer
```

The buttons shown are exactly `LEGAL_REQUEST_TRANSITIONS[current]`. The
server re-validates; a stale UI can never force an illegal move.

---

## Flow D — Manage a case (the center)

```
/cases
  ├─ search · status filter chips
  ├─ create modal → POST /api/v1/cases
  └─ card → /cases/[id]
              ├─ timeline events
              ├─ tasks (todo / in_progress / done)
              └─ linked documents & contracts
```

---

## Flow E — Chat as an entry point

```
/chat
  ├─ category cards → guided intake
  ├─ answers grounded in verified sources
  └─ ACTION phase → «ثبت پرونده» → /cases?create=true
```

Chat is one door into the platform. The durable artifact it produces is a
**case**, not a transcript.

---

## Flow F — Account & organization

```
/auth/mobile → /auth/verify → /auth/profile
  └─ account type chosen: PERSONAL | LAWYER | BUSINESS
       PERSONAL → personal workspace
       LAWYER   → lawyer profile + assigned requests
       BUSINESS → organization workspace (members, org-scoped cases)
```

Account type and RBAC role are independent: a `BUSINESS` account can hold
`COMPANY_OWNER`, `COMPANY_ADMIN` or `COMPANY_MEMBER`.
