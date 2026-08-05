# Demo Script — LEGALIR Development Demo (Phase 14)

**Version:** 0.0.0-demo
**Date:** 2026-08-05
**Duration:** Approximately 10 minutes

---

## Prerequisites

```bash
cd "d:\LegalIR Project"
npm install
npm run dev
```

Open `http://localhost:3000` in Chrome/Firefox.

> **Important:** Clear `localStorage` before starting the demo to ensure the splash screen appears. DevTools → Application → Local Storage → Clear.

---

## Demo User

| Field | Value |
|-------|-------|
| Mobile | `۰۹۱۲۰۰۰۰۰۰۳` (or any `09XX XXX XXXX` format number) |
| OTP | `405405` |
| Name | علی حسینی |
| Plan | Pro (پرو) |

The mobile number `۰۹۱۲۰۰۰۰۰۰۳` maps to a pre-seeded "Pro" user with complete profile, active subscription, and conversation history.

---

## Scene 1: Splash Screen (10s)

1. Navigate to `http://localhost:3000`
2. **Show:** LEGALIR animated splash with scales-of-justice logo, Persian "ل" mark, brand text, and animated dots
3. **Explain:** "4-second animated intro, CSS-only, respects reduced-motion preferences"
4. Splash fades out, revealing the landing page

---

## Scene 2: Persian Landing Page (30s)

1. **Show:** Hero section with mesh gradient background, heading "دستیار هوشمند حقوقی ایران"
2. **Point out:** AI disclaimer badge — "اطلاعات AI"
3. Scroll down to show:
   - Stats bar (۳ خدمات اصلی, ۶+ دسته‌بندی, ۲۴/۷ دسترسی)
   - Three service cards (تحلیل حقوقی, بررسی اسناد, تولید قرارداد)
   - Distinctions section (AI vs. legal sources vs. lawyer)
   - Full AI disclaimer
   - CTA section
4. **Explain:** "Fully Persian, RTL layout, professional legal tone"

---

## Scene 3: Registration (30s)

1. Click **"شروع مشاوره حقوقی"** button
2. Lands on `/auth/mobile`
3. Enter mobile: `۰۹۱۲۳۴۵۶۷۸۹`
4. Click **"ارسال کد تأیید"**
5. Lands on `/auth/verify`
6. **Show:** countdown timer, masked OTP input, edit button
7. Enter OTP: `405405`
8. Auto-verifies on 6th digit
9. Redirects to `/dashboard`

> **Note:** The OTP `405405` works for any mobile number except `09111111111` (rate-limited) and `09222222222` (always invalid). These test numbers demonstrate error scenarios.

---

## Scene 4: Workplace Dashboard (30s)

1. **Show:** Greeting header "علی حسینی"
2. Profile completion card (can point out a low % if profile incomplete)
3. Subscription summary (Pro plan, active)
4. Quick actions grid
5. Recent activities (rental consultation)
6. Usage summary card
7. **Explain:** "Each widget loads independently — one failure never breaks the page"

---

## Scene 5: Complete Profile (20s)

1. Click **"پروفایل"** in sidebar or navigate to `/profile`
2. **Show:**
   - Avatar with initial letter
   - Inline-editable fields (name, family name, city, occupation)
   - Profile completion bar
   - Usage pie chart (daily requests, tokens, documents, contracts)
   - Financial history table (subscription invoices)
3. Edit a field, demonstrate inline save
4. **Explain:** "Instant optimistic updates with React Query"

---

## Scene 6: Subscription Plans (20s)

1. Navigate to `/pricing`
2. **Show:** Plan comparison cards (الترا, پرو, پرو مکس)
3. Highlight features per plan
4. Navigate to `/subscription`
5. **Show:**
   - Current plan (پرو)
   - Usage vs. limits
   - Entitlements
6. Click a plan card — simulated checkout intent is created

---

## Scene 7: AI Legal Conversation (60s)

