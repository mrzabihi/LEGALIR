# بررسی قرارداد توسط وکیل (Lawyer Review)

> **قاعده بنیادین:** وکیل هرگز قرارداد را بی‌صدا ویرایش نمی‌کند. یافتهٔ وکیل یک
> **پیشنهاد** است که کاربر آن را می‌پذیرد یا رد می‌کند؛ پذیرش پیشنهاد از مسیر
> عادی ویرایش، **نسخه جدید** می‌سازد. بنابراین برتری نسخه هرگز نقض نمی‌شود.

---

## ۱. چرخه وضعیت

```
REQUESTED → MATCHING → AWAITING_ACCEPTANCE → ACCEPTED → IN_PROGRESS → COMPLETED
                    ↘ DECLINED / EXPIRED / CANCELLED
```

| وضعیت | معنی |
|---|---|
| `REQUESTED` | درخواست ثبت شد |
| `MATCHING` | در حال یافتن وکیل |
| `AWAITING_ACCEPTANCE` | در انتظار پذیرش وکیل |
| `ACCEPTED` | پذیرفته‌شده — **اینجا ساعت SLA شروع می‌شود** |
| `IN_PROGRESS` | در حال بررسی |
| `COMPLETED` | بررسی تکمیل شد |
| `DECLINED` / `EXPIRED` / `CANCELLED` | پایانی |

---

## ۲. تطبیق وکیل (§۴۵–۵۰)

تطبیق بر اساس **تخصص** انجام می‌شود:

```ts
listLawyerProfiles().find(
  (l) =>
    l.verificationStatus === "VERIFIED" &&
    l.acceptingRequests &&
    l.specializations.some((s) => s.category === category)
)
```

- دستهٔ حقوقی از `body.category ?? contract.domain` می‌آید.
- اگر وکیلی پیدا شود ⇒ `AWAITING_ACCEPTANCE`؛ وگرنه ⇒ `MATCHING`.
- هیچ وکیلی هاردکد نشده است.

---

## ۳. SLA ذخیره‌شده، نه هاردکد (§۵۱–۵۵)

- `slaHours` روی خود درخواست **ذخیره** می‌شود (پیش‌فرض ۴۸).
- ساعت SLA در `ACCEPTED` شروع می‌شود: `slaStartedAt = now`, `slaDueAt = now + slaHours`.
- درخواستی که بی‌پاسخ می‌ماند، SLA را نمی‌سوزاند.

---

## ۴. پنج عمل مسیر `/lawyer-review`

| action | چه می‌کند |
|---|---|
| `create` | درخواست را باز می‌کند و وکیل را تطبیق می‌دهد |
| `accept` | وکیل می‌پذیرد؛ ساعت SLA شروع می‌شود |
| `complete` | خلاصهٔ نظر + یافته‌ها ثبت می‌شود؛ وضعیت `COMPLETED` |
| `decide_finding` | کاربر یک یافته را می‌پذیرد یا رد می‌کند |
| `cancel` | کاربر درخواست را پس می‌گیرد |

---

## ۵. یافته‌ها (§۵۶–۶۲)

```ts
interface LawyerReviewFinding {
  kind: "risk" | "missing_clause" | "ambiguous" | "unfair_term" | "suggestion";
  severity: "info" | "low" | "medium" | "high" | "critical";
  titleFa: string;
  bodyFa: string;
  clauseRef: string | null;      // بند مرجع
  proposedText: string | null;   // متن پیشنهادی وکیل
  decision: "pending" | "accepted" | "rejected";
}
```

**جریان پذیرش پیشنهاد:**

```
وکیل یافته را ثبت می‌کند (decision = pending)
        ↓
کاربر «پذیرش پیشنهاد» یا «رد پیشنهاد» را می‌زند
        ↓
پذیرش ⇒ از مسیر عادی ویرایش، نسخه جدید ساخته می‌شود
        ↓
نسخه جدید ⇒ امضاهای قبلی باطل می‌شوند (invalidateApprovalsForOtherVersions)
```

هیچ مسیری وجود ندارد که وکیل مستقیم محتوا را عوض کند.

---

## ۶. حالت بازدارنده / غیربازدارنده (§۵۸)

| حالت | `blocksSigning` | اثر |
|---|---|---|
| `BLOCKING` | `true` | تا تکمیل بررسی، امضا ممکن نیست |
| `NON_BLOCKING` | `false` | امضا می‌تواند هم‌زمان ادامه یابد |

در `lifecycle-view.ts`:

```ts
const lawyerBlocks = !!lawyerReview && lawyerReview.blocksSigning;
const canSign = isSignable(contract.state) && !!signatureRequest && !lawyerBlocks;
```

---

## ۷. اتصال به نسخه

`LawyerReviewRequest` به `contractVersionId` و `documentHash` گره می‌خورد. تغییر
محتوا ⇒ بررسی روی نسخهٔ قدیمی بی‌اعتبار می‌شود، دقیقاً مانند امضا.

---

## ۸. پرچم ویژگی

`LAWYER_REVIEW_ENABLED` (پیش‌فرض `true`). وقتی خاموش باشد، مسیر با
`FEATURE_DISABLED` پاسخ می‌دهد و `lifecycle-view` مقدار `lawyerReview` را `null`
می‌کند. پرچم فقط یک گزینه را حذف می‌کند، نه یک مجوز را.
