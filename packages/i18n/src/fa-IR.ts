// ============================================================
// LEGALIR — Persian (fa-IR) Locale Strings
// ============================================================

const faIR = {
  // --- App ---
  app: {
    name: "LEGALIR",
    tagline: "پلتفرم هوشمند قوانین و قراردادهای حقوقی ایران",
    loading: "در حال بارگذاری...",
    error: "خطایی رخ داده است",
    retry: "تلاش مجدد",
    back: "بازگشت",
    save: "ذخیره",
    cancel: "انصراف",
    confirm: "تأیید",
    delete: "حذف",
    edit: "ویرایش",
    search: "جستجو",
    noResults: "نتیجه‌ای یافت نشد",
    offline: "اتصال اینترنت قطع است",
  },

  // --- Theme ---
  theme: {
    light: "روشن",
    dark: "تیره",
    switchToLight: "تغییر به حالت روشن",
    switchToDark: "تغییر به حالت تیره",
  },

  // --- Navigation ---
  nav: {
    home: "محیط کار",
    newService: "ساخت جدید",
    chat: "گفت‌وگوی حقوقی",
    documents: "اسناد",
    contracts: "قراردادها",
    history: "تاریخچه",
    memory: "حافظه",
    subscription: "اشتراک",
    profile: "پروفایل",
    settings: "تنظیمات",
    logout: "خروج",
  },

  // --- Auth ---
  auth: {
    mobileTitle: "ورود به LEGALIR",
    mobileLabel: "شماره موبایل",
    mobilePlaceholder: "۰۹xxxxxxxxx",
    mobileHint: "کد تأیید برای این شماره ارسال می‌شود",
    sendOtp: "ارسال کد تأیید",
    otpTitle: "تأیید کد",
    otpLabel: "کد ۶ رقمی",
    otpPlaceholder: "------",
    otpHint: "کد ارسال‌شده را وارد کنید",
    otpSent: "کد ارسال شد",
    otpResend: "ارسال مجدد کد",
    otpResendIn: "ارسال مجدد تا {seconds} ثانیه دیگر",
    otpWrong: "کد واردشده صحیح نیست",
    otpExpired: "زمان کد به پایان رسیده است",
    otpLocked: "تعداد تلاش بیش از حد. لطفاً کمی صبر کنید",
    otpRemainingAttempts: "{count} تلاش باقی‌مانده",
    verify: "تأیید",
    sessionExpired: "نشست شما منقضی شده است. لطفاً دوباره وارد شوید",
    profileCompletionTitle: "تکمیل اطلاعات",
    profileCompletionHint: "می‌توانید بعداً تکمیل کنید",
    skipForNow: "بعداً",
    acceptTerms: "با ورود، شرایط استفاده و حریم خصوصی را می‌پذیرم",
  },

  // --- Dashboard ---
  dashboard: {
    greeting: "سلام، {name}",
    guestGreeting: "سلام، خوش آمدید",
    profileCompletion: "تکمیل پروفایل {percent}٪",
    completeProfile: "تکمیل پروفایل",
    subscriptionSummary: "اشتراک {plan}",
    daysRemaining: "{days} روز باقی‌مانده",
    quickActions: "دسترسی سریع",
    newConsultation: "گفتگوی حقوقی",
    analyzeDocument: "تحلیل سند",
    createContract: "ساخت قرارداد",
    recentActivity: "فعالیت اخیر",
    savedSources: "منابع ذخیره‌شده",
    serviceStatus: "وضعیت سرویس",
    noActivity: "هنوز فعالیتی ندارید",
    startHere: "از اینجا شروع کنید",
  },

  // --- Pricing ---
  pricing: {
    title: "تعرفه‌ها",
    subtitle: "پلن مناسب خود را انتخاب کنید",
    currentPlan: "پلن فعلی",
    selectPlan: "انتخاب",
    upgrade: "ارتقا",
    toman: "تومان",
    perMonth: "ماهانه",
    perQuarter: "سه‌ماهه",
    perYear: "سالیانه",
    features: "قابلیت‌ها",
    aiMessages: "{count} پیام هوش مصنوعی",
    documentAnalysis: "{count} تحلیل سند",
    contracts: "{count} قرارداد",
    purchase: "خرید اشتراک",
    purchaseSuccess: "اشتراک با موفقیت فعال شد",
    purchaseFailed: "خطا در فعال‌سازی اشتراک",
    purchasePending: "در انتظار پرداخت",
  },

  // --- Chat ---
  chat: {
    newConversation: "گفتگوی جدید",
    conversationTitle: "عنوان گفتگو",
    enterTitle: "عنوان گفتگو را وارد کنید",
    selectCategory: "دسته‌بندی حقوقی",
    startChat: "شروع گفتگو",
    messagePlaceholder: "سوال حقوقی خود را بنویسید...",
    send: "ارسال",
    stop: "توقف",
    retry: "تلاش مجدد",
    streaming: "در حال نوشتن...",
    validating: "در حال بررسی منابع...",
    emptyConversation: "هنوز گفتگویی ندارید",
    emptyMessage: "گفتگوی خود را شروع کنید",
    disclaimer: "این پاسخ جایگزین مشاوره وکیل نیست",
    blocked: "این موضوع نیازمند مشاوره تخصصی است",
  },

  // --- AI Response ---
  ai: {
    summary: "خلاصه",
    relevantFacts: "اطلاعات مبنا",
    legalAnalysis: "تحلیل حقوقی",
    riskLevel: "سطح ریسک",
    possibleActions: "اقدامات احتمالی",
    sources: "منابع و مستندات",
    nextStep: "اقدام بعدی",
    riskLow: "کم",
    riskMedium: "متوسط",
    riskHigh: "زیاد",
    riskCritical: "بحرانی",
  },

  // --- Documents ---
  documents: {
    title: "اسناد",
    upload: "بارگذاری سند",
    dropFiles: "فایل را اینجا رها کنید یا کلیک کنید",
    supportedFormats: "فرمت‌های پشتیبانی‌شده: PDF، DOCX، تصویر",
    maxSize: "حداکثر حجم: ۲۵ مگابایت",
    uploading: "در حال بارگذاری...",
    processing: "در حال پردازش",
    extracting: "استخراج متن",
    analyzing: "تحلیل حقوقی",
    ready: "آماده",
    failed: "ناموفق",
    retry: "تلاش مجدد",
    delete: "حذف",
    riskReport: "گزارش ریسک",
    findings: "موارد شناسایی‌شده",
    noFindings: "مورد خاصی شناسایی نشد",
  },

  // --- Contracts ---
  contracts: {
    title: "قراردادها",
    newContract: "قرارداد جدید",
    selectType: "نوع قرارداد",
    questionnaire: "اطلاعات قرارداد",
    generating: "در حال تولید پیش‌نویس...",
    preview: "پیش‌نمایش",
    export: "خروجی",
    versions: "نسخه‌ها",
    aiDraft: "پیش‌نویس تولیدشده توسط AI",
  },

  // --- History ---
  history: {
    title: "تاریخچه",
    all: "همه",
    cases: "پرونده‌ها",
    contracts: "قراردادها",
    realEstate: "املاک",
    family: "خانواده",
    commerce: "تجارت",
    other: "سایر",
    searchPlaceholder: "جستجو در تاریخچه...",
    emptyHistory: "تاریخچه‌ای یافت نشد",
  },

  // --- Memory ---
  memory: {
    title: "حافظه",
    description: "اطلاعات ذخیره‌شده برای بهبود پاسخ‌های AI",
    noMemory: "اطلاعاتی ذخیره نشده است",
    deleteConfirm: "آیا از حذف این اطلاعات مطمئن هستید؟",
    toggleOff: "حافظه غیرفعال شد",
    toggleOn: "حافظه فعال شد",
  },

  // --- Profile ---
  profile: {
    title: "پروفایل",
    displayName: "نام نمایشی",
    city: "شهر",
    occupation: "شغل",
    mobile: "شماره موبایل",
    saveSuccess: "اطلاعات با موفقیت ذخیره شد",
    avatarHint: "تصویر پروفایل",
  },

  // --- Settings ---
  settings: {
    title: "تنظیمات",
    appearance: "ظاهر",
    notifications: "اعلان‌ها",
    security: "امنیت",
    sessions: "نشست‌های فعال",
  },

  // --- Errors ---
  errors: {
    generic: "خطایی رخ داده است. لطفاً دوباره تلاش کنید",
    network: "خطا در ارتباط با سرور",
    unauthorized: "نیاز به ورود مجدد",
    forbidden: "دسترسی مجاز نیست",
    notFound: "صفحه مورد نظر یافت نشد",
    validation: "لطفاً خطاها را بررسی کنید",
    serverError: "خطای سرور. در حال بررسی هستیم",
    quotaExceeded: "سهمیه شما به پایان رسیده است",
    upgradeRequired: "برای استفاده، اشتراک خود را ارتقا دهید",
  },

  // --- Legal ---
  legal: {
    disclaimer: "این پاسخ توسط هوش مصنوعی تولید شده و جایگزین مشاوره وکیل نیست",
    sourceValid: "معتبر",
    sourceAmended: "اصلاح‌شده",
    sourceExpired: "منسوخ",
    sourceNeedsReview: "نیازمند بررسی",
    article: "ماده",
    clause: "تبصره",
    paragraph: "بند",
  },

  // --- Splash ---
  splash: {
    tagline: "دستیار هوشمند حقوقی شما",
  },
} as const;

export { faIR };
