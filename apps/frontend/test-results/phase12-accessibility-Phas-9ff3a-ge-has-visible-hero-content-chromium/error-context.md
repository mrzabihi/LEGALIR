# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase12-accessibility.spec.ts >> Phase 12 — Accessibility & Responsive >> RTL & Layout >> Landing page has visible hero content
- Location: e2e\phase12-accessibility.spec.ts:74:9

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: /تحلیل حقوقی با هوش مصنوعی/i })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: /تحلیل حقوقی با هوش مصنوعی/i })

```

```yaml
- link "پرش به محتوای اصلی":
  - /url: "#main-content"
- banner:
  - link "LEGALIR — صفحه اصلی":
    - /url: /
    - img "LEGALIR"
  - navigation "ناوبری اصلی":
    - link "صفحه اصلی":
      - /url: /
    - link "قابلیت‌ها":
      - /url: /features
    - link "تعرفه‌ها":
      - /url: /pricing
    - link "وبلاگ حقوقی":
      - /url: /blog
    - link "درباره ما":
      - /url: /about
    - link "تماس با ما":
      - /url: /contact
  - link "ورود":
    - /url: /auth/mobile
  - button "شروع کنید":
    - text: شروع کنید
    - img
- main:
  - img "LEGALIR"
  - text: خدمات تخصصی حقوقی با پشتیبانی هوش مصنوعی و منابع حقوقی
  - heading "دستیار هوشمند حقوقی ایران" [level=1]
  - paragraph: خدمات تخصصی حقوقی با بهره‌گیری از هوش مصنوعی، منابع حقوقی و مدل زبانی تخصصی لیگالیر — تحلیل ساختاریافته پرونده‌ها، قراردادها و مسائل حقوقی
  - link "شروع مشاوره حقوقی":
    - /url: /auth/mobile?intent=chat
  - link "مشاهده قابلیت‌ها":
    - /url: /features
  - paragraph: دانش حقوقی، تحلیل هوشمند و منابع مستند؛ یکپارچه در لیگالیر
  - text: ۳+ خدمات اصلی ۲۰+ حوزه حقوقی ۲۴/۷ دسترسی آنلاین
  - heading "خدمات هوشمند لیگالیر" [level=2]
  - paragraph: سه سرویس تخصصی مبتنی بر هوش مصنوعی حقوقی — آموزش‌دیده بر نظام حقوقی ایران
  - link "اطلاعات AI مشاوره حقوقی با هوش مصنوعی پرسش حقوقی خود را به زبان ساده مطرح کنید و تحلیل دقیق با استناد به مواد قانونی و آرای وحدت رویه دریافت کنید":
    - /url: /auth/mobile?intent=chat
    - text: اطلاعات AI
    - heading "مشاوره حقوقی با هوش مصنوعی" [level=3]
    - paragraph: پرسش حقوقی خود را به زبان ساده مطرح کنید و تحلیل دقیق با استناد به مواد قانونی و آرای وحدت رویه دریافت کنید
  - link "کمک حقوقی تحلیل هوشمند اسناد قراردادها و اسناد حقوقی خود را بارگذاری کنید و بندهای پرریسک با گزارش تحلیل دقیق و شناسایی ریسک دریافت کنید":
    - /url: /auth/mobile?intent=document
    - text: کمک حقوقی
    - heading "تحلیل هوشمند اسناد" [level=3]
    - paragraph: قراردادها و اسناد حقوقی خود را بارگذاری کنید و بندهای پرریسک با گزارش تحلیل دقیق و شناسایی ریسک دریافت کنید
  - link "پیش‌نویس خودکار تولید پیش‌نویس قرارداد با پاسخ به پرسش‌نامه گام‌به‌گام، پیش‌نویس قرارداد شخصی‌سازی‌شده مطابق با آخرین قوانین ایران دریافت کنید":
    - /url: /auth/mobile?intent=contract
    - text: پیش‌نویس خودکار
    - heading "تولید پیش‌نویس قرارداد" [level=3]
    - paragraph: با پاسخ به پرسش‌نامه گام‌به‌گام، پیش‌نویس قرارداد شخصی‌سازی‌شده مطابق با آخرین قوانین ایران دریافت کنید
  - text: نمونه پرسش‌های واقعی
  - heading "لیگالیر چه سوالاتی را پاسخ می‌دهد؟" [level=2]
  - paragraph: اینها نمونه‌هایی از پرسش‌های واقعی حقوقی هستند که می‌توانید از لیگالیر بپرسید. هر پاسخ همراه با استناد دقیق به مواد قانونی و آرای قضایی ارائه می‌شود.
  - link "اگر مستأجر اجاره را پرداخت نکند، صاحبخانه چه اقداماتی می‌تواند انجام دهد؟ مالک و مستأجر ماده ۴۹۴ قانون مدنی":
    - /url: /auth/mobile?intent=chat
    - paragraph: اگر مستأجر اجاره را پرداخت نکند، صاحبخانه چه اقداماتی می‌تواند انجام دهد؟
    - text: مالک و مستأجر ماده ۴۹۴ قانون مدنی
  - link "چک برگشتی دارم — چطور می‌توانم وجه آن را مطالبه کنم؟ مطالبه وجه قانون صدور چک":
    - /url: /auth/mobile?intent=chat
    - paragraph: چک برگشتی دارم — چطور می‌توانم وجه آن را مطالبه کنم؟
    - text: مطالبه وجه قانون صدور چک
  - link "وجه‌الالتزام در قرارداد چیست و چه زمانی قابل مطالبه است؟ قراردادها ماده ۲۳۰ قانون مدنی":
    - /url: /auth/mobile?intent=chat
    - paragraph: وجه‌الالتزام در قرارداد چیست و چه زمانی قابل مطالبه است؟
    - text: قراردادها ماده ۲۳۰ قانون مدنی
  - link "برای درخواست طلاق توافقی چه مدارکی لازم است و چقدر طول می‌کشد؟ خانواده قانون حمایت خانواده":
    - /url: /auth/mobile?intent=chat
    - paragraph: برای درخواست طلاق توافقی چه مدارکی لازم است و چقدر طول می‌کشد؟
    - text: خانواده قانون حمایت خانواده
  - link "خسارت تأخیر تأدیه چطور محاسبه می‌شود و نرخ آن چقدر است؟ خسارت ماده ۵۲۲ آیین دادرسی مدنی":
    - /url: /auth/mobile?intent=chat
    - paragraph: خسارت تأخیر تأدیه چطور محاسبه می‌شود و نرخ آن چقدر است؟
    - text: خسارت ماده ۵۲۲ آیین دادرسی مدنی
  - link "برای تنظیم یک قرارداد اجاره مطمئن چه نکاتی را باید رعایت کنم؟ قراردادها قانون روابط موجر و مستأجر":
    - /url: /auth/mobile?intent=chat
    - paragraph: برای تنظیم یک قرارداد اجاره مطمئن چه نکاتی را باید رعایت کنم؟
    - text: قراردادها قانون روابط موجر و مستأجر
  - link "پرسش خود را مطرح کنید":
    - /url: /auth/mobile?intent=chat
  - text: موضوعات حقوقی
  - heading "موضوعات پرکاربرد حقوقی" [level=2]
  - paragraph: لیگالیر در حوزه‌های متنوع حقوقی آموزش دیده است. هر حوزه شامل منابع قانونی، آرای قضایی و تحلیل تخصصی مرتبط می‌باشد.
  - link "مالک و مستأجر قوانین اجاره، تخلیه، تعدیل اجاره‌بها، ودیعه و تعهدات طرفین اجاره تخلیه ودیعه سرقفلی":
    - /url: /auth/mobile?intent=chat
    - heading "مالک و مستأجر" [level=3]
    - paragraph: قوانین اجاره، تخلیه، تعدیل اجاره‌بها، ودیعه و تعهدات طرفین
    - text: اجاره تخلیه ودیعه سرقفلی
  - link "مطالبه وجه و خسارت چک برگشتی، سفته، خسارت تأخیر تأدیه، وجه‌الالتزام قراردادی چک سفته خسارت تأخیر تأدیه":
    - /url: /auth/mobile?intent=chat
    - heading "مطالبه وجه و خسارت" [level=3]
    - paragraph: چک برگشتی، سفته، خسارت تأخیر تأدیه، وجه‌الالتزام قراردادی
    - text: چک سفته خسارت تأخیر تأدیه
  - link "قراردادها و تعهدات تنظیم، بررسی و تفسیر قراردادهای ملکی، تجاری، پیمانکاری و استخدام قرارداد تعهدات فسخ وجه‌الالتزام":
    - /url: /auth/mobile?intent=chat
    - heading "قراردادها و تعهدات" [level=3]
    - paragraph: تنظیم، بررسی و تفسیر قراردادهای ملکی، تجاری، پیمانکاری و استخدام
    - text: قرارداد تعهدات فسخ وجه‌الالتزام
  - link "حقوق خانواده ازدواج، طلاق، مهریه، نفقه، حضانت، ارث و وصیت مهریه طلاق حضانت ارث":
    - /url: /auth/mobile?intent=chat
    - heading "حقوق خانواده" [level=3]
    - paragraph: ازدواج، طلاق، مهریه، نفقه، حضانت، ارث و وصیت
    - text: مهریه طلاق حضانت ارث
  - link "شرکت‌ها و تجارت ثبت شرکت، اساسنامه، سهام، قراردادهای تجاری، ورشکستگی شرکت تجارت سهام ورشکستگی":
    - /url: /auth/mobile?intent=chat
    - heading "شرکت‌ها و تجارت" [level=3]
    - paragraph: ثبت شرکت، اساسنامه، سهام، قراردادهای تجاری، ورشکستگی
    - text: شرکت تجارت سهام ورشکستگی
  - link "آیین دادرسی و دعاوی تنظیم دادخواست، اظهارنامه، لایحه دفاعیه و پیگیری پرونده دادخواست اظهارنامه لایحه دادرسی":
    - /url: /auth/mobile?intent=chat
    - heading "آیین دادرسی و دعاوی" [level=3]
    - paragraph: تنظیم دادخواست، اظهارنامه، لایحه دفاعیه و پیگیری پرونده
    - text: دادخواست اظهارنامه لایحه دادرسی
  - heading "لیگالیر چطور کار می‌کند؟" [level=2]
  - paragraph: سه گام ساده برای دریافت تحلیل حقوقی — از طرح موضوع تا دریافت راهنمایی تخصصی
  - text: ۰۱
  - heading "طرح موضوع حقوقی" [level=3]
  - paragraph: موضوع یا پرسش حقوقی خود را به زبان ساده و محاوره‌ای توضیح دهید — مانند صحبت با یک مشاور
  - text: ۰۲
  - heading "تحلیل تخصصی هوش مصنوعی" [level=3]
  - paragraph: هسته تخصصی لیگالیر با استناد به قوانین، آرای وحدت رویه و بخشنامه‌های معتبر، موضوع شما را تحلیل می‌کند
  - text: ۰۳
  - heading "دریافت راهنمایی" [level=3]
  - paragraph: تحلیل تفصیلی با ارجاع دقیق دریافت کنید و در صورت نیاز، برای مشاوره تخصصی به وکیل ارجاع شوید
  - text: منابع معتبر حقوقی
  - heading "منابع حقوقی تحت پوشش" [level=2]
  - paragraph: لیگالیر بر پایه قوانین، مقررات و آرای معتبر نظام حقوقی ایران آموزش دیده است. هر پاسخ با ارجاع دقیق به منبع اصلی همراه می‌باشد.
  - heading "قانون مدنی" [level=3]
  - paragraph: منبع اصلی حقوق خصوصی ایران — شامل احکام عقود، تعهدات، اموال و مالکیت
  - text: ۱۳۳۵ ماده مصوب ۱۳۰۷
  - heading "آیین دادرسی مدنی" [level=3]
  - paragraph: قواعد شکلی رسیدگی به دعاوی حقوقی در دادگاه‌های عمومی و انقلاب
  - text: ۵۲۹ ماده مصوب ۱۳۷۹
  - heading "قانون تجارت" [level=3]
  - paragraph: مقررات مربوط به شرکت‌های تجاری، اسناد تجاری، ورشکستگی و امور بازرگانی
  - text: ۶۰۰ ماده مصوب ۱۳۱۱
  - heading "آرای وحدت رویه" [level=3]
  - paragraph: تصمیمات هیأت عمومی دیوان عالی کشور برای ایجاد رویه واحد قضایی
  - text: ۸۵۰+ رأی مصوب جاری مجله و آموزش حقوقی لیگالیر
  - heading "مجله و آموزش حقوقی لیگالیر" [level=2]
  - paragraph: راهنماهای کاربردی، قوانین، آرای مهم و تحلیل موضوعات حقوقی — بر پایه منابع ساختاریافته حقوقی
  - link "قراردادها ۱۲ دقیقه مطالعه وجه‌الالتزام در قراردادها — از ماده ۲۳۰ تا رأی وحدت رویه ۸۰۵ بررسی جامع مفهوم وجه‌الالتزام، تفاوت آن با خسارت تأخیر تأدیه، و تأثیر رأی وحدت رویه ۸۰۵ بر قراردادهای پولی ۱۰ مرداد ۱۴۰۵ مطالعه مقاله":
    - /url: /blog/contract-penalty-clause
    - text: قراردادها ۱۲ دقیقه مطالعه
    - heading "وجه‌الالتزام در قراردادها — از ماده ۲۳۰ تا رأی وحدت رویه ۸۰۵" [level=3]
    - paragraph: بررسی جامع مفهوم وجه‌الالتزام، تفاوت آن با خسارت تأخیر تأدیه، و تأثیر رأی وحدت رویه ۸۰۵ بر قراردادهای پولی
    - text: ۱۰ مرداد ۱۴۰۵ مطالعه مقاله
  - link "املاک و مستغلات ۱۵ دقیقه مطالعه راهنمای جامع حقوق مستأجر — آنچه هر مستأجر باید بداند از تنظیم قرارداد تا تخلیه — آشنایی با حقوق قانونی مستأجر طبق قانون روابط موجر و مستأجر و قانون مدنی ۱۰ مرداد ۱۴۰۵ مطالعه مقاله":
    - /url: /blog/tenant-rights-guide
    - text: املاک و مستغلات ۱۵ دقیقه مطالعه
    - heading "راهنمای جامع حقوق مستأجر — آنچه هر مستأجر باید بداند" [level=3]
    - paragraph: از تنظیم قرارداد تا تخلیه — آشنایی با حقوق قانونی مستأجر طبق قانون روابط موجر و مستأجر و قانون مدنی
    - text: ۱۰ مرداد ۱۴۰۵ مطالعه مقاله
  - link "تجارت ۱۰ دقیقه مطالعه چک برگشتی — اقدامات قانونی و مراحل پیگیری گام به گام از صدور گواهی عدم پرداخت تا اجراییه ثبتی — راهنمای کامل اقدامات قانونی چک برگشتی ۱۰ مرداد ۱۴۰۵ مطالعه مقاله":
    - /url: /blog/check-bounced-legal-action
    - text: تجارت ۱۰ دقیقه مطالعه
    - heading "چک برگشتی — اقدامات قانونی و مراحل پیگیری" [level=3]
    - paragraph: گام به گام از صدور گواهی عدم پرداخت تا اجراییه ثبتی — راهنمای کامل اقدامات قانونی چک برگشتی
    - text: ۱۰ مرداد ۱۴۰۵ مطالعه مقاله
  - link "مشاهده همه مطالب وبلاگ":
    - /url: /blog
  - heading "شفافیت در خدمات" [level=2]
  - paragraph: لیگالیر مرز بین هوش مصنوعی، منابع معتبر حقوقی و وکیل متخصص را شفاف می‌کند
  - heading "مدل زبانی تخصصی حقوقی" [level=3]
  - paragraph: هسته هوشمند لیگالیر بر پایه منابع حقوقی ساختاریافته، قوانین و آرای قضایی آموزش دیده و تحلیل ساختاریافته ارائه می‌دهد.
  - heading "منابع معتبر حقوقی" [level=3]
  - paragraph: هر پاسخ با ارجاع دقیق به مواد قانونی، آرای وحدت رویه و بخشنامه‌ها همراه است. وضعیت اعتبار هر منبع (معتبر / اصلاح‌شده / منسوخ) به‌روشنی مشخص شده است.
  - heading "مسیر شفاف به وکیل" [level=3]
  - paragraph: در موضوعات حساس، لیگالیر مسیر ارتباط با وکلای متخصص و تأییدشده را فراهم می‌کند تا تصمیم‌گیری حقوقی با اطمینان بیشتری انجام شود.
  - heading "چگونه LEGALIR به شما کمک می‌کند" [level=3]
  - list:
    - listitem:
      - strong: "تحلیل ساختاریافته:"
      - text: LEGALIR با ترکیب هوش مصنوعی، منابع حقوقی و ابزارهای تخصصی، تحلیل و بررسی ساختاریافته مسائل، اسناد و قراردادهای حقوقی را در اختیار شما قرار می‌دهد.
    - listitem:
      - strong: "ابزار تخصصی:"
      - text: LEGALIR یک دستیار هوشمند حقوقی است که به شما در تحلیل، بررسی و تنظیم اسناد و قراردادها کمک می‌کند.
    - listitem:
      - strong: "منابع شفاف:"
      - text: تمام پاسخ‌ها با ارجاع به مواد قانونی، آرای وحدت رویه و بخشنامه‌ها همراه هستند و وضعیت اعتبار هر منبع مشخص شده است.
    - listitem:
      - strong: "مسیر وکیل:"
      - text: در موارد نیاز به تصمیم‌گیری حقوقی، LEGALIR مسیر ارتباط با وکلای متخصص را فراهم می‌کند.
  - heading "از کجا شروع کنیم؟" [level=2]
  - paragraph: بر اساس نیاز حقوقی خود، یکی از مسیرهای تخصصی زیر را انتخاب کنید
  - link "مشاوره حقوقی با هوش مصنوعی پرسش حقوقی خود را مطرح کنید و تحلیل دقیق با استناد به مواد قانونی و آرای وحدت رویه دریافت کنید شروع مشاوره":
    - /url: /auth/mobile?intent=chat
    - heading "مشاوره حقوقی با هوش مصنوعی" [level=3]
    - paragraph: پرسش حقوقی خود را مطرح کنید و تحلیل دقیق با استناد به مواد قانونی و آرای وحدت رویه دریافت کنید
    - text: شروع مشاوره
  - link "تحلیل هوشمند اسناد قراردادها و اسناد خود را بارگذاری کنید و بندهای پرریسک را با گزارش تحلیل دقیق شناسایی کنید تحلیل سند":
    - /url: /auth/mobile?intent=document
    - heading "تحلیل هوشمند اسناد" [level=3]
    - paragraph: قراردادها و اسناد خود را بارگذاری کنید و بندهای پرریسک را با گزارش تحلیل دقیق شناسایی کنید
    - text: تحلیل سند
  - link "تولید پیش‌نویس قرارداد با پاسخ به پرسش‌نامه گام‌به‌گام، قرارداد شخصی‌سازی‌شده مطابق با آخرین قوانین ایران دریافت کنید ایجاد قرارداد":
    - /url: /auth/mobile?intent=contract
    - heading "تولید پیش‌نویس قرارداد" [level=3]
    - paragraph: با پاسخ به پرسش‌نامه گام‌به‌گام، قرارداد شخصی‌سازی‌شده مطابق با آخرین قوانین ایران دریافت کنید
    - text: ایجاد قرارداد
  - link "مشاهده تعرفه‌ها پلن مناسب خود را انتخاب کنید و با قیمت شفاف از خدمات تخصصی LEGALIR استفاده کنید مشاهده اشتراک‌ها":
    - /url: /pricing
    - heading "مشاهده تعرفه‌ها" [level=3]
    - paragraph: پلن مناسب خود را انتخاب کنید و با قیمت شفاف از خدمات تخصصی LEGALIR استفاده کنید
    - text: مشاهده اشتراک‌ها
