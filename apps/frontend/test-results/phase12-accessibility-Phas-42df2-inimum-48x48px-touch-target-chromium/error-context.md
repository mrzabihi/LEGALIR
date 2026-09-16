# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase12-accessibility.spec.ts >> Phase 12 — Accessibility & Responsive >> Touch targets >> Primary CTA button has minimum 48x48px touch target
- Location: e2e\phase12-accessibility.spec.ts:326:9

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 44
Received:    42
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - link "پرش به محتوای اصلی" [ref=e2] [cursor=pointer]:
    - /url: "#main-content"
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - link "LEGALIR — صفحه اصلی" [ref=e6] [cursor=pointer]:
          - /url: /
          - img "LEGALIR" [ref=e7]
        - navigation "ناوبری اصلی" [ref=e8]:
          - link "صفحه اصلی" [ref=e9] [cursor=pointer]:
            - /url: /
          - link "قابلیت‌ها" [ref=e10] [cursor=pointer]:
            - /url: /features
          - link "تعرفه‌ها" [ref=e11] [cursor=pointer]:
            - /url: /pricing
          - link "وبلاگ حقوقی" [ref=e12] [cursor=pointer]:
            - /url: /blog
          - link "درباره ما" [ref=e13] [cursor=pointer]:
            - /url: /about
          - link "تماس با ما" [ref=e14] [cursor=pointer]:
            - /url: /contact
        - generic [ref=e15]:
          - link "ورود" [ref=e16] [cursor=pointer]:
            - /url: /auth/mobile
          - button "شروع کنید" [ref=e18] [cursor=pointer]
    - main [ref=e21]:
      - generic [ref=e22]:
        - generic [ref=e26]:
          - img "LEGALIR" [ref=e29]
          - generic [ref=e30]: خدمات تخصصی حقوقی با پشتیبانی هوش مصنوعی و منابع حقوقی
          - heading "دستیار هوشمند حقوقی ایران" [level=1] [ref=e35]
          - paragraph [ref=e36]: خدمات تخصصی حقوقی با بهره‌گیری از هوش مصنوعی، منابع حقوقی و مدل زبانی تخصصی لیگالیر — تحلیل ساختاریافته پرونده‌ها، قراردادها و مسائل حقوقی
          - generic [ref=e37]:
            - link "شروع مشاوره حقوقی" [ref=e38] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
            - link "مشاهده قابلیت‌ها" [ref=e39] [cursor=pointer]:
              - /url: /features
          - paragraph [ref=e40]: دانش حقوقی، تحلیل هوشمند و منابع مستند؛ یکپارچه در لیگالیر
        - generic [ref=e45]:
          - generic [ref=e46]:
            - generic [ref=e50]: ۳+
            - generic [ref=e51]: خدمات اصلی
          - generic [ref=e52]:
            - generic [ref=e56]: ۲۰+
            - generic [ref=e57]: حوزه حقوقی
          - generic [ref=e58]:
            - generic [ref=e62]: ۲۴/۷
            - generic [ref=e63]: دسترسی آنلاین
        - generic [ref=e64]:
          - generic [ref=e65]:
            - heading "خدمات هوشمند لیگالیر" [level=2] [ref=e66]
            - paragraph [ref=e67]: سه سرویس تخصصی مبتنی بر هوش مصنوعی حقوقی — آموزش‌دیده بر نظام حقوقی ایران
          - generic [ref=e68]:
            - link "اطلاعات AI مشاوره حقوقی با هوش مصنوعی پرسش حقوقی خود را به زبان ساده مطرح کنید و تحلیل دقیق با استناد به مواد قانونی و آرای وحدت رویه دریافت کنید" [ref=e69] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - generic [ref=e70]: اطلاعات AI
              - heading "مشاوره حقوقی با هوش مصنوعی" [level=3] [ref=e75]
              - paragraph [ref=e76]: پرسش حقوقی خود را به زبان ساده مطرح کنید و تحلیل دقیق با استناد به مواد قانونی و آرای وحدت رویه دریافت کنید
            - link "کمک حقوقی تحلیل هوشمند اسناد قراردادها و اسناد حقوقی خود را بارگذاری کنید و بندهای پرریسک با گزارش تحلیل دقیق و شناسایی ریسک دریافت کنید" [ref=e77] [cursor=pointer]:
              - /url: /auth/mobile?intent=document
              - generic [ref=e78]: کمک حقوقی
              - heading "تحلیل هوشمند اسناد" [level=3] [ref=e83]
              - paragraph [ref=e84]: قراردادها و اسناد حقوقی خود را بارگذاری کنید و بندهای پرریسک با گزارش تحلیل دقیق و شناسایی ریسک دریافت کنید
            - link "پیش‌نویس خودکار تولید پیش‌نویس قرارداد با پاسخ به پرسش‌نامه گام‌به‌گام، پیش‌نویس قرارداد شخصی‌سازی‌شده مطابق با آخرین قوانین ایران دریافت کنید" [ref=e85] [cursor=pointer]:
              - /url: /auth/mobile?intent=contract
              - generic [ref=e86]: پیش‌نویس خودکار
              - heading "تولید پیش‌نویس قرارداد" [level=3] [ref=e91]
              - paragraph [ref=e92]: با پاسخ به پرسش‌نامه گام‌به‌گام، پیش‌نویس قرارداد شخصی‌سازی‌شده مطابق با آخرین قوانین ایران دریافت کنید
        - generic [ref=e94]:
          - generic [ref=e95]:
            - generic [ref=e96]: نمونه پرسش‌های واقعی
            - heading "لیگالیر چه سوالاتی را پاسخ می‌دهد؟" [level=2] [ref=e99]
            - paragraph [ref=e100]: اینها نمونه‌هایی از پرسش‌های واقعی حقوقی هستند که می‌توانید از لیگالیر بپرسید. هر پاسخ همراه با استناد دقیق به مواد قانونی و آرای قضایی ارائه می‌شود.
          - generic [ref=e101]:
            - link "اگر مستأجر اجاره را پرداخت نکند، صاحبخانه چه اقداماتی می‌تواند انجام دهد؟ مالک و مستأجر ماده ۴۹۴ قانون مدنی" [ref=e102] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - generic [ref=e106]:
                - paragraph [ref=e107]: اگر مستأجر اجاره را پرداخت نکند، صاحبخانه چه اقداماتی می‌تواند انجام دهد؟
                - generic [ref=e108]:
                  - generic [ref=e109]: مالک و مستأجر
                  - generic [ref=e110]: ماده ۴۹۴ قانون مدنی
            - link "چک برگشتی دارم — چطور می‌توانم وجه آن را مطالبه کنم؟ مطالبه وجه قانون صدور چک" [ref=e111] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - generic [ref=e115]:
                - paragraph [ref=e116]: چک برگشتی دارم — چطور می‌توانم وجه آن را مطالبه کنم؟
                - generic [ref=e117]:
                  - generic [ref=e118]: مطالبه وجه
                  - generic [ref=e119]: قانون صدور چک
            - link "وجه‌الالتزام در قرارداد چیست و چه زمانی قابل مطالبه است؟ قراردادها ماده ۲۳۰ قانون مدنی" [ref=e120] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - generic [ref=e124]:
                - paragraph [ref=e125]: وجه‌الالتزام در قرارداد چیست و چه زمانی قابل مطالبه است؟
                - generic [ref=e126]:
                  - generic [ref=e127]: قراردادها
                  - generic [ref=e128]: ماده ۲۳۰ قانون مدنی
            - link "برای درخواست طلاق توافقی چه مدارکی لازم است و چقدر طول می‌کشد؟ خانواده قانون حمایت خانواده" [ref=e129] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - generic [ref=e133]:
                - paragraph [ref=e134]: برای درخواست طلاق توافقی چه مدارکی لازم است و چقدر طول می‌کشد؟
                - generic [ref=e135]:
                  - generic [ref=e136]: خانواده
                  - generic [ref=e137]: قانون حمایت خانواده
            - link "خسارت تأخیر تأدیه چطور محاسبه می‌شود و نرخ آن چقدر است؟ خسارت ماده ۵۲۲ آیین دادرسی مدنی" [ref=e138] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - generic [ref=e142]:
                - paragraph [ref=e143]: خسارت تأخیر تأدیه چطور محاسبه می‌شود و نرخ آن چقدر است؟
                - generic [ref=e144]:
                  - generic [ref=e145]: خسارت
                  - generic [ref=e146]: ماده ۵۲۲ آیین دادرسی مدنی
            - link "برای تنظیم یک قرارداد اجاره مطمئن چه نکاتی را باید رعایت کنم؟ قراردادها قانون روابط موجر و مستأجر" [ref=e147] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - generic [ref=e151]:
                - paragraph [ref=e152]: برای تنظیم یک قرارداد اجاره مطمئن چه نکاتی را باید رعایت کنم؟
                - generic [ref=e153]:
                  - generic [ref=e154]: قراردادها
                  - generic [ref=e155]: قانون روابط موجر و مستأجر
          - link "پرسش خود را مطرح کنید" [ref=e157] [cursor=pointer]:
            - /url: /auth/mobile?intent=chat
        - generic [ref=e160]:
          - generic [ref=e161]:
            - generic [ref=e162]: موضوعات حقوقی
            - heading "موضوعات پرکاربرد حقوقی" [level=2] [ref=e165]
            - paragraph [ref=e166]: لیگالیر در حوزه‌های متنوع حقوقی آموزش دیده است. هر حوزه شامل منابع قانونی، آرای قضایی و تحلیل تخصصی مرتبط می‌باشد.
          - generic [ref=e167]:
            - link "مالک و مستأجر قوانین اجاره، تخلیه، تعدیل اجاره‌بها، ودیعه و تعهدات طرفین اجاره تخلیه ودیعه سرقفلی" [ref=e168] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - generic [ref=e170]:
                - generic [ref=e171]: 🏠
                - generic [ref=e172]:
                  - heading "مالک و مستأجر" [level=3] [ref=e173]
                  - paragraph [ref=e174]: قوانین اجاره، تخلیه، تعدیل اجاره‌بها، ودیعه و تعهدات طرفین
              - generic [ref=e175]:
                - generic [ref=e176]: اجاره
                - generic [ref=e177]: تخلیه
                - generic [ref=e178]: ودیعه
                - generic [ref=e179]: سرقفلی
            - link "مطالبه وجه و خسارت چک برگشتی، سفته، خسارت تأخیر تأدیه، وجه‌الالتزام قراردادی چک سفته خسارت تأخیر تأدیه" [ref=e180] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - generic [ref=e182]:
                - generic [ref=e183]: 💰
                - generic [ref=e184]:
                  - heading "مطالبه وجه و خسارت" [level=3] [ref=e185]
                  - paragraph [ref=e186]: چک برگشتی، سفته، خسارت تأخیر تأدیه، وجه‌الالتزام قراردادی
              - generic [ref=e187]:
                - generic [ref=e188]: چک
                - generic [ref=e189]: سفته
                - generic [ref=e190]: خسارت
                - generic [ref=e191]: تأخیر تأدیه
            - link "قراردادها و تعهدات تنظیم، بررسی و تفسیر قراردادهای ملکی، تجاری، پیمانکاری و استخدام قرارداد تعهدات فسخ وجه‌الالتزام" [ref=e192] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - generic [ref=e194]:
                - generic [ref=e195]: 📝
                - generic [ref=e196]:
                  - heading "قراردادها و تعهدات" [level=3] [ref=e197]
                  - paragraph [ref=e198]: تنظیم، بررسی و تفسیر قراردادهای ملکی، تجاری، پیمانکاری و استخدام
              - generic [ref=e199]:
                - generic [ref=e200]: قرارداد
                - generic [ref=e201]: تعهدات
                - generic [ref=e202]: فسخ
                - generic [ref=e203]: وجه‌الالتزام
            - link "حقوق خانواده ازدواج، طلاق، مهریه، نفقه، حضانت، ارث و وصیت مهریه طلاق حضانت ارث" [ref=e204] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - generic [ref=e206]:
                - generic [ref=e207]: 👨‍👩‍👧
                - generic [ref=e208]:
                  - heading "حقوق خانواده" [level=3] [ref=e209]
                  - paragraph [ref=e210]: ازدواج، طلاق، مهریه، نفقه، حضانت، ارث و وصیت
              - generic [ref=e211]:
                - generic [ref=e212]: مهریه
                - generic [ref=e213]: طلاق
                - generic [ref=e214]: حضانت
                - generic [ref=e215]: ارث
            - link "شرکت‌ها و تجارت ثبت شرکت، اساسنامه، سهام، قراردادهای تجاری، ورشکستگی شرکت تجارت سهام ورشکستگی" [ref=e216] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - generic [ref=e218]:
                - generic [ref=e219]: 🏢
                - generic [ref=e220]:
                  - heading "شرکت‌ها و تجارت" [level=3] [ref=e221]
                  - paragraph [ref=e222]: ثبت شرکت، اساسنامه، سهام، قراردادهای تجاری، ورشکستگی
              - generic [ref=e223]:
                - generic [ref=e224]: شرکت
                - generic [ref=e225]: تجارت
                - generic [ref=e226]: سهام
                - generic [ref=e227]: ورشکستگی
            - link "آیین دادرسی و دعاوی تنظیم دادخواست، اظهارنامه، لایحه دفاعیه و پیگیری پرونده دادخواست اظهارنامه لایحه دادرسی" [ref=e228] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - generic [ref=e230]:
                - generic [ref=e231]: ⚖️
                - generic [ref=e232]:
                  - heading "آیین دادرسی و دعاوی" [level=3] [ref=e233]
                  - paragraph [ref=e234]: تنظیم دادخواست، اظهارنامه، لایحه دفاعیه و پیگیری پرونده
              - generic [ref=e235]:
                - generic [ref=e236]: دادخواست
                - generic [ref=e237]: اظهارنامه
                - generic [ref=e238]: لایحه
                - generic [ref=e239]: دادرسی
        - generic [ref=e241]:
          - generic [ref=e242]:
            - heading "لیگالیر چطور کار می‌کند؟" [level=2] [ref=e243]
            - paragraph [ref=e244]: سه گام ساده برای دریافت تحلیل حقوقی — از طرح موضوع تا دریافت راهنمایی تخصصی
          - generic [ref=e247]:
            - generic [ref=e248]:
              - generic [ref=e249]: ۰۱
              - generic [ref=e251]:
                - heading "طرح موضوع حقوقی" [level=3] [ref=e255]
                - paragraph [ref=e256]: موضوع یا پرسش حقوقی خود را به زبان ساده و محاوره‌ای توضیح دهید — مانند صحبت با یک مشاور
            - generic [ref=e257]:
              - generic [ref=e258]: ۰۲
              - generic [ref=e260]:
                - heading "تحلیل تخصصی هوش مصنوعی" [level=3] [ref=e264]
                - paragraph [ref=e265]: هسته تخصصی لیگالیر با استناد به قوانین، آرای وحدت رویه و بخشنامه‌های معتبر، موضوع شما را تحلیل می‌کند
            - generic [ref=e266]:
              - generic [ref=e267]: ۰۳
              - generic [ref=e269]:
                - heading "دریافت راهنمایی" [level=3] [ref=e273]
                - paragraph [ref=e274]: تحلیل تفصیلی با ارجاع دقیق دریافت کنید و در صورت نیاز، برای مشاوره تخصصی به وکیل ارجاع شوید
        - generic [ref=e275]:
          - generic [ref=e276]:
            - generic [ref=e277]: منابع معتبر حقوقی
            - heading "منابع حقوقی تحت پوشش" [level=2] [ref=e280]
            - paragraph [ref=e281]: لیگالیر بر پایه قوانین، مقررات و آرای معتبر نظام حقوقی ایران آموزش دیده است. هر پاسخ با ارجاع دقیق به منبع اصلی همراه می‌باشد.
          - generic [ref=e282]:
            - generic [ref=e283]:
              - generic [ref=e285]:
                - heading "قانون مدنی" [level=3] [ref=e286]
                - paragraph [ref=e287]: منبع اصلی حقوق خصوصی ایران — شامل احکام عقود، تعهدات، اموال و مالکیت
              - generic [ref=e288]:
                - generic [ref=e289]: ۱۳۳۵ ماده
                - generic [ref=e290]: مصوب ۱۳۰۷
            - generic [ref=e291]:
              - generic [ref=e293]:
                - heading "آیین دادرسی مدنی" [level=3] [ref=e294]
                - paragraph [ref=e295]: قواعد شکلی رسیدگی به دعاوی حقوقی در دادگاه‌های عمومی و انقلاب
              - generic [ref=e296]:
                - generic [ref=e297]: ۵۲۹ ماده
                - generic [ref=e298]: مصوب ۱۳۷۹
            - generic [ref=e299]:
              - generic [ref=e301]:
                - heading "قانون تجارت" [level=3] [ref=e302]
                - paragraph [ref=e303]: مقررات مربوط به شرکت‌های تجاری، اسناد تجاری، ورشکستگی و امور بازرگانی
              - generic [ref=e304]:
                - generic [ref=e305]: ۶۰۰ ماده
                - generic [ref=e306]: مصوب ۱۳۱۱
            - generic [ref=e307]:
              - generic [ref=e309]:
                - heading "آرای وحدت رویه" [level=3] [ref=e310]
                - paragraph [ref=e311]: تصمیمات هیأت عمومی دیوان عالی کشور برای ایجاد رویه واحد قضایی
              - generic [ref=e312]:
                - generic [ref=e313]: ۸۵۰+ رأی
                - generic [ref=e314]: مصوب جاری
        - generic [ref=e315]:
          - generic [ref=e316]:
            - generic [ref=e317]: مجله و آموزش حقوقی لیگالیر
            - heading "مجله و آموزش حقوقی لیگالیر" [level=2] [ref=e320]
            - paragraph [ref=e321]: راهنماهای کاربردی، قوانین، آرای مهم و تحلیل موضوعات حقوقی — بر پایه منابع ساختاریافته حقوقی
          - generic [ref=e322]:
            - link "قراردادها ۱۲ دقیقه مطالعه وجه‌الالتزام در قراردادها — از ماده ۲۳۰ تا رأی وحدت رویه ۸۰۵ بررسی جامع مفهوم وجه‌الالتزام، تفاوت آن با خسارت تأخیر تأدیه، و تأثیر رأی وحدت رویه ۸۰۵ بر قراردادهای پولی ۱۰ مرداد ۱۴۰۵ مطالعه مقاله" [ref=e323] [cursor=pointer]:
              - /url: /blog/contract-penalty-clause
              - generic [ref=e324]:
                - generic [ref=e325]: قراردادها
                - generic [ref=e328]: ۱۲ دقیقه مطالعه
              - generic [ref=e329]:
                - heading "وجه‌الالتزام در قراردادها — از ماده ۲۳۰ تا رأی وحدت رویه ۸۰۵" [level=3] [ref=e330]
                - paragraph [ref=e331]: بررسی جامع مفهوم وجه‌الالتزام، تفاوت آن با خسارت تأخیر تأدیه، و تأثیر رأی وحدت رویه ۸۰۵ بر قراردادهای پولی
                - generic [ref=e332]:
                  - generic [ref=e335]: ۱۰ مرداد ۱۴۰۵
                  - generic [ref=e336]: مطالعه مقاله
            - link "املاک و مستغلات ۱۵ دقیقه مطالعه راهنمای جامع حقوق مستأجر — آنچه هر مستأجر باید بداند از تنظیم قرارداد تا تخلیه — آشنایی با حقوق قانونی مستأجر طبق قانون روابط موجر و مستأجر و قانون مدنی ۱۰ مرداد ۱۴۰۵ مطالعه مقاله" [ref=e337] [cursor=pointer]:
              - /url: /blog/tenant-rights-guide
              - generic [ref=e338]:
                - generic [ref=e339]: املاک و مستغلات
                - generic [ref=e342]: ۱۵ دقیقه مطالعه
              - generic [ref=e343]:
                - heading "راهنمای جامع حقوق مستأجر — آنچه هر مستأجر باید بداند" [level=3] [ref=e344]
                - paragraph [ref=e345]: از تنظیم قرارداد تا تخلیه — آشنایی با حقوق قانونی مستأجر طبق قانون روابط موجر و مستأجر و قانون مدنی
                - generic [ref=e346]:
                  - generic [ref=e349]: ۱۰ مرداد ۱۴۰۵
                  - generic [ref=e350]: مطالعه مقاله
            - link "تجارت ۱۰ دقیقه مطالعه چک برگشتی — اقدامات قانونی و مراحل پیگیری گام به گام از صدور گواهی عدم پرداخت تا اجراییه ثبتی — راهنمای کامل اقدامات قانونی چک برگشتی ۱۰ مرداد ۱۴۰۵ مطالعه مقاله" [ref=e351] [cursor=pointer]:
              - /url: /blog/check-bounced-legal-action
              - generic [ref=e352]:
                - generic [ref=e353]: تجارت
                - generic [ref=e356]: ۱۰ دقیقه مطالعه
              - generic [ref=e357]:
                - heading "چک برگشتی — اقدامات قانونی و مراحل پیگیری" [level=3] [ref=e358]
                - paragraph [ref=e359]: گام به گام از صدور گواهی عدم پرداخت تا اجراییه ثبتی — راهنمای کامل اقدامات قانونی چک برگشتی
                - generic [ref=e360]:
                  - generic [ref=e363]: ۱۰ مرداد ۱۴۰۵
                  - generic [ref=e364]: مطالعه مقاله
          - link "مشاهده همه مطالب وبلاگ" [ref=e366] [cursor=pointer]:
            - /url: /blog
        - generic [ref=e368]:
          - generic [ref=e369]:
            - heading "شفافیت در خدمات" [level=2] [ref=e370]
            - paragraph [ref=e371]: لیگالیر مرز بین هوش مصنوعی، منابع معتبر حقوقی و وکیل متخصص را شفاف می‌کند
          - generic [ref=e372]:
            - generic [ref=e373]:
              - heading "مدل زبانی تخصصی حقوقی" [level=3] [ref=e377]
              - paragraph [ref=e378]: هسته هوشمند لیگالیر بر پایه منابع حقوقی ساختاریافته، قوانین و آرای قضایی آموزش دیده و تحلیل ساختاریافته ارائه می‌دهد.
            - generic [ref=e379]:
              - heading "منابع معتبر حقوقی" [level=3] [ref=e383]
              - paragraph [ref=e384]: هر پاسخ با ارجاع دقیق به مواد قانونی، آرای وحدت رویه و بخشنامه‌ها همراه است. وضعیت اعتبار هر منبع (معتبر / اصلاح‌شده / منسوخ) به‌روشنی مشخص شده است.
            - generic [ref=e385]:
              - heading "مسیر شفاف به وکیل" [level=3] [ref=e389]
              - paragraph [ref=e390]: در موضوعات حساس، لیگالیر مسیر ارتباط با وکلای متخصص و تأییدشده را فراهم می‌کند تا تصمیم‌گیری حقوقی با اطمینان بیشتری انجام شود.
        - generic [ref=e397]:
          - heading "چگونه LEGALIR به شما کمک می‌کند" [level=3] [ref=e398]
          - list [ref=e399]:
            - listitem [ref=e400]:
              - strong [ref=e401]: "تحلیل ساختاریافته:"
              - text: LEGALIR با ترکیب هوش مصنوعی، منابع حقوقی و ابزارهای تخصصی، تحلیل و بررسی ساختاریافته مسائل، اسناد و قراردادهای حقوقی را در اختیار شما قرار می‌دهد.
            - listitem [ref=e402]:
              - strong [ref=e403]: "ابزار تخصصی:"
              - text: LEGALIR یک دستیار هوشمند حقوقی است که به شما در تحلیل، بررسی و تنظیم اسناد و قراردادها کمک می‌کند.
            - listitem [ref=e404]:
              - strong [ref=e405]: "منابع شفاف:"
              - text: تمام پاسخ‌ها با ارجاع به مواد قانونی، آرای وحدت رویه و بخشنامه‌ها همراه هستند و وضعیت اعتبار هر منبع مشخص شده است.
            - listitem [ref=e406]:
              - strong [ref=e407]: "مسیر وکیل:"
              - text: در موارد نیاز به تصمیم‌گیری حقوقی، LEGALIR مسیر ارتباط با وکلای متخصص را فراهم می‌کند.
        - generic [ref=e408]:
          - generic [ref=e409]:
            - heading "از کجا شروع کنیم؟" [level=2] [ref=e410]
            - paragraph [ref=e411]: بر اساس نیاز حقوقی خود، یکی از مسیرهای تخصصی زیر را انتخاب کنید
          - generic [ref=e412]:
            - link "مشاوره حقوقی با هوش مصنوعی پرسش حقوقی خود را مطرح کنید و تحلیل دقیق با استناد به مواد قانونی و آرای وحدت رویه دریافت کنید شروع مشاوره" [ref=e413] [cursor=pointer]:
              - /url: /auth/mobile?intent=chat
              - heading "مشاوره حقوقی با هوش مصنوعی" [level=3] [ref=e414]
              - paragraph [ref=e415]: پرسش حقوقی خود را مطرح کنید و تحلیل دقیق با استناد به مواد قانونی و آرای وحدت رویه دریافت کنید
              - generic [ref=e416]: شروع مشاوره
            - link "تحلیل هوشمند اسناد قراردادها و اسناد خود را بارگذاری کنید و بندهای پرریسک را با گزارش تحلیل دقیق شناسایی کنید تحلیل سند" [ref=e417] [cursor=pointer]:
              - /url: /auth/mobile?intent=document
              - heading "تحلیل هوشمند اسناد" [level=3] [ref=e418]
              - paragraph [ref=e419]: قراردادها و اسناد خود را بارگذاری کنید و بندهای پرریسک را با گزارش تحلیل دقیق شناسایی کنید
              - generic [ref=e420]: تحلیل سند
            - link "تولید پیش‌نویس قرارداد با پاسخ به پرسش‌نامه گام‌به‌گام، قرارداد شخصی‌سازی‌شده مطابق با آخرین قوانین ایران دریافت کنید ایجاد قرارداد" [ref=e421] [cursor=pointer]:
              - /url: /auth/mobile?intent=contract
              - heading "تولید پیش‌نویس قرارداد" [level=3] [ref=e422]
              - paragraph [ref=e423]: با پاسخ به پرسش‌نامه گام‌به‌گام، قرارداد شخصی‌سازی‌شده مطابق با آخرین قوانین ایران دریافت کنید
              - generic [ref=e424]: ایجاد قرارداد
            - link "مشاهده تعرفه‌ها پلن مناسب خود را انتخاب کنید و با قیمت شفاف از خدمات تخصصی LEGALIR استفاده کنید مشاهده اشتراک‌ها" [ref=e425] [cursor=pointer]:
              - /url: /pricing
              - heading "مشاهده تعرفه‌ها" [level=3] [ref=e426]
              - paragraph [ref=e427]: پلن مناسب خود را انتخاب کنید و با قیمت شفاف از خدمات تخصصی LEGALIR استفاده کنید
              - generic [ref=e428]: مشاهده اشتراک‌ها
    - contentinfo [ref=e429]:
      - generic [ref=e432]:
        - generic [ref=e433]:
          - generic [ref=e434]:
            - generic [ref=e435]:
              - img "LEGALIR" [ref=e436]
              - generic [ref=e437]: لیگالیر
            - paragraph [ref=e438]: سویه یک برند مستقل و شخصی است که توسط جمعی از متخصصان و افراد حقیقی شکل گرفته و با تمرکز بر هوش مصنوعی، تجربه‌های آموزشی کاربردی، دقیق و حرفه‌ای برای کاربران عمومی، متخصصان و مدیران طراحی می‌کند.
            - paragraph [ref=e439]: نسخه ۰.۱.۰ — مرحله توسعه
          - generic [ref=e440]:
            - heading "خدمات" [level=3] [ref=e441]
            - list [ref=e442]:
              - listitem [ref=e443]:
                - link "مشاوره حقوقی با هوش مصنوعی" [ref=e444] [cursor=pointer]:
                  - /url: /auth/mobile?intent=chat
              - listitem [ref=e445]:
                - link "تحلیل و بررسی اسناد" [ref=e446] [cursor=pointer]:
                  - /url: /auth/mobile?intent=document
              - listitem [ref=e447]:
                - link "تولید پیش‌نویس قرارداد" [ref=e448] [cursor=pointer]:
                  - /url: /auth/mobile?intent=contract
              - listitem [ref=e449]:
                - link "تعرفه‌ها و اشتراک" [ref=e450] [cursor=pointer]:
                  - /url: /pricing
          - generic [ref=e451]:
            - heading "پلتفرم" [level=3] [ref=e452]
            - list [ref=e453]:
              - listitem [ref=e454]:
                - link "قابلیت‌ها" [ref=e455] [cursor=pointer]:
                  - /url: /features
              - listitem [ref=e456]:
                - link "درباره لیگالیر" [ref=e457] [cursor=pointer]:
                  - /url: /about
              - listitem [ref=e458]:
                - link "تماس با ما" [ref=e459] [cursor=pointer]:
                  - /url: /contact
          - generic [ref=e460]:
            - heading "حقوقی" [level=3] [ref=e461]
            - list [ref=e462]:
              - listitem [ref=e463]:
                - link "قوانین استفاده" [ref=e464] [cursor=pointer]:
                  - /url: /terms
              - listitem [ref=e465]:
                - link "حریم خصوصی" [ref=e466] [cursor=pointer]:
                  - /url: /privacy-policy
              - listitem [ref=e467]:
                - link "پشتیبانی" [ref=e468] [cursor=pointer]:
                  - /url: /contact
        - generic [ref=e471]:
          - generic [ref=e472]:
            - heading "خبرنامه لیگالیر" [level=3] [ref=e473]
            - paragraph [ref=e474]: برای اطلاع از به‌روزرسانی‌ها، امکانات جدید و آخرین اخبار حقوقی ایمیل خود را وارد کنید.
          - generic [ref=e475]:
            - textbox "ایمیل خود را وارد کنید" [ref=e476]
            - button "ثبت" [ref=e477] [cursor=pointer]
        - generic [ref=e478]:
          - paragraph [ref=e479]: © 2026 لیگالیر. تمام حقوق محفوظ است.
          - paragraph [ref=e480]: خدمات تخصصی حقوقی با پشتیبانی هوش مصنوعی و منابع حقوقی معتبر
  - button "Open Next.js Dev Tools" [ref=e486] [cursor=pointer]
  - alert [ref=e490]
