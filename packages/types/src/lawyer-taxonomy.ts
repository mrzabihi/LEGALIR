// ============================================================
// LEGALIR — Lawyer taxonomy, services & practice-context catalogs
// ============================================================
// A SINGLE generic, four-level taxonomy replaces the flat `LegalCategory`
// union for the lawyer marketplace:
//
//   DOMAIN → SPECIALTY → SUB_SPECIALTY → LEGAL_ISSUE
//
// Every node is a `LawyerTaxonomyNode` with a stable dotted-path id
// (`family.divorce.mutual`). A lawyer's expertise is stored as a set of node
// ids, so a filter for «طلاق توافقی» matches a lawyer tagged with `family`
// (via an ancestor walk) and free-text search matches node synonyms too.
//
// This module is PURE STATIC DATA + LOOKUPS — no file I/O, no network, no
// dates. It is ADDITIVE: the legacy `LEGAL_CATEGORY_FA` map in ./platform.ts
// is untouched, and it deliberately does NOT redefine `LawyerActivityType`
// (which already lives in ./platform.ts and is re-exported by ./index.ts).
// ============================================================

// ---------------------------------------------------------------------------
// Taxonomy node model
// ---------------------------------------------------------------------------

/** The four levels of the expertise tree. */
export type LawyerTaxonomyType = "DOMAIN" | "SPECIALTY" | "SUB_SPECIALTY" | "LEGAL_ISSUE";

/** Persian labels for the four levels. */
export const LAWYER_TAXONOMY_TYPE_FA: Record<LawyerTaxonomyType, string> = {
  DOMAIN: "حوزهٔ حقوقی",
  SPECIALTY: "تخصص",
  SUB_SPECIALTY: "زیرتخصص",
  LEGAL_ISSUE: "موضوع حقوقی",
};

/**
 * One node of the expertise tree. `id` is a stable, human-readable dotted
 * path derived from ancestor slugs — it is the value stored on a lawyer's
 * expertise record, so it must never be reordered or renamed without a
 * migration.
 */
export interface LawyerTaxonomyNode {
  /** Stable dotted-path id, e.g. `family.divorce.mutual`. */
  id: string;
  /** Parent node id, or null for a top-level DOMAIN. */
  parentId: string | null;
  type: LawyerTaxonomyType;
  nameFa: string;
  /** The node's own slug (last path segment). */
  slug: string;
  /** Extra Persian search terms (colloquial / alternate spellings). */
  synonyms: string[];
  /** Key into the app icon map, or null. */
  icon: string | null;
  /** Sibling order within the parent, ascending. */
  displayOrder: number;
}

// ---------------------------------------------------------------------------
// Tree definition (compact nested spec, flattened once at module load)
// ---------------------------------------------------------------------------

interface NodeSpec {
  slug: string;
  nameFa: string;
  synonyms?: string[];
  icon?: string;
  children?: NodeSpec[];
}

const LEVELS: LawyerTaxonomyType[] = ["DOMAIN", "SPECIALTY", "SUB_SPECIALTY", "LEGAL_ISSUE"];

function flatten(
  specs: NodeSpec[],
  parentId: string | null,
  depth: number,
  out: LawyerTaxonomyNode[]
): void {
  const type: LawyerTaxonomyType = LEVELS[Math.min(depth, LEVELS.length - 1)] ?? "LEGAL_ISSUE";
  specs.forEach((spec, index) => {
    const id = parentId ? `${parentId}.${spec.slug}` : spec.slug;
    out.push({
      id,
      parentId,
      type,
      nameFa: spec.nameFa,
      slug: spec.slug,
      synonyms: spec.synonyms ?? [],
      icon: spec.icon ?? null,
      displayOrder: index,
    });
    if (spec.children && spec.children.length > 0) {
      flatten(spec.children, id, depth + 1, out);
    }
  });
}

/**
 * The twenty legal domains and their specialty → sub-specialty → issue
 * sub-trees. Order here is the canonical display order.
 */
