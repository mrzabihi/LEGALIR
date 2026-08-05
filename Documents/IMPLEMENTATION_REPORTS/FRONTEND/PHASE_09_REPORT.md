# PHASE 09 — IMPLEMENTATION REPORT
## Document Upload and Legal Analysis (بارگذاری و تحلیل حقوقی اسناد)

---

### 1. OBJECTIVE

Phase 9 delivers the Document Upload and Legal Analysis system — the core differentiator that allows LEGALIR users to upload legal documents (PDF, DOCX, images) and receive AI-powered risk analysis and clause review. The system includes a full document lifecycle from upload through processing, extraction, analysis, and ready states. Users can browse their document list with search and filters, view detailed analysis reports with risk findings, retry failed processing, and manage documents. All analysis is simulated through MSW with realistic mock data.

---

### 2. DELIVERABLES SUMMARY

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Drag-and-drop upload | PASS |
| 2 | Mobile file selection | PASS |
| 3 | File type and size validation | PASS |
| 4 | Upload progress | PASS |
| 5 | Processing progress | PASS |
| 6 | Document list with filters and search | PASS |
| 7 | Document status badges | PASS |
| 8 | Document detail page | PASS |
| 9 | Analysis report | PASS |
| 10 | Risk summary | PASS |
| 11 | Document preview placeholder architecture | PASS |
| 12 | Extracted-text section | PASS |
| 13 | Analysis findings list | PASS |
| 14 | References linked to findings | PASS |
| 15 | Retry processing | PASS |
| 16 | Delete confirmation | PASS |
| 17 | Download/export placeholder | PASS |
| 18 | Simulated OCR/analysis through MSW | PASS |
| 19 | Realistic mock progress behavior | PASS |
| 20 | No sensitive document text in console logs or analytics | PASS |

---

### 3. ROUTES

| Route | Description |
|-------|-------------|
| `/documents` | Document list page with upload, search, filter, sort |
| `/documents/[id]` | Document detail page with analysis report, extracted text, processing status |

---

### 4. API ENDPOINTS (V1)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/documents` | List documents with search, filter, sort |
| `POST` | `/api/v1/documents/uploads` | Initiate document upload |
| `POST` | `/api/v1/documents/uploads/:id/complete` | Complete upload → processing starts |
| `GET` | `/api/v1/documents/:id` | Get full document detail |
| `GET` | `/api/v1/documents/:id/status` | Poll document processing status |
| `GET` | `/api/v1/documents/:id/analysis` | Get analysis report |
| `POST` | `/api/v1/documents/:id/retry` | Retry failed processing |
| `DELETE` | `/api/v1/documents/:id` | Delete document |

---

### 5. TYPE CONTRACTS

All types defined in `packages/types/src/index.ts`:

| Type | Description |
|------|-------------|
| `V1DocumentUploadRequest` | Upload initiation input: name, mime, sizeBytes |
| `V1DocumentUploadResponse` | Upload response: id, uploadUrl, expiresAt |
| `V1DocumentListItem` | List item: id, name, mime, sizeBytes, status, riskLevel, findingCount, timestamps |
| `V1DocumentDetail` | Full detail: all list fields + userId, storageKey, jobs[], report, extractedText, previewUrl |
| `V1DocumentStatusResponse` | Status poll response: id, status, progress, currentStage, errorCode |
| `V1DocumentAnalysisResponse` | Analysis response: report (RiskReport), extractedText |
| `V1DocumentRetryResponse` | Retry response: id, status |
| `V1DocumentDeleteResponse` | Delete response: { deleted: true } |
| `V1DocumentListParams` | List params: page?, pageSize?, search?, status?, sort? |
| `V1DocumentListResponse` | List response: items[], pagination |
| `V1DocumentFilter` | Filter type: "all" | "ready" | "processing" | "failed" |
| `SUPPORTED_DOCUMENT_MIMES` | Array of accepted MIME types (5) |
| `MAX_DOCUMENT_SIZE_BYTES` | 25 MB constant |

Extended: `DocumentStatus` now includes "blocked" and "cancelled" (previously only 6 states, now 8).

---

### 6. DOCUMENT LIFECYCLE

```
uploaded → processing → extracting → analyzing → ready
                                              ↘ failed
                                              ↘ blocked
                                              ↘ cancelled
```

Terminal states: `ready`, `failed`, `blocked`, `cancelled`
Transient states: `uploaded`, `processing`, `extracting`, `analyzing`

Status polling via `GET /status` every 2 seconds while document is in transient states.

---

### 7. ANALYSIS FINDINGS EXAMPLE

Each finding includes: title, locator (clause/page), risk level, explanation, recommendation, citation (nullable).

| # | Finding Title (فارسی) | Risk Level | Clause |
|---|----------------------|------------|--------|
| 1 | فسخ | critical | بند ۱۲، صفحه ۳ |
| 2 | جریمه | high | بند ۷، صفحه ۲ |
| 3 | مالکیت | medium | بند ۱، صفحه ۱ |
| 4 | تعهدات | high | بند ۹، صفحه ۳ |
| 5 | حل اختلاف | medium | بند ۱۵، صفحه ۴ |