- contentinfo:
  - img "LEGALIR"
  - text: لیگالیر
  - paragraph: سویه یک برند مستقل و شخصی است که توسط جمعی از متخصصان و افراد حقیقی شکل گرفته و با تمرکز بر هوش مصنوعی، تجربه‌های آموزشی کاربردی، دقیق و حرفه‌ای برای کاربران عمومی، متخصصان و مدیران طراحی می‌کند.
  - paragraph: نسخه ۰.۱.۰ — مرحله توسعه
  - heading "خدمات" [level=3]
  - list:
    - listitem:
      - link "مشاوره حقوقی با هوش مصنوعی":
        - /url: /auth/mobile?intent=chat
    - listitem:
      - link "تحلیل و بررسی اسناد":
        - /url: /auth/mobile?intent=document
    - listitem:
      - link "تولید پیش‌نویس قرارداد":
        - /url: /auth/mobile?intent=contract
    - listitem:
      - link "تعرفه‌ها و اشتراک":
        - /url: /pricing
  - heading "پلتفرم" [level=3]
  - list:
    - listitem:
      - link "قابلیت‌ها":
        - /url: /features
    - listitem:
      - link "درباره لیگالیر":
        - /url: /about
    - listitem:
      - link "تماس با ما":
        - /url: /contact
  - heading "حقوقی" [level=3]
  - list:
    - listitem:
      - link "قوانین استفاده":
        - /url: /terms
    - listitem:
      - link "حریم خصوصی":
        - /url: /privacy-policy
    - listitem:
      - link "پشتیبانی":
        - /url: /contact
  - heading "خبرنامه لیگالیر" [level=3]
  - paragraph: برای اطلاع از به‌روزرسانی‌ها، امکانات جدید و آخرین اخبار حقوقی ایمیل خود را وارد کنید.
  - textbox "ایمیل خود را وارد کنید"
  - button "ثبت"
  - paragraph: © 2026 لیگالیر. تمام حقوق محفوظ است.
  - paragraph: خدمات تخصصی حقوقی با پشتیبانی هوش مصنوعی و منابع حقوقی معتبر