const TAXONOMY_TREE: NodeSpec[] = [
  {
    slug: "family",
    nameFa: "خانواده",
    icon: "Users",
    synonyms: ["احوال شخصیه", "خانوادگی"],
    children: [
      {
        slug: "divorce",
        nameFa: "طلاق",
        synonyms: ["جدایی", "تفریق"],
        children: [
          { slug: "mutual", nameFa: "طلاق توافقی", synonyms: ["توافقی", "رضایتی"] },
          { slug: "judicial", nameFa: "طلاق یک‌طرفه", synonyms: ["طلاق قضایی", "طلاق به درخواست زوجه"] },
          { slug: "khula", nameFa: "طلاق خلع", synonyms: ["خلع"] },
          { slug: "mubarat", nameFa: "طلاق مبارات", synonyms: ["مبارات"] },
        ],
      },
      {
        slug: "marriage",
        nameFa: "ازدواج و نکاح",
        synonyms: ["عقد", "نکاح"],
        children: [
          { slug: "permanent", nameFa: "عقد دائم" },
          { slug: "temporary", nameFa: "عقد موقت", synonyms: ["صیغه", "متعه"] },
          { slug: "registration", nameFa: "ثبت ازدواج و طلاق" },
          { slug: "marriage_annulment", nameFa: "بطلان نکاح", synonyms: ["فسخ نکاح"] },
        ],
      },
      {
        slug: "dowry",
        nameFa: "مهریه",
        synonyms: ["مهر", "صداق"],
        children: [
          { slug: "collection", nameFa: "مطالبه مهریه", synonyms: ["وصول مهریه"] },
          { slug: "installment", nameFa: "تقسیط مهریه" },
          { slug: "dowry_execution", nameFa: "اجرای مهریه" },
        ],
      },
      { slug: "alimony", nameFa: "نفقه", synonyms: ["نفقه زوجه", "هزینه زندگی"] },
      {
        slug: "custody",
        nameFa: "حضانت و ملاقات فرزند",
        synonyms: ["فرزند", "حضانت"],
        children: [
          { slug: "custody_order", nameFa: "حضانت" },
          { slug: "visitation", nameFa: "ملاقات فرزند", synonyms: ["رؤیت فرزند"] },
          { slug: "abduction", nameFa: "ربایش و عدم استرداد فرزند" },
        ],
      },
      { slug: "filiation", nameFa: "نسب و اثبات نسب", synonyms: ["نسب", "رابطه پدر و فرزند"] },
      { slug: "guardianship", nameFa: "ولایت و قیمومت", synonyms: ["قیم", "ولی قهری", "امور محجورین"] },
      { slug: "domestic_violence", nameFa: "خشونت خانگی", synonyms: ["همسرآزاری"] },
      { slug: "family_mediation", nameFa: "میانجی‌گری خانوادگی", synonyms: ["حل اختلاف خانوادگی"] },
    ],
  },
  {
    slug: "criminal",
    nameFa: "کیفری",
    icon: "Scale",
    synonyms: ["جزایی", "جنایی", "دادسرا"],
    children: [
      {
        slug: "property_crimes",
        nameFa: "جرائم علیه اموال",
        synonyms: ["مالی", "جرائم مالی"],
        children: [
          { slug: "theft", nameFa: "سرقت", synonyms: ["دزدی", "سرقت مسلحانه"] },
          { slug: "fraud", nameFa: "کلاهبرداری", synonyms: ["فریب", "تحصیل مال نامشروع"] },
          { slug: "embezzlement", nameFa: "خیانت در امانت" },
          { slug: "destruction", nameFa: "تخریب و اتلاف اموال" },
        ],
      },
      {
        slug: "people_crimes",
        nameFa: "جرائم علیه اشخاص",
        synonyms: ["جرائم علیه افراد"],
        children: [
          { slug: "homicide", nameFa: "قتل و شبه‌عمد", synonyms: ["قتل", "ضرب و جرح منجر به فوت"] },
          { slug: "assault", nameFa: "ضرب و جرح", synonyms: ["آسیب جسمی", "نزاع"] },
          { slug: "defamation", nameFa: "افترا و توهین", synonyms: ["توهین", "افترا و نشر اکاذیب"] },
          { slug: "threat", nameFa: "تهدید و تهدید به قتل" },
        ],
      },
      {
        slug: "drug_crimes",
        nameFa: "جرائم مواد مخدر",
        synonyms: ["مواد مخدر", "اعتیاد"],
        children: [
          { slug: "trafficking", nameFa: "حمل و نگهداری مواد مخدر" },
          { slug: "consumption", nameFa: "مصرف مواد" },
        ],
      },
      {
        slug: "economic_crimes",
        nameFa: "جرائم اقتصادی",
        synonyms: ["اقتصادی", "جرائم مالی کلان"],
        children: [
          { slug: "check_bounce", nameFa: "صدور چک بلامحل", synonyms: ["چک برگشتی", "چک بلامحل"] },
          { slug: "money_laundering", nameFa: "پول‌شویی", synonyms: ["پولشویی"] },
          { slug: "forgery", nameFa: "جعل و استفاده از سند مجعول", synonyms: ["جعل", "سند جعلی"] },
          { slug: "smuggling", nameFa: "قاچاق کالا و ارز" },
        ],
      },
      { slug: "sexual_crimes", nameFa: "جرائم علیه عفت عمومی", synonyms: ["جرائم منافی عفت"] },
      { slug: "cyber_crimes", nameFa: "جرائم رایانه‌ای", synonyms: ["جرائم سایبری", "اینترنتی"] },
      { slug: "criminal_defense", nameFa: "دفاع و وکالت در دادسرا", synonyms: ["دفاع کیفری"] },
    ],
  },
  {
    slug: "property_real_estate",
    nameFa: "املاک و مستغلات",
    icon: "Building",
    synonyms: ["ملک", "املاک", "مستغلات", "ثبتی"],
    children: [
      {
        slug: "sale_purchase",
        nameFa: "خرید و فروش ملک",
        synonyms: ["معامله ملک", "بیع"],
        children: [
          { slug: "residential", nameFa: "مسکونی", synonyms: ["آپارتمان", "خانه"] },
          { slug: "commercial", nameFa: "تجاری", synonyms: ["مغازه", "دفتر کار"] },
          { slug: "pre_sale", nameFa: "پیش‌فروش", synonyms: ["پیش فروش ساختمان"] },
          { slug: "land", nameFa: "زمین و کلنگی" },
        ],
      },
      {
        slug: "lease",
        nameFa: "اجاره",
        synonyms: ["استیجار", "رهن و اجاره"],
        children: [
          { slug: "residential_lease", nameFa: "اجاره مسکونی" },
          { slug: "commercial_lease", nameFa: "اجاره تجاری" },
          { slug: "eviction", nameFa: "تخلیه ید", synonyms: ["تخلیه ملک", "تخلیه مستأجر"] },
          { slug: "rent_claim", nameFa: "مطالبه اجاره‌بها" },
        ],
      },
      { slug: "construction", nameFa: "ساخت و ساز", synonyms: ["پیمانکاری ساختمان", "سازنده"] },
      { slug: "partition", nameFa: "افراز و تقسیم", synonyms: ["تقسیم ملک مشاع", "افراز"] },
      { slug: "easement", nameFa: "حق ارتفاق و حریم", synonyms: ["ارتفاق", "حریم", "حق عبور"] },
      { slug: "registration", nameFa: "ثبت اسناد و املاک", synonyms: ["سند تک‌برگ", "سند مالکیت", "ثبت ملک"] },
      { slug: "co_ownership", nameFa: "املاک مشاع", synonyms: ["ملک مشاع", "مشاع"] },
      { slug: "demolition", nameFa: "تخریب و پایان‌کار" },
    ],
  },
  {
    slug: "finance_banking",
    nameFa: "مالی و بانکی",
    icon: "Banknote",
    synonyms: ["بانکی", "مالی", "اعتباری"],
    children: [
      {
        slug: "banking",
        nameFa: "خدمات بانکی",
        synonyms: ["بانک"],
        children: [
          { slug: "loan", nameFa: "تسهیلات و وام", synonyms: ["وام", "تسهیلات بانکی"] },
          { slug: "guarantee", nameFa: "ضمانت‌نامه", synonyms: ["ضمانتنامه بانکی"] },
          { slug: "letter_of_credit", nameFa: "اعتبار اسنادی", synonyms: ["ال‌سی", "LC"] },
          { slug: "account_dispute", nameFa: "اختلاف حساب و تراکنش" },
        ],
      },
      { slug: "securities", nameFa: "اوراق بهادار و بورس", synonyms: ["بورس", "سهام", "کارگزاری"] },
      { slug: "exchange", nameFa: "ارز و صرافی", synonyms: ["ارز", "صرافی", "تبادل ارز"] },
      { slug: "islamic_finance", nameFa: "عقود اسلامی", synonyms: ["مضاربه", "مشارکت مدنی", "اجاره به شرط تملیک"] },
      { slug: "debt_collection", nameFa: "مطالبه مطالبات", synonyms: ["وصول مطالبات", "طلب"] },
      { slug: "capital_market", nameFa: "تأمین سرمایه", synonyms: ["پذیره‌نویسی", "افزایش سرمایه"] },
    ],
  },
  {
    slug: "commercial",
    nameFa: "تجارت و بازرگانی",
    icon: "Briefcase",
    synonyms: ["تجاری", "بازرگانی"],
    children: [
      {
        slug: "company_law",
        nameFa: "حقوق شرکت‌ها",
        synonyms: ["شرکت", "شرکتی"],
        children: [
          { slug: "incorporation", nameFa: "ثبت و تأسیس شرکت", synonyms: ["ثبت شرکت", "تأسیس"] },
          { slug: "shareholder", nameFa: "اختلافات سهامداران", synonyms: ["سهامدار", "مجمع"] },
          { slug: "liquidation", nameFa: "انحلال و تصفیه", synonyms: ["انحلال شرکت"] },
          { slug: "directors", nameFa: "مسئولیت مدیران", synonyms: ["هیئت مدیره", "بازرس"] },
        ],
      },
      { slug: "bankruptcy", nameFa: "ورشکستگی و اعسار", synonyms: ["ورشکستگی", "اعسار", "تصفیه"] },
      { slug: "competition", nameFa: "رقابت و انحصار", synonyms: ["ضدرقابتی", "انحصار", "شفافیت"] },
      { slug: "distribution", nameFa: "توزیع و نمایندگی", synonyms: ["نمایندگی", "توزیع", "فرانشیز"] },
      { slug: "ecommerce", nameFa: "تجارت الکترونیک", synonyms: ["فروش آنلاین", "ای‌کامرس"] },
      { slug: "trade_documents", nameFa: "اسناد تجاری", synonyms: ["برات", "سفته", "قرارداد تجاری"] },
      { slug: "merger_acquisition", nameFa: "ادغام و تملیک", synonyms: ["M&A", "ادغام", "خرید شرکت"] },
    ],
  },
  {
    slug: "contracts",
    nameFa: "قراردادها",
    icon: "FileText",
    synonyms: ["قرارداد", "پیمان", "عهدنامه"],
    children: [
      { slug: "drafting", nameFa: "تنظیم و نگارش قرارداد", synonyms: ["نگارش قرارداد"] },
      { slug: "review", nameFa: "بررسی و بازبینی قرارداد", synonyms: ["بررسی قرارداد", "بازبینی"] },
      { slug: "breach", nameFa: "نقض قرارداد", synonyms: ["تخلف قراردادی", "عدم اجرای تعهد"] },
      { slug: "termination", nameFa: "فسخ و انفساخ", synonyms: ["فسخ", "انفساخ", "خاتمه قرارداد"] },
      {
        slug: "particular",
        nameFa: "قراردادهای خاص",
        synonyms: ["قرارداد موضوعی"],
        children: [
          { slug: "construction_contract", nameFa: "پیمانکاری" },
          { slug: "sale_contract", nameFa: "بیع و معاوضه" },
          { slug: "joint_venture", nameFa: "مشارکت و جوینت‌ونچر" },
          { slug: "franchise", nameFa: "فرانشیز و لایسنس" },
        ],
      },
    ],
  },
  {
    slug: "labor",
    nameFa: "کار و تأمین اجتماعی",
    icon: "HardHat",
    synonyms: ["کار", "کارگری", "روابط کار", "تأمین اجتماعی"],
    children: [
      { slug: "dismissal", nameFa: "اخراج و اتمام همکاری", synonyms: ["اخراج", "تعلیق از کار", "خاتمه خدمت"] },
      { slug: "wages", nameFa: "دستمزد و حقوق معوق", synonyms: ["حقوق معوق", "دستمزد"] },
      { slug: "severance", nameFa: "سنوات و مزایای پایان کار", synonyms: ["سنوات", "عیدی", "بازخرید مرخصی"] },
      { slug: "workplace_injury", nameFa: "حوادث کار", synonyms: ["حادثه کار", "بیمه کار"] },
      { slug: "social_security", nameFa: "تأمین اجتماعی", synonyms: ["بیمه تأمین اجتماعی", "سابقه بیمه"] },
      { slug: "labor_contract", nameFa: "قرارداد کار", synonyms: ["قرارداد استخدام"] },
      { slug: "labor_dispute", nameFa: "اختلافات کارگر و کارفرما", synonyms: ["هیئت تشخیص", "هیئت حل اختلاف کار"] },
    ],
  },
  {
    slug: "medical",
    nameFa: "پزشکی و سلامت",
    icon: "Stethoscope",
    synonyms: ["درمان", "سلامت", "پزشکی"],
    children: [
      { slug: "malpractice", nameFa: "قصور پزشکی", synonyms: ["قصور", "خطای پزشکی", "بی‌احتیاطی"] },
      { slug: "patient_rights", nameFa: "حقوق بیمار", synonyms: ["منشور حقوق بیمار"] },
      { slug: "pharmaceutical", nameFa: "دارو و تجهیزات پزشکی", synonyms: ["دارو", "تجهیزات"] },
      { slug: "health_insurance", nameFa: "بیمه درمان" },
    ],
  },
  {
    slug: "tax",
    nameFa: "مالیاتی",
    icon: "Receipt",
    synonyms: ["مالیات", "مالیاتی"],
    children: [
      { slug: "income_tax", nameFa: "مالیات بر درآمد", synonyms: ["مالیات درآمد"] },
      { slug: "vat", nameFa: "مالیات بر ارزش افزوده", synonyms: ["ارزش افزوده", "VAT"] },
      { slug: "corporate_tax", nameFa: "مالیات اشخاص حقوقی", synonyms: ["مالیات شرکت"] },
      { slug: "tax_dispute", nameFa: "اختلافات مالیاتی", synonyms: ["هیئت حل اختلاف مالیاتی", "اعتراض مالیاتی"] },
      { slug: "customs", nameFa: "گمرک و واردات", synonyms: ["گمرک", "حقوق ورودی"] },
      { slug: "tax_exemption", nameFa: "معافیت مالیاتی", synonyms: ["معافیت"] },
    ],
  },
  {
    slug: "administrative",
    nameFa: "اداری",
    icon: "Landmark",
    synonyms: ["اداری", "دیوان عدالت"],
    children: [
      { slug: "administrative_court", nameFa: "دیوان عدالت اداری", synonyms: ["دیوان عدالت", "شعب دیوان"] },
      { slug: "municipal", nameFa: "شهرداری و عوارض", synonyms: ["شهرداری", "کمیسیون ماده ۱۰۰", "عوارض"] },
      { slug: "licensing", nameFa: "مجوزها و پروانه‌ها", synonyms: ["مجوز", "پروانه کسب", "اتحادیه"] },
      { slug: "civil_service", nameFa: "استخدام و بازنشستگی", synonyms: ["استخدام دولتی", "بازنشستگی", "کارگزینی"] },
      { slug: "tender", nameFa: "مناقصه و مزایده دولتی", synonyms: ["مناقصه", "مزایده", "معاملات دولتی"] },
    ],
  },
  {
    slug: "intellectual_property",
    nameFa: "مالکیت فکری",
    icon: "Lightbulb",
    synonyms: ["مالکیت فکری", "IP", "اموال فکری"],
    children: [
      { slug: "trademark", nameFa: "علامت تجاری", synonyms: ["برند", "علامت", "ثبت برند"] },
      { slug: "patent", nameFa: "اختراع", synonyms: ["ثبت اختراع", "پتنت"] },
      { slug: "copyright", nameFa: "حق مؤلف", synonyms: ["کپی‌رایت", "حق نشر", "تألیف"] },
      { slug: "industrial_design", nameFa: "طرح صناعی", synonyms: ["طرح صنعتی", "مدل صنعتی"] },
      { slug: "trade_secret", nameFa: "اسرار تجاری", synonyms: ["راز تجاری", "دانش فنی"] },
      { slug: "ip_licensing", nameFa: "واگذاری و لایسنس مالکیت فکری", synonyms: ["لایسنس", "واگذاری برند"] },
    ],
  },
  {
    slug: "technology_cyber",
    nameFa: "فناوری و جرائم رایانه‌ای",
    icon: "Cpu",
    synonyms: ["فناوری", "سایبری", "رایانه", "IT"],
    children: [
      { slug: "data_protection", nameFa: "حفاظت از داده و حریم خصوصی", synonyms: ["حریم خصوصی", "داده شخصی", "GDPR"] },
      { slug: "cybercrime", nameFa: "جرائم رایانه‌ای", synonyms: ["هک", "کلاهبرداری اینترنتی", "فیشینگ"] },
      { slug: "fintech", nameFa: "فین‌تک و پرداخت", synonyms: ["پرداخت", "رمزارز", "فینتک"] },
      { slug: "software_contract", nameFa: "قراردادهای نرم‌افزاری", synonyms: ["SaaS", "نرم‌افزار", "توسعه نرم‌افزار"] },
      { slug: "cryptocurrency", nameFa: "رمزارز و بلاک‌چین", synonyms: ["بیت‌کوین", "ارز دیجیتال", "توکن"] },
      { slug: "online_reputation", nameFa: "دامنه و اعتبار آنلاین", synonyms: ["دامنه", "هتک حیثیت آنلاین", "حذف محتوا"] },
      { slug: "ai_regulation", nameFa: "هوش مصنوعی و مقررات", synonyms: ["AI", "هوش مصنوعی"] },
    ],
  },
  {
    slug: "immigration",
    nameFa: "مهاجرت و اتباع",
    icon: "Plane",
    synonyms: ["مهاجرت", "اتباع", "اقامت"],
    children: [
      { slug: "visa_residency", nameFa: "ویزا و اقامت", synonyms: ["ویزا", "اقامت", "گرین‌کارت"] },
      { slug: "asylum", nameFa: "پناهندگی", synonyms: ["پناهنده", "آزیلوم"] },
      { slug: "citizenship", nameFa: "تابعیت", synonyms: ["تابعیت", "شهروندی"] },
      { slug: "foreign_nationals", nameFa: "اتباع خارجی", synonyms: ["اتباع بیگانه", "کارت اقامت"] },
      { slug: "emigration_docs", nameFa: "اسناد و ترجمه مهاجرتی", synonyms: ["ترجمه رسمی", "تأییدیه"] },
    ],
  },
  {
    slug: "inheritance",
    nameFa: "ارث و وصیت",
    icon: "ScrollText",
    synonyms: ["ارث", "ترکه", "وصیت"],
    children: [
      { slug: "estate_distribution", nameFa: "تقسیم ترکه", synonyms: ["ترکه", "تقسیم ارث"] },
      { slug: "will_testament", nameFa: "وصیت", synonyms: ["وصیت‌نامه", "موصی"] },
      { slug: "probate", nameFa: "گواهی انحصار وراثت", synonyms: ["انحصار وراثت", "گواهی حصر وراثت"] },
      { slug: "disinheritance", nameFa: "محرومیت از ارث", synonyms: ["محرومیت", "کفر"] },
      { slug: "executor", nameFa: "وصی و قیم", synonyms: ["وصی", "امین"] },
    ],
  },
  {
    slug: "international",
    nameFa: "بین‌الملل",
    icon: "Globe",
    synonyms: ["بین‌الملل", "بین‌المللی", "خارجی"],
    children: [
      { slug: "arbitration", nameFa: "داوری بین‌المللی", synonyms: ["داوری", "ICC", "تحکیم"] },
      { slug: "foreign_investment", nameFa: "سرمایه‌گذاری خارجی", synonyms: ["فایپا", "سرمایه خارجی"] },
      { slug: "foreign_judgment", nameFa: "اجرای احکام خارجی", synonyms: ["شناسایی حکم خارجی"] },
      { slug: "export_import", nameFa: "صادرات و واردات", synonyms: ["صادرات", "واردات", "اینکوترمز"] },
      { slug: "conflict_of_laws", nameFa: "تعارض قوانین", synonyms: ["قانون حاکم", "صلاحیت"] },
    ],
  },
  {
    slug: "insurance",
    nameFa: "بیمه",
    icon: "ShieldCheck",
    synonyms: ["بیمه", "بیمه‌ای"],
    children: [
      { slug: "life_insurance", nameFa: "بیمه عمر", synonyms: ["بیمه زندگی"] },
      { slug: "property_insurance", nameFa: "بیمه اموال", synonyms: ["بیمه دارایی", "بیمه ساختمان"] },
      { slug: "liability_insurance", nameFa: "بیمه مسئولیت", synonyms: ["بیمه مسئولیت مدنی"] },
      { slug: "claim_dispute", nameFa: "اختلافات بیمه‌ای", synonyms: ["خسارت", "رد خسارت"] },
      { slug: "third_party", nameFa: "بیمه شخص ثالث", synonyms: ["ثالث", "بیمه خودرو"] },
    ],
  },
  {
    slug: "transportation",
    nameFa: "حمل و نقل و رانندگی",
    icon: "Car",
    synonyms: ["حمل و نقل", "رانندگی", "ترافیک"],
    children: [
      { slug: "traffic_accidents", nameFa: "تصادفات رانندگی", synonyms: ["تصادف", "دیه", "خسارت تصادف"] },
      { slug: "driving_offenses", nameFa: "تخلفات رانندگی", synonyms: ["تخلف", "جریمه", "گواهینامه"] },
      { slug: "shipping", nameFa: "حمل و نقل بین‌المللی", synonyms: ["کرایه حمل", "بارنامه"] },
      { slug: "aviation", nameFa: "هوایی و ریلی", synonyms: ["هواپیمایی", "ریلی"] },
    ],
  },
  {
    slug: "energy_resources",
    nameFa: "انرژی و منابع",
    icon: "Zap",
    synonyms: ["انرژی", "نفت", "معدن", "محیط زیست"],
    children: [
      { slug: "oil_gas", nameFa: "نفت و گاز", synonyms: ["نفت", "گاز", "پتروشیمی"] },
      { slug: "electricity", nameFa: "برق و انرژی تجدیدپذیر", synonyms: ["برق", "انرژی خورشیدی", "تجدیدپذیر"] },
      { slug: "mining", nameFa: "معدن", synonyms: ["معدن", "پروانه بهره‌برداری"] },
      { slug: "water_environment", nameFa: "آب و محیط زیست", synonyms: ["محیط زیست", "آب", "آلودگی"] },
    ],
  },
  {
    slug: "sports_culture",
    nameFa: "ورزش، فرهنگ و هنر",
    icon: "Trophy",
    synonyms: ["ورزش", "فرهنگ", "هنر"],
    children: [
      { slug: "sports_contracts", nameFa: "قراردادهای ورزشی", synonyms: ["قرارداد بازیکن", "باشگاه"] },
      { slug: "sports_dispute", nameFa: "اختلافات ورزشی و دوپینگ", synonyms: ["دوپینگ", "کمیته انضباطی"] },
      { slug: "culture_art", nameFa: "فرهنگ و هنر", synonyms: ["اثر هنری", "نشر", "سینما"] },
    ],
  },
  {
    slug: "enforcement",
    nameFa: "اجرای احکام",
    icon: "Gavel",
    synonyms: ["اجرا", "اجرای حکم", "توقیف"],
    children: [
      { slug: "enforcement", nameFa: "اجرای احکام مدنی", synonyms: ["اجرای حکم", "اجرای احکام"] },
      { slug: "provisional_measures", nameFa: "دستور موقت و تأمین خواسته", synonyms: ["تأمین خواسته", "توقیف اموال", "دستور موقت"] },
      { slug: "execution_sale", nameFa: "مزایده و فروش اموال", synonyms: ["مزایده", "فروش اموال توقیفی"] },
      { slug: "insolvency_execution", nameFa: "اجرای اسناد لازم‌الاجرا", synonyms: ["سند لازم‌الاجرا", "اجرای مستقیم"] },
    ],
  },
];