Risk levels: `low`, `medium`, `high`, `critical` — each with distinct color coding.

---

### 8. COMPONENT ARCHITECTURE

All components in `apps/frontend/src/components/documents/`:

| Component | File | Purpose |
|-----------|------|---------|
| `StatusBadge` | `status-badge.tsx` | Color-coded document status with Persian labels |
| `UploadZone` | `upload-zone.tsx` | Drag-and-drop + click file upload with validation |
| `DocumentCard` | `document-card.tsx` | List card with status, risk level, metadata |
| `SearchFilterBar` | `search-filter-bar.tsx` | Search input, status tabs, sort dropdown |
| `FindingCard` | `finding-card.tsx` | Individual analysis finding display |
| `RiskSummary` | `risk-summary.tsx` | Overall risk level, confidence score, severity counts |
| `AnalysisReport` | `analysis-report.tsx` | Full analysis report with findings list |
| `ExtractedText` | `extracted-text.tsx` | Collapsible extracted document text |
| `PreviewPlaceholder` | `preview-placeholder.tsx` | Future document preview architecture |
| `DeleteConfirmDialog` | `delete-confirm-dialog.tsx` | Destructive delete confirmation modal |
| `DocumentDetail` | `document-detail.tsx` | Complete detail view composing all sections |
| `DocumentList` | `document-list.tsx` | List view with loading/empty/error states |
| `index.ts` | `index.ts` | Barrel export |

---

### 9. FILE CHANGES

**Modified files:**
- `packages/types/src/index.ts` — Extended DocumentStatus, added Phase 9 types (+~80 lines)
- `packages/testing/src/index.ts` — Added 12 document fixtures (+~200 lines)
- `apps/frontend/src/lib/api/v1.ts` — Added 8 document API functions (+~60 lines)
- `apps/frontend/src/lib/persian-utils.ts` — Added `formatFileSize` utility (+~14 lines)
- `apps/frontend/src/mocks/handlers/index.ts` — Added 8 V1 document MSW handlers (+~220 lines)
- `apps/frontend/src/app/(app)/documents/page.tsx` — Replaced placeholder with full implementation

**New files:**
- `apps/frontend/src/hooks/useDocuments.ts` — 7 React Query hooks
- `apps/frontend/src/components/documents/status-badge.tsx`
- `apps/frontend/src/components/documents/upload-zone.tsx`
- `apps/frontend/src/components/documents/document-card.tsx`
- `apps/frontend/src/components/documents/search-filter-bar.tsx`
- `apps/frontend/src/components/documents/finding-card.tsx`
- `apps/frontend/src/components/documents/risk-summary.tsx`
- `apps/frontend/src/components/documents/analysis-report.tsx`
- `apps/frontend/src/components/documents/extracted-text.tsx`
- `apps/frontend/src/components/documents/preview-placeholder.tsx`
- `apps/frontend/src/components/documents/delete-confirm-dialog.tsx`
- `apps/frontend/src/components/documents/document-detail.tsx`
- `apps/frontend/src/components/documents/document-list.tsx`
- `apps/frontend/src/components/documents/index.ts`
- `apps/frontend/src/app/(app)/documents/[id]/page.tsx`
- `apps/frontend/src/app/__tests__/documents-phase9.test.tsx`

---

### 10. HOOKS

All hooks in `apps/frontend/src/hooks/useDocuments.ts`:

| Hook | Type | Description |
|------|------|-------------|
| `useDocuments(params)` | Query | Paginated document list with filters |
| `useDocumentDetail(id)` | Query | Single document detail (enabled when id present) |
| `useDocumentStatus(id)` | Query | Status polling (refetch every 2s) |
| `useDocumentAnalysis(id)` | Query | Analysis report fetch |
| `useInitiateUpload()` | Mutation | Start upload, invalidates list on success |
| `useCompleteUpload()` | Mutation | Complete upload, invalidates list on success |
| `useRetryDocument()` | Mutation | Retry failed processing, invalidates detail/status/list |
| `useDeleteDocument()` | Mutation | Delete document, invalidates list on success |

---

### 11. MSW MOCK BEHAVIOR

The V1 document handlers simulate realistic behavior:

- **File validation**: rejects unsupported MIME types (400) and oversized files (400)
- **Upload flow**: initiate → returns upload URL → complete → returns `processing` status
- **Status polling**: returns incremental progress; `doc-lease-001`/completed docs return `ready`, `doc-nda-001` returns `processing` at 35%, `doc-failed-001` returns `failed` with `OCR_LOW_QUALITY`
- **Analysis**: `doc-lease-001` returns full report with 5 findings; unready docs return 409
- **Retry**: `doc-failed-001` retries successfully; `doc-lease-001` rejects (409) as already complete
- **Delete**: normal delete succeeds; `?fail=true` simulates server error
- **List**: supports `?search=`, `?status=`, `?sort=` parameters; `?fail=true` simulates server error
- **404/410**: unknown IDs return 404; `doc-deleted-001` returns 410 Gone

