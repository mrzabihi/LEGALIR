# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase12-accessibility.spec.ts >> Phase 12 — Accessibility & Responsive >> Mobile menu >> Mobile menu closes on backdrop click
- Location: e2e\phase12-accessibility.spec.ts:185:9

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('.bg-scrim')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - link "پرش به محتوای اصلی" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - link "LEGALIR — صفحه اصلی" [ref=e6] [cursor=pointer]:
          - /url: /
          - img "LEGALIR" [ref=e7]
        - button "باز کردن منو" [expanded] [active] [ref=e9] [cursor=pointer]
      - dialog "منوی موبایل" [ref=e12]:
        - generic [ref=e14]:
          - generic [ref=e15]:
            - img "LEGALIR" [ref=e17]
            - button "بستن منو" [ref=e18] [cursor=pointer]
          - navigation "منوی موبایل" [ref=e21]:
            - link "صفحه اصلی" [ref=e22] [cursor=pointer]:
              - /url: /
            - link "قابلیت‌ها" [ref=e23] [cursor=pointer]:
              - /url: /features
            - link "تعرفه‌ها" [ref=e24] [cursor=pointer]:
              - /url: /pricing
            - link "وبلاگ حقوقی" [ref=e25] [cursor=pointer]:
              - /url: /blog
            - link "درباره ما" [ref=e26] [cursor=pointer]:
              - /url: /about
            - link "تماس با ما" [ref=e27] [cursor=pointer]:
              - /url: /contact
            - paragraph [ref=e29]: خدمات پرکاربرد
            - link "مشاوره حقوقی" [ref=e30] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
            - link "تحلیل سند" [ref=e32] [cursor=pointer]:
              - /url: /auth/mobile?intent=document
            - link "تولید قرارداد" [ref=e34] [cursor=pointer]:
              - /url: /auth/mobile?intent=contract
          - link "ورود / ثبت‌نام" [ref=e37] [cursor=pointer]:
            - /url: /auth/mobile
    - main [ref=e38]:
      - generic [ref=e39]:
        - generic [ref=e43]:
          - img "LEGALIR" [ref=e46]
          - generic [ref=e47]: خدمات تخصصی حقوقی با پشتیبانی هوش مصنوعی و منابع حقوقی
          - heading "دستیار هوشمند حقوقی ایران" [level=1] [ref=e52]
          - paragraph [ref=e53]: خدمات تخصصی حقوقی با بهره‌گیری از هوش مصنوعی، منابع حقوقی و مدل زبانی تخصصی لیگالیر — تحلیل ساختاریافته پرونده‌ها، قراردادها و مسائل حقوقی
          - generic [ref=e54]:
            - link "شروع مشاوره حقوقی" [ref=e55] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
            - link "مشاهده قابلیت‌ها" [ref=e56] [cursor=pointer]:
              - /url: /features
          - paragraph [ref=e57]: دانش حقوقی، تحلیل هوشمند و منابع مستند؛ یکپارچه در لیگالیر
        - generic [ref=e62]:
          - generic [ref=e63]:
            - generic [ref=e67]: ۳+
            - generic [ref=e68]: خدمات اصلی
          - generic [ref=e69]:
            - generic [ref=e73]: ۲۰+
            - generic [ref=e74]: حوزه حقوقی
          - generic [ref=e75]:
            - generic [ref=e79]: ۲۴/۷
            - generic [ref=e80]: دسترسی آنلاین
        - generic [ref=e81]:
          - generic [ref=e82]:
            - heading "خدمات هوشمند لیگالیر" [level=2] [ref=e83]
            - paragraph [ref=e84]: سه سرویس تخصصی مبتنی بر هوش مصنوعی حقوقی — آموزش‌دیده بر نظام حقوقی ایران
          - generic [ref=e85]:
            - link "اطلاعات AI مشاوره حقوقی با هوش مصنوعی پرسش حقوقی خود را به زبان ساده مطرح کنید و تحلیل دقیق با استناد به مواد قانونی و آرای وحدت رویه دریافت کنید" [ref=e86] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - generic [ref=e87]: اطلاعات AI
              - heading "مشاوره حقوقی با هوش مصنوعی" [level=3] [ref=e92]
              - paragraph [ref=e93]: پرسش حقوقی خود را به زبان ساده مطرح کنید و تحلیل دقیق با استناد به مواد قانونی و آرای وحدت رویه دریافت کنید
            - link "کمک حقوقی تحلیل هوشمند اسناد قراردادها و اسناد حقوقی خود را بارگذاری کنید و بندهای پرریسک با گزارش تحلیل دقیق و شناسایی ریسک دریافت کنید" [ref=e94] [cursor=pointer]:
              - /url: /auth/mobile?intent=document
              - generic [ref=e95]: کمک حقوقی
              - heading "تحلیل هوشمند اسناد" [level=3] [ref=e100]
              - paragraph [ref=e101]: قراردادها و اسناد حقوقی خود را بارگذاری کنید و بندهای پرریسک با گزارش تحلیل دقیق و شناسایی ریسک دریافت کنید
            - link "پیش‌نویس خودکار تولید پیش‌نویس قرارداد با پاسخ به پرسش‌نامه گام‌به‌گام، پیش‌نویس قرارداد شخصی‌سازی‌شده مطابق با آخرین قوانین ایران دریافت کنید" [ref=e102] [cursor=pointer]:
              - /url: /auth/mobile?intent=contract
              - generic [ref=e103]: پیش‌نویس خودکار
              - heading "تولید پیش‌نویس قرارداد" [level=3] [ref=e108]
              - paragraph [ref=e109]: با پاسخ به پرسش‌نامه گام‌به‌گام، پیش‌نویس قرارداد شخصی‌سازی‌شده مطابق با آخرین قوانین ایران دریافت کنید
        - generic [ref=e111]:
          - generic [ref=e112]:
            - generic [ref=e113]: نمونه پرسش‌های واقعی
            - heading "لیگالیر چه سوالاتی را پاسخ می‌دهد؟" [level=2] [ref=e116]
            - paragraph [ref=e117]: اینها نمونه‌هایی از پرسش‌های واقعی حقوقی هستند که می‌توانید از لیگالیر بپرسید. هر پاسخ همراه با استناد دقیق به مواد قانونی و آرای قضایی ارائه می‌شود.
          - generic [ref=e118]:
            - link "اگر مستأجر اجاره را پرداخت نکند، صاحبخانه چه اقداماتی می‌تواند انجام دهد؟ مالک و مستأجر ماده ۴۹۴ قانون مدنی" [ref=e119] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - generic [ref=e123]:
                - paragraph [ref=e124]: اگر مستأجر اجاره را پرداخت نکند، صاحبخانه چه اقداماتی می‌تواند انجام دهد؟
                - generic [ref=e125]:
                  - generic [ref=e126]: مالک و مستأجر
                  - generic [ref=e127]: ماده ۴۹۴ قانون مدنی
            - link "چک برگشتی دارم — چطور می‌توانم وجه آن را مطالبه کنم؟ مطالبه وجه قانون صدور چک" [ref=e128] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - generic [ref=e132]:
                - paragraph [ref=e133]: چک برگشتی دارم — چطور می‌توانم وجه آن را مطالبه کنم؟
                - generic [ref=e134]:
                  - generic [ref=e135]: مطالبه وجه
                  - generic [ref=e136]: قانون صدور چک
            - link "وجه‌الالتزام در قرارداد چیست و چه زمانی قابل مطالبه است؟ قراردادها ماده ۲۳۰ قانون مدنی" [ref=e137] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - generic [ref=e141]:
                - paragraph [ref=e142]: وجه‌الالتزام در قرارداد چیست و چه زمانی قابل مطالبه است؟
                - generic [ref=e143]:
                  - generic [ref=e144]: قراردادها
                  - generic [ref=e145]: ماده ۲۳۰ قانون مدنی
            - link "برای درخواست طلاق توافقی چه مدارکی لازم است و چقدر طول می‌کشد؟ خانواده قانون حمایت خانواده" [ref=e146] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - generic [ref=e150]:
                - paragraph [ref=e151]: برای درخواست طلاق توافقی چه مدارکی لازم است و چقدر طول می‌کشد؟
                - generic [ref=e152]:
                  - generic [ref=e153]: خانواده
                  - generic [ref=e154]: قانون حمایت خانواده
            - link "خسارت تأخیر تأدیه چطور محاسبه می‌شود و نرخ آن چقدر است؟ خسارت ماده ۵۲۲ آیین دادرسی مدنی" [ref=e155] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - generic [ref=e159]:
                - paragraph [ref=e160]: خسارت تأخیر تأدیه چطور محاسبه می‌شود و نرخ آن چقدر است؟
                - generic [ref=e161]:
                  - generic [ref=e162]: خسارت
                  - generic [ref=e163]: ماده ۵۲۲ آیین دادرسی مدنی
            - link "برای تنظیم یک قرارداد اجاره مطمئن چه نکاتی را باید رعایت کنم؟ قراردادها قانون روابط موجر و مستأجر" [ref=e164] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - generic [ref=e168]:
                - paragraph [ref=e169]: برای تنظیم یک قرارداد اجاره مطمئن چه نکاتی را باید رعایت کنم؟
                - generic [ref=e170]:
                  - generic [ref=e171]: قراردادها
                  - generic [ref=e172]: قانون روابط موجر و مستأجر
          - link "پرسش خود را مطرح کنید" [ref=e174] [cursor=pointer]:
            - /url: /auth/mobile?intent=chat
        - generic [ref=e177]:
          - generic [ref=e178]:
            - generic [ref=e179]: موضوعات حقوقی
            - heading "موضوعات پرکاربرد حقوقی" [level=2] [ref=e182]
            - paragraph [ref=e183]: لیگالیر در حوزه‌های متنوع حقوقی آموزش دیده است. هر حوزه شامل منابع قانونی، آرای قضایی و تحلیل تخصصی مرتبط می‌باشد.
          - generic [ref=e184]:
            - link "مالک و مستأجر قوانین اجاره، تخلیه، تعدیل اجاره‌بها، ودیعه و تعهدات طرفین اجاره تخلیه ودیعه سرقفلی" [ref=e185] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - generic [ref=e187]:
                - generic [ref=e188]: 🏠
                - generic [ref=e189]:
                  - heading "مالک و مستأجر" [level=3] [ref=e190]
                  - paragraph [ref=e191]: قوانین اجاره، تخلیه، تعدیل اجاره‌بها، ودیعه و تعهدات طرفین
              - generic [ref=e192]:
                - generic [ref=e193]: اجاره
                - generic [ref=e194]: تخلیه
                - generic [ref=e195]: ودیعه
                - generic [ref=e196]: سرقفلی
            - link "مطالبه وجه و خسارت چک برگشتی، سفته، خسارت تأخیر تأدیه، وجه‌الالتزام قراردادی چک سفته خسارت تأخیر تأدیه" [ref=e197] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - generic [ref=e199]:
                - generic [ref=e200]: 💰
                - generic [ref=e201]:
                  - heading "مطالبه وجه و خسارت" [level=3] [ref=e202]
                  - paragraph [ref=e203]: چک برگشتی، سفته، خسارت تأخیر تأدیه، وجه‌الالتزام قراردادی
              - generic [ref=e204]:
                - generic [ref=e205]: چک
                - generic [ref=e206]: سفته
                - generic [ref=e207]: خسارت
                - generic [ref=e208]: تأخیر تأدیه
            - link "قراردادها و تعهدات تنظیم، بررسی و تفسیر قراردادهای ملکی، تجاری، پیمانکاری و استخدام قرارداد تعهدات فسخ وجه‌الالتزام" [ref=e209] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - generic [ref=e211]:
                - generic [ref=e212]: 📝
                - generic [ref=e213]:
                  - heading "قراردادها و تعهدات" [level=3] [ref=e214]
                  - paragraph [ref=e215]: تنظیم، بررسی و تفسیر قراردادهای ملکی، تجاری، پیمانکاری و استخدام
              - generic [ref=e216]:
                - generic [ref=e217]: قرارداد
                - generic [ref=e218]: تعهدات
                - generic [ref=e219]: فسخ
                - generic [ref=e220]: وجه‌الالتزام
            - link "حقوق خانواده ازدواج، طلاق، مهریه، نفقه، حضانت، ارث و وصیت مهریه طلاق حضانت ارث" [ref=e221] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - generic [ref=e223]:
                - generic [ref=e224]: 👨‍👩‍👧
                - generic [ref=e225]:
                  - heading "حقوق خانواده" [level=3] [ref=e226]
                  - paragraph [ref=e227]: ازدواج، طلاق، مهریه، نفقه، حضانت، ارث و وصیت
              - generic [ref=e228]:
                - generic [ref=e229]: مهریه
                - generic [ref=e230]: طلاق
                - generic [ref=e231]: حضانت
                - generic [ref=e232]: ارث
            - link "شرکت‌ها و تجارت ثبت شرکت، اساسنامه، سهام، قراردادهای تجاری، ورشکستگی شرکت تجارت سهام ورشکستگی" [ref=e233] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - generic [ref=e235]:
                - generic [ref=e236]: 🏢
                - generic [ref=e237]:
                  - heading "شرکت‌ها و تجارت" [level=3] [ref=e238]
                  - paragraph [ref=e239]: ثبت شرکت، اساسنامه، سهام، قراردادهای تجاری، ورشکستگی
              - generic [ref=e240]:
                - generic [ref=e241]: شرکت
                - generic [ref=e242]: تجارت
                - generic [ref=e243]: سهام
                - generic [ref=e244]: ورشکستگی
            - link "آیین دادرسی و دعاوی تنظیم دادخواست، اظهارنامه، لایحه دفاعیه و پیگیری پرونده دادخواست اظهارنامه لایحه دادرسی" [ref=e245] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - generic [ref=e247]:
                - generic [ref=e248]: ⚖️
                - generic [ref=e249]:
                  - heading "آیین دادرسی و دعاوی" [level=3] [ref=e250]
                  - paragraph [ref=e251]: تنظیم دادخواست، اظهارنامه، لایحه دفاعیه و پیگیری پرونده
              - generic [ref=e252]:
                - generic [ref=e253]: دادخواست
                - generic [ref=e254]: اظهارنامه
                - generic [ref=e255]: لایحه
                - generic [ref=e256]: دادرسی
        - generic [ref=e258]:
          - generic [ref=e259]:
            - heading "لیگالیر چطور کار می‌کند؟" [level=2] [ref=e260]
            - paragraph [ref=e261]: سه گام ساده برای دریافت تحلیل حقوقی — از طرح موضوع تا دریافت راهنمایی تخصصی
          - generic [ref=e264]:
            - generic [ref=e265]:
              - generic [ref=e266]: ۰۱
              - generic [ref=e268]:
                - heading "طرح موضوع حقوقی" [level=3] [ref=e269]
                - paragraph [ref=e270]: موضوع یا پرسش حقوقی خود را به زبان ساده و محاوره‌ای توضیح دهید — مانند صحبت با یک مشاور
            - generic [ref=e271]:
              - generic [ref=e272]: ۰۲
              - generic [ref=e274]:
                - heading "تحلیل تخصصی هوش مصنوعی" [level=3] [ref=e275]
                - paragraph [ref=e276]: هسته تخصصی لیگالیر با استناد به قوانین، آرای وحدت رویه و بخشنامه‌های معتبر، موضوع شما را تحلیل می‌کند
            - generic [ref=e277]:
              - generic [ref=e278]: ۰۳
              - generic [ref=e280]:
                - heading "دریافت راهنمایی" [level=3] [ref=e281]
                - paragraph [ref=e282]: تحلیل تفصیلی با ارجاع دقیق دریافت کنید و در صورت نیاز، برای مشاوره تخصصی به وکیل ارجاع شوید
        - generic [ref=e283]:
          - generic [ref=e284]:
            - generic [ref=e285]: منابع معتبر حقوقی
            - heading "منابع حقوقی تحت پوشش" [level=2] [ref=e288]
            - paragraph [ref=e289]: لیگالیر بر پایه قوانین، مقررات و آرای معتبر نظام حقوقی ایران آموزش دیده است. هر پاسخ با ارجاع دقیق به منبع اصلی همراه می‌باشد.
          - generic [ref=e290]:
            - generic [ref=e291]:
              - generic [ref=e293]:
                - heading "قانون مدنی" [level=3] [ref=e294]
                - paragraph [ref=e295]: منبع اصلی حقوق خصوصی ایران — شامل احکام عقود، تعهدات، اموال و مالکیت
              - generic [ref=e296]:
                - generic [ref=e297]: ۱۳۳۵ ماده
                - generic [ref=e298]: مصوب ۱۳۰۷
            - generic [ref=e299]:
              - generic [ref=e301]:
                - heading "آیین دادرسی مدنی" [level=3] [ref=e302]
                - paragraph [ref=e303]: قواعد شکلی رسیدگی به دعاوی حقوقی در دادگاه‌های عمومی و انقلاب
              - generic [ref=e304]:
                - generic [ref=e305]: ۵۲۹ ماده
                - generic [ref=e306]: مصوب ۱۳۷۹
            - generic [ref=e307]:
              - generic [ref=e309]:
                - heading "قانون تجارت" [level=3] [ref=e310]
                - paragraph [ref=e311]: مقررات مربوط به شرکت‌های تجاری، اسناد تجاری، ورشکستگی و امور بازرگانی
              - generic [ref=e312]:
                - generic [ref=e313]: ۶۰۰ ماده
                - generic [ref=e314]: مصوب ۱۳۱۱
            - generic [ref=e315]:
              - generic [ref=e317]:
                - heading "آرای وحدت رویه" [level=3] [ref=e318]
                - paragraph [ref=e319]: تصمیمات هیأت عمومی دیوان عالی کشور برای ایجاد رویه واحد قضایی
              - generic [ref=e320]:
                - generic [ref=e321]: ۸۵۰+ رأی
                - generic [ref=e322]: مصوب جاری
        - generic [ref=e323]:
          - generic [ref=e324]:
            - generic [ref=e325]: مجله و آموزش حقوقی لیگالیر
            - heading "مجله و آموزش حقوقی لیگالیر" [level=2] [ref=e328]
            - paragraph [ref=e329]: راهنماهای کاربردی، قوانین، آرای مهم و تحلیل موضوعات حقوقی — بر پایه منابع ساختاریافته حقوقی
          - generic [ref=e330]:
            - link "قراردادها ۱۲ دقیقه مطالعه وجه‌الالتزام در قراردادها — از ماده ۲۳۰ تا رأی وحدت رویه ۸۰۵ بررسی جامع مفهوم وجه‌الالتزام، تفاوت آن با خسارت تأخیر تأدیه، و تأثیر رأی وحدت رویه ۸۰۵ بر قراردادهای پولی ۱۰ مرداد ۱۴۰۵ مطالعه مقاله" [ref=e331] [cursor=pointer]:
              - /url: /blog/contract-penalty-clause
              - generic [ref=e332]:
                - generic [ref=e333]: قراردادها
                - generic [ref=e336]: ۱۲ دقیقه مطالعه
              - generic [ref=e337]:
                - heading "وجه‌الالتزام در قراردادها — از ماده ۲۳۰ تا رأی وحدت رویه ۸۰۵" [level=3] [ref=e338]
                - paragraph [ref=e339]: بررسی جامع مفهوم وجه‌الالتزام، تفاوت آن با خسارت تأخیر تأدیه، و تأثیر رأی وحدت رویه ۸۰۵ بر قراردادهای پولی
                - generic [ref=e340]:
                  - generic [ref=e343]: ۱۰ مرداد ۱۴۰۵
                  - generic [ref=e344]: مطالعه مقاله
            - link "املاک و مستغلات ۱۵ دقیقه مطالعه راهنمای جامع حقوق مستأجر — آنچه هر مستأجر باید بداند از تنظیم قرارداد تا تخلیه — آشنایی با حقوق قانونی مستأجر طبق قانون روابط موجر و مستأجر و قانون مدنی ۱۰ مرداد ۱۴۰۵ مطالعه مقاله" [ref=e345] [cursor=pointer]:
              - /url: /blog/tenant-rights-guide
              - generic [ref=e346]:
                - generic [ref=e347]: املاک و مستغلات
                - generic [ref=e350]: ۱۵ دقیقه مطالعه
              - generic [ref=e351]:
                - heading "راهنمای جامع حقوق مستأجر — آنچه هر مستأجر باید بداند" [level=3] [ref=e352]
                - paragraph [ref=e353]: از تنظیم قرارداد تا تخلیه — آشنایی با حقوق قانونی مستأجر طبق قانون روابط موجر و مستأجر و قانون مدنی
                - generic [ref=e354]:
                  - generic [ref=e357]: ۱۰ مرداد ۱۴۰۵
                  - generic [ref=e358]: مطالعه مقاله
            - link "تجارت ۱۰ دقیقه مطالعه چک برگشتی — اقدامات قانونی و مراحل پیگیری گام به گام از صدور گواهی عدم پرداخت تا اجراییه ثبتی — راهنمای کامل اقدامات قانونی چک برگشتی ۱۰ مرداد ۱۴۰۵ مطالعه مقاله" [ref=e359] [cursor=pointer]:
              - /url: /blog/check-bounced-legal-action
              - generic [ref=e360]:
                - generic [ref=e361]: تجارت
                - generic [ref=e364]: ۱۰ دقیقه مطالعه
              - generic [ref=e365]:
                - heading "چک برگشتی — اقدامات قانونی و مراحل پیگیری" [level=3] [ref=e366]
                - paragraph [ref=e367]: گام به گام از صدور گواهی عدم پرداخت تا اجراییه ثبتی — راهنمای کامل اقدامات قانونی چک برگشتی
                - generic [ref=e368]:
                  - generic [ref=e371]: ۱۰ مرداد ۱۴۰۵
                  - generic [ref=e372]: مطالعه مقاله
          - link "مشاهده همه مطالب وبلاگ" [ref=e374] [cursor=pointer]:
            - /url: /blog
        - generic [ref=e376]:
          - generic [ref=e377]:
            - heading "شفافیت در خدمات" [level=2] [ref=e378]
            - paragraph [ref=e379]: لیگالیر مرز بین هوش مصنوعی، منابع معتبر حقوقی و وکیل متخصص را شفاف می‌کند
          - generic [ref=e380]:
            - generic [ref=e381]:
              - heading "مدل زبانی تخصصی حقوقی" [level=3] [ref=e385]
              - paragraph [ref=e386]: هسته هوشمند لیگالیر بر پایه منابع حقوقی ساختاریافته، قوانین و آرای قضایی آموزش دیده و تحلیل ساختاریافته ارائه می‌دهد.
            - generic [ref=e387]:
              - heading "منابع معتبر حقوقی" [level=3] [ref=e391]
              - paragraph [ref=e392]: هر پاسخ با ارجاع دقیق به مواد قانونی، آرای وحدت رویه و بخشنامه‌ها همراه است. وضعیت اعتبار هر منبع (معتبر / اصلاح‌شده / منسوخ) به‌روشنی مشخص شده است.
            - generic [ref=e393]:
              - heading "مسیر شفاف به وکیل" [level=3] [ref=e397]
              - paragraph [ref=e398]: در موضوعات حساس، لیگالیر مسیر ارتباط با وکلای متخصص و تأییدشده را فراهم می‌کند تا تصمیم‌گیری حقوقی با اطمینان بیشتری انجام شود.
        - generic [ref=e405]:
          - heading "چگونه LEGALIR به شما کمک می‌کند" [level=3] [ref=e406]
          - list [ref=e407]:
            - listitem [ref=e408]:
              - strong [ref=e409]: "تحلیل ساختاریافته:"
              - text: LEGALIR با ترکیب هوش مصنوعی، منابع حقوقی و ابزارهای تخصصی، تحلیل و بررسی ساختاریافته مسائل، اسناد و قراردادهای حقوقی را در اختیار شما قرار می‌دهد.
            - listitem [ref=e410]:
              - strong [ref=e411]: "ابزار تخصصی:"
              - text: LEGALIR یک دستیار هوشمند حقوقی است که به شما در تحلیل، بررسی و تنظیم اسناد و قراردادها کمک می‌کند.
            - listitem [ref=e412]:
              - strong [ref=e413]: "منابع شفاف:"
              - text: تمام پاسخ‌ها با ارجاع به مواد قانونی، آرای وحدت رویه و بخشنامه‌ها همراه هستند و وضعیت اعتبار هر منبع مشخص شده است.
            - listitem [ref=e414]:
              - strong [ref=e415]: "مسیر وکیل:"
              - text: در موارد نیاز به تصمیم‌گیری حقوقی، LEGALIR مسیر ارتباط با وکلای متخصص را فراهم می‌کند.
        - generic [ref=e416]:
          - generic [ref=e417]:
            - heading "از کجا شروع کنیم؟" [level=2] [ref=e418]
            - paragraph [ref=e419]: بر اساس نیاز حقوقی خود، یکی از مسیرهای تخصصی زیر را انتخاب کنید
          - generic [ref=e420]:
            - link "مشاوره حقوقی با هوش مصنوعی پرسش حقوقی خود را مطرح کنید و تحلیل دقیق با استناد به مواد قانونی و آرای وحدت رویه دریافت کنید شروع مشاوره" [ref=e421] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - heading "مشاوره حقوقی با هوش مصنوعی" [level=3] [ref=e422]
              - paragraph [ref=e423]: پرسش حقوقی خود را مطرح کنید و تحلیل دقیق با استناد به مواد قانونی و آرای وحدت رویه دریافت کنید
              - generic [ref=e424]: شروع مشاوره
            - link "تحلیل هوشمند اسناد قراردادها و اسناد خود را بارگذاری کنید و بندهای پرریسک را با گزارش تحلیل دقیق شناسایی کنید تحلیل سند" [ref=e425] [cursor=pointer]:
              - /url: /auth/mobile?intent=document
              - heading "تحلیل هوشمند اسناد" [level=3] [ref=e426]
              - paragraph [ref=e427]: قراردادها و اسناد خود را بارگذاری کنید و بندهای پرریسک را با گزارش تحلیل دقیق شناسایی کنید
              - generic [ref=e428]: تحلیل سند
            - link "تولید پیش‌نویس قرارداد با پاسخ به پرسش‌نامه گام‌به‌گام، قرارداد شخصی‌سازی‌شده مطابق با آخرین قوانین ایران دریافت کنید ایجاد قرارداد" [ref=e429] [cursor=pointer]:
              - /url: /auth/mobile?intent=contract
              - heading "تولید پیش‌نویس قرارداد" [level=3] [ref=e430]
              - paragraph [ref=e431]: با پاسخ به پرسش‌نامه گام‌به‌گام، قرارداد شخصی‌سازی‌شده مطابق با آخرین قوانین ایران دریافت کنید
              - generic [ref=e432]: ایجاد قرارداد
            - link "مشاهده تعرفه‌ها پلن مناسب خود را انتخاب کنید و با قیمت شفاف از خدمات تخصصی LEGALIR استفاده کنید مشاهده اشتراک‌ها" [ref=e433] [cursor=pointer]:
              - /url: /pricing
              - heading "مشاهده تعرفه‌ها" [level=3] [ref=e434]
              - paragraph [ref=e435]: پلن مناسب خود را انتخاب کنید و با قیمت شفاف از خدمات تخصصی LEGALIR استفاده کنید
              - generic [ref=e436]: مشاهده اشتراک‌ها
    - contentinfo [ref=e437]:
      - generic [ref=e440]:
        - generic [ref=e441]:
          - generic [ref=e442]:
            - generic [ref=e443]:
              - img "LEGALIR" [ref=e444]
              - generic [ref=e445]: لیگالیر
            - paragraph [ref=e446]: سویه یک برند مستقل و شخصی است که توسط جمعی از متخصصان و افراد حقیقی شکل گرفته و با تمرکز بر هوش مصنوعی، تجربه‌های آموزشی کاربردی، دقیق و حرفه‌ای برای کاربران عمومی، متخصصان و مدیران طراحی می‌کند.
            - paragraph [ref=e447]: نسخه ۰.۱.۰ — مرحله توسعه
          - generic [ref=e448]:
            - heading "خدمات" [level=3] [ref=e449]
            - list [ref=e450]:
              - listitem [ref=e451]:
                - link "مشاوره حقوقی با هوش مصنوعی" [ref=e452] [cursor=pointer]:
                  - /url: /auth/mobile?intent=chat
              - listitem [ref=e453]:
                - link "تحلیل و بررسی اسناد" [ref=e454] [cursor=pointer]:
                  - /url: /auth/mobile?intent=document
              - listitem [ref=e455]:
                - link "تولید پیش‌نویس قرارداد" [ref=e456] [cursor=pointer]:
                  - /url: /auth/mobile?intent=contract
              - listitem [ref=e457]:
                - link "تعرفه‌ها و اشتراک" [ref=e458] [cursor=pointer]:
                  - /url: /pricing
          - generic [ref=e459]:
            - heading "پلتفرم" [level=3] [ref=e460]
            - list [ref=e461]:
              - listitem [ref=e462]:
                - link "قابلیت‌ها" [ref=e463] [cursor=pointer]:
                  - /url: /features
              - listitem [ref=e464]:
                - link "درباره لیگالیر" [ref=e465] [cursor=pointer]:
                  - /url: /about
              - listitem [ref=e466]:
                - link "تماس با ما" [ref=e467] [cursor=pointer]:
                  - /url: /contact
          - generic [ref=e468]:
            - heading "حقوقی" [level=3] [ref=e469]
            - list [ref=e470]:
              - listitem [ref=e471]:
                - link "قوانین استفاده" [ref=e472] [cursor=pointer]:
                  - /url: /terms
              - listitem [ref=e473]:
                - link "حریم خصوصی" [ref=e474] [cursor=pointer]:
                  - /url: /privacy-policy
              - listitem [ref=e475]:
                - link "پشتیبانی" [ref=e476] [cursor=pointer]:
                  - /url: /contact
        - generic [ref=e479]:
          - generic [ref=e480]:
            - heading "خبرنامه لیگالیر" [level=3] [ref=e481]
            - paragraph [ref=e482]: برای اطلاع از به‌روزرسانی‌ها، امکانات جدید و آخرین اخبار حقوقی ایمیل خود را وارد کنید.
          - generic [ref=e483]:
            - textbox "ایمیل خود را وارد کنید" [ref=e484]
            - button "ثبت" [ref=e485] [cursor=pointer]
        - generic [ref=e486]:
          - paragraph [ref=e487]: © 2026 لیگالیر. تمام حقوق محفوظ است.
          - paragraph [ref=e488]: خدمات تخصصی حقوقی با پشتیبانی هوش مصنوعی و منابع حقوقی معتبر
  - button "Open Next.js Dev Tools" [ref=e494] [cursor=pointer]
  - alert [ref=e498]
