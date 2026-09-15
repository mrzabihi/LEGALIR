// ============================================================
// LEGALIR — Official Law Catalog (16 files → structured sources)
// ============================================================
// Pure, dependency-free data module. Importable from BOTH server
// (routes, grounding, seed) and client (services page) because it
// performs no filesystem or crypto work at module scope.
//
// It converts the 16 official law files under «iran legal» into:
//   - V1SourceDetail       (chat «مستندات» / «ارجاعات» tabs)
//   - V1DocumentDetail     (اسناد section)
//   - V1MemoryItem         (حافظه section, legal_context)
//   - LawServiceExample    (خدمات section — documented examples)
// ============================================================

import type {
  SourceType,
  SourceStatus,
  V1SourceDetail,
  V1DocumentDetail,
  V1MemoryItem,
} from "@legalir/types";

// Version guard used by the seed layer in demo-seed.ts so re-running
// the dev server never duplicates these rows.
export const LAW_SEED_VERSION = "legalir-laws-v1";

// ============================================================
// Source definition (internal, richer than V1SourceDetail)
// ============================================================

export interface LawSourceDef {
  id: string;
  title: string;
  sourceType: SourceType;
  sourceTypeFa: string;
  /** Representative article / principle locator (e.g. «ماده ۲۳۰ قانون مدنی»). */
  articleSection: string;
  publicationAuthority: string;
  jurisdiction: string;
  effectiveDate: string;
  versionDate: string | null;
  /** Verbatim-ish excerpt of the referenced provision. */
  excerpt: string;
  url: string | null;
  documentIdentifier: string;
  status: SourceStatus;
  availability: "available" | "unavailable" | "outdated" | "unverified";
  /** Original file name in the «iran legal» folder. */
  fileName: string;
  mime: string;
  fileSizeBytes: number;
  summary: string;
  keywords: string[];
}

// ============================================================
// 16 official law sources
// ============================================================

