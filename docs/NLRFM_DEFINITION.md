# NLRFM_DEFINITION.md

> The **exact, honest** definition of the customer-segmentation model used in
> the LEGALIR analytics dashboard. Read this before trusting any customer score.
>
> **The short version:** the brief asked for "NLRFM". A full-text search of the
> entire repository for `NLRFM`, `LRFM`, `RFM`, `churn`, `cohort`, `LTV` found
> **zero** prior definitions, docs, code, or comments. LEGALIR has never defined
> what its "N" would mean. Therefore this module ships a **transparent LRFM
> model** (Length · Recency · Frequency · Monetary) and, **separately and
> explicitly labelled**, a binary «New vs Returning» flag. **Nothing here claims
> to be an industry-standard NLRFM**, because LEGALIR has no documented N
> dimension and inventing one would violate the no-fake-metric rule.
>
> Snapshot: 2026-10-07.

---

## 1. What we deliberately do NOT do

| Not done | Why |
|---|---|
| Invent an "N" dimension | No documented definition exists anywhere in the project. A fabricated N would be a fake metric. |
| Hide thresholds inside code | Every cut-point is declared here and surfaced in the UI («چگونه محاسبه می‌شود؟»). |
| Present heuristic labels as ML predictions | The at-risk/dormant label is a rule over recency, labelled «هیوریستیک» in the UI. |
| Show a projected LTV | Only **realized** lifetime value (money actually collected) is shown. |
| Score users with no purchase | A user with zero completed purchases has no F/M; they are placed in an explicit «بدون خرید» bucket, never scored as if they had bought. |

---

## 2. The four real dimensions (LRFM)

Each dimension is computed **only from real rows**.

### L — Length (طول عمر رابطه)
- **Definition:** days from the user's **first activity anchor** to `now`.
- **Anchor (first purchase if any, else registration):**
  - if the user has ≥1 completed purchase → `min(subscriptions.purchased_at)`
  - else → `users.createdAt`
- **Why this order:** length is meaningful *within the customer relationship*;
  anchoring the whole population on registration would inflate non-buyers.
- **Unit:** whole days. **Source:** `subscriptions.purchased_at`, `users.createdAt`.

### R — Recency (تازگی فعالیت)
- **Definition:** days from the user's **last observed activity** to `now`.
- **Last activity = max of:**
  - `subscriptions.purchased_at` (last purchase), and
  - `sessions.lastActiveAt` (last session), and
  - `activities.created_at` (last activity row).
- **Source:** `subscriptions`, `sessions`, `activities`. The UI states the exact
  source of the winning signal so it is never a mystery.
- **Unit:** whole days. Smaller = more recent = better.

### F — Frequency (تعداد خرید)
- **Definition:** count of **completed (paid)** purchases = number of
  `subscriptions` rows for the user **that were actually activated**.
- Legacy caveat (G2): pre-fix rows have no `payment_id`. A subscription row
  exists only after activation, so every subscription row counts as one
  completed purchase; this is stated in the UI.
- **Source:** `subscriptions` (grouped by `user_id`).

### M — Monetary (ارزش پولی)
- **Definition:** **net** monetary value = Σ(`subscriptions.amount`) −
  settled refunds (`financial_adjustments` with `status="completed"`).
- Redemption/points are **not** money and are excluded from M.
- Refunds are currently 0 (G1) → M = gross today, and the UI says so.
- **Unit:** integer Toman (IRT). **Source:** `subscriptions.amount`, `financial_adjustments`.

---

## 3. Scoring (declared, not hidden)

Each dimension is mapped to a **1–5 quintile-ish score** using **fixed,
declared thresholds** (not data-driven quantiles, so a score is stable across
runs and comparable over time). Thresholds are chosen from the platform's own
plan economics and are shown in the UI.

### 3.1 L score (longer is better)
| L days | score |
|---|---|
| ≥ 365 | 5 |
| ≥ 180 | 4 |
| ≥ 90 | 3 |
| ≥ 30 | 2 |
| < 30 | 1 |

### 3.2 R score (more recent is better)
| R days | score |
|---|---|
| ≤ 7 | 5 |
| ≤ 30 | 4 |
| ≤ 90 | 3 |
| ≤ 180 | 2 |
| > 180 | 1 |