```

# Test source

```ts
  97  |   // Skip-to-main link
  98  |   // =========================================================================
  99  |   test.describe("Skip-to-main", () => {
  100 |     test("Skip-to-main link exists in the DOM", async ({ page }) => {
  101 |       await page.goto("/");
  102 |       await page.waitForSelector("body");
  103 | 
  104 |       const skipLink = page.locator(".skip-to-main");
  105 |       await expect(skipLink).toBeAttached();
  106 |       await expect(skipLink).toHaveText(/پرش به محتوای اصلی/i);
  107 |       await expect(skipLink).toHaveAttribute("href", "#main-content");
  108 |     });
  109 | 
  110 |     test("Skip-to-main link is present across public routes", async ({
  111 |       page,
  112 |     }) => {
  113 |       const publicRoutes = ["/features", "/pricing", "/about", "/contact"];
  114 |       for (const route of publicRoutes) {
  115 |         await page.goto(route);
  116 |         await page.waitForSelector("body");
  117 |         await expect(page.locator(".skip-to-main")).toBeAttached();
  118 |       }
  119 |     });
  120 |   });
  121 | 
  122 |   // =========================================================================
  123 |   // Landing light-only theme (§3 / §40)
  124 |   // =========================================================================
  125 |   test.describe("Landing light-only theme", () => {
  126 |     test("Landing header has no theme toggle and is forced to light", async ({
  127 |       page,
  128 |     }) => {
  129 |       await page.goto("/");
  130 |       await page.waitForSelector("body");
  131 | 
  132 |       // The public landing header must not render a theme toggle.
  133 |       const themeBtn = page.locator(
  134 |         'button[aria-label="حالت تیره"], button[aria-label="حالت روشن"]',
  135 |       );
  136 |       await expect(themeBtn).toHaveCount(0);
  137 | 
  138 |       // ForceLightTheme keeps the document locked to light mode.
  139 |       await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  140 |     });
  141 | 
  142 |     test("Landing stays light on mobile viewport", async ({ page }) => {
  143 |       await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14
  144 |       await page.goto("/");
  145 |       await page.waitForSelector("body");
  146 | 
  147 |       await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  148 |       await expect(
  149 |         page.locator('button[aria-label="حالت تیره"], button[aria-label="حالت روشن"]'),
  150 |       ).toHaveCount(0);
  151 |     });
  152 |   });
  153 | 
  154 |   // =========================================================================
  155 |   // Mobile menu
  156 |   // =========================================================================
  157 |   test.describe("Mobile menu", () => {
  158 |     test("Mobile menu opens and closes", async ({ page }) => {
  159 |       await page.setViewportSize({ width: 390, height: 844 });
  160 |       await page.goto("/");
  161 |       await page.waitForSelector("body");
  162 | 
  163 |       // Open menu
  164 |       const openBtn = page.getByRole("button", { name: /باز کردن منو/i });
  165 |       await expect(openBtn).toBeVisible();
  166 |       await openBtn.click();
  167 | 
  168 |       // Verify drawer is open — it contains a navigation with label "منوی موبایل"
  169 |       const mobileNav = page.getByRole("navigation", { name: /منوی موبایل/i });
  170 |       await expect(mobileNav).toBeVisible();
  171 | 
  172 |       // Verify nav items are present
  173 |       await expect(page.getByRole("link", { name: /صفحه اصلی/i })).toBeVisible();
  174 |       await expect(page.getByRole("link", { name: /قابلیت‌ها/i })).toBeVisible();
  175 | 
  176 |       // Close menu
  177 |       const closeBtn = page.getByRole("button", { name: /بستن منو/i });
  178 |       await expect(closeBtn).toBeVisible();
  179 |       await closeBtn.click();
  180 | 
  181 |       // Verify drawer is hidden
  182 |       await expect(mobileNav).not.toBeVisible();
  183 |     });
  184 | 
  185 |     test("Mobile menu closes on backdrop click", async ({ page }) => {
  186 |       await page.setViewportSize({ width: 390, height: 844 });
  187 |       await page.goto("/");
  188 |       await page.waitForSelector("body");
  189 | 
  190 |       // Open menu
  191 |       await page.getByRole("button", { name: /باز کردن منو/i }).click();
  192 |       await expect(
  193 |         page.getByRole("navigation", { name: /منوی موبایل/i }),
  194 |       ).toBeVisible();
  195 | 
  196 |       // Click the backdrop (the scrim div with aria-hidden)
> 197 |       await page.locator(".bg-scrim").click();
      |                                       ^ Error: locator.click: Test timeout of 30000ms exceeded.
  198 | 
  199 |       // Verify drawer is hidden
  200 |       await expect(
  201 |         page.getByRole("navigation", { name: /منوی موبایل/i }),
  202 |       ).not.toBeVisible();
  203 |     });
  204 | 
  205 |     test("Mobile menu close button exists and has correct aria-label", async ({
  206 |       page,
  207 |     }) => {
  208 |       await page.setViewportSize({ width: 390, height: 844 });
  209 |       await page.goto("/");
  210 |       await page.waitForSelector("body");
  211 | 
  212 |       await page.getByRole("button", { name: /باز کردن منو/i }).click();
  213 |       const closeBtn = page.getByRole("button", { name: /بستن منو/i });
  214 |       await expect(closeBtn).toBeVisible();
  215 |     });
  216 | 
  217 |     test("Hamburger menu is hidden on desktop viewport", async ({ page }) => {
  218 |       await page.setViewportSize({ width: 1280, height: 800 });
  219 |       await page.goto("/");
  220 |       await page.waitForSelector("body");
  221 | 
  222 |       const openBtn = page.getByRole("button", { name: /باز کردن منو/i });
  223 |       await expect(openBtn).not.toBeVisible();
  224 | 
  225 |       // Desktop nav should be visible instead
  226 |       const desktopNav = page.getByRole("navigation", { name: /ناوبری اصلی/i });
  227 |       await expect(desktopNav).toBeVisible();
  228 |     });
  229 |   });
  230 | 
  231 |   // =========================================================================
  232 |   // Route smoke tests
  233 |   // =========================================================================
  234 |   test.describe("Route smoke tests", () => {
  235 |     for (const route of APP_ROUTES) {
  236 |       test(`${route.label} page (${route.path}) loads without network errors`, async ({
  237 |         page,
  238 |       }) => {
  239 |         const errors: string[] = [];
  240 |         page.on("pageerror", (err) => errors.push(err.message));
  241 | 
  242 |         const response = await page.goto(route.path);
  243 |         await page.waitForSelector("body");
  244 | 
  245 |         // The page should return HTTP 200 (not 404/500)
  246 |         expect(response?.status()).toBe(200);
  247 | 
  248 |         // No uncaught JS errors
  249 |         expect(errors).toEqual([]);
  250 |       });
  251 |     }
  252 | 
  253 |     test("Auth page (mobile login) shows the expected form", async ({ page }) => {
  254 |       await page.goto("/auth/mobile");
  255 |       await page.waitForSelector("body");
  256 | 
  257 |       await expect(
  258 |         page.getByRole("heading", { name: /ورود به LEGALIR/i }),
  259 |       ).toBeVisible();
  260 |       await expect(page.getByLabel(/شماره موبایل/i)).toBeVisible();
  261 |       await expect(
  262 |         page.getByRole("button", { name: /ارسال کد تأیید|در حال ارسال/i }),
  263 |       ).toBeVisible();
  264 |     });
  265 |   });
  266 | 
  267 |   // =========================================================================
  268 |   // Dashboard with mocked auth
  269 |   // =========================================================================
  270 |   test.describe("Dashboard (mocked auth)", () => {
  271 |     test("Dashboard loads when authenticated", async ({ page }) => {
  272 |       await mockAuth(page);
  273 |       await page.goto("/dashboard");
  274 |       await page.waitForSelector("body");
  275 | 
  276 |       // The dashboard should load and the page shouldn't redirect away
  277 |       expect(page.url()).toContain("/dashboard");
  278 | 
  279 |       // The Sidebar or app shell should be visible
  280 |       // Look for the sidebar navigation or app shell elements
  281 |       const appShell = page.locator(
  282 |         '[data-testid="app-shell"], aside, [role="navigation"]',
  283 |       );
  284 |       // At least one structural element should exist
  285 |       await expect(page.locator("body")).toBeVisible();
  286 |     });
  287 | 
  288 |     test("Dashboard shows proper app shell on desktop", async ({ page }) => {
  289 |       await page.setViewportSize({ width: 1280, height: 800 });
  290 |       await mockAuth(page);
  291 |       await page.goto("/dashboard");
  292 |       await page.waitForSelector("body");
  293 | 
  294 |       expect(page.url()).toContain("/dashboard");
  295 |       await expect(page.locator("body")).toBeVisible();
  296 |     });
  297 | 
```