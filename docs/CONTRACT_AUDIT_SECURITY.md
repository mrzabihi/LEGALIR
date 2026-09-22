# حسابرسی و امنیت چرخه عمر قرارداد (Audit & Security)

> **قاعده بنیادین:** هر تغییر وضعیت یک **رویداد تغییرناپذیر** می‌سازد. رد حسابرسی
> مدل DocuSign/Adobe است: چه کسی، چه زمانی، کدام نسخه، با چه روش احراز هویتی.

---

## ۱. دو رد حسابرسی

| رد | جدول | دامنه |
|---|---|---|
| `SignatureEvent` | `contract-signature-events` | فقط فرایند امضا |
| `ContractAuditEntry` | `contract-audit` | کل چرخه عمر قرارداد |

هر دو **فقط افزودنی** هستند؛ هیچ رویدادی ویرایش یا حذف نمی‌شود.

---

## ۲. انواع رویداد امضا

```ts
type SignatureEventType =
  | "REQUEST_CREATED" | "REQUEST_SENT"
  | "INVITATION_SENT" | "INVITATION_REVOKED"
  | "DOCUMENT_VIEWED"
  | "OTP_REQUESTED" | "OTP_FAILED" | "OTP_VERIFIED"
  | "SIGNED" | "DECLINED"
  | "REQUEST_COMPLETED" | "REQUEST_EXPIRED" | "REQUEST_CANCELLED"
  | "INTEGRITY_FAILED";
```

هر رویداد این‌ها را حمل می‌کند:

```ts
interface SignatureEvent {
  participantId: string | null;
  type: SignatureEventType;
  descriptionFa: string;
  contractVersionId: string | null;   // نسخهٔ دقیق
  documentHash: string | null;        // هش نسخه در لحظهٔ رویداد
  authMethod: string | null;          // "OTP_SMS"
  clientFingerprint: string | null;   // اثر انگشت درشت — هرگز IP خام
  metadata: Record<string, unknown>;
  createdAt: string;
}
```

---

## ۳. امنیت سمت سرور (§۸۰–۸۶)

### ۳.۱ احراز هویت و مجوزدهی

- هر مسیر از `requireContract(request, id)` استفاده می‌کند که **مالک‌محور** است
  (کوکی `legalir-session`). قرارداد کاربر دیگر ⇒ ۴۰۴.
- هیچ مجوزدهی‌ای در کلاینت انجام نمی‌شود؛ UI فقط تصمیم می‌گیرد چه چیزی را
  **پیشنهاد** کند.

### ۳.۲ توکن‌ها

| مورد | پیاده‌سازی |
|---|---|
| توکن دعوت | `crypto.randomBytes(32)` — خام یک‌بار برگردانده می‌شود |
| ذخیرهٔ توکن | فقط هش SHA-256 (`tokenHash`) |
| انقضا | ۷۲ ساعت پیش‌فرض |
| لغو | وضعیت `REVOKED` + `revokedAt` |

### ۳.۳ کد یک‌بارمصرف

| مورد | پیاده‌سازی |
|---|---|
| تولید | `crypto.randomInt` |
| ذخیره | فقط هش SHA-256 کد |
| TTL | ۵ دقیقه |
| تلاش | حداکثر ۵، سپس نابودی چالش |
| نرخ | ۳ درخواست در ۵ دقیقه برای هر موضوع |
| بازپخش | یک‌بارمصرف (حذف پس از موفقیت) |
| مقایسه | `crypto.timingSafeEqual` |
| لاگ | کد خام هرگز لاگ نمی‌شود |

### ۳.۴ یکپارچگی سند

پیش از هر امضا، هش نسخه از snapshot ذخیره‌شده **دوباره محاسبه** و با هش ثبت‌شده
مقایسه می‌شود (`verifyVersionIntegrity`). عدم تطابق ⇒ رویداد `INTEGRITY_FAILED` و
رد امضا.

### ۳.۵ رضایت

- چک‌باکس رضایت **هرگز پیش‌انتخاب‌شده** نیست.
- `consentGiven === true` در سرور الزامی است.
- `consentVersion` + زمان در رویداد `SIGNED` ثبت می‌شود.

### ۳.۶ idempotency

`verify_otp` برای شرکت‌کنندهٔ قبلاً امضاشده، همان وضعیت را برمی‌گرداند
(`idempotent: true`) — یک درخواست تکراری نمی‌تواند دوبار امضا کند.

---

## ۴. جداسازی دامنه (§۳ / §۱۱۰)

مدل‌های موجود بازاستفاده شده‌اند؛ هیچ جدول موازی‌ای ساخته نشده است:

| مفهوم | جدول موجود |
|---|---|
| قرارداد | `property-contracts` |
| نسخه | `contract-versions` |
| طرف | `contract-parties` |
| تأیید محتوا | `contract-approvals` |
| حسابرسی | `contract-audit` |

جدول‌های **جدید** فقط برای شکاف‌های واقعی: `contract-signature-requests`,
`contract-signature-participants`, `contract-signature-events`,
`contract-signature-invitations`, `contract-review-comments`,
`contract-lawyer-reviews`, `contract-lawyer-findings`, `contract-ai-reviews`.

---

## ۵. پرچم‌های ویژگی (§۱۱۶)

| پرچم | پیش‌فرض | اثر |
|---|---|---|
| `CONTRACT_SIGNING_ENABLED` | `true` | امضای الکترونیکی |
| `LAWYER_REVIEW_ENABLED` | `true` | بررسی توسط وکیل |
| `AI_CONTRACT_REVIEW_ENABLED` | `true` | بررسی هوشمند |
| `CERTIFIED_SIGNATURE_ENABLED` | `false` | امضای گواهی‌محور (آینده) |

پرچم‌ها سمت **سرور** اعمال می‌شوند. یک پرچم فقط یک **گزینه** را حذف می‌کند، هرگز
یک **مجوز** نمی‌دهد.

---

## ۶. سازگاری عقب‌رو (§۱۱۵)

- پیش‌نویس‌های موجود دست‌نخورده می‌مانند؛ مهاجرت اجباری وجود ندارد.
- `ContractApproval{ method: "otp" }` همچنان معتبر است و به‌عنوان امضای تاریخی
  خوانده می‌شود؛ `SignatureRequest` فقط لایهٔ فرایندی روی آن است.
- مسیرهای موجود (`request_otp` / `verify_otp`) حفظ شده‌اند.
