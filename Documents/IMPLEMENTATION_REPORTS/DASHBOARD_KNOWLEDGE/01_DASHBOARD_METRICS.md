# Dashboard Metrics — Real Operational Overview

## Purpose

Replace the previously hard-coded dashboard numbers with values computed from
the JSON-file DB, scoped to the authenticated user and the Asia/Tehran
business day.

## Module: `src/lib/dashboard-metrics.ts`

### Timezone

Iran has not observed DST since 2022, so Tehran is a fixed `UTC+03:30` offset
(`TEHRAN_UTC_OFFSET_MS = 210 * 60 * 1000`).

- `tehranDayStartUtc(date)` — UTC instant of the current Tehran midnight.
- `tehranDayEndUtc(date)` — UTC instant 24h after Tehran midnight (exclusive).
- `isTehranToday(iso, now)` — true when an ISO timestamp falls inside the
  current Tehran day.

The Tehran calendar date is obtained from `tehranDateString` in
`src/lib/rewards.ts` (an `Intl.DateTimeFormat` with `timeZone: "Asia/Tehran"`),
then converted back to a UTC epoch using the fixed offset.

### Computed fields (`computeDashboardMetrics(userId, now?)`)

| Field | Source |
|-------|--------|
| `documentsCount` | `listDemoDocuments(userId).length` |
| `contractsCount` | `listDemoContracts(userId).length` |
| `memoriesCount` | `listDemoMemories(userId).length` |
| `requestsToday` | activities with `updated_at` in the current Tehran day |
| `activeRequests` | active documents + collecting/under-review contracts + active conversations |
| `recentDocuments` | 5 most-recently-updated documents |
| `recommendations` | failed doc / review contract / processing doc (up to 3) |
| `activeProcessingCount` | `activeRequests.length` |
| `savedSourcesCount` | legal-context memories count |
| `dailyRequestsUsed/Total` | `queryProfileUsage(userId)` |

### `subscriptionDaysRemaining(userId)`

Reads `queryActiveSubscription(userId)`, computes `ceil((endAt - now) / 1 day)`,
clamped to `>= 0`. Returns `null` when no active subscription exists.

## API: `GET /api/v1/dashboard/summary`

Still returns the full user/profile/subscription/entitlements payload, but the
overview fields are now real:

```ts
{
  savedSourcesCount,        // real
  activeProcessingCount,    // real
  dailyTrialsUsed,          // = requestsToday (backward-compatible alias)
  dailyTrialsTotal,         // = usage.dailyRequestsTotal
  activeRequests,           // real
  recommendations,          // real
  recentDocuments,          // real
  requestsToday,            // real (new)
  documentsCount,           // real (new)
  contractsCount,           // real (new)
  memoriesCount,            // real (new)
  daysRemaining,            // real (new, may be null)
  subscriptionUsage,        // real (new, { planCode, planNameFa, endAt, daysRemaining } | null)
}
```

## UI

- `src/app/(app)/dashboard/page.tsx` reads the real `heroStats` fields.
- `src/components/dashboard/widgets.tsx` adds `SubscriptionOverview`, a
  `CircularProgress` ring showing days-remaining out of a 30-day reference,
  with loading/empty/error states and a retry affordance.
