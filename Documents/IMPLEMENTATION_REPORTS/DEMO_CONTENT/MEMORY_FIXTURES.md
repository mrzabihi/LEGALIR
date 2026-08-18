# DEMO CONTENT — Memory Fixtures (حافظه)

Seven structured memories for **امیر رضایی**, all with `consentGiven: true`.

| id | key | category | sensitivity | value |
|----|-----|----------|-------------|-------|
| `mem-001` | نام کاربر | profile | normal | امیر رضایی |
| `mem-002` | شرکت | profile | normal | شرکت خدمات فنی و مهندسی رهام پارس |
| `mem-003` | ترجیح زبان پاسخ | preference | normal | فارسی ساده و روان، با استناد به مواد قانونی |
| `mem-004` | قراردادهای فعال | legal_context | sensitive | قرارداد استخدام مدیر فنی، پیمانکاری خدمات فنی و توافقنامه محرمانگی |
| `mem-005` | پرونده جاری | legal_context | highly_sensitive | اختلاف با پیمانکار شبکه درباره تأخیر در رفع اشکال — در حال مذاکره |
| `mem-006` | محل دفتر شرکت | profile | normal | تهران، خیابان ولیعصر، بالاتر از میدان ونک، برج رهام، طبقه ششم |
| `mem-007` | تعهد بیمه تأمین اجتماعی | legal_context | normal | کارفرما مکلف به بیمه کارکنان از تاریخ شروع به کار است |

## Coverage

- **Categories**: profile (3), preference (1), legal_context (3).
- **Sensitivity**: normal (5), sensitive (1), highly_sensitive (1).
- **Consent**: all `consentGiven: true` with a `consentDate`.

## Relationships

| source | relation | target |
|--------|----------|--------|
| `mem-004` | references | `cnt-emp-001` |
| `mem-005` | references | `cnt-ctr-001` |

## API behaviour

- `GET /api/v1/memories` filters out `status: "deleted"` rows and returns
  `memoryEnabled` derived from `preferences.privacy.storeConversationHistory`.
- `PATCH /api/v1/memories/[id]` updates key/value/status.
- `DELETE /api/v1/memories/[id]` soft-deletes (status → `"deleted"`).