export const LAW_SOURCES: LawSourceDef[] = [
  {
    id: "law-constitution",
    title: "قانون اساسی جمهوری اسلامی ایران",
    sourceType: "law",
    sourceTypeFa: "قانون",
    articleSection: "اصول ۳۴، ۳۶، ۳۷، ۱۵۶ و ۱۶۷",
    publicationAuthority: "مجلس خبرگان قانون اساسی",
    jurisdiction: "جمهوری اسلامی ایران",
    effectiveDate: "1358-08-24",
    versionDate: "1368-05-06",
    excerpt:
      "اصل ۳۴: دادخواهی حق مسلّم هر فرد است و هر کس می‌تواند به منظور دادخواهی به دادگاه‌های صالح رجوع نماید. اصل ۳۶: حکم به مجازات و اجرای آن باید تنها از طریق دادگاه صالح و به موجب قانون باشد. اصل ۳۷: اصل، برائت است و هیچ‌کس از نظر قانون مجرم شناخته نمی‌شود مگر این‌که جرم او در دادگاه صالح ثابت گردد.",
    url: null,
    documentIdentifier: "مصوب ۱۳۵۸، بازنگری ۱۳۶۸",
    status: "valid",
    availability: "available",
    fileName: "قانون اساسی جمهوری اسلامی ایران.pdf",
    mime: "application/pdf",
    fileSizeBytes: 2930535,
    summary:
      "مهم‌ترین سند حقوقی کشور، شامل اصول دادرسی عادلانه، اصل برائت و تضمین‌های حقوق شهروندی.",
    keywords: ["قانون اساسی", "دادخواهی", "اصل برائت", "دادرسی عادلانه", "قوه قضائیه", "حقوق شهروندی"],
  },
  {
    id: "law-constitution-parliament",
    title: "قانون اساسی و ماده ۲۰۰ آیین‌نامه داخلی مجلس شورای اسلامی",
    sourceType: "law",
    sourceTypeFa: "قانون",
    articleSection: "ماده ۲۰۰ آیین‌نامه داخلی مجلس",
    publicationAuthority: "مجلس شورای اسلامی",
    jurisdiction: "جمهوری اسلامی ایران",
    effectiveDate: "1363-01-01",
    versionDate: null,
    excerpt:
      "ماده ۲۰۰ آیین‌نامه داخلی مجلس شورای اسلامی، سازوکار تصویب طرح‌ها و لوایح، نحوه رسیدگی شور اول و دوم و شرایط ارجاع به کمیسیون‌های تخصصی را در چارچوب قانون اساسی معیّن می‌کند.",
    url: null,
    documentIdentifier: "آیین‌نامه داخلی مجلس، ماده ۲۰۰",
    status: "valid",
    availability: "available",
    fileName: "قانون اساسی جمهوری اسلامی ایران و ماده (۲۰۰) قانون آیین نامه داخلی مجلس شورای اسلامی.pdf",
    mime: "application/pdf",
    fileSizeBytes: 525246,
    summary:
      "پیوند قانون اساسی با آیین‌نامه داخلی مجلس و فرایند قانون‌گذاری در نظام تقنینی ایران.",
    keywords: ["آیین نامه داخلی مجلس", "ماده ۲۰۰", "قانون گذاری", "طرح", "لایحه", "قانون اساسی"],
  },
  {
    id: "law-civil-procedure",
    title: "قانون آیین دادرسی دادگاه‌های عمومی و انقلاب (در امور مدنی)",
    sourceType: "law",
    sourceTypeFa: "قانون",
    articleSection: "مواد ۱، ۳، ۸۷ و ۵۲۲",
    publicationAuthority: "مجلس شورای اسلامی",
    jurisdiction: "جمهوری اسلامی ایران",
    effectiveDate: "1379-01-21",
    versionDate: null,
    excerpt:
      "ماده ۱: آیین دادرسی مدنی مجموعه اصول و مقرراتی است که در مقام رسیدگی به امور حسبی و کلیه دعاوی مدنی و بازرگانی در دادگاه‌ها به کار می‌رود. ماده ۳: قضات دادگاه‌ها موظف‌اند موافق قوانین به دعاوی رسیدگی کرده، حکم صادر نمایند.",
    url: null,
    documentIdentifier: "مصوب ۱۳۷۹",
    status: "valid",
    availability: "available",
    fileName: "قانون-آیین-دادرسی-مدنی-1.pdf",
    mime: "application/pdf",
    fileSizeBytes: 1645253,
    summary:
      "قانون پایه دادرسی مدنی، تعیین‌کننده صلاحیت دادگاه‌ها، آیین طرح دعوی و صدور آرای مدنی.",
    keywords: ["آیین دادرسی مدنی", "دعوی", "دادگاه", "صلاحیت", "حکم", "خسارت تأخیر تأدیه"],
  },
  {
    id: "law-labor",
    title: "قانون کار جمهوری اسلامی ایران",
    sourceType: "law",
    sourceTypeFa: "قانون",
    articleSection: "مواد ۷، ۵۹ و ۱۹۰",
    publicationAuthority: "مجلس شورای اسلامی",
    jurisdiction: "جمهوری اسلامی ایران",
    effectiveDate: "1369-09-29",
    versionDate: null,
    excerpt:
      "ماده ۷: قرارداد کار عبارت است از قرارداد کتبی یا شفاهی که به موجب آن کارگر در قبال دریافت حق‌السعی، کاری را برای مدت موقت یا غیرموقت برای کارفرما انجام می‌دهد. ماده ۵۹: ارجاع کار اضافی به کارگر علاوه بر مزد عادی، مستلزم پرداخت فوق‌العاده اضافه‌کاری است.",
    url: null,
    documentIdentifier: "مصوب ۱۳۶۹",
    status: "valid",
    availability: "available",
    fileName: "مجموعه_قوانین_و_مقررات_کاربردی_اداری_و_استخدامی_ویراست.pdf",
    mime: "application/pdf",
    fileSizeBytes: 9712213,
    summary:
      "قانون حاکم بر روابط کارگر و کارفرما، قرارداد کار، ساعات کار، اضافه‌کاری و حل اختلافات کارگری.",
    keywords: ["قانون کار", "قرارداد کار", "اضافه کاری", "حق السعی", "کارگر", "کارفرما"],
  },
  {
    id: "law-civil-service",
    title: "قانون مدیریت خدمات کشوری",
    sourceType: "law",
    sourceTypeFa: "قانون",
    articleSection: "مواد ۱، ۵ و ۴۲",
    publicationAuthority: "مجلس شورای اسلامی",
    jurisdiction: "جمهوری اسلامی ایران",
    effectiveDate: "1386-07-08",
    versionDate: null,
    excerpt:
      "ماده ۱: این قانون به منظور ایجاد نظام اداری سالم، کارآمد و پاسخگو، مقررات استخدامی و مدیریتی دستگاه‌های اجرایی را تعیین می‌کند. ماده ۴۲: ورود به خدمت و به کارگیری افراد در دستگاه‌های اجرایی منوط به کسب شرایط عمومی و طی مراحل قانونی است.",
    url: null,
    documentIdentifier: "مصوب ۱۳۸۶",
    status: "valid",
    availability: "available",
    fileName: "مجموعه_قوانین_و_مقررات_کاربردی_اداری_و_استخدامی_ویراست.pdf",
    mime: "application/pdf",
    fileSizeBytes: 9712213,
    summary:
      "قانون جامع استخدام و مدیریت اداری کشور، شامل شرایط ورود به خدمت و نظام پرداخت کارکنان دولت.",
    keywords: ["مدیریت خدمات کشوری", "استخدام", "دستگاه اجرایی", "کارمند دولت", "نظام اداری"],
  },
  {
    id: "law-penalty-clause",
    title: "وجه التزام (شرط کیفری) — ماده ۲۳۰ قانون مدنی",
    sourceType: "law",
    sourceTypeFa: "قانون",
    articleSection: "ماده ۲۳۰ قانون مدنی",
    publicationAuthority: "مجلس شورای ملی",
    jurisdiction: "جمهوری اسلامی ایران",
    effectiveDate: "1307-02-18",
    versionDate: null,
    excerpt:
      "اگر در ضمن معامله شرط شده باشد که در صورت تخلف، متخلف مبلغی به عنوان خسارت تأدیه نماید، حاکم نمی‌تواند او را به بیشتر یا کمتر از آنچه ملزم شده است محکوم کند.",
    url: null,
    documentIdentifier: "ق.م. ماده ۲۳۰",
    status: "valid",
    availability: "available",
    fileName: "ECONOMLAW تحليل اقتصادي و حقوقي اعتبار شرط كيفري(وجه التزام).pdf",
    mime: "application/pdf",
    fileSizeBytes: 194927,
    summary:
      "تحلیل اقتصادی و حقوقی اعتبار شرط کیفری (وجه التزام) و آثار آن در تعهدات قراردادی.",
    keywords: ["وجه التزام", "شرط کیفری", "ماده ۲۳۰ قانون مدنی", "خسارت قراردادی", "تخلف قراردادی"],
  },
  {
    id: "law-penalty-clause-iran",
    title: "وجه التزام در حقوق ایران",
    sourceType: "law",
    sourceTypeFa: "قانون",
    articleSection: "ماده ۲۳۰ قانون مدنی و آرای مرتبط",
    publicationAuthority: "قوه قضائیه / دکترین حقوقی",
    jurisdiction: "جمهوری اسلامی ایران",
    effectiveDate: "1307-02-18",
    versionDate: null,
    excerpt:
      "وجه التزام توافقی است که به موجب آن طرفین مبلغ معینی را به عنوان جبران خسارت ناشی از عدم انجام یا تأخیر در انجام تعهد از پیش تعیین می‌کنند؛ این توافق تا زمانی که مخالف قواعد آمره نباشد برای طرفین الزام‌آور است.",
    url: null,
    documentIdentifier: "وجه التزام — دکترین و رویه",
    status: "valid",
    availability: "available",
    fileName: "JHVMN_Volume 5_Issue 1_Pages 1-25 وجه التزام در حقوق ایران.pdf",
    mime: "application/pdf",
    fileSizeBytes: 799144,
    summary:
      "مبانی فقهی و حقوقی وجه التزام در نظام حقوقی ایران و شرایط تعدیل آن توسط دادگاه.",
    keywords: ["وجه التزام", "شرط کیفری", "تعدیل خسارت", "قانون مدنی", "تعهد قراردادی"],
  },
  {
    id: "law-monetary-banking",
    title: "قانون پولی و بانکی کشور",
    sourceType: "law",
    sourceTypeFa: "قانون",
    articleSection: "مواد ۱ و ۱۰",
    publicationAuthority: "مجلس شورای ملی",
    jurisdiction: "جمهوری اسلامی ایران",
    effectiveDate: "1351-04-18",
    versionDate: null,
    excerpt:
      "ماده ۱: واحد پول رسمی ایران ریال است. ماده ۱۰: بانک مرکزی جمهوری اسلامی ایران مسئول تنظیم حجم پول، حفظ ارزش پول و نظارت بر عملیات بانک‌ها است.",
    url: null,
    documentIdentifier: "مصوب ۱۳۵۱",
    status: "valid",
    availability: "available",
    fileName: "قانون-بانکی-و-پولی-کشور.pdf",
    mime: "application/pdf",
    fileSizeBytes: 303388,
    summary:
      "قانون بنیادین نظام پولی و بانکی کشور و تعیین وظایف و اختیارات بانک مرکزی.",
    keywords: ["قانون پولی و بانکی", "ریال", "بانک مرکزی", "سیاست پولی", "نظام بانکی"],
  },
  {
    id: "law-central-bank",
    title: "نکات قانون بانک مرکزی جمهوری اسلامی ایران",
    sourceType: "regulation",
    sourceTypeFa: "آیین‌نامه",
    articleSection: "مواد ۱۰ و ۴۴",
    publicationAuthority: "بانک مرکزی جمهوری اسلامی ایران",
    jurisdiction: "جمهوری اسلامی ایران",
    effectiveDate: "1351-04-18",
    versionDate: null,
    excerpt:
      "بانک مرکزی به عنوان بانکدار دولت، نهاد ناظر بر شبکه بانکی و مرجع تعیین نرخ سود بانکی و انتشار اسکناس عمل می‌کند و مسئول حفظ ثبات پولی و ارزی کشور است.",
    url: null,
    documentIdentifier: "بانک مرکزی — خلاصه نکات",
    status: "valid",
    availability: "available",
    fileName: "kholase-ghanun-bank-markazi نکات قانون های بانک مرکزی ایران.pdf",
    mime: "application/pdf",
    fileSizeBytes: 1221392,
    summary:
      "خلاصه نکات کاربردی قانون بانک مرکزی، شامل وظایف نظارتی و تعیین نرخ سود بانکی.",
    keywords: ["بانک مرکزی", "نرخ سود", "نظارت بانکی", "سیاست پولی", "خسارت تأخیر تأدیه"],
  },
  {
    id: "law-divorce",
    title: "طلاق و آثار ناشی از آن",
    sourceType: "law",
    sourceTypeFa: "قانون",
    articleSection: "مواد ۱۱۳۳، ۱۱۴۳ و ۱۱۴۶ قانون مدنی",
    publicationAuthority: "مجلس شورای ملی",
    jurisdiction: "جمهوری اسلامی ایران",
    effectiveDate: "1307-02-18",
    versionDate: null,
    excerpt:
      "ماده ۱۱۳۳: مرد می‌تواند با رعایت شرایط مقرر در قانون، با مراجعه به دادگاه تقاضای طلاق همسرش را بنماید؛ زن نیز در موارد مقرر قانونی می‌تواند از دادگاه تقاضای طلاق نماید. ماده ۱۱۴۳: طلاق مخصوص عقد دائم است.",
    url: null,
    documentIdentifier: "ق.م. مواد ۱۱۳۳ و ۱۱۴۳",
    status: "valid",
    availability: "available",
    fileName: "تصميمات نهايي دادگاه در طلاق و آثار ناشی از آن.pdf",
    mime: "application/pdf",
    fileSizeBytes: 267268,
    summary:
      "شرایط طلاق، انواع آن (رِجعی و بائن)، مهریه، نفقه، حضانت و آثار مالی و غیرمالی انحلال نکاح.",
    keywords: ["طلاق", "مهریه", "نفقه", "حضانت", "طلاق رجعی", "طلاق بائن"],
  },
  {
    id: "law-customs",
    title: "قانون امور گمرکی",
    sourceType: "law",
    sourceTypeFa: "قانون",
    articleSection: "مواد ۱ و ۵۳",
    publicationAuthority: "مجلس شورای اسلامی",
    jurisdiction: "جمهوری اسلامی ایران",
    effectiveDate: "1390-08-22",
    versionDate: null,
    excerpt:
      "ماده ۱: گمرک سازمانی است دولتی که وظیفه اجرای قوانین و مقررات گمرکی و وصول حقوق ورودی و عوارض را بر عهده دارد. ماده ۵۳: ترخیص کالا از گمرک منوط به انجام تشریفات گمرکی و پرداخت حقوق و عوارض قانونی است.",
    url: null,
    documentIdentifier: "مصوب ۱۳۹۰",
    status: "valid",
    availability: "available",
    fileName: "قانون امور گمركي.pdf",
    mime: "application/pdf",
    fileSizeBytes: 867004,
    summary:
      "قانون حاکم بر تشریفات گمرکی، تعرفه، ارزش گمرکی کالا و حقوق ورودی.",
    keywords: ["گمرک", "حقوق ورودی", "تعرفه", "ترخیص کالا", "ارزش گمرکی"],
  },
  {
    id: "law-cheque",
    title: "قانون صدور چک (اصلاحی)",
    sourceType: "law",
    sourceTypeFa: "قانون",
    articleSection: "مواد ۱، ۳، ۱۳ و ۲۳",
    publicationAuthority: "مجلس شورای اسلامی",
    jurisdiction: "جمهوری اسلامی ایران",
    effectiveDate: "1397-08-13",
    versionDate: null,
    excerpt:
      "ماده ۳: صادرکننده چک باید در تاریخ مندرج در آن معادل مبلغ چک در بانک محال‌علیه وجه نقد یا اعتبار قابل استفاده داشته باشد. ماده ۱۳: دارنده چک می‌تواند خسارت تأخیر تأدیه را از تاریخ سررسید مطالبه کند.",
    url: null,
    documentIdentifier: "اصلاحی ۱۳۹۷",
    status: "amended",
    availability: "available",
    fileName: "قانون-صدور-چک-اصلاحی-1.pdf",
    mime: "application/pdf",
    fileSizeBytes: 1471931,
    summary:
      "قانون اصلاحی صدور چک، شامل ضمانت اجراهای کیفری، ثبت در سامانه صیاد و مطالبه خسارت تأخیر تأدیه.",
    keywords: ["چک", "چک برگشتی", "سامانه صیاد", "چک بلامحل", "خسارت تأخیر تأدیه"],
  },
  {
    id: "law-hs",
    title: "قواعد عمومی تفسیر سیستم هماهنگ (HS)",
    sourceType: "regulation",
    sourceTypeFa: "آیین‌نامه",
    articleSection: "قواعد عمومی ۱ تا ۶",
    publicationAuthority: "سازمان جهانی گمرک / گمرک ایران",
    jurisdiction: "بین‌المللی / جمهوری اسلامی ایران",
    effectiveDate: "1366-01-01",
    versionDate: null,
    excerpt:
      "قاعده ۱: عنوان بخش‌ها، فصل‌ها و زیرفصل‌ها فقط جنبه راهنمایی دارد و طبقه‌بندی قانونی کالا باید بر اساس عبارات ردیف‌ها و یادداشت‌های بخش و فصل تعیین شود.",
    url: null,
    documentIdentifier: "HS — قواعد عمومی تفسیر",
    status: "valid",
    availability: "available",
    fileName: "قواعد عمومی برای تفسیر سیستم همآهنگ )HS).pdf",
    mime: "application/pdf",
    fileSizeBytes: 8504490,
    summary:
      "شش قاعده عمومی تفسیر نظام هماهنگ‌شده توصیف و کدگذاری کالا (HS) برای طبقه‌بندی صحیح تعرفه‌ای.",
    keywords: ["HS", "سیستم هماهنگ", "طبقه بندی کالا", "کد تعرفه", "گمرک"],
  },
  {
    id: "law-delayed-payment",
    title: "خسارت تأخیر تأدیه — ماده ۵۲۲ آیین دادرسی مدنی",
    sourceType: "law",
    sourceTypeFa: "قانون",
    articleSection: "ماده ۵۲۲ آیین دادرسی مدنی",
    publicationAuthority: "مجلس شورای اسلامی",
    jurisdiction: "جمهوری اسلامی ایران",
    effectiveDate: "1379-01-21",
    versionDate: null,
    excerpt:
      "در دعاویی که موضوع آن دین و از نوع وجه رایج بوده و با مطالبه داین و تمکّن مدیون، مدیون از پرداخت امتناع نموده، در صورت تغییر فاحش شاخص قیمت سالانه، دادگاه می‌تواند خسارت تأخیر تأدیه را بر اساس شاخص قیمت بانک مرکزی محاسبه و تعیین کند.",
    url: null,
    documentIdentifier: "آ.د.م. ماده ۵۲۲",
    status: "valid",
    availability: "available",
    fileName: "قواعد و شرایط حاکم بر مطالبۀ خسارت تأخیر تأدیه در.pdf",
    mime: "application/pdf",
    fileSizeBytes: 172703,
    summary:
      "شرایط و قواعد مطالبه خسارت تأخیر تأدیه، مبانی محاسبه و رویه قضایی مرتبط با آن.",
    keywords: ["خسارت تأخیر تأدیه", "ماده ۵۲۲", "شاخص بانک مرکزی", "دین", "وجه رایج"],
  },
  {
    id: "law-civil-procedure-doctrine",
    title: "آیین دادرسی مدنی (مبانی و دکترین)",
    sourceType: "law",
    sourceTypeFa: "قانون",
    articleSection: "مواد ۱، ۳، ۵۱۱ و ۵۲۲",
    publicationAuthority: "دکترین حقوقی / قوه قضائیه",
    jurisdiction: "جمهوری اسلامی ایران",
    effectiveDate: "1379-01-21",
    versionDate: null,
    excerpt:
      "آیین دادرسی مدنی با تبیین شرایط اقامه دعوی، تشریفات رسیدگی، ادله اثبات دعوی و صدور رأی، تضمین‌کننده دادرسی عادلانه و حقوق اصحاب دعواست.",
    url: null,
    documentIdentifier: "آیین دادرسی مدنی — شرح و مبانی",
    status: "valid",
    availability: "available",
    fileName: "جزوه ایین دادرسی مدنی 1 بر اساس کتاب آیین دادرسی مدنی1 دکتر شمش.pdf",
    mime: "application/pdf",
    fileSizeBytes: 968155,
    summary:
      "شرح و مبانی آیین دادرسی مدنی بر اساس منابع دکترین، برای فهم عمیق‌تر تشریفات دادرسی.",
    keywords: ["آیین دادرسی مدنی", "دکترین", "ادله اثبات", "دعوی", "رأی"],
  },
  {
    id: "law-social-security",
    title: "قانون تأمین اجتماعی",
    sourceType: "law",
    sourceTypeFa: "قانون",
    articleSection: "ماده ۳۹",
    publicationAuthority: "مجلس شورای ملی",
    jurisdiction: "جمهوری اسلامی ایران",
    effectiveDate: "1354-03-31",
    versionDate: null,
    excerpt:
      "ماده ۳۹: کارفرما مسئول پرداخت حق بیمه سهم خود و بیمه‌شده به سازمان است و مکلف است در موقع پرداخت مزد یا حقوق، سهم بیمه‌شده را کسر و به همراه سهم خود به سازمان پرداخت نماید.",
    url: null,
    documentIdentifier: "مصوب ۱۳۵۴",
    status: "valid",
    availability: "available",
    fileName: "مجموعه_قوانین_و_مقررات_کاربردی_اداری_و_استخدامی_ویراست.pdf",
    mime: "application/pdf",
    fileSizeBytes: 9712213,
    summary:
      "قانون حاکم بر بیمه‌های اجتماعی کارگران، تعیین سهم کارگر، کارفرما و دولت در پرداخت حق بیمه.",
    keywords: ["تأمین اجتماعی", "حق بیمه", "بیمه کارکنان", "کارفرما", "بازنشستگی"],
  },
];

