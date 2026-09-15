// ============================================================
// LEGALIR — Contract Catalog (server-only, static)
// ============================================================
// The contract types and wizard question lists served by the
// /api/v1/contract-types* routes. This mirrors the demo fixtures so the
// contract workspace works without MSW, but lives in app code (not the
// testing package) so it is available to the real Next.js route handlers.
// ============================================================

import type {
  V1ContractType,
  V1ContractTypeListResponse,
  V1ContractQuestion,
  V1ContractCategory,
} from "@legalir/types";

export const CONTRACT_TYPES: V1ContractTypeListResponse = {
  personal: [
    { id: "lease", nameFa: "اجاره", descriptionFa: "قرارداد اجاره ملک مسکونی، تجاری یا اداری", category: "personal", icon: "home", questionCount: 12 },
    { id: "sale_purchase", nameFa: "خرید و فروش", descriptionFa: "قرارداد خرید و فروش اموال منقول و غیرمنقول", category: "personal", icon: "shopping", questionCount: 14 },
    { id: "loan", nameFa: "قرض", descriptionFa: "قرارداد قرض‌الحسنه یا قرض با بهره", category: "personal", icon: "money", questionCount: 10 },
    { id: "partnership", nameFa: "شراکت", descriptionFa: "قرارداد مشارکت مدنی یا تجاری", category: "personal", icon: "users", questionCount: 16 },
  ],
  business: [
    { id: "nda", nameFa: "NDA", descriptionFa: "توافقنامه عدم افشای اطلاعات محرمانه", category: "business", icon: "shield", questionCount: 8 },
    { id: "employment", nameFa: "استخدام", descriptionFa: "قرارداد استخدام و همکاری کاری", category: "business", icon: "briefcase", questionCount: 15 },
    { id: "saas", nameFa: "SaaS", descriptionFa: "قرارداد اشتراک نرم‌افزار به عنوان سرویس", category: "business", icon: "cloud", questionCount: 11 },
    { id: "contracting", nameFa: "پیمانکاری", descriptionFa: "قرارداد پیمانکاری و خدمات اجرایی", category: "business", icon: "construction", questionCount: 18 },
    { id: "investment", nameFa: "سرمایه‌گذاری", descriptionFa: "قرارداد مشارکت سرمایه‌گذاری", category: "business", icon: "chart", questionCount: 14 },
  ],
};

// typeId → { typeFa, category }
export const CONTRACT_TYPE_META: Record<V1ContractType, { typeFa: string; category: V1ContractCategory }> = {
  lease: { typeFa: "اجاره", category: "personal" },
  sale_purchase: { typeFa: "خرید و فروش", category: "personal" },
  loan: { typeFa: "قرض", category: "personal" },
  partnership: { typeFa: "شراکت", category: "personal" },
  nda: { typeFa: "NDA", category: "business" },
  employment: { typeFa: "استخدام", category: "business" },
  saas: { typeFa: "SaaS", category: "business" },
  contracting: { typeFa: "پیمانکاری", category: "business" },
  investment: { typeFa: "سرمایه‌گذاری", category: "business" },
};

const leaseQuestions: V1ContractQuestion[] = [
  { id: "q-lease-01", typeId: "lease", step: 1, fieldKey: "party1_name", labelFa: "نام و نام خانوادگی موجر", inputType: "text", required: true, placeholderFa: "نام کامل مالک" },
  { id: "q-lease-02", typeId: "lease", step: 1, fieldKey: "party1_id", labelFa: "کد ملی موجر", inputType: "text", required: true, placeholderFa: "شماره ملی ۱۰ رقمی" },
  { id: "q-lease-03", typeId: "lease", step: 1, fieldKey: "party2_name", labelFa: "نام و نام خانوادگی مستأجر", inputType: "text", required: true, placeholderFa: "نام کامل مستأجر" },
  { id: "q-lease-04", typeId: "lease", step: 1, fieldKey: "party2_id", labelFa: "کد ملی مستأجر", inputType: "text", required: true, placeholderFa: "شماره ملی ۱۰ رقمی" },
  { id: "q-lease-05", typeId: "lease", step: 2, fieldKey: "property_address", labelFa: "نشانی دقیق ملک", inputType: "textarea", required: true, placeholderFa: "استان، شهر، خیابان، کوچه، پلاک، طبقه" },
  { id: "q-lease-06", typeId: "lease", step: 2, fieldKey: "property_area", labelFa: "متراژ ملک (متر مربع)", inputType: "number", required: true, placeholderFa: "مثلاً ۸۵" },
  { id: "q-lease-07", typeId: "lease", step: 2, fieldKey: "property_usage", labelFa: "کاربری ملک", inputType: "select", required: true, options: [{ value: "residential", labelFa: "مسکونی" }, { value: "commercial", labelFa: "تجاری" }, { value: "office", labelFa: "اداری" }] },
  { id: "q-lease-08", typeId: "lease", step: 3, fieldKey: "rent_amount", labelFa: "مبلغ اجاره ماهانه (ریال)", inputType: "number", required: true, placeholderFa: "مبلغ به ریال" },
  { id: "q-lease-09", typeId: "lease", step: 3, fieldKey: "deposit_amount", labelFa: "مبلغ ودیعه/رهن (ریال)", inputType: "number", required: false, placeholderFa: "در صورت وجود" },
  { id: "q-lease-10", typeId: "lease", step: 4, fieldKey: "start_date", labelFa: "تاریخ شروع اجاره", inputType: "date", required: true },
  { id: "q-lease-11", typeId: "lease", step: 4, fieldKey: "duration_months", labelFa: "مدت اجاره (ماه)", inputType: "number", required: true, placeholderFa: "مثلاً ۱۲" },
  { id: "q-lease-12", typeId: "lease", step: 5, fieldKey: "special_conditions", labelFa: "شرایط خاص", inputType: "textarea", required: false, hintFa: "هرگونه شرط یا توضیح اضافی", placeholderFa: "شرایط خاص قرارداد..." },
];

