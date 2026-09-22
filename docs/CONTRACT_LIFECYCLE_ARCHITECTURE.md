# معماری چرخه عمر قرارداد (Universal Contract Lifecycle Engine)

> **قاعده بنیادین:** نوع قرارداد محتوا را تعیین می‌کند؛ موتور چرخه عمر تعیین می‌کند
> که پس از ساخته‌شدن محتوا چه اتفاقی می‌افتد. هیچ جریان امضای مخصوص یک نوع قرارداد
> وجود ندارد و هیچ‌جای موتور، «موجر/مستأجر» هاردکد نشده است.

---

## ۱. چرخه عمر

```
اطلاعات ✓ → پیش‌نمایش ✓ → بررسی ● → امضا ○ → تکمیل ○
```

| مرحله | `ContractLifecycleStage` | حالت‌های قرارداد |
|---|---|---|
| اطلاعات | `INFO` | `DRAFT`, `PARTIES_PENDING`, `PROPERTY_PENDING`, `DOCUMENTS_PENDING`, `TERMS_PENDING` |
| پیش‌نمایش | `PREVIEW` | (همان حالت‌های اطلاعات، وقتی `completeness.overall === 100`) |
| بررسی | `REVIEW` | `READY_FOR_REVIEW`, `COUNTERPARTY_REVIEW`, `CHANGES_REQUESTED` |
| امضا | `SIGNATURE` | `READY_TO_SIGN`, `PARTIALLY_SIGNED` |
| تکمیل | `COMPLETE` | `SIGNED`, `READY_FOR_OFFICIAL_REGISTRATION`, `FINALIZED`, `ARCHIVED` |

مرحله از **حالت واقعی قرارداد** مشتق می‌شود (`lib/contracts/lifecycle.ts`)، نه از
اینکه کاربر روی چه دکمه‌ای کلیک کرده است.

---

## ۲. جداسازی دامنه (§۳ / §۱۱۰)

مدل‌های موجود **بازاستفاده** شده‌اند و مدل‌های جدید فقط برای شکاف‌های واقعی اضافه شده‌اند:

| مفهوم خواسته‌شده | پیاده‌سازی |
|---|---|
| Contract | `PropertyContract` (موجود) |
| ContractVersion | `PropertyContractVersion` + `snapshot.ts` (موجود) |
| ContractParty | `ContractParty` (موجود) |
| ContractReview | `ContractApproval` + `ContractReviewComment` (جدید) |
| LawyerReview | `LawyerReviewRequest` + `LawyerReviewFinding` (جدید) |
| SignatureRequest | `SignatureRequest` (جدید) |
| SignatureParticipant | `SignatureParticipant` (جدید) |
| SignatureEvent | `SignatureEvent` (جدید) |
| ContractAuditEvent | `ContractAuditEntry` (موجود) |
| GeneratedDocument | `PropertyContractVersion` + `pdf.ts` (موجود) |

هیچ‌کدام از این‌ها جایگزین دیگری نیست: `ContractApproval` تأیید محتواست،
`SignatureRequest` فرایند امضاست، و `SignatureEvent` رد حسابرسی.

---

## ۳. برتری نسخه (§۱۴–۱۶)

- هر امضا به `contractVersionId` **و** `documentHash` گره می‌خورد.
- تغییر محتوا → `createVersion` → `invalidateApprovalsForOtherVersions` → همه
  امضاهای قبلی باطل می‌شوند.
- پیش از امضا، هش نسخه دوباره محاسبه و با هش ثبت‌شده مقایسه می‌شود
  (`verifyVersionIntegrity`). عدم تطابق ⇒ امضا رد می‌شود.
- نسخه پیش از امضا **قفل** می‌شود (`isEditable` روی حالت‌های امضا `false` است).

---

## ۴. لایه‌ها

```
UI (review.tsx → LifecycleStepper + سه انتخاب اصلی)
  │
  ├─ hooks/useContractLifecycle.ts        (React Query)
  │
  └─ API  /api/v1/property-contracts/[id]/
        ├─ sign/            ← SignatureProvider (OTP v1)
        ├─ review/          ← تأیید + کامنت
        ├─ lawyer-review/   ← درخواست/پذیرش/نتیجه وکیل
        ├─ invitations/     ← توکن دعوت هش‌شده
        └─ ai-review/       ← اتصال قرارداد به چت موجود (با ارجاع)
  │
  └─ lib/contracts/
        ├─ lifecycle.ts          مشتق‌سازی مرحله
        ├─ feature-flags.ts      پرچم‌های §۱۱۶
        ├─ signature/
        │    ├─ provider.ts      انتزاع SignatureProvider
        │    ├─ otp-provider.ts  پیاده‌سازی OTP v1
        │    ├─ db.ts            جدول‌های امضا/دعوت
        │    └─ integrity.ts     بازبینی هش نسخه
        ├─ review-db.ts          کامنت‌ها + درخواست وکیل + یافته‌ها + بررسی هوشمند
        └─ lifecycle-view.ts     مونتاژ نمای چرخه عمر
```

مستندات مرتبط: `CONTRACT_SIGNATURE_FLOW.md`، `CONTRACT_LAWYER_REVIEW.md`،
`CONTRACT_AI_REVIEW.md`، `CONTRACT_AUDIT_SECURITY.md`،
`CONTRACT_LIFECYCLE_TEST_PLAN.md`.

---

## ۵. پرچم‌های ویژگی (§۱۱۶)

| پرچم | پیش‌فرض | اثر |
|---|---|---|
| `CONTRACT_SIGNING_ENABLED` | `true` | امضای الکترونیکی |
| `LAWYER_REVIEW_ENABLED` | `true` | بررسی توسط وکیل |
| `AI_CONTRACT_REVIEW_ENABLED` | `true` | پرسش از دستیار هوشمند |
| `CERTIFIED_SIGNATURE_ENABLED` | `false` | امضای گواهی‌شده (آینده) |

پرچم‌ها در `lib/contracts/feature-flags.ts` از متغیر محیطی خوانده می‌شوند و
سمت سرور اعمال می‌گردند؛ UI فقط برای پنهان‌کردن دکمه از آن‌ها استفاده می‌کند.

---

## ۶. سازگاری عقب‌رو (§۱۱۵)

- پیش‌نویس‌های موجود دست‌نخورده می‌مانند: هیچ مهاجرت اجباری‌ای وجود ندارد.
- `ContractApproval` با `method: "otp"` همچنان معتبر است و به‌عنوان امضای
  تاریخی خوانده می‌شود؛ `SignatureRequest` فقط لایه فرایندی روی آن است.
- مسیرهای API موجود (`request_otp` / `verify_otp`) حفظ شده‌اند.