/** All taxonomy nodes, flattened in tree (depth-first) order. */
export const LAWYER_TAXONOMY: LawyerTaxonomyNode[] = (() => {
  const out: LawyerTaxonomyNode[] = [];
  flatten(TAXONOMY_TREE, null, 0, out);
  return out;
})();

// ---------------------------------------------------------------------------
// Lookups (built once, O(1) resolutions)
// ---------------------------------------------------------------------------

const BY_ID = new Map<string, LawyerTaxonomyNode>(LAWYER_TAXONOMY.map((n) => [n.id, n]));

/** The node with this id, or undefined. */
export function taxonomyNode(id: string | null | undefined): LawyerTaxonomyNode | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** All nodes at exactly the given level. */
export function taxonomyByType(type: LawyerTaxonomyType): LawyerTaxonomyNode[] {
  return LAWYER_TAXONOMY.filter((n) => n.type === type);
}

/** The top-level DOMAIN nodes, in display order. */
export function taxonomyDomains(): LawyerTaxonomyNode[] {
  return LAWYER_TAXONOMY.filter((n) => n.type === "DOMAIN");
}

/** Direct children of a node (or the domains when `id` is null). */
export function taxonomyChildren(id: string | null): LawyerTaxonomyNode[] {
  return LAWYER_TAXONOMY.filter((n) => n.parentId === id);
}