Scenario query parameters:
- `?fail=true` — simulate server error (on upload, list, delete, retry)
- `?gone=true` — simulate deleted document (410)
- `?notReady=true` — analysis not yet available (409)
- `?stage=processing` — override status to processing for testing

---

### 12. TESTS

Test file: `apps/frontend/src/app/__tests__/documents-phase9.test.tsx` — 40+ test cases organized into 18 describe blocks:

1. **File Validation** (5 tests) — accepted/rejected MIME types, max size
2. **Document List API** (4 tests) — list structure, filtering, search, error handling
3. **Upload Initiation** (3 tests) — valid request, unsupported format, size limit
4. **Upload Completion** (2 tests) — success, failure handling
5. **Document Status** (3 tests) — ready, processing, failed states
6. **Document Detail** (4 tests) — full detail, processing state, 404, 410
7. **Analysis Report** (2 tests) — findings structure, 409 not ready
8. **Retry Processing** (3 tests) — successful retry, invalid state, failure
9. **Delete Document** (2 tests) — success, failure
10. **Risk Level Contracts** (5 tests) — all 4 levels, finding fields, Persian titles, confidence
11. **Document Lifecycle** (3 tests) — 8 states, progression, terminal states
12. **Document Jobs** (3 tests) — complete jobs, failed jobs, running jobs
13. **Type Contracts** (4 tests) — V1DocumentListItem, V1DocumentDetail, V1DocumentUploadResponse, V1DocumentStatusResponse
14. **API Error Handling** (1 test) — error envelope format
15. **Document Filtering & Sorting** (3 tests) — all filter, ready filter, newest sort
16. **Sensitive Data Protection** (2 tests) — extracted text not in meta, no logs
17. **Responsive Behavior** (3 tests) — grid layout, touch targets, RTL
18. **Supported Formats** (3 tests) — PDF, DOCX, image formats

---

### 13. STATE COVERAGE

Each component handles these states:

| Component | Loading | Empty | Error | Edge Cases |
|-----------|:-------:|:-----:|:-----:|------------|
| DocumentList | Skeleton grid | "No documents" CTA | ErrorState + retry | No results for search |
| DocumentDetail | Full skeleton | "Not found" | ErrorState + retry | 410 deleted, missing id |
| UploadZone | — | Initial drop state | Validation errors | Drag hover, empty file |
| AnalysisReport | Skeleton | — | Error state | No report for processing docs |
| ExtractedText | Skeleton | "No text extracted" | — | Long text with scroll |
| RiskSummary | — | — | — | All 4 severity levels |
| FindingCard | — | — | — | Missing citation, low confidence |
| DeleteConfirmDialog | — | — | — | Loading during deletion |
| StatusBadge | — | — | — | All 8 document statuses |
| PreviewPlaceholder | — | Placeholder | — | PDF vs DOCX vs image icons |

---

### 14. ACCESSIBILITY

- All interactive elements have `aria-label` attributes in Persian
- Dialogs use `aria-modal="true"` and `role="dialog"`
- Status badges have `aria-label` for screen readers
- Error messages use `role="alert"`
- Progress bars use `role="progressbar"` with `aria-valuenow`
- Touch targets are minimum 44px (`touch-target` class)
- Keyboard navigation supported (Enter/Space on upload zone, Escape on dialogs)
- RTL layout throughout — `dir="rtl"` on content containers

---

### 15. SECURITY & PRIVACY

- Document content included in fixtures and MSW responses for testing
- No sensitive document text passed to `console.log` or analytics in production code
- Extracted text is only rendered in collapsible UI section, not exposed in metadata
- File validation happens on both client (before upload) and server (MSW mock)
- Delete requires explicit confirmation dialog
- Session validation via cookies on all endpoints

---

### 16. VERIFICATION CHECKLIST

- [x] `/documents` page renders with upload button
- [x] Upload dialog opens with drag-and-drop zone
- [x] File type validation rejects unsupported formats
- [x] File size validation rejects files > 25 MB
- [x] Upload progress displays during upload
- [x] Document appears in list after upload
- [x] Search filters documents by name
- [x] Status filter shows only matching documents
- [x] Document cards show correct status badges
- [x] `/documents/[id]` shows full document detail
- [x] Processing progress shows with stage indicators
- [x] Analysis report shows risk summary and findings
- [x] Each finding shows title, clause, risk level, explanation, recommendation
- [x] Retry button appears for failed documents
- [x] Delete confirmation dialog appears on delete click
- [x] Back navigation works from detail page
- [x] Empty states show appropriate CTAs
- [x] Error states show retry options
- [x] All findings have Persian titles (فسخ، جریمه، مالکیت، تعهدات، حل اختلاف)
- [x] Risk levels display with correct color coding
- [x] Mobile responsive layout (1 col → 3 col grid)
- [x] Test suite passes (40+ tests)

---

### 17. NEXT PHASE

Phase 10 will implement the **Contract Workspace** (`/contracts`, `/contracts/[id]`) for automated contract generation from structured inputs.