// ============================================================
// Documented service examples (خدمات)
// ============================================================

export interface LawServiceExample {
  id: string;
  title: string;
  description: string;
  category: "consultation" | "contracts" | "documents" | "cases" | "calculations";
  duration: string;
  outputType: "متن" | "سند PDF" | "گزارش";
  href: string;
  /** Law source ids that document this service. */
  lawRefs: string[];
}

export const LAW_SERVICE_EXAMPLES: LawServiceExample[] = [
  // ---- Consultation (مشاوره) ----
  {
    id: "law-consult-constitution",
    title: "مشاوره دادرسی عادلانه و حقوق شهروندی",
    description: "بررسی تضمین‌های قانون اساسی شامل اصل برائت و حق دادخواهی در موضوع شما",
    category: "consultation",
    duration: "~۱۰ دقیقه",
    outputType: "متن",
    href: "/chat",
    lawRefs: ["law-constitution"],
  },
  {
    id: "law-consult-procedure",
    title: "مشاوره نحوه طرح دعوی مدنی",
    description: "راهنمایی صلاحیت دادگاه، شرایط اقامه دعوی و تشریفات آیین دادرسی مدنی",
    category: "consultation",
    duration: "~۱۰ دقیقه",
    outputType: "متن",
    href: "/chat",
    lawRefs: ["law-civil-procedure", "law-civil-procedure-doctrine"],
  },
  {
    id: "law-consult-penalty",
    title: "مشاوره وجه التزام و شرط کیفری",
    description: "بررسی اعتبار شرط وجه التزام و امکان تعدیل آن توسط دادگاه (ماده ۲۳۰ ق.م.)",
    category: "consultation",
    duration: "~۱۰ دقیقه",
    outputType: "گزارش",
    href: "/chat",
    lawRefs: ["law-penalty-clause", "law-penalty-clause-iran"],
  },
  {
    id: "law-consult-delayed",
    title: "مشاوره مطالبه خسارت تأخیر تأدیه",
    description: "شرایط ماده ۵۲۲ آ.د.م. و نحوه محاسبه خسارت بر اساس شاخص بانک مرکزی",
    category: "consultation",
    duration: "~۱۰ دقیقه",
    outputType: "گزارش",
    href: "/chat",
    lawRefs: ["law-delayed-payment", "law-central-bank"],
  },
  {
    id: "law-consult-divorce",
    title: "مشاوره طلاق و آثار مالی آن",
    description: "شرایط طلاق، مهریه، نفقه، حضانت و آثار انحلال نکاح (مواد ۱۱۳۳ و ۱۱۴۳ ق.م.)",
    category: "consultation",
    duration: "~۱۵ دقیقه",
    outputType: "گزارش",
    href: "/chat",
    lawRefs: ["law-divorce"],
  },
  {
    id: "law-consult-cheque",
    title: "مشاوره چک برگشتی و حقوق دارنده",
    description: "ضمانت اجراهای کیفری و حقوقی چک بلامحل و مطالبه خسارت تأخیر تأدیه",
    category: "consultation",
    duration: "~۱۰ دقیقه",
    outputType: "متن",
    href: "/chat",
    lawRefs: ["law-cheque"],
  },
  {
    id: "law-consult-labor",
    title: "مشاوره حقوق کار و بیمه تأمین اجتماعی",
    description: "تکالیف کارفرما در بیمه کارکنان، ساعات کار و فوق‌العاده اضافه‌کاری",
    category: "consultation",
    duration: "~۱۰ دقیقه",
    outputType: "متن",
    href: "/chat",
    lawRefs: ["law-labor", "law-social-security"],
  },
  {
    id: "law-consult-customs",
    title: "مشاوره ترخیص کالا از گمرک",
    description: "تشریفات گمرکی، تعرفه و ارزش گمرکی کالا طبق قانون امور گمرکی",
    category: "consultation",
    duration: "~۱۰ دقیقه",
    outputType: "گزارش",
    href: "/chat",
    lawRefs: ["law-customs", "law-hs"],
  },

  // ---- Contracts (قراردادها) ----
  {
    id: "law-ctr-penalty",
    title: "تنظیم شرط وجه التزام در قرارداد",
    description: "درج شرط کیفری معتبر و قابل اجرا مطابق ماده ۲۳۰ قانون مدنی",
    category: "contracts",
    duration: "~۱۰ دقیقه",
    outputType: "سند PDF",
    href: "/contracts",
    lawRefs: ["law-penalty-clause", "law-penalty-clause-iran"],
  },
  {
    id: "law-ctr-labor",
    title: "قرارداد کار مطابق قانون کار",
    description: "تنظیم قرارداد کار با رعایت ماده ۷ قانون کار و تکالیف بیمه تأمین اجتماعی",
    category: "contracts",
    duration: "~۱۵ دقیقه",
    outputType: "سند PDF",
    href: "/contracts",
    lawRefs: ["law-labor", "law-social-security"],
  },
  {
    id: "law-ctr-delayed",
    title: "قرارداد با شرط خسارت تأخیر تأدیه",
    description: "درج شرط خسارت تأخیر و ضمانت اجرای آن مطابق ماده ۵۲۲ آ.د.م.",
    category: "contracts",
    duration: "~۱۵ دقیقه",
    outputType: "سند PDF",
    href: "/contracts",
    lawRefs: ["law-delayed-payment", "law-civil-procedure"],
  },
  {
    id: "law-ctr-civil-service",
    title: "قرارداد استخدامی خدمات کشوری",
    description: "تنظیم قرارداد استخدام در چارچوب قانون مدیریت خدمات کشوری",
    category: "contracts",
    duration: "~۱۵ دقیقه",
    outputType: "سند PDF",
    href: "/contracts",
    lawRefs: ["law-civil-service"],
  },
  {
    id: "law-ctr-banking",
    title: "قرارداد و ضوابط اعتباری بانکی",
    description: "بررسی قراردادهای اعتباری و تسهیلات در چارچوب قانون پولی و بانکی کشور",
    category: "contracts",
    duration: "~۱۵ دقیقه",
    outputType: "گزارش",
    href: "/contracts",
    lawRefs: ["law-monetary-banking", "law-central-bank"],
  },
  {
    id: "law-ctr-customs",
    title: "قرارداد و اسناد ترخیص کالا",
    description: "تنظیم اسناد و قراردادهای مرتبط با ترخیص کالا طبق قانون امور گمرکی",
    category: "contracts",
    duration: "~۱۵ دقیقه",
    outputType: "سند PDF",
    href: "/contracts",
    lawRefs: ["law-customs", "law-hs"],
  },

  // ---- Documents (اسناد) ----
  {
    id: "law-doc-petition",
    title: "تنظیم دادخواست با استناد آیین دادرسی مدنی",
    description: "تنظیم دادخواست رسمی با رعایت شرایط اقامه دعوی و صلاحیت دادگاه",
    category: "documents",
    duration: "~۱۵ دقیقه",
    outputType: "سند PDF",
    href: "/chat",
    lawRefs: ["law-civil-procedure", "law-civil-procedure-doctrine"],
  },
  {
    id: "law-doc-constitution",
    title: "تنظیم لایحه دفاعیه با استناد به قانون اساسی",
    description: "تنظیم لایحه با تکیه بر اصل برائت، حق دادخواهی و دادرسی عادلانه",
    category: "documents",
    duration: "~۱۵ دقیقه",
    outputType: "سند PDF",
    href: "/chat",
    lawRefs: ["law-constitution"],
  },
  {
    id: "law-doc-cheque-notice",
    title: "تنظیم اظهارنامه مطالبه وجه چک",
    description: "ارسال اظهارنامه قانونی برای مطالبه وجه چک و خسارت تأخیر تأدیه",
    category: "documents",
    duration: "~۱۰ دقیقه",
    outputType: "سند PDF",
    href: "/chat",
    lawRefs: ["law-cheque"],
  },
  {
    id: "law-doc-delayed-petition",
    title: "تنظیم دادخواست مطالبه خسارت تأخیر تأدیه",
    description: "تنظیم دادخواست مطالبه خسارت با استناد ماده ۵۲۲ آ.د.م.",
    category: "documents",
    duration: "~۱۵ دقیقه",
    outputType: "سند PDF",
    href: "/chat",
    lawRefs: ["law-delayed-payment"],
  },
  {
    id: "law-doc-cheque-complaint",
    title: "تنظیم شکوائیه چک بلامحل",
    description: "تنظیم شکایت کیفری چک بلامحل طبق قانون صدور چک اصلاحی",
    category: "documents",
    duration: "~۱۵ دقیقه",
    outputType: "سند PDF",
    href: "/chat",
    lawRefs: ["law-cheque"],
  },
  {
    id: "law-doc-divorce",
    title: "تنظیم دادخواست طلاق",
    description: "تنظیم دادخواست طلاق با رعایت شرایط قانونی مواد ۱۱۳۳ و ۱۱۴۳ ق.م.",
    category: "documents",
    duration: "~۱۵ دقیقه",
    outputType: "سند PDF",
    href: "/chat",
    lawRefs: ["law-divorce"],
  },
  {
    id: "law-doc-customs",
    title: "تنظیم اظهارنامه گمرکی",
    description: "تنظیم اظهارنامه و اسناد ترخیص کالا مطابق قانون امور گمرکی",
    category: "documents",
    duration: "~۱۰ دقیقه",
    outputType: "سند PDF",
    href: "/chat",
    lawRefs: ["law-customs", "law-hs"],
  },

  // ---- Cases (پرونده‌ها) ----
  {
    id: "law-case-labor",
    title: "تحلیل پرونده اختلاف کارگری",
    description: "تحلیل اختلافات کارگر و کارفرما بر اساس قانون کار و قانون تأمین اجتماعی",
    category: "cases",
    duration: "~۱۰ دقیقه",
    outputType: "گزارش",
    href: "/chat",
    lawRefs: ["law-labor", "law-social-security"],
  },
  {
    id: "law-case-penalty",
    title: "تحلیل پرونده وجه التزام",
    description: "تحلیل اختلاف ناشی از شرط وجه التزام و قابلیت تعدیل آن",
    category: "cases",
    duration: "~۱۰ دقیقه",
    outputType: "گزارش",
    href: "/chat",
    lawRefs: ["law-penalty-clause", "law-penalty-clause-iran"],
  },
  {
    id: "law-case-cheque",
    title: "تحلیل پرونده چک برگشتی",
    description: "تحلیل حقوقی و کیفری پرونده چک بلامحل و مسیر مطالبه وجه",
    category: "cases",
    duration: "~۱۰ دقیقه",
    outputType: "گزارش",
    href: "/chat",
    lawRefs: ["law-cheque"],
  },
  {
    id: "law-case-divorce",
    title: "تحلیل پرونده طلاق و آثار آن",
    description: "تحلیل آثار مالی و غیرمالی طلاق شامل مهریه، نفقه و حضانت",
    category: "cases",
    duration: "~۱۰ دقیقه",
    outputType: "گزارش",
    href: "/chat",
    lawRefs: ["law-divorce"],
  },
  {
    id: "law-case-delayed",
    title: "تحلیل پرونده تأخیر تأدیه",
    description: "تحلیل شرایط و مبنای محاسبه خسارت تأخیر تأدیه در پرونده",
    category: "cases",
    duration: "~۱۰ دقیقه",
    outputType: "گزارش",
    href: "/chat",
    lawRefs: ["law-delayed-payment", "law-central-bank"],
  },
  {
    id: "law-case-customs",
    title: "تحلیل پرونده گمرکی",
    description: "تحلیل اختلافات تعرفه‌ای و ترخیص کالا بر اساس قانون امور گمرکی",
    category: "cases",
    duration: "~۱۰ دقیقه",
    outputType: "گزارش",
    href: "/chat",
    lawRefs: ["law-customs", "law-hs"],
  },

  // ---- Calculations (محاسبات) ----
  {
    id: "law-calc-penalty",
    title: "محاسبه وجه التزام",
    description: "محاسبه مبلغ وجه التزام قراردادی بر اساس نرخ تعیین‌شده در شرط",
    category: "calculations",
    duration: "~۵ دقیقه",
    outputType: "متن",
    href: "/chat?category=calculator",
    lawRefs: ["law-penalty-clause"],
  },
  {
    id: "law-calc-delayed",
    title: "محاسبه خسارت تأخیر تأدیه",
    description: "محاسبه خسارت بر اساس شاخص قیمت بانک مرکزی (ماده ۵۲۲ آ.د.م.)",
    category: "calculations",
    duration: "~۵ دقیقه",
    outputType: "متن",
    href: "/chat?category=calculator",
    lawRefs: ["law-delayed-payment", "law-central-bank"],
  },
  {
    id: "law-calc-insurance",
    title: "محاسبه حق بیمه تأمین اجتماعی",
    description: "محاسبه سهم کارگر، کارفرما و دولت در پرداخت حق بیمه",
    category: "calculations",
    duration: "~۵ دقیقه",
    outputType: "متن",
    href: "/chat?category=calculator",
    lawRefs: ["law-social-security", "law-labor"],
  },
  {
    id: "law-calc-overtime",
    title: "محاسبه فوق‌العاده اضافه‌کاری",
    description: "محاسبه اضافه‌کاری بر اساس نرخ مقرر در قانون کار",
    category: "calculations",
    duration: "~۵ دقیقه",
    outputType: "متن",
    href: "/chat?category=calculator",
    lawRefs: ["law-labor"],
  },
  {
    id: "law-calc-customs",
    title: "محاسبه ارزش گمرکی کالا",
    description: "محاسبه ارزش گمرکی و حقوق ورودی بر اساس طبقه‌بندی HS",
    category: "calculations",
    duration: "~۵ دقیقه",
    outputType: "متن",
    href: "/chat?category=calculator",
    lawRefs: ["law-hs", "law-customs"],
  },
  {
    id: "law-calc-court-fee",
    title: "محاسبه هزینه دادرسی",
    description: "محاسبه هزینه دادرسی بر اساس نوع دعوی و خواسته مطابق آیین دادرسی مدنی",
    category: "calculations",
    duration: "~۵ دقیقه",
    outputType: "متن",
    href: "/chat?category=calculator",
    lawRefs: ["law-civil-procedure"],
  },
];

