# Known Limitations — LEGALIR Development Demo (Phase 14)

**Version:** 0.0.0-demo
**Date:** 2026-08-05

---

## Classification Key

| Label | Meaning |
|-------|---------|
| **KNOWN** | Expected behavior, not a bug |
| **TODO** | Planned for a future phase |
| **ENV** | Environment-specific limitation |
| **WIP** | Work in progress |

---

## 1. E2E Tests (Playwright)

**Classification:** ENV
**Severity:** Low (for demo)

Playwright Chromium browser binaries are not available in the current Windows environment. The E2E test suites (`smoke.spec.ts`, `phase12-accessibility.spec.ts`) are fully authored but cannot execute locally.

**Workaround:** Run `npx playwright install chromium` in an environment with internet access, or run E2E tests in CI pipeline.

**Note:** All unit tests (415/415) and integration tests pass, providing equivalent code coverage.

---

## 2. MSW-Only Architecture

**Classification:** KNOWN
**Severity:** None (by design)

The entire demo runs against MSW (Mock Service Worker) handlers. No real backend, no real API calls, no real database.

**Implications:**
- Data resets on page refresh (no persistence beyond localStorage)
- File uploads are simulated (no actual file storage)
- OTP verification is hardcoded (`405405`)
- Payment flows are simulated (checkout intent created but no real gateway)
- AI responses are static fixtures (not real LLM output)

**Path to Production:** Replace MSW handlers with real API calls by removing the `initMsw()` call or deploying with `NODE_ENV=production`.

---

## 3. Fixed Development OTP

**Classification:** KNOWN
**Severity:** None (for demo)

The development OTP `405405` works for all mobile numbers. The OTP exists only in the MSW handler file (`src/mocks/handlers/index.ts`) and is never returned to the client or shown in the UI.

**Production Behavior:** The `requestOtpApi` / `verifyOtpApi` functions in `src/lib/auth/api.ts` call the real backend endpoint, which uses a proper SMS gateway.

---

## 4. In-Memory State Loss

**Classification:** KNOWN
**Severity:** Low (for demo)

MSW handlers maintain state in JavaScript Maps (challenge store, conversation store, draft store, checkout intent store). This state is lost on dev server restart or page hard refresh.

**Workaround:** The Zustand auth store persists to localStorage, so the session survives refresh. Data from MSW handlers (conversations, documents) re-seeds on each page load via fixture data.

---

## 5. No Real-Time AI Streaming

**Classification:** TODO
**Severity:** Medium

AI responses are delivered as complete messages after a simulated 2-second delay. Real streaming (SSE / WebSocket) is planned for Phase 16+.

**Current behavior:** The AI run state progresses through statuses (`queued` → `retrieving` → `generating` → `validating` → `succeeded`) on each poll, simulating streaming-complete in one step.

---

## 6. No Vakil (Lawyer) Integration

**Classification:** TODO
**Severity:** Low (for demo)

The escalation CTA ("نیاز به وکیل دارید؟") is a placeholder. Lawyer profiles, booking, and communication are planned for Phase 18+.

---

## 7. Limited Persian Font

**Classification:** KNOWN
**Severity:** Low

Only Vazirmatn is loaded. Additional Persian fonts for specific use cases (e.g., Nastaliq for legal document rendering) are not included.

---

## 8. No File Validation Beyond MIME

**Classification:** KNOWN
**Severity:** Low (for demo)

Document upload accepts any file with the correct MIME type. Real server-side virus scanning, OCR validation, and file integrity checks are backend responsibilities.

---

## 9. Windows Path Handling

**Classification:** ENV
**Severity:** Low

The project runs on Windows with bash (Git Bash / WSL compatibility layer). Some path operations may behave differently on native Linux/macOS. The `.next/trace` file occasionally has write permission issues on Windows.

**Workaround:** Run `rm -rf .next` before `npm run dev` if encountering EPERM errors.

---

## 10. No Analytics

**Classification:** TODO
**Severity:** Low (for demo)

No analytics, telemetry, or usage tracking is implemented. The console guard is installed to strip logs in production but no telemetry pipeline exists.

---

## 11. Browser Support

**Classification:** KNOWN
**Severity:** Low

Primary testing on Chromium-based browsers (Chrome, Edge). Firefox works. Safari not tested.

MSW v2 requires a modern browser with Service Worker support. IE11 is not supported.

---

## 12. No Offline Mode

**Classification:** TODO
**Severity:** Low

The offline banner appears but no offline-first capabilities (Service Worker caching, IndexedDB sync) are implemented.

---

## 13. Contract Generation Quality

**Classification:** WIP
**Severity:** Medium (for production)

Contract templates and generated clauses are mock fixtures. Real AI-powered contract generation with jurisdiction-specific clause generation is planned for Phase 15+.

---

## Summary

| # | Limitation | Classification | Severity |
|---|-----------|---------------|----------|
| 1 | E2E tests can't run (no Playwright browser) | ENV | Low |
| 2 | MSW-only, no real backend | KNOWN | None |
| 3 | Fixed dev OTP `405405` | KNOWN | None |
| 4 | In-memory state lost on restart | KNOWN | Low |
| 5 | No real-time AI streaming | TODO | Medium |
| 6 | No lawyer integration | TODO | Low |
| 7 | Single Persian font | KNOWN | Low |
| 8 | No server-side file validation | KNOWN | Low |
| 9 | Windows path quirks | ENV | Low |
| 10 | No analytics | TODO | Low |
| 11 | Chrome/Edge only validated | KNOWN | Low |
| 12 | No offline mode | TODO | Low |
| 13 | Mock contract generation quality | WIP | Medium |

---

**All limitations are within acceptable bounds for a Development Demo release.** No blocker prevents the demo from showcasing the complete LEGALIR user journey.