- alert
```

# Test source

```ts
  1   | /**
  2   |  * ============================================================
  3   |  * LEGALIR — Phase 12 Accessibility & Responsive E2E Tests
  4   |  * ============================================================
  5   |  * Covers: RTL, skip-link, theme toggle, mobile menu, route pages,
  6   |  * touch targets, focus-visible, reduced-motion.
  7   |  */
  8   | 
  9   | import { test, expect } from "@playwright/test";
  10  | 
  11  | // ---------------------------------------------------------------------------
  12  | // Helpers
  13  | // ---------------------------------------------------------------------------
  14  | 
  15  | /** Simulate an authenticated session by writing to zustand's localStorage key. */
  16  | async function mockAuth(
  17  |   page: import("@playwright/test").Page,
  18  |   overrides?: {
  19  |     sessionId?: string;
  20  |     userId?: string;
  21  |     isNewUser?: boolean;
  22  |   },
  23  | ) {
  24  |   const sessionState = {
  25  |     state: {
  26  |       session: {
  27  |         sessionId: overrides?.sessionId ?? "test-session-id",
  28  |         userId: overrides?.userId ?? "test-user-id",
  29  |         mobileE164: "+989121234567",
  30  |         mobileDisplay: "۰۹۱۲۱۲۳۴۵۶۷",
  31  |         isNewUser: overrides?.isNewUser ?? false,
  32  |         createdAt: Date.now(),
  33  |       },
  34  |     },
  35  |     version: 0,
  36  |   };
  37  |   await page.evaluate(
  38  |     (data) => localStorage.setItem("legalir-auth", JSON.stringify(data)),
  39  |     sessionState,
  40  |   );
  41  | }
  42  | 
  43  | /** A list of routes that should load without errors (smoke-test style). */
  44  | const APP_ROUTES = [
  45  |   { path: "/", label: "Landing" },
  46  |   { path: "/features", label: "Features" },
  47  |   { path: "/pricing", label: "Pricing" },
  48  |   { path: "/about", label: "About" },
  49  |   { path: "/contact", label: "Contact" },
  50  |   { path: "/auth/mobile", label: "Auth" },
  51  |   { path: "/register", label: "Register" },
  52  | ];
  53  | 
  54  | // ---------------------------------------------------------------------------
  55  | // Tests
  56  | // ---------------------------------------------------------------------------
  57  | 
  58  | test.describe("Phase 12 — Accessibility & Responsive", () => {
  59  |   // =========================================================================
  60  |   // RTL & Layout fundamentals
  61  |   // =========================================================================
  62  |   test.describe("RTL & Layout", () => {
  63  |     test("Landing page renders with RTL direction and Persian lang", async ({
  64  |       page,
  65  |     }) => {
  66  |       await page.goto("/");
  67  |       await page.waitForSelector("body");
  68  | 
  69  |       const html = page.locator("html");
  70  |       await expect(html).toHaveAttribute("dir", "rtl");
  71  |       await expect(html).toHaveAttribute("lang", "fa-IR");
  72  |     });
  73  | 
  74  |     test("Landing page has visible hero content", async ({ page }) => {
  75  |       await page.goto("/");
  76  |       await page.waitForSelector("h1");
  77  | 
  78  |       const heading = page.getByRole("heading", {
  79  |         name: /دستیار هوشمند حقوقی ایران/i,
  80  |       });
  81  |       await expect(heading).toBeVisible();
  82  | 
  83  |       // Also verify the three highlight cards are present
  84  |       await expect(
  85  |         page.getByRole("heading", { name: /تحلیل حقوقی با هوش مصنوعی/i }),
> 86  |       ).toBeVisible();
      |         ^ Error: expect(locator).toBeVisible() failed
  87  |       await expect(
  88  |         page.getByRole("heading", { name: /بررسی هوشمند اسناد/i }),
  89  |       ).toBeVisible();
  90  |       await expect(
  91  |         page.getByRole("heading", { name: /تولید پیش‌نویس قرارداد/i }),
  92  |       ).toBeVisible();
  93  |     });
  94  |   });
  95  | 
  96  |   // =========================================================================
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
```