/** The node's ancestor chain, root-first (excludes the node itself). */
export function taxonomyAncestors(id: string): LawyerTaxonomyNode[] {
  const chain: LawyerTaxonomyNode[] = [];
  let current = BY_ID.get(id)?.parentId ?? null;
  while (current) {
    const node = BY_ID.get(current);
    if (!node) break;
    chain.unshift(node);
    current = node.parentId;
  }
  return chain;
}

/** The node itself followed by all of its descendants (any depth). */
export function taxonomySubtree(id: string): LawyerTaxonomyNode[] {
  const result: LawyerTaxonomyNode[] = [];
  const stack = [id];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    const node = BY_ID.get(current);
    if (!node) continue;
    result.push(node);
    for (const child of taxonomyChildren(current)) stack.push(child.id);
  }
  return result;
}

/** True when `nodeId` is `ancestorId` itself or lives beneath it. */
export function isTaxonomyDescendantOf(nodeId: string, ancestorId: string): boolean {
  return nodeId === ancestorId || nodeId.startsWith(ancestorId + ".");
}

/** The DOMAIN node a taxonomy id belongs to (or undefined). */
export function taxonomyDomainOf(id: string): LawyerTaxonomyNode | undefined {
  return taxonomyAncestors(id)[0];
}

/** Persian label of a node id, falling back to the raw id when unknown. */
export function taxonomyLabel(id: string | null | undefined): string {
  if (!id) return "";
  return BY_ID.get(id)?.nameFa ?? id;
}

