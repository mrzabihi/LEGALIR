# بررسی هوشمند قرارداد (AI Contract Review)

> **قاعده بنیادین:** بررسی هوشمند یک **چت جداگانه** نیست. قرارداد به گفتگوی
> **موجود** لِگال‌آی‌آر **با ارجاع** وصل می‌شود (نه بارگذاری مجدد)، خط لولهٔ موجود
> پاسخ می‌دهد، و نتیجه به‌صراحت به‌عنوان «تحلیل هوش مصنوعی» برچسب می‌خورد — هرگز
> به‌عنوان نظر وکیل.

---

## ۱. جریان

```
POST /api/v1/property-contracts/[id]/ai-review
  ├─ پرچم AI_CONTRACT_REVIEW_ENABLED فعال باشد
  ├─ contract.currentVersionId موجود باشد
  ├─ resolveConversation(userId, contract, conversationId?)
  │     ├─ اگر conversationId داده شده و مالکش همین کاربر است ⇒ همان
  │     └─ وگرنه ⇒ گفتگوی جدید با عنوان «بررسی قرارداد {referenceCode}»
  ├─ classifyMessage(question, true)  →  دستهٔ حقوقی + پرچم‌های ریسک واقعی
  ├─ appendMessage(user)      →  پیام کاربر
  ├─ appendMessage(assistant) →  خلاصهٔ ساخت‌یافته
  ├─ insertAiReview(AiContractReview{ isAiAnalysis: true })
  └─ audit: ai_review.completed
```

پاسخ: `{ review, conversationId }` — UI کاربر را به `/chat/{conversationId}` می‌برد.

---

## ۲. اتصال با ارجاع، نه بارگذاری مجدد (§۶۳–۶۶)

قرارداد **دوباره آپلود نمی‌شود**. گفتگو فقط `contractId` و `contractVersionId` را
می‌شناسد و تحلیل روی همان نسخهٔ قفل‌شده انجام می‌شود. بنابراین:

- هیچ بایت اضافه‌ای ذخیره نمی‌شود؛
- تحلیل همیشه به نسخهٔ درست گره می‌خورد؛
- تغییر محتوا ⇒ تحلیل قدیمی به‌طور قابل‌مشاهده کهنه می‌شود.

---

## ۳. دید طرفین (§۶۷–۶۸)

`perspectiveRole` تعیین می‌کند تحلیل از دید کدام طرف نوشته شود:

```ts
const perspectiveRole = body.perspectiveRole ?? contract.initiatorRole;
const perspectiveRoleFa = partyRoleLabelFa(perspectiveRole);
```

نقش از **رجیستری** خوانده می‌شود؛ هیچ نقشی هاردکد نشده است. یک قرارداد می‌تواند
از دید هر طرف تحلیل شود.

---

## ۴. تفکیک «تحلیل هوش مصنوعی» از «نظر وکیل» (§۶۹–۷۰)

```ts
interface AiContractReview {
  isAiAnalysis: true;   // همیشه true — UI باید تفکیک را رندر کند
  perspectiveRoleFa: string;
  summaryFa: string;
  citations: { locator: string; title: string }[];
  conversationId: string;
  messageId: string | null;
}
```

خلاصهٔ ذخیره‌شده با این جمله آغاز می‌شود:

> این تحلیل هوش مصنوعی است و جایگزین نظر وکیل نیست.

UI در `review.tsx` این را در یک `Notice tone="info"` با عنوان «این تحلیل هوش
مصنوعی است» نشان می‌دهد. بررسی وکیل و بررسی هوشمند دو کارت **جدا** هستند و هرگز
با هم ادغام نمی‌شوند.

---

## ۵. خط لولهٔ موجود، نه یک موتور جدید

`classifyMessage(question, true)` از `lib/ai/pipeline/classify.ts` استفاده می‌شود —
همان خط لوله‌ای که چت معمولی استفاده می‌کند. بنابراین بررسی، یک دستهٔ حقوقی و
سیگنال ریسک **واقعی** حمل می‌کند، نه ساختگی.

---

## ۶. پرچم ویژگی

`AI_CONTRACT_REVIEW_ENABLED` (پیش‌فرض `true`). وقتی خاموش باشد، مسیر با
`FEATURE_DISABLED` پاسخ می‌دهد و `lifecycle-view` مقدار `aiReview` را `null`
می‌کند.
