# DEMO CONTENT — Contract Fixtures (قراردادهای من)

Five contracts with full version history, risk analysis and attachments.

| id | title | type | category | state | versions |
|----|-------|------|----------|-------|----------|
| `cnt-emp-001` | قرارداد استخدام مدیر فنی | employment | business | under_review | 3 (v1→v3) |
| `cnt-nda-001` | توافقنامه محرمانگی (NDA) | nda | business | generated | 2 |
| `cnt-ctr-001` | قرارداد پیمانکاری خدمات فنی | contracting | business | approved | 3 |
| `cnt-part-001` | قرارداد مشارکت تجاری | partnership | personal | generated | 2 |
| `cnt-saas-001` | قرارداد اشتراک نرم‌افزار | saas | business | draft | 0 |

## Version history (representative)

`cnt-emp-001` — the flagship fixture — shows salary negotiation across versions:
v1 (۱۵۰/۰۰۰/۰۰۰ ریال) → v2 (۱۷۰/۰۰۰/۰۰۰) → v3 (۱۸۵/۰۰۰/۰۰۰, under_review), with
`answers` and `content` updated each step.

`cnt-ctr-001` shows SLA tightening across versions (8h/48h → 6h/36h → 4h/24h)
and amount escalation (۱.۸ → ۲.۲ → ۲.۴ میلیارد ریال).

## Risk analysis

| contract | overallRisk | findings |
|----------|-------------|----------|
| `cnt-emp-001` | high | 3 (ابهام دوره آزمایشی، سهم حق بیمه critical، شرط عدم رقابت) |
| `cnt-nda-001` | medium | 2 (دامنه محرمانگی، جبران خسارت) |
| `cnt-ctr-001` | medium | 2 (سقف جریمه، ساعت کاری SLA) |
| `cnt-part-001` | low | 1 (ابهام مدیریت) |
| `cnt-saas-001` | — | draft (no analysis) |

Protective suggestions (`protectiveSuggestions`) are populated for employment
(بیمه + محرمانگی) and contracting (سقف جریمه).

## Attachments

- `cnt-emp-001`: قانون کار (مواد ۷، ۲۴) + قانون تأمین اجتماعی (ماده ۳۹).
- `cnt-nda-001`: قانون تجارت الکترونیکی (ماده ۶۴).
- `cnt-part-001`: قانون مدنی — باب شرکت (ماده ۵۷۱).
- `cnt-ctr-001`, `cnt-saas-001`: none.

All contracts carry the standard AI disclaimer (پیش‌نویس خودکار، نیازمند بررسی وکیل).

## Relationships

| source | relation | target |
|--------|----------|--------|
| `cnt-emp-001` | generated-from | `doc-emp-001` |
| `cnt-ctr-001` | generated-from | `doc-ctr-001` |
| `cnt-nda-001` | generated-from | `doc-nda-001` |
| `mem-004` (memory) | references | `cnt-emp-001` |
| `mem-005` (memory) | references | `cnt-ctr-001` |