// ============================================================
// Lookup helpers
// ============================================================

export function getLawById(id: string): LawSourceDef | undefined {
  return LAW_SOURCES.find((l) => l.id === id);
}

/** Map a law source to the Phase-8 V1SourceDetail consumed by the chat tabs. */
export function lawSourceToV1SourceDetail(def: LawSourceDef): V1SourceDetail {
  return {
    id: def.id,
    sourceType: def.sourceType,
    sourceTypeFa: def.sourceTypeFa,
    title: def.title,
    articleSection: def.articleSection,
    publicationAuthority: def.publicationAuthority,
    jurisdiction: def.jurisdiction,
    effectiveDate: def.effectiveDate,
    versionDate: def.versionDate,
    excerpt: def.excerpt,
    url: def.url,
    documentIdentifier: def.documentIdentifier,
    status: def.status,
    availability: def.availability,
  };
}

/** Build the اسناد rows for the 16 files (owned by the given user). */
export function buildLawDocuments(userId: string): V1DocumentDetail[] {
  const baseDate = "2026-08-18T09:00:00Z";
  return LAW_SOURCES.map((def) => ({
    id: `doc-${def.id}`,
    userId,
    name: def.fileName,
    mime: def.mime,
    sizeBytes: def.fileSizeBytes,
    status: "ready",
    storageKey: null,
    createdAt: baseDate,
    updatedAt: baseDate,
    jobs: [],
    report: null,
    extractedText: `${def.title}\n${def.articleSection}\n${def.excerpt}`,
    previewUrl: null,
  }));
}

/** Build the حافظه rows for the 16 laws (legal_context category). */
export function buildLawMemories(userId: string): V1MemoryItem[] {
  const baseDate = "2026-08-18T09:00:00Z";
  return LAW_SOURCES.map((def, i) => ({
    id: `mem-law-${i + 1}`,
    userId,
    key: def.title,
    value: `${def.articleSection} — ${def.summary}`,
    category: "legal_context" as const,
    categoryFa: "اطلاعات حقوقی",
    sensitivity: "normal" as const,
    sensitivityFa: "عادی",
    status: "active" as const,
    createdAt: baseDate,
    updatedAt: baseDate,
    consentGiven: true,
    consentDate: baseDate,
  }));
}
