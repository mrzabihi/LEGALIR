# DEMO CONTENT — Document Fixtures (اسناد من)

Six documents belonging to **امیر رضایی** (`7ff28cfa-ffac-4eab-9db3-07a4111d4bbd`),
covering every `DocumentStatus` branch: ready / processing / failed.

| id | name | mime | status | risk | findings | preview |
|----|------|------|--------|------|----------|---------|
| `doc-emp-001` | قرارداد-کار-و-تعهدات-بیمه.pdf | application/pdf | ready | critical | 5 | ✅ PDF |
| `doc-ctr-001` | قرارداد-پیمانکاری-خدمات-فنی.pdf | application/pdf | ready | medium | 3 | ✅ PDF |
| `doc-nda-001` | توافقنامه-محرمانگی-NDA.pdf | application/pdf | ready | medium | 2 | ✅ PDF |
| `doc-board-001` | صورتجلسه-هیئت-مدیره-رهام-پارس.docx | Word | ready | low | 1 | — |
| `doc-license-001` | درخواست-پروانه-کسب-و-مدارک.docx | Word | processing | — | — | — |
| `doc-check-001` | تصویر-چک-برگشتی.jpg | image/jpeg | failed | — | — | — |

## Analysis coverage

- `doc-emp-001`: 5 findings (1 critical — حق بیمه تأمین اجتماعی؛ 2 high — دوره
  آزمایشی و شرط عدم رقابت؛ 1 medium — اضافه‌کاری؛ 1 low — سند مالیاتی). Overall
  risk = **critical** (derived from highest severity finding).
- `doc-ctr-001`: 3 findings (جریمه تأخیر، سطح خدمات SLA، مالکیت مستندات). Risk =
  **medium**.
- `doc-nda-001`: 2 findings (دامنه اطلاعات محرمانه، جبران خسارت). Risk = **medium**.
- `doc-board-001`: 1 finding (امضای صورتجلسه). Risk = **low**.

## Processing lifecycle

- Ready docs carry four `completedJobs` (uploaded → processing → extracting →
  analyzing).
- `doc-license-001` carries `processingJobs` with `extracting` at 62% (running)
  and `analyzing` pending — exercising the polling/progress UI.
- `doc-check-001` carries `failedJobs` (`extracting` failed, `OCR_LOW_QUALITY`)
  — exercising the retry + error UI.

## Relationships

| source | relation | target |
|--------|----------|--------|
| `doc-emp-001` | analyzed-in | `conv-demo-001` |
| `doc-ctr-001` | analyzed-in | `conv-demo-002` |
| `cnt-emp-001` (contract) | generated-from | `doc-emp-001` |
| `cnt-ctr-001` (contract) | generated-from | `doc-ctr-001` |
| `cnt-nda-001` (contract) | generated-from | `doc-nda-001` |

## PDF preview & download

The three PDFs have real preview/download via `previewUrl` and
`/api/v1/documents/[id]/download`. Non-PDF documents (`previewUrl: null`) fall
back to the icon placeholder.