```

# Test source

```ts
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
  298 |     test("Auth pages redirect to dashboard when already authenticated", async ({
  299 |       page,
  300 |     }) => {
  301 |       await mockAuth(page);
  302 |       await page.goto("/auth/mobile");
  303 |       await page.waitForSelector("body");
  304 | 
  305 |       // Should redirect to /dashboard
  306 |       await page.waitForURL("**/dashboard", { timeout: 5000 });
  307 |       expect(page.url()).toContain("/dashboard");
  308 |     });
  309 | 
  310 |     test("Unauthenticated user does not get app shell on dashboard", async ({
  311 |       page,
  312 |     }) => {
  313 |       // No mock auth — user is unauthenticated
  314 |       await page.goto("/dashboard");
  315 |       await page.waitForSelector("body");
  316 | 
  317 |       // The page should still load (children are rendered when !isAuthenticated)
  318 |       expect(page.url()).toContain("/dashboard");
  319 |     });
  320 |   });
  321 | 
  322 |   // =========================================================================
  323 |   // Touch targets (min 48px)
  324 |   // =========================================================================
  325 |   test.describe("Touch targets", () => {
  326 |     test("Primary CTA button has minimum 48x48px touch target", async ({
  327 |       page,
  328 |     }) => {
  329 |       await page.goto("/");
  330 |       await page.waitForSelector("body");
  331 | 
  332 |       const ctaBtn = page.getByRole("button", { name: /شروع کنید/i });
  333 |       await expect(ctaBtn).toBeVisible();
  334 | 
  335 |       const box = await ctaBtn.boundingBox();
  336 |       expect(box).not.toBeNull();
  337 |       // Both width and height should be at least 48px
> 338 |       expect(box!.height).toBeGreaterThanOrEqual(44);
      |                           ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
  339 |       expect(box!.width).toBeGreaterThanOrEqual(44);
  340 |     });
  341 | 
  342 |     test("Mobile menu open/close buttons have adequate touch size", async ({
  343 |       page,
  344 |     }) => {
  345 |       await page.setViewportSize({ width: 390, height: 844 });
  346 |       await page.goto("/");
  347 |       await page.waitForSelector("body");
  348 | 
  349 |       const openBtn = page.getByRole("button", { name: /باز کردن منو/i });
  350 |       const openBox = await openBtn.boundingBox();
  351 |       expect(openBox).not.toBeNull();
  352 |       expect(openBox!.width).toBeGreaterThanOrEqual(40);
  353 |       expect(openBox!.height).toBeGreaterThanOrEqual(40);
  354 |     });
  355 | 
  356 |     test("CTA buttons on landing page have minimum touch target size", async ({
  357 |       page,
  358 |     }) => {
  359 |       await page.goto("/");
  360 |       await page.waitForSelector("body");
  361 | 
  362 |       // The primary CTA link with text "شروع مشاوره حقوقی"
  363 |       const ctaLink = page.getByRole("link", { name: /شروع مشاوره حقوقی/i });
  364 |       await expect(ctaLink).toBeVisible();
  365 | 
  366 |       const box = await ctaLink.boundingBox();
  367 |       expect(box).not.toBeNull();
  368 |       // The link should be at least 44px in height (touch-friendly)
  369 |       expect(box!.height).toBeGreaterThanOrEqual(44);
  370 |     });
  371 |   });
  372 | 
  373 |   // =========================================================================
  374 |   // Focus-visible styles
  375 |   // =========================================================================
  376 |   test.describe("Focus-visible", () => {
  377 |     test("Skip-to-main link becomes visible on focus", async ({ page }) => {
  378 |       await page.goto("/");
  379 |       await page.waitForSelector("body");
  380 | 
  381 |       const skipLink = page.locator(".skip-to-main");
  382 | 
  383 |       // Before focus, the link should be off-screen (top: -100%)
  384 |       const initialBox = await skipLink.boundingBox();
  385 |       // The skip link is positioned off-screen initially
  386 |       expect(initialBox).not.toBeNull();
  387 | 
  388 |       // Focus the skip link using keyboard
  389 |       await page.keyboard.press("Tab");
  390 | 
  391 |       // After focus, it should slide into view (top: 0 per CSS)
  392 |       await page.waitForTimeout(300);
  393 |       const focusedBox = await skipLink.boundingBox();
  394 |       expect(focusedBox).not.toBeNull();
  395 | 
  396 |       // The y position should be >= 0 (visible in viewport)
  397 |       // Use a looser check: assert the element is actually in the viewport
  398 |       await expect(skipLink).toBeInViewport();
  399 |     });
  400 | 
  401 |     test("Focus-visible outline is applied to interactive elements", async ({
  402 |       page,
  403 |     }) => {
  404 |       await page.setViewportSize({ width: 1280, height: 800 });
  405 |       await page.goto("/");
  406 |       await page.waitForSelector("body");
  407 | 
  408 |       // Tab through interactive elements and verify focus ring exists in stylesheet
  409 |       // We verify the CSS rule exists — functional verification
  410 |       // The :focus-visible styles are defined in globals.css
  411 |       const hasFocusVisibleStyles = await page.evaluate(() => {
  412 |         const sheets = Array.from(document.styleSheets);
  413 |         for (const sheet of sheets) {
  414 |           try {
  415 |             const rules = Array.from(sheet.cssRules || []);
  416 |             for (const rule of rules) {
  417 |               if (
  418 |                 rule instanceof CSSStyleRule &&
  419 |                 rule.selectorText &&
  420 |                 rule.selectorText.includes("focus-visible")
  421 |               ) {
  422 |                 return true;
  423 |               }
  424 |             }
  425 |           } catch {
  426 |             // Cross-origin stylesheets throw — expected
  427 |           }
  428 |         }
  429 |         return false;
  430 |       });
  431 |       expect(hasFocusVisibleStyles).toBe(true);
  432 |     });
  433 | 
  434 |     test("Tab navigation reaches the skip-to-main link first", async ({
  435 |       page,
  436 |     }) => {
  437 |       await page.goto("/");
  438 |       await page.waitForSelector("body");
```