1. Navigate to `/chat` or click **"گفتگوها"** in sidebar
2. **Show:** Conversation list (pre-seeded with rental law conversation)
3. Click on existing conversation or create new
4. Type a legal question: "آیا صاحبخانه می‌تواند بدون اجازه وارد ملک استیجاری شود؟"
5. Send message — **Show:** AI run indicator with progress states:
   - `queued` → `retrieving` → `generating` → `validating` → `succeeded`
6. **Show:** Structured response with sections:
   - خلاصه (Summary)
   - اطلاعات و فرض‌ها (Facts & Assumptions)
   - تحلیل اولیه (Analysis)
   - ریسک‌ها (Risks)
   - اقدامات پیشنهادی (Recommended Actions)
   - منابع (Sources)
   - هشدار حقوقی (Legal Disclaimer)
7. Click **"منابع"** tab — **Show:** legal references with status badges
8. Click a source — **Show:** source detail drawer with version history
9. **Explain:** "References to real Iranian legal sources — Civil Code art. 490, Mojer-Mostajer Law 1376"

---

## Scene 8: Document Upload & Analysis (45s)

1. Navigate to `/documents`
2. **Show:** Document list (pre-seeded with lease agreement)
3. Click **"بارگذاری سند"** or upload button
4. Simulate upload (MSW accepts POST without actual file in demo)
5. **Show:** Processing lifecycle — document card with status progression:
   - `uploaded` → `processing` → `extracting` → `analyzing` → `ready`
6. Click on document — **Show:** detail page with:
   - Extracted text preview
   - Risk report with findings (high/medium/low severity)
   - Processing job timeline
   - Risk summary (overall score, confidence)

---

## Scene 9: Contract Generation (45s)

1. Navigate to `/contracts`
2. **Show:** Contract list (pre-seeded with lease NDA)
3. Click **"ایجاد قرارداد جدید"**
4. Select contract type: "اجاره" (Lease)
5. Step through wizard questions in Persian:
   - طرفین قرارداد (Parties)
   - موضوع قرارداد (Subject)
   - مدت (Duration)
   - مبلغ (Amount)
6. Click **"تولید پیش‌نویس"**
7. **Show:** Generated contract with Persian legal clauses
8. **Show:** Risk analysis panel:
   - Protective clauses highlighted
   - Missing clauses flagged
   - Risk severity badges
9. **Show:** Version history (multiple versions with diff)

---

## Scene 10: Categorized History (15s)

1. Navigate to `/history`
2. **Show:** Timeline with categorized entries:
   - `conversation` — گفتگوها
   - `document` — اسناد
   - `contract` — قراردادها
   - `subscription` — اشتراک
3. Filter by category, search
4. **Explain:** "Full audit trail of all user actions"

---

## Scene 11: Theme Switching (15s)

1. **Show:** Current Light theme
2. Click theme toggle button (sun/moon icon in top bar)
3. **Show:** Smooth transition to Dark theme
4. Navigate through pages — all components render correctly in dark mode
5. Toggle back to Light
6. **Explain:** "Persisted to localStorage, no flash on reload"

---

## Scene 12: Mobile Responsive (20s)

1. Open DevTools Responsive Mode (iPhone SE / 375px width)
2. **Show:**
   - Hamburger menu replaces sidebar
   - Bottom navigation bar appears
   - Cards stack vertically instead of table
   - Touch targets are ≥48px
   - Forms adapt to mobile width
3. Navigate through key pages
4. **Explain:** "Mobile-first design, RTL-aware, Persian-optimized"

---

## Error Scenarios (Optional)

If time permits, demonstrate error handling:

| Test | Action | Expected |
|------|--------|----------|
| Rate limit | Enter `09111111111` and request OTP | 429 — "تعداد درخواست‌ها بیش از حد مجاز است" |
| Invalid OTP | Enter wrong code for any number | 400 — "کد واردشده صحیح نیست" |
| Expired OTP | Use `09333333333` (1s TTL), wait, verify | 400 — "زمان کد به پایان رسیده است" |
| Offline | Toggle network offline | Offline banner appears |
| Empty states | Navigate as new user | Empty state messages in Persian |

---

## Demo Completion

1. Return to landing page
2. Explain: "All data is MSW-mocked — no backend, no real API calls. Ready for stakeholder review."
3. Q&A