/** The root-first Persian label chain of a node id, e.g. «خانواده › طلاق › طلاق توافقی». */
export function taxonomyPathLabels(id: string, separator = " › "): string {
  const node = BY_ID.get(id);
  if (!node) return id;
  return [...taxonomyAncestors(id), node].map((n) => n.nameFa).join(separator);
}

/**
 * The free-text search text for a node id — its name, its synonyms, AND the
 * name + synonyms of every ancestor. A lawyer tagged on a deep issue is
 * implicitly an expert in each ancestor domain, so searching an ancestor
 * («خانواده») or any of its synonyms («خانوادگی») must still find them.
 */
export function taxonomySearchText(id: string | null | undefined): string {
  if (!id) return "";
  const node = BY_ID.get(id);
  if (!node) return id;
  const parts: string[] = [];
  for (const n of [...taxonomyAncestors(id), node]) parts.push(n.nameFa, ...n.synonyms);
  return parts.join(" ");
}

/** The icon key for a node id (walks up to the nearest ancestor icon). */
export function taxonomyIcon(id: string | null | undefined): string | null {
  if (!id) return null;
  const nodes = [...taxonomyAncestors(id), BY_ID.get(id)].filter(
    (n): n is LawyerTaxonomyNode => Boolean(n)
  );
  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    if (node?.icon) return node.icon;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Search (Persian-normalized, synonym-aware)
// ---------------------------------------------------------------------------

/**
 * Normalize a Persian string for search/lookup: unifies Arabic/Persian
 * yeh & kaf, strips harakat and ZWNJ, and collapses whitespace. Exported so
 * the marketplace search can normalize a user query the same way.
 */
export function normalizeFa(input: string): string {
  return input
    .replace(/[\u064B-\u0652\u0670]/g, "") // harakat
    .replace(/\u064A/g, "\u06CC") // ي → ی
    .replace(/\u0649/g, "\u06CC") // ى (alef maksura) → ی
    .replace(/\u0643/g, "\u06A9") // ك → ک
    .replace(/[\u200B\u200C\u200E\u200F]/g, " ") // zero-width marks → space
    .replace(/[أإآ]/g, "ا")
    .replace(/\u0640/g, "") // tatweel
    .replace(/\s+/g, " ")
    .trim();
}

interface IndexedNode {
  node: LawyerTaxonomyNode;
  haystack: string;
}

const SEARCH_INDEX: IndexedNode[] = LAWYER_TAXONOMY.map((node) => ({
  node,
  haystack: normalizeFa([node.nameFa, ...node.synonyms].join(" ")),
}));

/** Nodes whose name or synonyms contain the query (empty query → []). */
export function searchTaxonomyNodes(query: string): LawyerTaxonomyNode[] {
  const q = normalizeFa(query);
  if (!q) return [];
  return SEARCH_INDEX.filter((e) => e.haystack.includes(q)).map((e) => e.node);
}

/**
 * Every taxonomy id that should be treated as a match for `query`: the
 * directly-matching nodes plus all of their descendants. Used to turn a
 * search box entry into a filter set (e.g. «خانواده» also matches every
 * family sub-specialty).
 */
export function taxonomyIdsMatching(query: string): string[] {
  const roots = searchTaxonomyNodes(query);
  const ids = new Set<string>();
  for (const root of roots) {
    for (const node of taxonomySubtree(root.id)) ids.add(node.id);
  }
  return [...ids];
}

// ---------------------------------------------------------------------------
// Professional rank, licence & organisation (INDEPENDENT attributes)
// ---------------------------------------------------------------------------

/**
 * The professional rank (پایهٔ وکالت). Independent of the organisation the
 * licence was issued by — a BASE_ONE lawyer may hold a کانون or a مرکز
 * licence.
 */
export type LawyerProfessionalRank = "BASE_ONE" | "BASE_TWO" | "TRAINEE";

export const LAWYER_PROFESSIONAL_RANK_FA: Record<LawyerProfessionalRank, string> = {
  BASE_ONE: "وکیل پایه یک دادگستری",
  BASE_TWO: "وکیل پایه دو دادگستری",
  TRAINEE: "کارآموز وکالت",
};

/** Short form for chips/labels. */
export const LAWYER_PROFESSIONAL_RANK_SHORT_FA: Record<LawyerProfessionalRank, string> = {
  BASE_ONE: "پایه یک",
  BASE_TWO: "پایه دو",
  TRAINEE: "کارآموز",
};

export const LAWYER_PROFESSIONAL_RANKS: LawyerProfessionalRank[] = ["BASE_ONE", "BASE_TWO", "TRAINEE"];

/**
 * The issuing organisation. Independent of rank — it records WHERE the
 * licence came from (کانون وکلای دادگستری vs مرکز وکلای قوه قضائیه).
 */
export type LawyerOrganizationType = "BAR" | "JUDICIARY_CENTER" | "OTHER";

export const LAWYER_ORGANIZATION_TYPE_FA: Record<LawyerOrganizationType, string> = {
  BAR: "کانون وکلای دادگستری",
  JUDICIARY_CENTER: "مرکز وکلای قوه قضائیه",
  OTHER: "سایر مراجع",
};

export const LAWYER_ORGANIZATION_TYPES: LawyerOrganizationType[] = [
  "BAR",
  "JUDICIARY_CENTER",
  "OTHER",
];

/** The lifecycle state of the bar licence itself. */
export type LawyerLicenseStatus = "ACTIVE" | "SUSPENDED" | "REVOKED" | "EXPIRED";

export const LAWYER_LICENSE_STATUS_FA: Record<LawyerLicenseStatus, string> = {
  ACTIVE: "معتبر",
  SUSPENDED: "معلق",
  REVOKED: "لغو شده",
  EXPIRED: "منقضی",
};

// ---------------------------------------------------------------------------
// Marketplace visibility (separate from verification status)
// ---------------------------------------------------------------------------

/**
 * Whether the profile appears on the public marketplace. Deliberately
 * separate from `LawyerVerificationStatus`: a VERIFIED lawyer can still be
 * UNLISTED (deep-link only) or HIDDEN (removed from search), and an
 * operator controls that independently of the verification decision.
 */
export type LawyerMarketplaceVisibility = "PUBLIC" | "UNLISTED" | "HIDDEN";

export const LAWYER_VISIBILITY_FA: Record<LawyerMarketplaceVisibility, string> = {
  PUBLIC: "نمایش عمومی",
  UNLISTED: "بدون فهرست (لینک مستقیم)",
  HIDDEN: "پنهان از جستجو",
};

// ---------------------------------------------------------------------------
// Gender (used for avatar defaults and display only — never for ranking)
// ---------------------------------------------------------------------------

export type LawyerGender = "MALE" | "FEMALE" | "UNSPECIFIED";

export const LAWYER_GENDER_FA: Record<LawyerGender, string> = {
  MALE: "آقا",
  FEMALE: "خانم",
  UNSPECIFIED: "نامشخص",
};

// ---------------------------------------------------------------------------
// Experience bands
// ---------------------------------------------------------------------------

export interface LawyerExperienceBand {
  id: string;
  nameFa: string;
  /** Inclusive lower bound in years. */
  min: number;
  /** Exclusive upper bound in years; `null` = unbounded. */
  max: number | null;
}

/** The experience buckets shown in the marketplace filter. */
export const LAWYER_EXPERIENCE_BANDS: LawyerExperienceBand[] = [
  { id: "1-3", nameFa: "۱ تا ۳ سال", min: 1, max: 4 },
  { id: "4-7", nameFa: "۴ تا ۷ سال", min: 4, max: 8 },
  { id: "8-12", nameFa: "۸ تا ۱۲ سال", min: 8, max: 13 },
  { id: "13-18", nameFa: "۱۳ تا ۱۸ سال", min: 13, max: 19 },
  { id: "19-25plus", nameFa: "۱۹ سال و بیشتر", min: 19, max: null },
];

/** The band a years-of-experience value falls into, or undefined. */
export function experienceBandFor(years: number): LawyerExperienceBand | undefined {
  return LAWYER_EXPERIENCE_BANDS.find((b) => years >= b.min && (b.max === null || years < b.max));
}

// ---------------------------------------------------------------------------
// Services catalog (what a lawyer OFFERS — separate from expertise)
// ---------------------------------------------------------------------------

export interface LawyerService {
  id: string;
  nameFa: string;
  /** One-line description for the profile/card. */
  descriptionFa: string;
  icon: string;
  /** True when the service can be delivered fully online. */
  onlineCapable: boolean;
}

/** The catalogue of services a lawyer can offer. */
export const LAWYER_SERVICES: LawyerService[] = [
  {
    id: "in_person_consult",
    nameFa: "مشاوره حضوری",
    descriptionFa: "جلسهٔ مشاوره در دفتر وکیل.",
    icon: "Building",
    onlineCapable: false,
  },
  {
    id: "phone_consult",
    nameFa: "مشاوره تلفنی",
    descriptionFa: "جلسهٔ مشاوره از طریق تماس تلفنی.",
    icon: "Phone",
    onlineCapable: true,
  },
  {
    id: "online_consult",
    nameFa: "مشاوره آنلاین (تصویری)",
    descriptionFa: "جلسهٔ مشاوره ویدیویی از راه دور.",
    icon: "Video",
    onlineCapable: true,
  },
  {
    id: "written_consult",
    nameFa: "پاسخ کتبی",
    descriptionFa: "پاسخ حقوقی مکتوب به پرسش شما.",
    icon: "MessageSquare",
    onlineCapable: true,
  },
  {
    id: "contract_review",
    nameFa: "بررسی قرارداد",
    descriptionFa: "بازبینی حقوقی قرارداد و اعلام ریسک‌ها.",
    icon: "FileSearch",
    onlineCapable: true,
  },
  {
    id: "contract_drafting",
    nameFa: "تنظیم و نگارش قرارداد",
    descriptionFa: "نگارش قرارداد اختصاصی متناسب با موضوع.",
    icon: "FileText",
    onlineCapable: true,
  },
  {
    id: "petition_drafting",
    nameFa: "تنظیم دادخواست و شکواییه",
    descriptionFa: "نگارش دادخواست، شکواییه یا اظهارنامه.",
    icon: "FileSignature",
    onlineCapable: true,
  },
  {
    id: "legal_opinion",
    nameFa: "اعلام نظر حقوقی",
    descriptionFa: "نظر کارشناسی حقوقی مکتوب دربارهٔ موضوع.",
    icon: "ScrollText",
    onlineCapable: true,
  },
  {
    id: "case_estimate",
    nameFa: "برآورد ریسک پرونده",
    descriptionFa: "ارزیابی شانس موفقیت و مسیر احتمالی پرونده.",
    icon: "BarChart3",
    onlineCapable: true,
  },
  {
    id: "case_prosecution",
    nameFa: "پیگیری و طرح دعوا",
    descriptionFa: "طرح و پیگیری دعوا در مراجع قضایی.",
    icon: "Gavel",
    onlineCapable: false,
  },
  {
    id: "legal_defense",
    nameFa: "وکالت و دفاع در دادگاه",
    descriptionFa: "حضور و دفاع در جلسات دادگاه.",
    icon: "Shield",
    onlineCapable: false,
  },
  {
    id: "mediation",
    nameFa: "میانجی‌گری و حل اختلاف",
    descriptionFa: "کوشش برای سازش پیش از طرح دعوا.",
    icon: "Handshake",
    onlineCapable: true,
  },
  {
    id: "arbitration_service",
    nameFa: "داوری",
    descriptionFa: "پذیرش داوری و صدور رأی داوری.",
    icon: "Scale",
    onlineCapable: false,
  },
  {
    id: "corporate_retainer",
    nameFa: "مشاوره حقوقی سازمانی",
    descriptionFa: "همکاری مستمر به‌عنوان مشاور حقوقی کسب‌وکار.",
    icon: "Briefcase",
    onlineCapable: true,
  },
  {
    id: "company_registration",
    nameFa: "ثبت و تغییرات شرکت",
    descriptionFa: "ثبت شرکت، برند و انجام تغییرات ثبتی.",
    icon: "Building2",
    onlineCapable: true,
  },
  {
    id: "due_diligence",
    nameFa: "بررسی حقوقی و اهلیت‌سنجی",
    descriptionFa: "بررسی حقوقی معاملات، اسناد و طرف مقابل.",
    icon: "Search",
    onlineCapable: true,
  },
  {
    id: "notary_followup",
    nameFa: "هماهنگی دفتر اسناد رسمی",
    descriptionFa: "تنظیم و پیگیری اسناد رسمی و وکالت‌نامه.",
    icon: "Stamp",
    onlineCapable: false,
  },
  {
    id: "legal_translation",
    nameFa: "ترجمه متون حقوقی",
    descriptionFa: "ترجمهٔ رسمی و حقوقی اسناد و مکاتبات.",
    icon: "Languages",
    onlineCapable: true,
  },
];

const SERVICE_BY_ID = new Map(LAWYER_SERVICES.map((s) => [s.id, s]));

/** The service with this id, or undefined. */
export function getLawyerService(id: string | null | undefined): LawyerService | undefined {
  return id ? SERVICE_BY_ID.get(id) : undefined;
}

/** Persian label of a service id, falling back to the raw id. */
export function lawyerServiceLabel(id: string): string {
  return SERVICE_BY_ID.get(id)?.nameFa ?? id;
}

// ---------------------------------------------------------------------------
// Jurisdictions (the fora / authorities a lawyer can practise before)
// ---------------------------------------------------------------------------

export interface LawyerJurisdiction {
  id: string;
  nameFa: string;
  /** Coarse grouping for display. */
  groupFa: string;
}

export const LAWYER_JURISDICTIONS: LawyerJurisdiction[] = [
  { id: "general_court_1", nameFa: "دادگاه عمومی حقوقی", groupFa: "دادگاه‌های عمومی" },
  { id: "general_court_2", nameFa: "دادگاه عمومی جزایی", groupFa: "دادگاه‌های عمومی" },
  { id: "criminal_court_1", nameFa: "دادگاه کیفری یک", groupFa: "دادگاه‌های کیفری" },
  { id: "criminal_court_2", nameFa: "دادگاه کیفری دو", groupFa: "دادگاه‌های کیفری" },
  { id: "peace_court", nameFa: "دادگاه صلح", groupFa: "دادگاه‌های عمومی" },
  { id: "family_court", nameFa: "دادگاه خانواده", groupFa: "دادگاه‌های اختصاصی" },
  { id: "appeal_court", nameFa: "دادگاه تجدیدنظر استان", groupFa: "مراجع تجدیدنظر" },
  { id: "supreme_court", nameFa: "دیوان عالی کشور", groupFa: "مراجع عالی" },
  { id: "prosecutor", nameFa: "دادسرا", groupFa: "دادسراها" },
  { id: "revolution_court", nameFa: "دادگاه انقلاب", groupFa: "دادگاه‌های اختصاصی" },
  { id: "economic_court", nameFa: "دادگاه ویژهٔ اقتصادی", groupFa: "دادگاه‌های اختصاصی" },
  { id: "administrative_justice", nameFa: "دیوان عدالت اداری", groupFa: "مراجع اداری" },
  { id: "tax_dispute_board", nameFa: "هیئت حل اختلاف مالیاتی", groupFa: "مراجع اداری" },
  { id: "labor_dispute_board", nameFa: "هیئت حل اختلاف کار", groupFa: "مراجع اداری" },
  { id: "registration_office", nameFa: "ادارهٔ ثبت اسناد و املاک", groupFa: "مراجع ثبتی" },
  { id: "justice_advisors", nameFa: "قوهٔ قضائیه / معاونت حقوقی", groupFa: "مراجع اداری" },
  { id: "arbitration_center", nameFa: "مرکز داوری", groupFa: "داوری" },
  { id: "medical_council", nameFa: "سازمان نظام پزشکی", groupFa: "مراجع صنفی" },
  { id: "bar_disciplinary", nameFa: "دادگاه انتظامی وکلا", groupFa: "مراجع صنفی" },
];

const JURISDICTION_BY_ID = new Map(LAWYER_JURISDICTIONS.map((j) => [j.id, j]));

/** Persian label of a jurisdiction id, falling back to the raw id. */
export function jurisdictionLabel(id: string): string {
  return JURISDICTION_BY_ID.get(id)?.nameFa ?? id;
}

// ---------------------------------------------------------------------------
// Geography (provinces → cities)
// ---------------------------------------------------------------------------

export interface IranProvince {
  /** Stable slug, e.g. `tehran`. */
  slug: string;
  nameFa: string;
  cities: string[];
}

/** The covered provinces and their cities (the marketplace geography). */
export const IRAN_PROVINCES: IranProvince[] = [
  {
    slug: "tehran",
    nameFa: "تهران",
    cities: ["تهران", "شهریار", "اسلامشهر", "کرج", "ورامین", "ری", "پاکدشت", "رباط‌کریم", "قدس", "ملارد"],
  },
  {
    slug: "alborz",
    nameFa: "البرز",
    cities: ["کرج", "فردیس", "نظرآباد", "هشتگرد", "اشتهارد", "طالقان", "ساوجبلاغ"],
  },
  {
    slug: "isfahan",
    nameFa: "اصفهان",
    cities: ["اصفهان", "کاشان", "نجف‌آباد", "خمینی‌شهر", "شهرضا", "اردستان", "گلپایگان"],
  },
  {
    slug: "fars",
    nameFa: "فارس",
    cities: ["شیراز", "مرودشت", "کازرون", "جهرم", "فسا", "داراب", "لار", "آباده"],
  },
  {
    slug: "razavi_khorasan",
    nameFa: "خراسان رضوی",
    cities: ["مشهد", "نیشابور", "سبزوار", "تربت حیدریه", "قوچان", "کاشمر", "گناباد"],
  },
  {
    slug: "east_azerbaijan",
    nameFa: "آذربایجان شرقی",
    cities: ["تبریز", "مراغه", "مرند", "اهر", "میانه", "بناب", "سراب"],
  },
  {
    slug: "west_azerbaijan",
    nameFa: "آذربایجان غربی",
    cities: ["ارومیه", "خوی", "مهاباد", "میاندوآب", "بوکان", "سلماس"],
  },
  {
    slug: "khuzestan",
    nameFa: "خوزستان",
    cities: ["اهواز", "آبادان", "دزفول", "خرمشهر", "بهبهان", "ماهشهر", "شوشتر"],
  },
  {
    slug: "gilan",
    nameFa: "گیلان",
    cities: ["رشت", "بندر انزلی", "لاهیجان", "آستارا", "تالش", "رودسر", "فومن"],
  },
  {
    slug: "mazandaran",
    nameFa: "مازندران",
    cities: ["ساری", "بابل", "آمل", "قائم‌شهر", "نوشهر", "چالوس", "رامسر", "بهشهر"],
  },
  {
    slug: "kerman",
    nameFa: "کرمان",
    cities: ["کرمان", "رفسنجان", "سیرجان", "بم", "جیرفت", "زرند"],
  },
  {
    slug: "qom",
    nameFa: "قم",
    cities: ["قم"],
  },
  {
    slug: "yazd",
    nameFa: "یزد",
    cities: ["یزد", "میبد", "اردکان", "بافق", "مهریز"],
  },
  {
    slug: "kermanshah",
    nameFa: "کرمانشاه",
    cities: ["کرمانشاه", "اسلام‌آباد غرب", "هرسین", "سنقر", "پاوه"],
  },
  {
    slug: "golestan",
    nameFa: "گلستان",
    cities: ["گرگان", "گنبد کاووس", "علی‌آباد", "بندر ترکمن", "آق‌قلا"],
  },
  {
    slug: "hormozgan",
    nameFa: "هرمزگان",
    cities: ["بندرعباس", "قشم", "میناب", "بندر لنگه", "کیش", "بستک"],
  },
  {
    slug: "sistan_baluchestan",
    nameFa: "سیستان و بلوچستان",
    cities: ["زاهدان", "زابل", "چابهار", "ایرانشهر", "سراوان"],
  },
  {
    slug: "hamadan",
    nameFa: "همدان",
    cities: ["همدان", "ملایر", "نهاوند", "تویسرکان", "اسدآباد"],
  },
  {
    slug: "markazi",
    nameFa: "مرکزی",
    cities: ["اراک", "ساوه", "خمین", "محلات", "دلیجان"],
  },
  {
    slug: "ardabil",
    nameFa: "اردبیل",
    cities: ["اردبیل", "پارس‌آباد", "مشکین‌شهر", "خلخال"],
  },
];

/** All city names across every province (deduplicated). */
export const IRAN_CITIES: string[] = [...new Set(IRAN_PROVINCES.flatMap((p) => p.cities))];

const PROVINCE_BY_CITY = new Map<string, IranProvince>();
for (const province of IRAN_PROVINCES) {
  for (const city of province.cities) {
    if (!PROVINCE_BY_CITY.has(city)) PROVINCE_BY_CITY.set(city, province);
  }
}

/** The province that contains `city`, or undefined. */
export function provinceOfCity(city: string): IranProvince | undefined {
  return PROVINCE_BY_CITY.get(city);
}