### 3.3 F score (more purchases is better)
| F | score |
|---|---|
| ≥ 5 | 5 |
| 4 | 4 |
| 3 | 3 |
| 2 | 2 |
| 1 | 1 |
| 0 | **unscored** → «بدون خرید» bucket |

### 3.4 M score (more net value is better)
| M (IRT) | score |
|---|---|
| ≥ 20,000,000 | 5 |
| ≥ 10,000,000 | 4 |
| ≥ 5,000,000 | 3 |
| ≥ 2,000,000 | 2 |
| < 2,000,000 | 1 |
| 0 | **unscored** → «بدون خرید» bucket |

> Thresholds are a **design choice**, disclosed here and in the product. They are
> not claimed to be statistically optimal. If product economics change, these
> tables are the single place to update, and the data dictionary records it.

---

## 4. Segments (transparent rules)

A user with **F = 0** → segment **«بدون خرید»** (never scored as a buyer).

For buyers, the segment is assigned by the first matching rule (top → bottom):

| Segment | Rule (on 1–5 scores) |
|---|---|
| قهرمانان (Champions) | R ≥ 4 AND F ≥ 4 AND M ≥ 4 |
| وفادار (Loyal) | R ≥ 4 AND F ≥ 3 |
| در معرض وفاداری (Potential Loyalist) | R ≥ 4 AND F ∈ {1,2} |
| تازه‌وارد ارزشمند (Promising) | R = 3 AND L ≤ 3 |
| نیازمند توجه (Needs Attention) | R = 3 AND L ≥ 4 |
| در معرض ریزش (At Risk) | R = 2 AND M ≥ 3 |
| رو به خاموشی (Hibernating) | R ≤ 2 AND F ≥ 2 |
| ازدست‌رفته (Lost) | R = 1 AND L ≥ 4 |
| تازه (New) | fallback when F = 1 AND R ≥ 3 |
| نامشخص (Unclassified) | any buyer not matched above |

**At-risk / dormant (heuristic):** any buyer with **R > 90 days** is flagged
«هیوریستیک: در ریسک ریزش» — a rule, not a prediction. The UI labels it as such
and never calls it AI.

---

## 5. New vs Returning (separate, explicit)

This is **not** part of LRFM. It is a second, clearly separate flag:

- **Returning:** the user has ≥ 2 completed purchases, OR ≥ 2 distinct purchase
  months. (`subscriptions.purchased_at`)
- **New:** exactly 1 completed purchase.
- **Non-buyer:** 0 purchases (shown, not segmented).

This is the only thing resembling an "N" dimension LEGALIR can honestly produce,
and it is named «کاربر تازه / بازگشتی», never «N».

---

## 6. Repurchase interval (average AND median, separately)

- For each user with **≥ 2 purchases**, compute consecutive gaps between sorted
  `purchased_at` timestamps → interval list (days).
- Report **average** and **median** as two distinct numbers (never blended).
- Users with exactly 1 purchase → **N/A** (excluded from the statistic, shown as
  «تک‌خرید — قابل محاسبه نیست», never counted as a 0-day interval).
- **Source:** `subscriptions.purchased_at`.

---

## 7. LTV (realized only)

- **Historical LTV** = Σ(net monetary) over the user's lifetime = the same M
  value, presented as a per-segment aggregate and a distribution.
- **Never** projected/extrapolated. No "predicted LTV".

---

## 8. Cohort analysis (small-n honest)

- **Registration cohort:** `users.createdAt` bucketed by month.
- **First-purchase cohort:** `min(subscriptions.purchased_at)` by month.
- For each cohort: users, buyers, purchase conversion (**%), net revenue, ARPPU
  (net ÷ buyers).
- **Small-n guard:** when a cohort base is 0, no percentage is emitted (shown as
  «—»). When a cohort base is < 5, a «نمونهٔ کوچک» warning is attached. The UI
  states that these shares are descriptive, not statistically robust.

---

## 9. What the UI must disclose

For every customer-analytics screen, the header/footnote must state:
- the model is **LRFM** (not a standard "NLRFM"),
- the R source actually used (session vs activity vs purchase),
- that M is gross today because no refunds are recorded (or the real refund total),
- that at-risk is a **heuristic**,
- and that cohorts on small n are descriptive only.

This disclosure is not optional — it is the contract that keeps the dashboard
honest.
