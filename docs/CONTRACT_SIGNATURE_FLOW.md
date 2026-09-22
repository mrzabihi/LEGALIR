# جریان امضای الکترونیکی قرارداد (Contract Signature Flow)

> **قاعده بنیادین:** هر امضا به یک **نسخه غیرقابل‌تغییر** و **هش SHA-256** آن گره
> می‌خورد، نه به قرارداد قابل‌ویرایش. هیچ‌جای این جریان «موجر/مستأجر» یا هر نقش
> دامنه‌ای دیگری هاردکد نشده است.

---

## ۱. واژگان حقوقی (§۲۱)

| سطح | برچسب مجاز | چه زمانی |
|---|---|---|
| `ELECTRONIC_CONFIRMATION` | **تأیید و امضای الکترونیکی** | امضای OTP (امروز) |
| `SECURE_ELECTRONIC` | امضای الکترونیکی مطمئن | امضای گواهی‌محور (آینده) |
| `QUALIFIED` | امضای دیجیتال رسمی | امضای واجد شرایط (آینده) |

**ممنوع:** امضای OTP هرگز نباید «امضای الکترونیکی مطمئن» یا «امضای دیجیتال رسمی»
نامیده شود. تنها منبع متن، `signatureAssuranceLabelFa()` در
`lib/contracts/signature/index.ts` است.

---

## ۲. انتزاع SignatureProvider (§۲۲)

موتور چرخه عمر هرگز مستقیم با سرویس OTP حرف نمی‌زند؛ با یک `SignatureProvider`
حرف می‌زند:

```ts
interface SignatureProvider {
  readonly id: SignatureProviderId;
  assuranceLevel(): SignatureAssuranceLevel;
  requestChallenge(p: { subject: string; mobile: string }): ChallengeIssued;
  verifyChallenge(p: { subject: string; code: string }): ChallengeVerified;
  clearChallenge(subject: string): void;
}
```

- `OTP_SIGNATURE` تنها پیاده‌سازی امروز است (`otp-provider.ts`).
- افزودن `CERTIFICATE_SIGNATURE` فقط یک تغییر در `activeSignatureProvider()` است؛
  مسیرها، هوک‌ها و UI دست‌نخورده می‌مانند و تنها سطح اطمینان (و در نتیجه متن) عوض می‌شود.

---

## ۳. چهار عمل مسیر `/sign`

| action | چه می‌کند |
|---|---|
| `create_request` | نسخه جاری را **قفل** می‌کند (`createVersion`)، یک `SignatureRequest` باز می‌کند و برای هر طرف/مهمان یک `SignatureParticipant` می‌سازد |
| `request_otp` | برای یک شرکت‌کننده چالش می‌فرستد (موضوع = `requestId:participantId`) |
| `verify_otp` | کد را می‌سنجد، **یکپارچگی نسخه** را بازبینی می‌کند و امضا را ثبت می‌کند |
| `decline` | خودداری یک شرکت‌کننده را ثبت می‌کند |

---

## ۴. گام‌به‌گام

```
create_request
  ├─ isSignable(state)؟  (READY_TO_SIGN | PARTIALLY_SIGNED)
  ├─ درخواست در جریان نباشد
  ├─ createVersion()  →  version + documentHash
  ├─ SignatureRequest{ provider, assuranceLevel, expiresAt }
  ├─ SignatureParticipant[]  (party یا guest)
  └─ event: REQUEST_CREATED

request_otp
  ├─ participant.status !== SIGNED
  ├─ participant.mobile موجود باشد
  ├─ provider.requestChallenge()  →  rate-limit (۳ در ۵ دقیقه)
  └─ event: OTP_REQUESTED

verify_otp
  ├─ idempotent: اگر قبلاً امضا شده ⇒ همان وضعیت برگردد
  ├─ consentGiven === true  (هرگز پیش‌انتخاب‌شده)
  ├─ verifyVersionIntegrity(version)  →  عدم تطابق ⇒ INTEGRITY_FAILED + رد
  ├─ provider.verifyChallenge()  →  NO_CHALLENGE | EXPIRED | TOO_MANY_ATTEMPTS | INVALID_CODE
  ├─ participant.status = SIGNED
  ├─ ContractApproval{ method: "otp", comment: "تأیید و امضای الکترونیکی" }
  ├─ events: OTP_VERIFIED + SIGNED
  ├─ همه امضا کردند؟ ⇒ request COMPLETED + contract SIGNED
  │                     وگرنه ⇒ request PARTIALLY_SIGNED + contract PARTIALLY_SIGNED
  └─ event: REQUEST_COMPLETED (در صورت تکمیل)
```

---

## ۵. امنیت (§۸۰–۸۶)

| تهدید | دفاع |
|---|---|
| حدس کد | حداکثر ۵ تلاش، سپس چالش نابود می‌شود |
| ارسال انبوه کد | محدودیت نرخ ۳ درخواست در ۵ دقیقه برای هر موضوع |
| بازپخش کد | چالش **یک‌بارمصرف** است (پس از موفقیت حذف می‌شود) |
| ذخیره کد خام | فقط هش SHA-256 کد در حافظه می‌ماند؛ کد خام هرگز لاگ/ذخیره نمی‌شود |
| مقایسه غیرثابت‌زمان | `crypto.timingSafeEqual` |
| تولید کد ضعیف | `crypto.randomInt` (نه `Math.random`) |
| امضای دوباره | idempotent بر اساس (شرکت‌کننده، نسخه) |
| دستکاری محتوا | بازبینی هش نسخه پیش از هر امضا |
| امضای بدون رضایت | `consentGiven === true` الزامی + `consentVersion` |

**کد دمو:** در محیط توسعه کد ثابت `405405` پذیرفته می‌شود (همان قرارداد ورود)، تا
جریان بدون درگاه پیامک قابل‌آزمون باشد. در production کد تصادفی است.

---

## ۶. دعوت‌نامه‌ها (§۲۵–۲۸)

- توکن خام با `crypto.randomBytes(32)` ساخته و **یک‌بار** برگردانده می‌شود.
- تنها **هش SHA-256** توکن ذخیره می‌شود؛ نشت پایگاه‌داده قابل بازپخش نیست.
- انقضا پیش‌فرض ۷۲ ساعت؛ `verifyBeforeView` پیش‌فرض `true`.
- لغو با `DELETE` و پارامتر `invitationId` (وضعیت `REVOKED`).

---

## ۷. امضاکننده مهمان (§۲۷–۲۸)

`SignatureParticipant` یا به یک `partyId` وصل است یا فقط با `guestMobile` شناخته
می‌شود. موتور هر دو را **یکسان** می‌بیند؛ هیچ مسیر جداگانه‌ای برای مهمان وجود ندارد.

---

## ۸. وضعیت امضا ≠ وضعیت ثبت (§۸۷–۹۰)

`FULLY_SIGNED` هرگز به معنای `OFFICIALLY_REGISTERED` نیست. یک قرارداد فروش که در
لِگال‌آی‌آر کاملاً امضا شده، مالکیت را منتقل **نکرده** است؛ این کار فقط در دفتر
اسناد رسمی رخ می‌دهد. این دو محور در `deriveRegistrationStatus()` جدا نگه داشته
می‌شوند و هرگز ادغام نمی‌شوند.