const ndaQuestions: V1ContractQuestion[] = [
  { id: "q-nda-01", typeId: "nda", step: 1, fieldKey: "party1_name", labelFa: "نام افشاکننده (شخص/شرکت)", inputType: "text", required: true, placeholderFa: "نام کامل شخص یا شرکت" },
  { id: "q-nda-02", typeId: "nda", step: 1, fieldKey: "party1_id", labelFa: "شناسه ملی/کد ثبت", inputType: "text", required: true, placeholderFa: "شناسه ملی یا شماره ثبت" },
  { id: "q-nda-03", typeId: "nda", step: 1, fieldKey: "party2_name", labelFa: "نام گیرنده (شخص/شرکت)", inputType: "text", required: true, placeholderFa: "نام کامل شخص یا شرکت" },
  { id: "q-nda-04", typeId: "nda", step: 1, fieldKey: "party2_id", labelFa: "شناسه ملی/کد ثبت گیرنده", inputType: "text", required: true, placeholderFa: "شناسه ملی یا شماره ثبت" },
  { id: "q-nda-05", typeId: "nda", step: 2, fieldKey: "purpose", labelFa: "هدف از افشای اطلاعات", inputType: "textarea", required: true, placeholderFa: "شرح هدف از تبادل اطلاعات محرمانه" },
  { id: "q-nda-06", typeId: "nda", step: 3, fieldKey: "duration_months", labelFa: "مدت تعهد محرمانگی (ماه)", inputType: "number", required: true, placeholderFa: "مثلاً ۲۴" },
  { id: "q-nda-07", typeId: "nda", step: 4, fieldKey: "penalty_amount", labelFa: "مبلغ خسارت نقض تعهد (ریال)", inputType: "number", required: true, placeholderFa: "مبلغ به ریال" },
  { id: "q-nda-08", typeId: "nda", step: 4, fieldKey: "governing_law", labelFa: "قانون حاکم", inputType: "select", required: true, options: [{ value: "iran", labelFa: "قوانین جمهوری اسلامی ایران" }, { value: "other", labelFa: "سایر" }] },
];

const employmentQuestions: V1ContractQuestion[] = [
  { id: "q-emp-01", typeId: "employment", step: 1, fieldKey: "employer_name", labelFa: "نام کارفرما (شرکت/شخص)", inputType: "text", required: true, placeholderFa: "نام کامل شرکت یا شخص" },
  { id: "q-emp-02", typeId: "employment", step: 1, fieldKey: "employer_id", labelFa: "شناسه/کد ثبت کارفرما", inputType: "text", required: true, placeholderFa: "شناسه ملی یا شماره ثبت" },
  { id: "q-emp-03", typeId: "employment", step: 1, fieldKey: "employee_name", labelFa: "نام و نام خانوادگی کارمند", inputType: "text", required: true, placeholderFa: "نام کامل" },
  { id: "q-emp-04", typeId: "employment", step: 1, fieldKey: "employee_id", labelFa: "کد ملی کارمند", inputType: "text", required: true, placeholderFa: "شماره ملی ۱۰ رقمی" },
  { id: "q-emp-05", typeId: "employment", step: 2, fieldKey: "position", labelFa: "عنوان شغلی", inputType: "text", required: true, placeholderFa: "سمت و عنوان شغلی" },
  { id: "q-emp-06", typeId: "employment", step: 2, fieldKey: "salary", labelFa: "حقوق ماهانه (ریال)", inputType: "number", required: true, placeholderFa: "مبلغ به ریال" },
  { id: "q-emp-07", typeId: "employment", step: 3, fieldKey: "start_date", labelFa: "تاریخ شروع همکاری", inputType: "date", required: true },
  { id: "q-emp-08", typeId: "employment", step: 3, fieldKey: "probation_months", labelFa: "دوره آزمایشی (ماه)", inputType: "number", required: true, placeholderFa: "مثلاً ۳" },
  { id: "q-emp-09", typeId: "employment", step: 4, fieldKey: "work_hours", labelFa: "ساعت کاری هفتگی", inputType: "number", required: true, placeholderFa: "مثلاً ۴۴" },
  { id: "q-emp-10", typeId: "employment", step: 4, fieldKey: "benefits", labelFa: "مزایا (بیمه، بن، ...)", inputType: "textarea", required: false, hintFa: "مزایای شغلی ذکر شود", placeholderFa: "بیمه تأمین اجتماعی، بن کارگری، ..." },
];

export const CONTRACT_QUESTIONS: Record<V1ContractType, V1ContractQuestion[]> = {
  lease: leaseQuestions,
  nda: ndaQuestions,
  employment: employmentQuestions,
  sale_purchase: [],
  loan: [],
  partnership: [],
  saas: [],
  contracting: [],
  investment: [],
};
