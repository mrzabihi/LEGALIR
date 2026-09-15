// ============================================================
// LEGALIR — Testing Utilities & Fixtures
// ============================================================

function generateId(): string {
  // crypto.randomUUID() is unavailable in non-secure browser contexts.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

import type {
  UserSummary,
  Profile,
  UserPreference,
  Plan,
  Subscription,
  Entitlement,
  DashboardSummary,
  Conversation,
  Message,
  Document,
  RiskReport,
  DocumentFinding,
  DocumentJob,
  Contract,
  ContractVersion,
  MemoryItem,
  UsageSummary,
  V1Subscription,
  V1EntitlementsResponse,
  V1UsageResponse,
  CheckoutIntent,
  PaymentStatus,
  V1ConversationDetail,
  V1StructuredMessage,
  StructuredResponseSection,
  V1Reference,
  V1SourceDetail,
  V1SourceVersion,
  AiRun,
  LegalCategory,
  V1DocumentListItem,
  V1DocumentDetail,
  V1DocumentListResponse,
  V1DocumentStatusResponse,
  V1DocumentAnalysisResponse,
  V1DocumentUploadResponse,
  DocumentStatus,
  V1ContractTypeInfo,
  V1ContractType,
  V1ContractQuestion,
  V1ContractListItem,
  V1ContractListResponse,
  V1ContractDetail,
  V1ContractVersionDetail,
  V1ContractRiskAnalysis,
  V1RiskFinding,
  V1ContractClause,
  V1ContractDraft,
  V1ContractTypeListResponse,
  V1ContractQuestionListResponse,
  V1ContractGenerateResponse,
  V1ContractCategory,
  V1ContractState,
  V1ContractAttachment,
  // Phase 11
  V1HistoryItem,
  V1HistoryListResponse,
  V1MemoryItem,
  V1MemoryListResponse,
  V1UserPreferences,
  V1SubscriptionHistoryItem,
  V1SubscriptionHistoryResponse,
  V1ProfileUsage,
} from "@legalir/types";

// --- User Fixtures ---

export const fixtureUserNew: UserSummary = {
  id: "u-new-001",
  mobileE164: "+989120000001",
  mobileDisplay: "۰۹۱۲۰۰۰۰۰۰۱",
  status: "active",
};

export const fixtureUserBasic: UserSummary = {
  id: "u-basic-001",
  mobileE164: "+989120000002",
  mobileDisplay: "۰۹۱۲۰۰۰۰۰۰۲",
  status: "active",
};

export const fixtureUserPro: UserSummary = {
  id: "u-pro-001",
  mobileE164: "+989120000003",
  mobileDisplay: "۰۹۱۲۰۰۰۰۰۰۳",
  status: "active",
};

export const fixtureUserPremium: UserSummary = {
  id: "u-premium-001",
  mobileE164: "+989120000004",
  mobileDisplay: "۰۹۱۲۰۰۰۰۰۰۴",
  status: "active",
};

// --- Profile Fixtures ---

export const fixtureProfileIncomplete: Profile = {
  userId: "u-new-001",
  displayName: null,
  email: null,
  gender: null,
  birthDate: null,
  city: null,
  occupation: null,
  completionPercent: 30,
  avatarUrl: null,
  userType: null,
  province: null,
  legalInterests: null,
  primaryUseCase: null,
};

export const fixtureProfileComplete: Profile = {
  userId: "u-pro-001",
  displayName: "مریم محمدی",
  email: "maryam.mohammadi@example.com",
  gender: "female",
  birthDate: "1990-03-15",
  city: "تهران",
  occupation: "کارشناس حقوقی",
  completionPercent: 85,
  avatarUrl: null,
  userType: "کسب‌وکار / سازمان",
  province: "تهران",
  legalInterests: ["قراردادها", "املاک"],
  primaryUseCase: "مشاوره حقوقی",
};

// --- Preference Fixtures ---

export const fixturePreferences: UserPreference = {
  theme: "light",
  locale: "fa-IR",
  notifications: {
    appointments: true,
    contractExpiry: true,
    lawyerResponse: true,
    paymentStatus: true,
    caseUpdate: true,
    marketing: false,
  },
};

// --- Plan Fixtures ---

export const fixturePlans: Plan[] = [
  {
    id: "plan-silver",
    code: "silver",
    nameFa: "نقره",
    descriptionFa: "مناسب برای استفاده شخصی و آشنایی با خدمات حقوقی",
    durationDays: 30,
    listPrice: 5000000,
    salePrice: 2500000,
    currency: "IRT",
    dailyRequestLimit: 100,
    totalTokenLimit: 3000000,
    features: [
      "۱۰۰ درخواست روزانه",
      "۳٬۰۰۰٬۰۰۰ توکن ماهانه",
      "دسترسی پایه به منابع حقوقی",
      "پشتیبانی پیامکی",
      "مدت ۳۰ روزه",
    ],
    usageLimits: [
      { featureKey: "AI_CHAT_MESSAGE", nameFa: "پیام هوش مصنوعی", period: "month", limit: 3000 },
      { featureKey: "DOCUMENT_ANALYSIS", nameFa: "تحلیل سند", period: "month", limit: 5 },
      { featureKey: "CONTRACT_GENERATION", nameFa: "ایجاد قرارداد", period: "month", limit: 3 },
    ],
  },
  {
    id: "plan-gold",
    code: "gold",
    nameFa: "طلا",
    descriptionFa: "مناسب برای کسب‌وکارها و نیازهای حقوقی منظم",
    durationDays: 30,
    listPrice: 7000000,
    salePrice: 3500000,
    currency: "IRT",
    dailyRequestLimit: 150,
    totalTokenLimit: 4500000,
    features: [
      "۱۵۰ درخواست روزانه",
      "۴٬۵۰۰٬۰۰۰ توکن ماهانه",
      "تحلیل اسناد حقوقی",
      "ایجاد پیش‌نویس قرارداد",
      "پشتیبانی تلفنی",
      "مدت ۳۰ روزه",
    ],
    usageLimits: [
      { featureKey: "AI_CHAT_MESSAGE", nameFa: "پیام هوش مصنوعی", period: "month", limit: 4500 },
      { featureKey: "DOCUMENT_ANALYSIS", nameFa: "تحلیل سند", period: "month", limit: 15 },
      { featureKey: "CONTRACT_GENERATION", nameFa: "ایجاد قرارداد", period: "month", limit: 10 },
    ],
  },
  {
    id: "plan-diamond",
    code: "diamond",
    nameFa: "الماس",
    descriptionFa: "مناسب برای وکلا، موسسات حقوقی و استفاده حرفه‌ای",
    durationDays: 30,
    listPrice: 10000000,
    salePrice: 4860000,
    currency: "IRT",
    dailyRequestLimit: 300,
    totalTokenLimit: 9000000,
    features: [
      "۳۰۰ درخواست روزانه",
      "۹٬۰۰۰٬۰۰۰ توکن ماهانه",
      "خدمات ویژه حقوقی",
      "تحلیل پیشرفته اسناد",
      "ایجاد نامحدود قرارداد",
      "پشتیبانی اختصاصی",
      "مشاوره تخصصی با وکیل",
      "مدت ۳۰ روزه",
    ],
    usageLimits: [
      { featureKey: "AI_CHAT_MESSAGE", nameFa: "پیام هوش مصنوعی", period: "month", limit: 9000 },
      { featureKey: "DOCUMENT_ANALYSIS", nameFa: "تحلیل سند", period: "month", limit: 50 },
      { featureKey: "CONTRACT_GENERATION", nameFa: "ایجاد قرارداد", period: "month", limit: 30 },
    ],
  },
];

// --- Subscription Fixtures ---

export const fixtureSubscriptionSilver: Subscription = {
  id: "sub-silver-001",
  userId: "u-basic-001",
  planId: "plan-silver",
  planCode: "silver",
  startAt: "2026-07-01T00:00:00Z",
  endAt: "2026-07-31T00:00:00Z",
  status: "active",
};

export const fixtureSubscriptionGold: Subscription = {
  id: "sub-gold-001",
  userId: "u-pro-001",
  planId: "plan-gold",
  planCode: "gold",
  startAt: "2026-07-01T00:00:00Z",
  endAt: "2026-10-01T00:00:00Z",
  status: "active",
};

// --- V1 Subscription Fixtures ---

export const fixtureV1SubscriptionGold: V1Subscription = {
  id: "sub-gold-001",
  userId: "u-pro-001",
  planId: "plan-gold",
  planCode: "gold",
  planNameFa: "طلا",
  startAt: "2026-07-01T00:00:00Z",
  endAt: "2026-10-01T00:00:00Z",
  status: "active",
  autoRenew: true,
  cancelledAt: null,
};

export const fixtureV1SubscriptionExpired: V1Subscription = {
  id: "sub-expired-001",
  userId: "u-expired-001",
  planId: "plan-silver",
  planCode: "silver",
  planNameFa: "نقره",
  startAt: "2026-06-01T00:00:00Z",
  endAt: "2026-07-01T00:00:00Z",
  status: "expired",
  autoRenew: false,
  cancelledAt: null,
};

// --- Entitlement Fixtures ---

export const fixtureEntitlements: Entitlement[] = [
  { featureKey: "AI_CHAT_MESSAGE", nameFa: "پیام هوش مصنوعی", limit: 300, period: "month", used: 127, isBoolean: false, isEnabled: true },
  { featureKey: "DOCUMENT_ANALYSIS", nameFa: "تحلیل سند", limit: 10, period: "month", used: 3, isBoolean: false, isEnabled: true },
  { featureKey: "CONTRACT_GENERATION", nameFa: "ایجاد قرارداد", limit: 8, period: "month", used: 1, isBoolean: false, isEnabled: true },
  { featureKey: "ADVANCED_REFERENCE", nameFa: "منابع پیشرفته", limit: null, period: "forever", used: 0, isBoolean: true, isEnabled: true },
  { featureKey: "PRIORITY_PROCESSING", nameFa: "اولویت پردازش", limit: null, period: "forever", used: 0, isBoolean: true, isEnabled: false },
];

// --- Dashboard Fixtures ---

export const fixtureDashboard: DashboardSummary = {
  user: fixtureUserPro,
  profile: fixtureProfileComplete,
  subscription: fixtureSubscriptionGold,
  entitlements: fixtureEntitlements,
  recentActivity: [
    { id: "conv-001", type: "conversation", title: "مشاوره قرارداد اجاره", status: "active", updatedAt: "2026-07-28T10:30:00Z" },
    { id: "doc-001", type: "document", title: "قرارداد فروش.pdf", status: "ready", updatedAt: "2026-07-27T16:00:00Z" },
    { id: "cnt-001", type: "contract", title: "پیش‌نویس NDA", status: "generated", updatedAt: "2026-07-26T09:15:00Z" },
  ],
  savedSourcesCount: 4,
  activeProcessingCount: 1,
  dailyTrialsUsed: 0,
  dailyTrialsTotal: 5,
  activeRequests: [
    { id: 'ar-1', title: 'بررسی قرارداد اجاره ملک', type: 'document', typeFa: 'تحلیل سند', date: '2026-08-04T10:30:00Z', progress: 72, status: 'processing', statusFa: 'در حال پردازش', link: '/documents' },
    { id: 'ar-2', title: 'پیش‌نویس قرارداد مشارکت', type: 'contract', typeFa: 'قرارداد', date: '2026-08-03T14:00:00Z', progress: 30, status: 'draft', statusFa: 'پیش‌نویس', link: '/contracts' },
    { id: 'ar-3', title: 'مشاوره حقوقی در خصوص ارث', type: 'conversation', typeFa: 'گفتگو', date: '2026-08-05T08:15:00Z', progress: 0, status: 'needs_info', statusFa: 'نیازمند اطلاعات', link: '/chat' },
    { id: 'ar-4', title: 'تحلیل سند وصیت‌نامه', type: 'document', typeFa: 'تحلیل سند', date: '2026-08-01T09:00:00Z', progress: 100, status: 'completed', statusFa: 'تکمیل شده', link: '/documents' },
    { id: 'ar-5', title: 'تنظیم اظهارنامه رسمی', type: 'contract', typeFa: 'قرارداد', date: '2026-07-28T11:00:00Z', progress: 95, status: 'processing', statusFa: 'در حال پردازش', link: '/contracts' },
  ],
  recommendations: [
    { id: 'rec-1', text: 'قرارداد مشارکت شما هنوز نهایی نشده است. ادامه تنظیم قرارداد را تکمیل کنید.', icon: '📝', link: '/contracts', linkLabel: 'ادامه تنظیم', urgency: 'action' },
    { id: 'rec-2', text: 'بررسی ریسک سند قرارداد اجاره کامل شده است. گزارش تحلیل را مشاهده کنید.', icon: '✅', link: '/documents', linkLabel: 'مشاهده گزارش', urgency: 'info' },
    { id: 'rec-3', text: 'اطلاعات پرونده ناقص است. برای دریافت مشاوره دقیق‌تر، اطلاعات تکمیلی را وارد کنید.', icon: '⚠️', link: '/chat', linkLabel: 'تکمیل اطلاعات', urgency: 'warning' },
    { id: 'rec-4', text: 'درخواست اظهارنامه شما آماده پیش‌نمایش است. می‌توانید آن را بررسی و تأیید کنید.', icon: '✉️', link: '/contracts', linkLabel: 'پیش‌نمایش', urgency: 'action' },
  ],
  recentDocuments: [
    { id: 'rd-1', name: 'قرارداد_اجاره_۱۴۰۵.pdf', mime: 'application/pdf', uploadedAt: '2026-08-04T10:30:00Z', status: 'ready', statusFa: 'آماده' },
    { id: 'rd-2', name: 'وصیت‌نامه_تنظیمی.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', uploadedAt: '2026-08-03T16:00:00Z', status: 'analyzing', statusFa: 'در حال تحلیل' },
    { id: 'rd-3', name: 'مدارک_مالکیت.pdf', mime: 'application/pdf', uploadedAt: '2026-07-30T09:00:00Z', status: 'ready', statusFa: 'آماده' },
  ],
};

/** Dashboard for a new user — no activity, no subscription, incomplete profile */
export const fixtureDashboardEmpty: DashboardSummary = {
  user: fixtureUserNew,
  profile: fixtureProfileIncomplete,
  subscription: null,
  entitlements: [],
  recentActivity: [],
  savedSourcesCount: 0,
  activeProcessingCount: 0,
  dailyTrialsUsed: 0,
  dailyTrialsTotal: 5,
  activeRequests: [],
  recommendations: [],
  recentDocuments: [],
};

// --- Usage Summary Fixture ---

export const fixtureUsageSummary = {
  entitlements: fixtureEntitlements,
  periodEnd: new Date(Date.now() + 23 * 86_400_000).toISOString(),
  daysRemaining: 23,
} as const;

// --- Conversation Fixtures ---

export const fixtureConversationRent: Conversation & { messages: Message[] } = {
  id: "conv-rent-001",
  userId: "u-pro-001",
  title: "مشاوره قرارداد اجاره",
  category: "real_estate",
  status: "active",
  riskLevel: "medium",
  messageCount: 4,
  createdAt: "2026-07-28T10:00:00Z",
  updatedAt: "2026-07-28T10:30:00Z",
  messages: [
    {
      id: "msg-001",
      conversationId: "conv-rent-001",
      role: "user",
      content: "صاحبخانه بدون اجازه وارد خانه شده است. چه کاری می‌توانم انجام دهم؟",
      status: "sent",
      createdAt: "2026-07-28T10:00:00Z",
    },
    {
      id: "msg-002",
      conversationId: "conv-rent-001",
      role: "assistant",
      content: "بر اساس قانون روابط موجر و مستأجر، ورود بدون اجازه صاحبخانه به ملک استیجاری تخلف محسوب می‌شود...",
      status: "completed",
      createdAt: "2026-07-28T10:00:15Z",
    },
  ],
};

// --- Document Fixtures ---

export const fixtureDocumentLease: Document = {
  id: "doc-lease-001",
  userId: "u-pro-001",
  name: "قرارداد-اجاره-آپارتمان.pdf",
  mime: "application/pdf",
  sizeBytes: 450_000,
  status: "ready",
  storageKey: "u-pro-001/doc-lease-001.pdf",
  createdAt: "2026-07-27T14:00:00Z",
  updatedAt: "2026-07-27T16:00:00Z",
};

export const fixtureRiskReport: RiskReport = {
  documentId: "doc-lease-001",
  summary: "در این قرارداد ۵ مورد نیازمند توجه شناسایی شد.",
  findings: [
    {
      id: "find-001",
      documentId: "doc-lease-001",
      title: "عدم تعیین دقیق مبلغ اجاره",
      severity: "high",
      locator: "بند ۲، صفحه ۱",
      reason: "مبلغ اجاره به صورت علی‌الحساب ذکر شده و مکانیزم تعدیل ندارد",
      recommendation: "مبلغ دقیق اجاره و نحوه تعدیل سالانه را مشخص کنید",
      citation: null,
      confidence: 0.87,
    },
    {
      id: "find-002",
      documentId: "doc-lease-001",
      title: "وجه التزام نامتناسب",
      severity: "medium",
      locator: "بند ۷، صفحه ۲",
      reason: "وجه التزام تخلیه معادل ۳ برابر اجاره ماهانه تعیین شده است",
      recommendation: "وجه التزام را متناسب با خسارت واقعی تعدیل کنید",
      citation: null,
      confidence: 0.82,
    },
  ],
  generatedAt: "2026-07-27T16:00:00Z",
  confidence: 0.85,
};

// --- Contract Fixtures ---

export const fixtureContractNda: Contract & { versions: ContractVersion[] } = {
  id: "cnt-nda-001",
  userId: "u-pro-001",
  type: "nda",
  status: "generated",
  currentVersionId: "ver-002",
  createdAt: "2026-07-26T09:00:00Z",
  updatedAt: "2026-07-26T09:15:00Z",
  versions: [
    {
      id: "ver-001",
      contractId: "cnt-nda-001",
      versionNumber: 1,
      answers: { party1: "شرکت الف", party2: "شرکت ب", duration: "۲ سال" },
      content: "پیش‌نویس محرمانگی — نسخه ۱",
      createdAt: "2026-07-26T09:10:00Z",
    },
    {
      id: "ver-002",
      contractId: "cnt-nda-001",
      versionNumber: 2,
      answers: { party1: "شرکت الف", party2: "شرکت ب", duration: "۳ سال" },
      content: "پیش‌نویس محرمانگی — نسخه ۲",
      createdAt: "2026-07-26T09:15:00Z",
    },
  ],
};

// --- Memory Fixtures ---

export const fixtureMemoryItems: MemoryItem[] = [
  {
    id: "mem-001",
    userId: "u-pro-001",
    key: "نام کاربر",
    value: "مریم محمدی",
    sensitivity: "normal",
    status: "active",
    createdAt: "2026-07-15T10:00:00Z",
    updatedAt: "2026-07-15T10:00:00Z",
  },
];

// --- Phase 11: History Fixtures ---

export const HISTORY_CATEGORY_LABELS: Record<string, string> = {
  cases: "پرونده‌ها",
  contracts: "قراردادها",
  real_estate: "املاک",
  family: "خانواده",
  commerce: "تجارت",
  other: "سایر",
};

export const fixtureV1HistoryItems: V1HistoryItem[] = [
  {
    id: "hist-001",
    userId: "u-pro-001",
    type: "conversation",
    title: "مشاوره قرارداد اجاره",
    category: "real_estate",
    categoryFa: "املاک",
    status: "active",
    statusFa: "فعال",
    description: "گفتگو در مورد حقوق مستأجر و ورود غیرمجاز صاحبخانه",
    createdAt: "2026-07-28T10:00:00Z",
    updatedAt: "2026-07-28T10:30:00Z",
    archived: false,
  },
  {
    id: "hist-002",
    userId: "u-pro-001",
    type: "document",
    title: "قرارداد-اجاره-آپارتمان.pdf",
    category: "real_estate",
    categoryFa: "املاک",
    status: "ready",
    statusFa: "آماده",
    description: "تحلیل سند اجاره — ۵ یافته شناسایی شد",
    createdAt: "2026-07-27T14:00:00Z",
    updatedAt: "2026-07-27T16:00:00Z",
    archived: false,
  },
  {
    id: "hist-003",
    userId: "u-pro-001",
    type: "contract",
    title: "قرارداد اجاره آپارتمان",
    category: "real_estate",
    categoryFa: "املاک",
    status: "generated",
    statusFa: "تولید شده",
    description: "پیش‌نویس قرارداد اجاره — نسخه ۲",
    createdAt: "2026-07-30T10:00:00Z",
    updatedAt: "2026-07-30T11:00:00Z",
    archived: false,
  },
  {
    id: "hist-004",
    userId: "u-pro-001",
    type: "conversation",
    title: "مشاوره طلاق توافقی",
    category: "family",
    categoryFa: "خانواده",
    status: "completed",
    statusFa: "تکمیل شده",
    description: "گفتگو در مورد شرایط و مراحل طلاق توافقی",
    createdAt: "2026-07-20T10:00:00Z",
    updatedAt: "2026-07-25T18:00:00Z",
    archived: false,
  },
  {
    id: "hist-005",
    userId: "u-pro-001",
    type: "contract",
    title: "توافقنامه محرمانگی",
    category: "commerce",
    categoryFa: "تجارت",
    status: "under_review",
    statusFa: "در حال بررسی",
    description: "NDA بین شرکت الف و شرکت ب",
    createdAt: "2026-07-28T09:00:00Z",
    updatedAt: "2026-07-28T09:30:00Z",
    archived: false,
  },
  {
    id: "hist-006",
    userId: "u-pro-001",
    type: "document",
    title: "قرارداد-پیمانکاری-ساختمان.pdf",
    category: "commerce",
    categoryFa: "تجارت",
    status: "ready",
    statusFa: "آماده",
    description: "تحلیل قرارداد پیمانکاری — ۳ یافته",
    createdAt: "2026-07-25T09:00:00Z",
    updatedAt: "2026-07-25T11:30:00Z",
    archived: false,
  },
  {
    id: "hist-007",
    userId: "u-pro-001",
    type: "conversation",
    title: "چک برگشتی و نحوه اقدام",
    category: "commerce",
    categoryFa: "تجارت",
    status: "archived",
    statusFa: "بایگانی شده",
    description: "راهنمایی در مورد اقدامات قانونی چک برگشتی",
    createdAt: "2026-07-10T09:00:00Z",
    updatedAt: "2026-07-15T16:00:00Z",
    archived: true,
  },
  {
    id: "hist-008",
    userId: "u-pro-001",
    type: "conversation",
    title: "شکایت کلاهبرداری اینترنتی",
    category: "other",
    categoryFa: "سایر",
    status: "active",
    statusFa: "فعال",
    description: "مشاوره در مورد کلاهبرداری آنلاین و نحوه شکایت",
    createdAt: "2026-07-25T11:00:00Z",
    updatedAt: "2026-07-29T09:00:00Z",
    archived: false,
  },
];

// --- Phase 11: Memory V1 Fixtures ---

export const fixtureV1MemoryItems: V1MemoryItem[] = [
  {
    id: "mem-001",
    userId: "u-pro-001",
    key: "نام کاربر",
    value: "مریم محمدی",
    category: "profile",
    categoryFa: "اطلاعات کاربر",
    sensitivity: "normal",
    sensitivityFa: "عادی",
    status: "active",
    createdAt: "2026-07-15T10:00:00Z",
    updatedAt: "2026-07-15T10:00:00Z",
    consentGiven: true,
    consentDate: "2026-07-15T10:00:00Z",
  },
  {
    id: "mem-002",
    userId: "u-pro-001",
    key: "شهر محل سکونت",
    value: "تهران",
    category: "profile",
    categoryFa: "اطلاعات کاربر",
    sensitivity: "normal",
    sensitivityFa: "عادی",
    status: "active",
    createdAt: "2026-07-15T10:05:00Z",
    updatedAt: "2026-07-15T10:05:00Z",
    consentGiven: true,
    consentDate: "2026-07-15T10:05:00Z",
  },
  {
    id: "mem-003",
    userId: "u-pro-001",
    key: "ترجیح زبان پاسخ",
    value: "فارسی ساده و روان",
    category: "preference",
    categoryFa: "تنظیمات برگزیده",
    sensitivity: "normal",
    sensitivityFa: "عادی",
    status: "active",
    createdAt: "2026-07-16T09:00:00Z",
    updatedAt: "2026-07-16T09:00:00Z",
    consentGiven: true,
    consentDate: "2026-07-16T09:00:00Z",
  },
  {
    id: "mem-004",
    userId: "u-pro-001",
    key: "پرونده جاری",
    value: "اختلاف ملکی با موجر — شعبه ۱۵ شورای حل اختلاف تهران",
    category: "legal_context",
    categoryFa: "اطلاعات حقوقی",
    sensitivity: "sensitive",
    sensitivityFa: "حساس",
    status: "active",
    createdAt: "2026-07-20T14:00:00Z",
    updatedAt: "2026-07-20T14:00:00Z",
    consentGiven: true,
    consentDate: "2026-07-20T14:00:00Z",
  },
  {
    id: "mem-005",
    userId: "u-pro-001",
    key: "قراردادهای فعال",
    value: "اجاره آپارتمان ولیعصر — قرارداد یکساله تا ۱۴۰۵/۱۲/۲۹",
    category: "legal_context",
    categoryFa: "اطلاعات حقوقی",
    sensitivity: "sensitive",
    sensitivityFa: "حساس",
    status: "disabled",
    createdAt: "2026-07-18T11:00:00Z",
    updatedAt: "2026-07-19T08:00:00Z",
    consentGiven: true,
    consentDate: "2026-07-18T11:00:00Z",
  },
];

// --- Phase 11: Subscription History Fixtures ---

export const fixtureV1SubscriptionHistory: V1SubscriptionHistoryItem[] = [
  {
    id: "subhist-001",
    planNameFa: "طلا",
    planCode: "gold",
    amount: 2000000,
    currency: "IRT",
    startAt: "2026-07-01T00:00:00Z",
    endAt: "2026-10-01T00:00:00Z",
    status: "active",
    statusFa: "فعال",
    purchasedAt: "2026-07-01T00:00:00Z",
  },
  {
    id: "subhist-002",
    planNameFa: "نقره",
    planCode: "silver",
    amount: 900000,
    currency: "IRT",
    startAt: "2026-05-01T00:00:00Z",
    endAt: "2026-06-01T00:00:00Z",
    status: "expired",
    statusFa: "پایان یافته",
    purchasedAt: "2026-05-01T00:00:00Z",
  },
  {
    id: "subhist-003",
    planNameFa: "نقره",
    planCode: "silver",
    amount: 900000,
    currency: "IRT",
    startAt: "2025-12-01T00:00:00Z",
    endAt: "2026-01-01T00:00:00Z",
    status: "unknown",
    statusFa: "نامشخص",
    purchasedAt: "2025-12-01T00:00:00Z",
  },
];

// --- Phase 11: Profile Usage ---

export const fixtureProfileUsage: V1ProfileUsage = {
  dailyRequestsUsed: 127,
  dailyRequestsTotal: 300,
  tokensUsed: 850000,
  tokensTotal: 1300000,
  documentAnalysesUsed: 3,
  documentAnalysesTotal: 10,
  contractsGenerated: 1,
  contractsTotal: 8,
};

// --- V1 Entitlements Response ---

export const fixtureV1EntitlementsResponse: V1EntitlementsResponse = {
  entitlements: fixtureEntitlements,
  planCode: "gold",
  planNameFa: "طلا",
};

// --- V1 Usage Response ---

export const fixtureV1UsageResponse: V1UsageResponse = {
  usageCounters: [
    { featureKey: "AI_CHAT_MESSAGE", periodStart: "2026-07-01T00:00:00Z", periodEnd: "2026-08-01T00:00:00Z", used: 127, limit: 300 },
    { featureKey: "DOCUMENT_ANALYSIS", periodStart: "2026-07-01T00:00:00Z", periodEnd: "2026-08-01T00:00:00Z", used: 3, limit: 10 },
    { featureKey: "CONTRACT_GENERATION", periodStart: "2026-07-01T00:00:00Z", periodEnd: "2026-08-01T00:00:00Z", used: 1, limit: 8 },
  ],
  periodStart: "2026-07-01T00:00:00Z",
  periodEnd: "2026-08-01T00:00:00Z",
  daysRemaining: 23,
};

// --- Checkout Intent Fixtures ---

export function createCheckoutIntent(planCode: string, status: PaymentStatus = "idle"): CheckoutIntent {
  const plan = fixturePlans.find((p) => p.code === planCode) ?? fixturePlans[0]!;
  return {
    id: generateId(),
    planCode: plan.code,
    amount: plan.salePrice,
    currency: "IRT",
    status,
    paymentUrl: status === "pending" ? "https://mock-payment.legalir.ir/pay?id=mock-123" : null,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
    metadata: {
      planNameFa: plan.nameFa,
      durationDays: plan.durationDays,
      dailyRequests: plan.dailyRequestLimit,
      totalTokens: plan.totalTokenLimit,
    },
  };
}

// --- Phase 7: Structured Response Fixtures ---

export const fixtureStructuredResponseSections: StructuredResponseSection[] = [
  {
    id: "sec-summary",
    title: "خلاصه",
    content: "بر اساس اطلاعات ارائه‌شده، ورود صاحبخانه بدون اجازه به ملک استیجاری، نقض حقوق مستأجر محسوب می‌شود. قانون روابط موجر و مستأجر مصوب ۱۳۷۶، حقوق مشخصی را برای مستأجر در نظر گرفته است.",
    order: 1,
  },
  {
    id: "sec-facts",
    title: "اطلاعات و فرض‌ها",
    content: "اطلاعات ارائه‌شده:\n- قرارداد اجاره یک‌ساله منعقد شده است\n- صاحبخانه بدون اطلاع قبلی وارد ملک شده است\n- مورد مشابهی در ماه قبل نیز رخ داده است\n\nفرض‌ها:\n- قرارداد اجاره معتبر و قانونی است\n- ورود بدون هماهنگی قبلی انجام شده است",
    order: 2,
  },
  {
    id: "sec-analysis",
    title: "تحلیل اولیه",
    content: "طبق ماده ۴۹۰ قانون مدنی، مستأجر در مدت اجاره مالک منافع ملک است و صاحبخانه حق ورود بدون اجازه را ندارد. همچنین بر اساس قانون روابط موجر و مستأجر مصوب ۱۳۷۶، تصرف عدوانی توسط موجر قابل پیگرد است.",
    order: 3,
  },
  {
    id: "sec-risks",
    title: "ریسک‌ها",
    content: "۱. **ریسک بالا**: ادامه ورودهای غیرمجاز می‌تواند به سرقت یا آسیب به اموال شخصی منجر شود.\n۲. **ریسک متوسط**: احتمال فسخ یک‌طرفه قرارداد توسط موجر وجود دارد.\n۳. **ریسک متوسط**: در صورت عدم اقدام قانونی به‌موقع، حق شکایت ممکن است با محدودیت زمانی مواجه شود.",
    order: 4,
  },
  {
    id: "sec-actions",
    title: "اقدامات پیشنهادی",
    content: "۱. ارسال اظهارنامه رسمی به صاحبخانه مبنی بر ممنوعیت ورود بدون هماهنگی\n۲. نصب دوربین مداربسته در ورودی ملک جهت مستندسازی\n۳. در صورت تکرار، طرح شکایت در شورای حل اختلاف\n۴. مشاوره با وکیل متخصص دعاوی ملکی\n۵. مستندسازی تمام موارد ورود غیرمجاز با تاریخ و ساعت",
    order: 5,
  },
  {
    id: "sec-sources",
    title: "منابع",
    content: "تحلیل فوق بر اساس منابع حقوقی زیر انجام شده است:",
    order: 6,
  },
  {
    id: "sec-disclaimer",
    title: "هشدار حقوقی",
    content: "این تحلیل توسط هوش مصنوعی LEGALIR انجام شده و به هیچ‌وجه جایگزین مشاوره با وکیل متخصص نیست. قوانین ممکن است بسته به شرایط خاص پرونده شما تفسیر متفاوتی داشته باشند. توصیه می‌شود پیش از هر اقدام حقوقی با یک وکیل مشورت کنید.",
    order: 7,
  },
];

// --- Phase 8: Reference & Source Fixtures ---

export const fixtureV1References: V1Reference[] = [
  {
    id: "ref-001",
    conversationId: "conv-rent-001",
    messageId: "msg-002",
    sourceId: "src-law-civil-490",
    locator: "ماده ۴۹۰",
    quote: "مستأجر در مدت اجاره مالک منافع عین مستأجره است",
    section: "sec-analysis",
    sourceType: "law",
    sourceTypeFa: "قانون",
  },
  {
    id: "ref-002",
    conversationId: "conv-rent-001",
    messageId: "msg-002",
    sourceId: "src-law-mojer-1376",
    locator: "ماده ۱",
    quote: "روابط موجر و مستأجر تابع این قانون است",
    section: "sec-analysis",
    sourceType: "law",
    sourceTypeFa: "قانون",
  },
  {
    id: "ref-003",
    conversationId: "conv-rent-001",
    messageId: "msg-002",
    sourceId: "src-regulation-building",
    locator: "بند ۳-۲",
    quote: "ورود مالک به واحد استیجاری منوط به هماهنگی قبلی است",
    section: "sec-actions",
    sourceType: "regulation",
    sourceTypeFa: "آیین‌نامه",
  },
  {
    id: "ref-004",
    conversationId: "conv-rent-001",
    messageId: "msg-002",
    sourceId: "src-precinct-1402135",
    locator: "دادنامه ۹۹۰۹۹۷",
    quote: "ورود بدون اذن مستأجر به منزل استیجاری، تخلف محسوب می‌شود",
    section: "sec-analysis",
    sourceType: "precedent",
    sourceTypeFa: "رأی یا رویه قضایی",
  },
];

export const fixtureV1SourceCivil490: V1SourceDetail = {
  id: "src-law-civil-490",
  sourceType: "law",
  sourceTypeFa: "قانون",
  title: "قانون مدنی جمهوری اسلامی ایران",
  articleSection: "ماده ۴۹۰",
  publicationAuthority: "مجلس شورای اسلامی",
  jurisdiction: "ایران",
  effectiveDate: "۱۳۰۷-۰۲-۱۸",
  versionDate: "۱۳۹۵-۰۷-۱۴",
  excerpt: "ماده ۴۹۰: موجر نمی‌تواند در مدت اجاره در عین مستأجره تغییری دهد که موجب تضرر مستأجر شود. مستأجر در مدت اجاره مالک منافع عین مستأجره است و می‌تواند از آن به نحو متعارف استفاده نماید.",
  url: "https://rc.majlis.ir/fa/law/show/92538",
  documentIdentifier: "ق.م. مصوب ۱۳۰۷",
  status: "valid",
  availability: "available",
};

export const fixtureV1SourceMojer: V1SourceDetail = {
  id: "src-law-mojer-1376",
  sourceType: "law",
  sourceTypeFa: "قانون",
  title: "قانون روابط موجر و مستأجر مصوب ۱۳۷۶",
  articleSection: "ماده ۱",
  publicationAuthority: "مجلس شورای اسلامی",
  jurisdiction: "ایران",
  effectiveDate: "۱۳۷۶-۰۵-۲۰",
  versionDate: null,
  excerpt: "ماده ۱: به منظور ایجاد تعادل در روابط موجر و مستأجر و حمایت از حقوق مستأجران، مقررات این قانون لازم‌الاجرا می‌باشد.",
  url: "https://rc.majlis.ir/fa/law/show/93034",
  documentIdentifier: "ق.ر.م.م مصوب ۱۳۷۶",
  status: "valid",
  availability: "available",
};

export const fixtureV1SourceRegulation: V1SourceDetail = {
  id: "src-regulation-building",
  sourceType: "regulation",
  sourceTypeFa: "آیین‌نامه",
  title: "آیین‌نامه اجرایی قانون تملک آپارتمان‌ها",
  articleSection: "بند ۳-۲",
  publicationAuthority: "وزارت مسکن و شهرسازی",
  jurisdiction: "ایران",
  effectiveDate: "۱۳۸۰-۰۳-۱۵",
  versionDate: "۱۳۹۰-۱۲-۰۵",
  excerpt: "بند ۳-۲: ورود مالک یا نماینده وی به واحدهای استیجاری منوط به هماهنگی قبلی با مستأجر و کسب اجازه کتبی می‌باشد.",
  url: null,
  documentIdentifier: "آ.ا.ت.آ مصوب ۱۳۸۰",
  status: "valid",
  availability: "available",
};

export const fixtureV1SourcePrecedent: V1SourceDetail = {
  id: "src-precinct-1402135",
  sourceType: "precedent",
  sourceTypeFa: "رأی یا رویه قضایی",
  title: "رأی دادگاه تجدیدنظر استان تهران — پرونده ۱۴۰۲۱۳۵",
  articleSection: "دادنامه ۹۹۰۹۹۷",
  publicationAuthority: "دادگستری استان تهران",
  jurisdiction: "تهران",
  effectiveDate: "۱۴۰۲-۰۸-۲۱",
  versionDate: null,
  excerpt: "با توجه به محتویات پرونده و اظهارات طرفین، ورود بدون اذن مستأجر به منزل استیجاری تخلف از مفاد قرارداد اجاره و قانون مدنی محسوب می‌گردد. دادگاه موجر را به رعایت حقوق مستأجر ملزم می‌نماید.",
  url: null,
  documentIdentifier: "۹۹۰۹۹۷۰۲۲۳۹۰۰۰۰۰",
  status: "valid",
  availability: "available",
};

export const fixtureV1SourceOutdated: V1SourceDetail = {
  id: "src-outdated-001",
  sourceType: "law",
  sourceTypeFa: "قانون",
  title: "قانون روابط موجر و مستأجر مصوب ۱۳۵۶ (منسوخ)",
  articleSection: "ماده ۳",
  publicationAuthority: "مجلس شورای ملی",
  jurisdiction: "ایران",
  effectiveDate: "۱۳۵۶-۰۴-۱۰",
  versionDate: null,
  excerpt: "این قانون دیگر معتبر نیست و با قانون مصوب ۱۳۷۶ جایگزین شده است.",
  url: null,
  documentIdentifier: "ق.ر.م.م ۱۳۵۶",
  status: "expired",
  availability: "outdated",
};

export const fixtureV1SourceUnavailable: V1SourceDetail = {
  id: "src-unavailable-001",
  sourceType: "opinion",
  sourceTypeFa: "منبع تفسیری",
  title: "نظریه مشورتی شماره ۷/۹۹/۵۶۳ — اداره کل حقوقی قوه قضاییه",
  articleSection: null,
  publicationAuthority: "اداره کل حقوقی قوه قضاییه",
  jurisdiction: "ایران",
  effectiveDate: "۱۳۹۹-۰۶-۱۵",
  versionDate: null,
  excerpt: "متن کامل این نظریه مشورتی در دسترس نیست. ممکن است به دلیل دسته‌بندی محرمانه یا محدودیت انتشار، قابل دسترسی عمومی نباشد.",
  url: null,
  documentIdentifier: "ش ۷/۹۹/۵۶۳",
  status: "needs_review",
  availability: "unavailable",
};

export const fixtureV1SourceVersions: V1SourceVersion[] = [
  {
    id: "ver-src-001",
    sourceId: "src-law-civil-490",
    versionDate: "۱۳۹۵-۰۷-۱۴",
    changes: "اصلاح عبارت 'منافع' به 'منافع و استفاده'",
    effectiveDate: "۱۳۹۵-۰۸-۰۱",
  },
  {
    id: "ver-src-002",
    sourceId: "src-law-civil-490",
    versionDate: "۱۳۷۰-۰۵-۰۸",
    changes: "تغییر شماره ماده از ۴۸۸ به ۴۹۰",
    effectiveDate: "۱۳۷۰-۰۶-۰۱",
  },
  {
    id: "ver-src-003",
    sourceId: "src-law-civil-490",
    versionDate: "۱۳۰۷-۰۲-۱۸",
    changes: "تصویب اولیه",
    effectiveDate: "۱۳۰۷-۰۲-۱۸",
  },
];

// --- Phase 7: AI Run Fixtures ---

export function createAiRunFixture(
  conversationId = "conv-rent-001",
  messageId = "msg-002",
  status: AiRun["status"] = "succeeded"
): AiRun {
  return {
    id: generateId(),
    conversationId,
    messageId,
    modelRef: "legalir-v1.0",
    promptVersion: "v1-stable",
    status,
    startedAt: new Date().toISOString(),
    completedAt: status === "succeeded" || status === "failed" ? new Date().toISOString() : null,
  };
}

// --- Phase 7: Structured Message Fixture ---

export const fixtureV1StructuredMessage: V1StructuredMessage = {
  id: "msg-structured-001",
  conversationId: "conv-rent-001",
  role: "assistant",
  content: "بر اساس اطلاعات ارائه‌شده، ورود صاحبخانه بدون اجازه به ملک استیجاری، نقض حقوق مستأجر محسوب می‌شود.",
  status: "completed",
  createdAt: new Date().toISOString(),
  sections: fixtureStructuredResponseSections,
  riskLevel: "medium",
  references: fixtureV1References,
};

// --- Phase 7: Multiple Conversations for List ---

export const fixtureConversationContract: Conversation = {
  id: "conv-contract-001",
  userId: "u-pro-001",
  title: "تنظیم قرارداد مشارکت",
  category: "contract",
  status: "active",
  riskLevel: "low",
  messageCount: 8,
  createdAt: "2026-07-27T08:00:00Z",
  updatedAt: "2026-07-28T14:00:00Z",
};

export const fixtureConversationFamily: Conversation = {
  id: "conv-family-001",
  userId: "u-pro-001",
  title: "مشاوره طلاق توافقی",
  category: "family",
  status: "completed",
  riskLevel: "high",
  messageCount: 22,
  createdAt: "2026-07-20T10:00:00Z",
  updatedAt: "2026-07-25T18:00:00Z",
};

export const fixtureConversationCommerce: Conversation = {
  id: "conv-commerce-001",
  userId: "u-pro-001",
  title: "چک برگشتی و نحوه اقدام",
  category: "commerce",
  status: "archived",
  riskLevel: "critical",
  messageCount: 12,
  createdAt: "2026-07-10T09:00:00Z",
  updatedAt: "2026-07-15T16:00:00Z",
};

export const fixtureConversationCriminal: Conversation = {
  id: "conv-criminal-001",
  userId: "u-pro-001",
  title: "شکایت کلاهبرداری اینترنتی",
  category: "criminal",
  status: "active",
  riskLevel: "high",
  messageCount: 15,
  createdAt: "2026-07-25T11:00:00Z",
  updatedAt: "2026-07-29T09:00:00Z",
};

export const fixtureAllConversations: Conversation[] = [
  fixtureConversationRent,
  fixtureConversationCriminal,
  fixtureConversationContract,
  fixtureConversationFamily,
  fixtureConversationCommerce,
];

// --- Phase 7: V1 Conversation Detail ---

export const fixtureV1ConversationDetail: V1ConversationDetail = {
  ...fixtureConversationRent,
  messages: [
    ...(fixtureConversationRent as Conversation & { messages: Message[] }).messages,
    fixtureV1StructuredMessage,
  ],
  aiRuns: [
    createAiRunFixture("conv-rent-001", "msg-002", "succeeded"),
  ],
  references: fixtureV1References,
};

// --- Phase 8: Document Citations ---

export const fixtureV1DocumentCitations: { documentId: string; citations: V1Reference[] } = {
  documentId: "doc-lease-001",
  citations: [fixtureV1References[0]!, fixtureV1References[1]!],
};

// --- Phase 9: Document Analysis Fixtures ---

export const fixtureDocumentContract: Document = {
  id: "doc-contract-001",
  userId: "u-pro-001",
  name: "قرارداد-پیمانکاری-ساختمان.pdf",
  mime: "application/pdf",
  sizeBytes: 820_000,
  status: "ready",
  storageKey: "u-pro-001/doc-contract-001.pdf",
  createdAt: "2026-07-25T09:00:00Z",
  updatedAt: "2026-07-25T11:30:00Z",
};

export const fixtureDocumentNda: Document = {
  id: "doc-nda-001",
  userId: "u-pro-001",
  name: "توافقنامه-محرمانگی-شرکتی.docx",
  mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  sizeBytes: 245_000,
  status: "processing",
  storageKey: "u-pro-001/doc-nda-001.docx",
  createdAt: "2026-07-30T08:00:00Z",
  updatedAt: "2026-07-30T08:05:00Z",
};

export const fixtureDocumentFailed: Document = {
  id: "doc-failed-001",
  userId: "u-pro-001",
  name: "تصویر-قرارداد-ناخوانا.jpg",
  mime: "image/jpeg",
  sizeBytes: 1_200_000,
  status: "failed",
  storageKey: null,
  createdAt: "2026-07-29T14:00:00Z",
  updatedAt: "2026-07-29T14:02:00Z",
};

export const fixtureDocumentUploaded: Document = {
  id: "doc-uploaded-001",
  userId: "u-pro-001",
  name: "مدارک-دادگاه-جدید.pdf",
  mime: "application/pdf",
  sizeBytes: 3_500_000,
  status: "uploaded",
  storageKey: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// --- Phase 9: Risk Report with Full Findings ---

export const fixtureRiskReportFull: RiskReport = {
  documentId: "doc-lease-001",
  summary: "در این قرارداد ۵ مورد نیازمند توجه شناسایی شد. شامل ۱ مورد بحرانی و ۲ مورد با ریسک بالا.",
  findings: [
    {
      id: "find-001",
      documentId: "doc-lease-001",
      title: "فسخ",
      severity: "critical",
      locator: "بند ۱۲، صفحه ۳",
      reason: "شرط فسخ یک‌طرفه به نفع موجر تنظیم شده و مستأجر حق فسخ ندارد. این شرط برخلاف ماده ۴۹۰ قانون مدنی است.",
      recommendation: "شرط فسخ را به صورت دوطرفه تنظیم کنید و موارد فسخ را به تخلف از تعهدات اساسی محدود نمایید.",
      citation: null,
      confidence: 0.94,
    },
    {
      id: "find-002",
      documentId: "doc-lease-001",
      title: "جریمه",
      severity: "high",
      locator: "بند ۷، صفحه ۲",
      reason: "وجه التزام تخلیه معادل ۳ برابر اجاره ماهانه تعیین شده که طبق ماده ۲۳۰ قانون مدنی در صورت نامتناسب بودن قابل تعدیل است.",
      recommendation: "وجه التزام را متناسب با خسارت واقعی تعدیل کنید و سقف مشخصی برای آن تعیین نمایید.",
      citation: null,
      confidence: 0.87,
    },
    {
      id: "find-003",
      documentId: "doc-lease-001",
      title: "مالکیت",
      severity: "medium",
      locator: "بند ۱، صفحه ۱",
      reason: "مشخصات ثبتی ملک به صورت کامل ذکر نشده و شماره پلاک ثبتی و مساحت دقیق عین مستأجره قید نگردیده است.",
      recommendation: "اطلاعات ثبتی کامل ملک شامل پلاک ثبتی، مساحت، و کاربری را در قرارداد درج کنید.",
      citation: null,
      confidence: 0.91,
    },
    {
      id: "find-004",
      documentId: "doc-lease-001",
      title: "تعهدات",
      severity: "high",
      locator: "بند ۹، صفحه ۳",
      reason: "تعهدات مستأجر به صورت کلی ذکر شده و شامل 'هرگونه تعمیرات' است که برخلاف عرف، تعمیرات اساسی را نیز شامل می‌شود.",
      recommendation: "تعهدات تعمیراتی را تفکیک کنید: تعمیرات جزیی با مستأجر و تعمیرات اساسی با موجر.",
      citation: null,
      confidence: 0.83,
    },
    {
      id: "find-005",
      documentId: "doc-lease-001",
      title: "حل اختلاف",
      severity: "medium",
      locator: "بند ۱۵، صفحه ۴",
      reason: "شرط داوری به صورت کامل تنظیم نشده و مشخصات داور و نحوه انتخاب وی تعیین نگردیده است.",
      recommendation: "شرط داوری را با ذکر نام داور یا سازوکار مشخص برای انتخاب داور تکمیل کنید.",
      citation: null,
      confidence: 0.79,
    },
  ],
  generatedAt: "2026-07-27T16:00:00Z",
  confidence: 0.87,
};

// --- Phase 9: Document Jobs for Lifecycle Simulation ---

export const fixtureDocumentJobsComplete: DocumentJob[] = [
  { id: "job-001", documentId: "doc-lease-001", stage: "uploaded", status: "completed", progress: 100, errorCode: null },
  { id: "job-002", documentId: "doc-lease-001", stage: "processing", status: "completed", progress: 100, errorCode: null },
  { id: "job-003", documentId: "doc-lease-001", stage: "extracting", status: "completed", progress: 100, errorCode: null },
  { id: "job-004", documentId: "doc-lease-001", stage: "analyzing", status: "completed", progress: 100, errorCode: null },
];

export const fixtureDocumentJobsFailed: DocumentJob[] = [
  { id: "job-101", documentId: "doc-failed-001", stage: "uploaded", status: "completed", progress: 100, errorCode: null },
  { id: "job-102", documentId: "doc-failed-001", stage: "processing", status: "completed", progress: 100, errorCode: null },
  { id: "job-103", documentId: "doc-failed-001", stage: "extracting", status: "failed", progress: 45, errorCode: "OCR_LOW_QUALITY" },
];

// --- Phase 9: Document List Items ---

export const fixtureDocumentListItems: V1DocumentListItem[] = [
  {
    id: "doc-lease-001",
    name: "قرارداد-اجاره-آپارتمان.pdf",
    mime: "application/pdf",
    sizeBytes: 450_000,
    status: "ready",
    createdAt: "2026-07-27T14:00:00Z",
    updatedAt: "2026-07-27T16:00:00Z",
    riskLevel: "high",
    findingCount: 5,
  },
  {
    id: "doc-contract-001",
    name: "قرارداد-پیمانکاری-ساختمان.pdf",
    mime: "application/pdf",
    sizeBytes: 820_000,
    status: "ready",
    createdAt: "2026-07-25T09:00:00Z",
    updatedAt: "2026-07-25T11:30:00Z",
    riskLevel: "medium",
    findingCount: 3,
  },
  {
    id: "doc-nda-001",
    name: "توافقنامه-محرمانگی-شرکتی.docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: 245_000,
    status: "processing",
    createdAt: "2026-07-30T08:00:00Z",
    updatedAt: "2026-07-30T08:05:00Z",
    riskLevel: null,
    findingCount: 0,
  },
  {
    id: "doc-failed-001",
    name: "تصویر-قرارداد-ناخوانا.jpg",
    mime: "image/jpeg",
    sizeBytes: 1_200_000,
    status: "failed",
    createdAt: "2026-07-29T14:00:00Z",
    updatedAt: "2026-07-29T14:02:00Z",
    riskLevel: null,
    findingCount: 0,
  },
  {
    id: "doc-employment-002",
    name: "قرارداد-استخدام-شرکت-فنی.docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    sizeBytes: 520_000,
    status: "ready",
    createdAt: "2026-07-20T10:00:00Z",
    updatedAt: "2026-07-20T12:00:00Z",
    riskLevel: "low",
    findingCount: 1,
  },
];

export const fixtureDocumentListResponse: V1DocumentListResponse = {
  items: fixtureDocumentListItems,
  pagination: { page: 1, pageSize: 20, total: 5, totalPages: 1 },
};

// --- Phase 9: Document Detail ---

export const fixtureDocumentDetail: V1DocumentDetail = {
  id: "doc-lease-001",
  userId: "u-pro-001",
  name: "قرارداد-اجاره-آپارتمان.pdf",
  mime: "application/pdf",
  sizeBytes: 450_000,
  status: "ready",
  storageKey: "u-pro-001/doc-lease-001.pdf",
  createdAt: "2026-07-27T14:00:00Z",
  updatedAt: "2026-07-27T16:00:00Z",
  jobs: fixtureDocumentJobsComplete,
  report: fixtureRiskReportFull,
  extractedText: "قرارداد اجاره آپارتمان\n\nماده ۱: طرفین قرارداد\nموجر: آقای علی احمدی فرزند محمد، به شماره ملی ۰۰۱۲۳۴۵۶۷۸\nمستأجر: خانم مریم محمدی فرزند حسین، به شماره ملی ۹۸۷۶۵۴۳۲۱۰\n\nماده ۲: موضوع قرارداد\nیک باب آپارتمان مسکونی به مساحت تقریبی ۸۵ متر مربع واقع در تهران، خیابان ولیعصر...\n\nماده ۳: مدت قرارداد\nمدت اجاره از تاریخ ۱۴۰۵/۰۱/۰۱ لغایت ۱۴۰۵/۱۲/۲۹ به مدت یک سال شمسی.\n\nماده ۴: مبلغ اجاره\nاجاره‌بهای ماهانه مبلغ ۱۲۰,۰۰۰,۰۰۰ ریال که در پنجم هر ماه قابل پرداخت است.\n\n...",
  previewUrl: null,
};

export const fixtureDocumentDetailFailed: V1DocumentDetail = {
  id: "doc-failed-001",
  userId: "u-pro-001",
  name: "تصویر-قرارداد-ناخوانا.jpg",
  mime: "image/jpeg",
  sizeBytes: 1_200_000,
  status: "failed",
  storageKey: null,
  createdAt: "2026-07-29T14:00:00Z",
  updatedAt: "2026-07-29T14:02:00Z",
  jobs: fixtureDocumentJobsFailed,
  report: null,
  extractedText: null,
  previewUrl: null,
};

// --- Phase 9: Status & Analysis Response ---

export const fixtureDocumentStatusReady: V1DocumentStatusResponse = {
  id: "doc-lease-001",
  status: "ready",
  progress: 100,
  currentStage: null,
  errorCode: null,
};

export const fixtureDocumentStatusProcessing: V1DocumentStatusResponse = {
  id: "doc-nda-001",
  status: "processing",
  progress: 35,
  currentStage: "extracting",
  errorCode: null,
};

export const fixtureDocumentAnalysisResponse: V1DocumentAnalysisResponse = {
  report: fixtureRiskReportFull,
  extractedText: "قرارداد اجاره آپارتمان\n\nماده ۱: طرفین قرارداد\nموجر: آقای علی احمدی...",
};

// --- Phase 9: Upload Response ---

export const fixtureUploadResponse: V1DocumentUploadResponse = {
  id: "doc-new-001",
  uploadUrl: "http://localhost:8000/api/v1/documents/uploads/doc-new-001/complete",
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
};

// --- Document Utility: Create varied document for MSW ---

let docCounter = 0;
export function createMockDocument(name: string, mime: string, sizeBytes: number, status: DocumentStatus = "uploaded"): V1DocumentListItem {
  docCounter += 1;
  const id = `doc-mock-${docCounter.toString().padStart(3, "0")}`;
  const now = new Date().toISOString();
  return {
    id,
    name,
    mime,
    sizeBytes,
    status,
    createdAt: now,
    updatedAt: now,
    riskLevel: null,
    findingCount: 0,
  };
}

// --- Phase 10: Contract Workspace Fixtures ---

// Contract Type Info

export const fixtureV1ContractTypes: V1ContractTypeListResponse = {
  personal: [
    {
      id: "lease",
      nameFa: "اجاره",
      descriptionFa: "قرارداد اجاره ملک مسکونی، تجاری یا اداری",
      category: "personal",
      icon: "home",
      questionCount: 12,
    },
    {
      id: "sale_purchase",
      nameFa: "خرید و فروش",
      descriptionFa: "قرارداد خرید و فروش اموال منقول و غیرمنقول",
      category: "personal",
      icon: "shopping",
      questionCount: 14,
    },
    {
      id: "loan",
      nameFa: "قرض",
      descriptionFa: "قرارداد قرض‌الحسنه یا قرض با بهره",
      category: "personal",
      icon: "money",
      questionCount: 10,
    },
    {
      id: "partnership",
      nameFa: "شراکت",
      descriptionFa: "قرارداد مشارکت مدنی یا تجاری",
      category: "personal",
      icon: "users",
      questionCount: 16,
    },
  ],
  business: [
    {
      id: "nda",
      nameFa: "NDA",
      descriptionFa: "توافقنامه عدم افشای اطلاعات محرمانه",
      category: "business",
      icon: "shield",
      questionCount: 8,
    },
    {
      id: "employment",
      nameFa: "استخدام",
      descriptionFa: "قرارداد استخدام و همکاری کاری",
      category: "business",
      icon: "briefcase",
      questionCount: 15,
    },
    {
      id: "saas",
      nameFa: "SaaS",
      descriptionFa: "قرارداد اشتراک نرم‌افزار به عنوان سرویس",
      category: "business",
      icon: "cloud",
      questionCount: 11,
    },
    {
      id: "contracting",
      nameFa: "پیمانکاری",
      descriptionFa: "قرارداد پیمانکاری و خدمات اجرایی",
      category: "business",
      icon: "construction",
      questionCount: 18,
    },
    {
      id: "investment",
      nameFa: "سرمایه‌گذاری",
      descriptionFa: "قرارداد مشارکت سرمایه‌گذاری",
      category: "business",
      icon: "chart",
      questionCount: 14,
    },
  ],
};

// Contract Questions for Lease Type

export const fixtureV1LeaseQuestions: V1ContractQuestion[] = [
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

// Contract Questions for NDA Type

export const fixtureV1NdaQuestions: V1ContractQuestion[] = [
  { id: "q-nda-01", typeId: "nda", step: 1, fieldKey: "party1_name", labelFa: "نام افشاکننده (شخص/شرکت)", inputType: "text", required: true, placeholderFa: "نام کامل شخص یا شرکت" },
  { id: "q-nda-02", typeId: "nda", step: 1, fieldKey: "party1_id", labelFa: "شناسه ملی/کد ثبت", inputType: "text", required: true, placeholderFa: "شناسه ملی یا شماره ثبت" },
  { id: "q-nda-03", typeId: "nda", step: 1, fieldKey: "party2_name", labelFa: "نام گیرنده (شخص/شرکت)", inputType: "text", required: true, placeholderFa: "نام کامل شخص یا شرکت" },
  { id: "q-nda-04", typeId: "nda", step: 1, fieldKey: "party2_id", labelFa: "شناسه ملی/کد ثبت گیرنده", inputType: "text", required: true, placeholderFa: "شناسه ملی یا شماره ثبت" },
  { id: "q-nda-05", typeId: "nda", step: 2, fieldKey: "purpose", labelFa: "هدف از افشای اطلاعات", inputType: "textarea", required: true, placeholderFa: "شرح هدف از تبادل اطلاعات محرمانه" },
  { id: "q-nda-06", typeId: "nda", step: 3, fieldKey: "duration_months", labelFa: "مدت تعهد محرمانگی (ماه)", inputType: "number", required: true, placeholderFa: "مثلاً ۲۴" },
  { id: "q-nda-07", typeId: "nda", step: 4, fieldKey: "penalty_amount", labelFa: "مبلغ خسارت نقض تعهد (ریال)", inputType: "number", required: true, placeholderFa: "مبلغ به ریال" },
  { id: "q-nda-08", typeId: "nda", step: 4, fieldKey: "governing_law", labelFa: "قانون حاکم", inputType: "select", required: true, options: [{ value: "iran", labelFa: "قوانین جمهوری اسلامی ایران" }, { value: "other", labelFa: "سایر" }] },
];

// Contract Questions for Employment Type

export const fixtureV1EmploymentQuestions: V1ContractQuestion[] = [
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

// Contract Version Detail Fixtures

export const fixtureV1ContractVersion1: V1ContractVersionDetail = {
  id: "ver-lease-001",
  contractId: "cnt-lease-001",
  versionNumber: 1,
  answers: {
    party1_name: "علی احمدی",
    party1_id: "۰۰۱۲۳۴۵۶۷۸",
    party2_name: "مریم محمدی",
    party2_id: "۹۸۷۶۵۴۳۲۱۰",
    property_address: "تهران، خیابان ولیعصر، کوچه نهم، پلاک ۱۲، طبقه سوم",
    property_area: "۸۵",
    property_usage: "residential",
    rent_amount: "۱۲۰۰۰۰۰۰۰",
    deposit_amount: "۳۰۰۰۰۰۰۰۰",
    start_date: "۱۴۰۵/۰۱/۰۱",
    duration_months: "۱۲",
    special_conditions: "",
  },
  content: `قرارداد اجاره
بین آقای علی احمدی به عنوان "موجر" و خانم مریم محمدی به عنوان "مستأجر" به شرح زیر منعقد می‌گردد.

ماده ۱ - موضوع قرارداد: یک باب آپارتمان مسکونی به مساحت ۸۵ متر مربع واقع در تهران، خیابان ولیعصر، کوچه نهم، پلاک ۱۲، طبقه سوم می‌باشد.

ماده ۲ - مدت اجاره: از تاریخ ۱۴۰۵/۰۱/۰۱ لغایت ۱۴۰۵/۱۲/۲۹ به مدت ۱۲ ماه شمسی.

ماده ۳ - اجاره‌بها: ماهیانه ۱۲۰,۰۰۰,۰۰۰ ریال که می‌بایست حداکثر تا پنجم هر ماه پرداخت گردد.

ماده ۴ - ودیعه: مبلغ ۳۰۰,۰۰۰,۰۰۰ ریال به عنوان ودیعه نزد موجر می‌ماند که در پایان مدت اجاره مسترد خواهد شد.`,
  clauses: [
    { id: "cl-001", title: "ماده ۱ - موضوع قرارداد", content: "یک باب آپارتمان مسکونی به مساحت ۸۵ متر مربع...", isProtective: false, importance: "essential" },
    { id: "cl-002", title: "ماده ۲ - مدت اجاره", content: "از تاریخ ۱۴۰۵/۰۱/۰۱ لغایت ۱۴۰۵/۱۲/۲۹ به مدت ۱۲ ماه...", isProtective: false, importance: "essential" },
    { id: "cl-003", title: "ماده ۳ - اجاره‌بها", content: "ماهیانه ۱۲۰,۰۰۰,۰۰۰ ریال...", isProtective: false, importance: "essential" },
    { id: "cl-004", title: "ماده ۴ - ودیعه", content: "مبلغ ۳۰۰,۰۰۰,۰۰۰ ریال به عنوان ودیعه...", isProtective: true, importance: "recommended" },
  ],
  state: "generated",
  createdAt: "2026-07-30T10:00:00Z",
};

export const fixtureV1ContractVersion2: V1ContractVersionDetail = {
  id: "ver-lease-002",
  contractId: "cnt-lease-001",
  versionNumber: 2,
  answers: {
    party1_name: "علی احمدی",
    party1_id: "۰۰۱۲۳۴۵۶۷۸",
    party2_name: "مریم محمدی",
    party2_id: "۹۸۷۶۵۴۳۲۱۰",
    property_address: "تهران، خیابان ولیعصر، کوچه نهم، پلاک ۱۲، طبقه سوم",
    property_area: "۸۵",
    property_usage: "residential",
    rent_amount: "۱۳۰۰۰۰۰۰۰",
    deposit_amount: "۳۵۰۰۰۰۰۰۰",
    start_date: "۱۴۰۵/۰۲/۰۱",
    duration_months: "۱۲",
    special_conditions: "مستأجر حق فسخ یک‌ماهه دارد",
  },
  content: `قرارداد اجاره
بین آقای علی احمدی به عنوان "موجر" و خانم مریم محمدی به عنوان "مستأجر" به شرح زیر منعقد می‌گردد.

ماده ۱ - موضوع قرارداد: یک باب آپارتمان مسکونی به مساحت ۸۵ متر مربع واقع در تهران، خیابان ولیعصر، کوچه نهم، پلاک ۱۲، طبقه سوم می‌باشد.

ماده ۲ - مدت اجاره: از تاریخ ۱۴۰۵/۰۲/۰۱ لغایت ۱۴۰۶/۰۱/۳۱ به مدت ۱۲ ماه شمسی.

ماده ۳ - اجاره‌بها: ماهیانه ۱۳۰,۰۰۰,۰۰۰ ریال.

ماده ۴ - ودیعه: مبلغ ۳۵۰,۰۰۰,۰۰۰ ریال.

ماده ۵ - شرایط خاص: مستأجر حق فسخ قرارداد با اعلام یک‌ماهه را خواهد داشت.`,
  clauses: [
    { id: "cl-001", title: "ماده ۱ - موضوع قرارداد", content: "یک باب آپارتمان مسکونی به مساحت ۸۵ متر مربع...", isProtective: false, importance: "essential" },
    { id: "cl-002", title: "ماده ۲ - مدت اجاره", content: "از تاریخ ۱۴۰۵/۰۲/۰۱ لغایت ۱۴۰۶/۰۱/۳۱...", isProtective: false, importance: "essential" },
    { id: "cl-003", title: "ماده ۳ - اجاره‌بها", content: "ماهیانه ۱۳۰,۰۰۰,۰۰۰ ریال...", isProtective: false, importance: "essential" },
    { id: "cl-004", title: "ماده ۴ - ودیعه", content: "مبلغ ۳۵۰,۰۰۰,۰۰۰ ریال...", isProtective: true, importance: "recommended" },
    { id: "cl-005", title: "ماده ۵ - شرایط خاص", content: "مستأجر حق فسخ با اعلام یک‌ماهه دارد", isProtective: true, importance: "essential" },
  ],
  state: "generated",
  createdAt: "2026-07-30T11:00:00Z",
};

// Risk Analysis Fixtures

export const fixtureV1RiskFindings: V1RiskFinding[] = [
  {
    id: "rf-001",
    title: "عدم تعیین تکلیف تعمیرات اساسی",
    severity: "high",
    description: "در این قرارداد تعمیرات اساسی بر عهده مستأجر گذاشته شده که برخلاف عرف و قانون است.",
    clauseRef: "cl-002",
    suggestion: "تعمیرات اساسی باید بر عهده موجر باشد و در بند جداگانه تصریح شود.",
  },
  {
    id: "rf-002",
    title: "وجه‌الضمان نامشخص",
    severity: "medium",
    description: "نحوه برداشت از ودیعه برای خسارات احتمالی مشخص نشده است.",
    clauseRef: "cl-004",
    suggestion: "شرایط برداشت از ودیعه و نحوه مستندسازی خسارت را تعیین کنید.",
  },
  {
    id: "rf-003",
    title: "عدم ذکر حق فسخ",
    severity: "low",
    description: "شرایط فسخ قرارداد برای طرفین ذکر نشده است.",
    clauseRef: null,
    suggestion: "شرایط فسخ یک‌طرفه و دوطرفه را مشخص کنید.",
  },
];

export const fixtureV1ContractRiskAnalysis: V1ContractRiskAnalysis = {
  contractId: "cnt-lease-001",
  overallRisk: "medium",
  findings: fixtureV1RiskFindings,
  protectiveSuggestions: [
    {
      id: "ps-001",
      title: "بند تضمین تخلیه",
      content: "مستأجر متعهد می‌گردد در پایان مدت اجاره، ملک را بدون نیاز به تشریفات قضایی تخلیه و تحویل دهد.",
      isProtective: true,
      importance: "recommended",
    },
    {
      id: "ps-002",
      title: "بند حل اختلاف",
      content: "در صورت بروز اختلاف، طرفین ابتدا به داوری مراجعه و در صورت عدم حصول نتیجه، به دادگاه صالح مراجعه خواهند نمود.",
      isProtective: true,
      importance: "essential",
    },
    {
      id: "ps-003",
      title: "بند تعدیل اجاره‌بها",
      content: "اجاره‌بهای سال‌های بعد با توافق طرفین و بر اساس نرخ تورم رسمی اعلامی بانک مرکزی تعدیل خواهد شد.",
      isProtective: true,
      importance: "optional",
    },
  ],
  generatedAt: "2026-07-30T10:05:00Z",
};

// Contract List Item Fixtures

export const fixtureV1ContractListItems: V1ContractListItem[] = [
  {
    id: "cnt-lease-001",
    title: "قرارداد اجاره آپارتمان",
    type: "lease",
    typeFa: "اجاره",
    category: "personal",
    state: "generated",
    currentVersionNumber: 2,
    createdAt: "2026-07-30T10:00:00Z",
    updatedAt: "2026-07-30T11:00:00Z",
    hasDraft: false,
  },
  {
    id: "cnt-nda-001",
    title: "توافقنامه محرمانگی",
    type: "nda",
    typeFa: "NDA",
    category: "business",
    state: "under_review",
    currentVersionNumber: 1,
    createdAt: "2026-07-28T09:00:00Z",
    updatedAt: "2026-07-28T09:30:00Z",
    hasDraft: false,
  },
  {
    id: "cnt-emp-001",
    title: "قرارداد استخدام مدیر فنی",
    type: "employment",
    typeFa: "استخدام",
    category: "business",
    state: "draft",
    currentVersionNumber: 0,
    createdAt: "2026-07-31T08:00:00Z",
    updatedAt: "2026-07-31T08:00:00Z",
    hasDraft: true,
  },
  {
    id: "cnt-partner-001",
    title: "قرارداد مشارکت تجاری",
    type: "partnership",
    typeFa: "شراکت",
    category: "personal",
    state: "approved",
    currentVersionNumber: 3,
    createdAt: "2026-07-15T10:00:00Z",
    updatedAt: "2026-07-25T16:00:00Z",
    hasDraft: false,
  },
  {
    id: "cnt-archived-001",
    title: "قرارداد قدیمی پیمانکاری",
    type: "contracting",
    typeFa: "پیمانکاری",
    category: "business",
    state: "archived",
    currentVersionNumber: 1,
    createdAt: "2026-06-01T10:00:00Z",
    updatedAt: "2026-07-01T10:00:00Z",
    hasDraft: false,
  },
  {
    id: "cnt-saas-001",
    title: "قرارداد اشتراک نرم‌افزار",
    type: "saas",
    typeFa: "SaaS",
    category: "business",
    state: "draft",
    currentVersionNumber: 0,
    createdAt: "2026-07-31T10:00:00Z",
    updatedAt: "2026-07-31T10:00:00Z",
    hasDraft: true,
  },
];

export const fixtureV1ContractListResponse: V1ContractListResponse = {
  items: fixtureV1ContractListItems,
  pagination: { page: 1, pageSize: 20, total: 6, totalPages: 1 },
};

// Contract Attachment Fixtures (sample attached documents with legal sections)

export const fixtureV1ContractAttachmentsLease: V1ContractAttachment[] = [
  {
    id: "att-lease-law-001",
    fileName: "قانون-روابط-موجر-و-مستاجر-1356.pdf",
    title: "قانون روابط موجر و مستأجر مصوب ۱۳۵۶",
    kind: "law",
    kindFa: "قانون",
    uploadedAt: "2026-07-30T10:10:00Z",
    sections: [
      {
        id: "s-lease-law-1",
        title: "ماده ۱ — شمول قانون",
        content:
          "این قانون ناظر به کلیه قراردادهای اجاره‌ای است که پس از لازم‌الاجرا شدن آن منعقد می‌گردد و روابط موجر و مستأجر را از حیث مدت، اجاره‌بها و شرایط تخلیه تنظیم می‌نماید.",
      },
      {
        id: "s-lease-law-2",
        title: "ماده ۲ — مدت اجاره",
        content:
          "مدت اجاره حسب توافق طرفین تعیین می‌شود. در صورت عدم تعیین مدت، قرارداد اجاره حسب عرف محل و نوع مورد اجاره تفسیر می‌گردد.",
      },
      {
        id: "s-lease-law-3",
        title: "ماده ۳ — اجاره‌بها",
        content:
          "اجاره‌بها می‌بایست در مواعد مقرر پرداخت گردد. عدم پرداخت اجاره‌بها در موعد مقرر، حق مراجعه قانونی موجر را ایجاد می‌نماید.",
      },
    ],
  },
  {
    id: "att-lease-dir-001",
    fileName: "بخشنامه-تعدیل-اجاره-1403.pdf",
    title: "بخشنامه تعدیل اجاره‌بها (شورای عالی مسکن)",
    kind: "directive",
    kindFa: "بخشنامه",
    uploadedAt: "2026-07-30T10:12:00Z",
    sections: [
      {
        id: "s-lease-dir-1",
        title: "بند ۱ — سقف افزایش سالانه",
        content:
          "افزایش اجاره‌بها در تمدید قراردادهای مسکونی نباید از سقف تعیین‌شده سالانه تجاوز نماید؛ تعیین سقف بر اساس نرخ تورم و شرایط بازار مسکن صورت می‌پذیرد.",
      },
      {
        id: "s-lease-dir-2",
        title: "بند ۲ — مستندات قرارداد",
        content:
          "قراردادهای اجاره می‌بایست در سامانه ملی املاک و مستغلات ثبت گردیده و کد رهگیری دریافت نمایند تا مشمول حمایت‌های این بخشنامه قرار گیرند.",
      },
    ],
  },
  {
    id: "att-lease-prec-001",
    fileName: "رای-وحدت-رویه-814-اجاره.pdf",
    title: "رأی وحدت رویه شماره ۸۱۴ هیأت عمومی دیوان عالی کشور",
    kind: "precedent",
    kindFa: "رأی وحدت رویه",
    uploadedAt: "2026-07-30T10:15:00Z",
    sections: [
      {
        id: "s-lease-prec-1",
        title: "موضوع رأی",
        content:
          "در خصوص اعتبار شرط فسخ یک‌ماهه مستأجر و آثار آن بر لزوم پرداخت اجاره‌بهای مدت باقی‌مانده، هیأت عمومی دیوان عالی کشور مقرر داشت...",
      },
    ],
  },
];

export const fixtureV1ContractAttachmentsNda: V1ContractAttachment[] = [
  {
    id: "att-nda-law-001",
    fileName: "قانون-تجارت-الکترونیکی-1382.pdf",
    title: "قانون تجارت الکترونیکی مصوب ۱۳۸۲",
    kind: "law",
    kindFa: "قانون",
    uploadedAt: "2026-07-28T09:10:00Z",
    sections: [
      {
        id: "s-nda-law-1",
        title: "ماده ۶۴ — حفاظت از داده‌ها",
        content:
          "تأمین‌کنندگان و دریافت‌کنندگان خدمات الکترونیکی مکلف به حفظ محرمانگی اطلاعات و داده‌های شخصی کاربران می‌باشند و افشای آن جز در موارد قانونی ممنوع است.",
      },
      {
        id: "s-nda-law-2",
        title: "ماده ۶۵ — مسئولیت",
        content:
          "هر شخصی که اطلاعات محرمانه را بدون مجوز قانونی افشا نماید، حسب مورد مسئولیت مدنی و کیفری خواهد داشت.",
      },
    ],
  },
  {
    id: "att-nda-reg-001",
    fileName: "آیین‌نامه-حفاظت-از-اسرار-تجاری.pdf",
    title: "آیین‌نامه حفاظت از اسرار تجاری",
    kind: "regulation",
    kindFa: "آیین‌نامه",
    uploadedAt: "2026-07-28T09:20:00Z",
    sections: [
      {
        id: "s-nda-reg-1",
        title: "ماده ۱ — تعریف اسرار تجاری",
        content:
          "اسرار تجاری عبارت است از هرگونه اطلاعاتی که دارای ارزش اقتصادی بوده، نزد عموم شناخته‌شده نباشد و دارنده آن اقدامات معقولی برای حفظ محرمانگی به عمل آورده باشد.",
      },
    ],
  },
];

// Contract Detail Fixture

export const fixtureV1ContractDetail: V1ContractDetail = {
  id: "cnt-lease-001",
  userId: "u-pro-001",
  title: "قرارداد اجاره آپارتمان",
  type: "lease",
  typeFa: "اجاره",
  category: "personal",
  state: "generated",
  currentVersionId: "ver-lease-002",
  currentVersionNumber: 2,
  versions: [fixtureV1ContractVersion1, fixtureV1ContractVersion2],
  analysis: fixtureV1ContractRiskAnalysis,
  attachments: fixtureV1ContractAttachmentsLease,
  createdAt: "2026-07-30T10:00:00Z",
  updatedAt: "2026-07-30T11:00:00Z",
  disclaimer: "این متن به صورت خودکار توسط هوش مصنوعی LEGALIR تولید شده و صرفاً یک پیش‌نویس است. این متن نباید به عنوان سند قانونی نهایی تلقی شود. پیش از استفاده، حتماً آن را توسط یک وکیل متخصص بررسی و تأیید کنید. LEGALIR هیچ مسئولیتی در قبال استفاده از این پیش‌نویس بدون بررسی حقوقی ندارد.",
};

// --- Sample Attachments for the remaining contract types ---

export const fixtureV1ContractAttachmentsEmployment: V1ContractAttachment[] = [
  {
    id: "att-emp-law-001",
    fileName: "قانون-کار-مصوب-1369.pdf",
    title: "قانون کار جمهوری اسلامی ایران",
    kind: "law",
    kindFa: "قانون",
    uploadedAt: "2026-07-31T08:10:00Z",
    sections: [
      {
        id: "s-emp-law-1",
        title: "ماده ۷ — قرارداد کار",
        content:
          "قرارداد کار عبارت است از قرارداد کتبی یا شفاهی که به موجب آن کارگر در قبال دریافت حقالسعی، کاری را برای مدت موقت یا غیرموقت برای کارفرما انجام می‌دهد.",
      },
      {
        id: "s-emp-law-2",
        title: "ماده ۲۴ — خاتمه قرارداد",
        content:
          "در صورت فسخ قرارداد کار، کارفرما مکلف به پرداخت کلیه حقوق و مزایای قانونی کارگر تا تاریخ خاتمه قرارداد می‌باشد.",
      },
    ],
  },
  {
    id: "att-emp-dir-001",
    fileName: "آیین‌نامه-ساعات-کار-و-اضافه‌کاری.pdf",
    title: "آیین‌نامه ساعات کار و اضافه‌کاری",
    kind: "regulation",
    kindFa: "آیین‌نامه",
    uploadedAt: "2026-07-31T08:15:00Z",
    sections: [
      {
        id: "s-emp-dir-1",
        title: "ماده ۱ — ساعات کار",
        content:
          "ساعات کار کارگران نباید از سقف مقرر در قانون کار تجاوز نماید و اضافه‌کاری مستلزم توافق و پرداخت فوق‌العاده مربوطه است.",
      },
    ],
  },
];

export const fixtureV1ContractAttachmentsPartnership: V1ContractAttachment[] = [
  {
    id: "att-partner-law-001",
    fileName: "قانون-مدنی-عقد-شرکت.pdf",
    title: "قانون مدنی — باب شرکت (مواد ۵۷۱ تا ۶۰۶)",
    kind: "law",
    kindFa: "قانون",
    uploadedAt: "2026-07-15T10:05:00Z",
    sections: [
      {
        id: "s-partner-law-1",
        title: "ماده ۵۷۱ — تعریف شرکت",
        content:
          "شرکت عبارت است از اجتماع حقوق مالکین متعدد در شیء واحد به نحو اشاعه.",
      },
      {
        id: "s-partner-law-2",
        title: "ماده ۵۷۵ — تقسیم سود و زیان",
        content:
          "سود و زیان به نسبت حصه شرکا تقسیم می‌گردد مگر اینکه ترتیب دیگری در قرارداد شرط شده باشد.",
      },
    ],
  },
  {
    id: "att-partner-law-002",
    fileName: "قانون-تجارت-شرکت‌های-تجاری.pdf",
    title: "قانون تجارت — شرکت‌های تجاری",
    kind: "law",
    kindFa: "قانون",
    uploadedAt: "2026-07-15T10:10:00Z",
    sections: [
      {
        id: "s-partner-law-2-1",
        title: "ماده ۲۰ — انواع شرکت‌های تجاری",
        content:
          "شرکت‌های تجاری بر هفت قسم است: سهامی عام، سهامی خاص، با مسئولیت محدود، تضامنی، مختلط، نسبی، تعاونی.",
      },
    ],
  },
];

export const fixtureV1ContractAttachmentsSaas: V1ContractAttachment[] = [
  {
    id: "att-saas-law-001",
    fileName: "قانون-تجارت-الکترونیکی-1382.pdf",
    title: "قانون تجارت الکترونیکی مصوب ۱۳۸۲",
    kind: "law",
    kindFa: "قانون",
    uploadedAt: "2026-07-31T10:05:00Z",
    sections: [
      {
        id: "s-saas-law-1",
        title: "ماده ۳۳ — قراردادهای الکترونیکی",
        content:
          "قراردادهای الکترونیکی در حکم قراردادهای عادی بوده و دارای همان آثار حقوقی می‌باشند.",
      },
      {
        id: "s-saas-law-2",
        title: "ماده ۶۴ — حفاظت از داده‌ها",
        content:
          "ارائه‌دهندگان خدمات الکترونیکی مکلف به حفظ محرمانگی اطلاعات کاربران می‌باشند.",
      },
    ],
  },
];

export const fixtureV1ContractAttachmentsContracting: V1ContractAttachment[] = [
  {
    id: "att-ctr-law-001",
    fileName: "شرایط-عمومی-پیمان.pdf",
    title: "شرایط عمومی پیمان",
    kind: "regulation",
    kindFa: "آیین‌نامه",
    uploadedAt: "2026-06-01T10:05:00Z",
    sections: [
      {
        id: "s-ctr-law-1",
        title: "ماده ۲ — تعهدات پیمانکار",
        content:
          "پیمانکار متعهد است عملیات موضوع پیمان را مطابق نقشه‌ها، مشخصات فنی و برنامه زمان‌بندی انجام و تحویل دهد.",
      },
      {
        id: "s-ctr-law-2",
        title: "ماده ۴۸ — صورت‌وضعیت",
        content:
          "صورت‌وضعیت‌های موقت و قطعی بر اساس پیشرفت کار تنظیم و پس از تأیید دستگاه نظارت پرداخت می‌گردد.",
      },
    ],
  },
  {
    id: "att-ctr-law-002",
    fileName: "قانون-برگزاری-مناقصات.pdf",
    title: "قانون برگزاری مناقصات",
    kind: "law",
    kindFa: "قانون",
    uploadedAt: "2026-06-01T10:10:00Z",
    sections: [
      {
        id: "s-ctr-law-2-1",
        title: "ماده ۱ — شمول قانون",
        content:
          "این قانون ناظر بر معاملات دستگاه‌های اجرایی از طریق برگزاری مناقصه می‌باشد.",
      },
    ],
  },
];

export const fixtureV1ContractDetailEmployment: V1ContractDetail = {
  id: "cnt-emp-001",
  userId: "u-pro-001",
  title: "قرارداد استخدام مدیر فنی",
  type: "employment",
  typeFa: "استخدام",
  category: "business",
  state: "draft",
  currentVersionId: null,
  currentVersionNumber: 0,
  versions: [],
  analysis: null,
  attachments: fixtureV1ContractAttachmentsEmployment,
  createdAt: "2026-07-31T08:00:00Z",
  updatedAt: "2026-07-31T08:30:00Z",
  disclaimer: "این متن به صورت خودکار توسط هوش مصنوعی LEGALIR تولید شده و صرفاً یک پیش‌نویس است.",
};

export const fixtureV1ContractDetailPartnership: V1ContractDetail = {
  id: "cnt-partner-001",
  userId: "u-pro-001",
  title: "قرارداد مشارکت تجاری",
  type: "partnership",
  typeFa: "شراکت",
  category: "personal",
  state: "approved",
  currentVersionId: "ver-partner-003",
  currentVersionNumber: 3,
  versions: [
    {
      id: "ver-partner-003",
      contractId: "cnt-partner-001",
      versionNumber: 3,
      answers: {
        party1_name: "حسین کریمی",
        party2_name: "رضا نادری",
        capital_share_1: "۶۰",
        capital_share_2: "۴۰",
        business_purpose: "تأسیس و راه‌اندازی فروشگاه آنلاین",
      },
      content: `قرارداد مشارکت مدنی\n\nاین قرارداد بین آقای حسین کریمی (شریک اول) و آقای رضا نادری (شریک دوم) به شرح زیر منعقد می‌گردد.\n\nماده ۱ - موضوع مشارکت: تأسیس و راه‌اندازی فروشگاه آنلاین.\n\nماده ۲ - سهم الشرکه: شریک اول ۶۰ درصد و شریک دوم ۴۰ درصد.\n\nماده ۳ - تقسیم سود و زیان: به نسبت سهم‌الشرکه.`,
      clauses: [
        { id: "cl-p-001", title: "ماده ۱ - موضوع مشارکت", content: "تأسیس و راه‌اندازی فروشگاه آنلاین...", isProtective: false, importance: "essential" },
        { id: "cl-p-002", title: "ماده ۲ - سهم‌الشرکه", content: "شریک اول ۶۰ درصد و شریک دوم ۴۰ درصد...", isProtective: true, importance: "essential" },
        { id: "cl-p-003", title: "ماده ۳ - تقسیم سود و زیان", content: "به نسبت سهم‌الشرکه...", isProtective: true, importance: "recommended" },
      ],
      state: "approved",
      createdAt: "2026-07-25T16:00:00Z",
    },
  ],
  analysis: null,
  attachments: fixtureV1ContractAttachmentsPartnership,
  createdAt: "2026-07-15T10:00:00Z",
  updatedAt: "2026-07-25T16:00:00Z",
  disclaimer: "این متن به صورت خودکار توسط هوش مصنوعی LEGALIR تولید شده و صرفاً یک پیش‌نویس است.",
};

export const fixtureV1ContractDetailSaas: V1ContractDetail = {
  id: "cnt-saas-001",
  userId: "u-pro-001",
  title: "قرارداد اشتراک نرم‌افزار",
  type: "saas",
  typeFa: "SaaS",
  category: "business",
  state: "draft",
  currentVersionId: null,
  currentVersionNumber: 0,
  versions: [],
  analysis: null,
  attachments: fixtureV1ContractAttachmentsSaas,
  createdAt: "2026-07-31T10:00:00Z",
  updatedAt: "2026-07-31T10:00:00Z",
  disclaimer: "این متن به صورت خودکار توسط هوش مصنوعی LEGALIR تولید شده و صرفاً یک پیش‌نویس است.",
};

export const fixtureV1ContractDetailContracting: V1ContractDetail = {
  id: "cnt-archived-001",
  userId: "u-pro-001",
  title: "قرارداد قدیمی پیمانکاری",
  type: "contracting",
  typeFa: "پیمانکاری",
  category: "business",
  state: "archived",
  currentVersionId: "ver-ctr-001",
  currentVersionNumber: 1,
  versions: [
    {
      id: "ver-ctr-001",
      contractId: "cnt-archived-001",
      versionNumber: 1,
      answers: {
        employer: "سازمان توسعه شهری",
        contractor: "شرکت عمران پارس",
        project_name: "احداث ساختمان اداری",
        contract_amount: "۲۵۰۰۰۰۰۰۰۰۰",
        duration_months: "۱۸",
      },
      content: `قرارداد پیمانکاری\n\nاین قرارداد بین سازمان توسعه شهری (کارفرما) و شرکت عمران پارس (پیمانکار) منعقد می‌گردد.\n\nماده ۱ - موضوع پیمان: احداث ساختمان اداری.\n\nماده ۲ - مبلغ پیمان: ۲۵,۰۰۰,۰۰۰,۰۰۰ ریال.\n\nماده ۳ - مدت اجرا: ۱۸ ماه شمسی.`,
      clauses: [
        { id: "cl-c-001", title: "ماده ۱ - موضوع پیمان", content: "احداث ساختمان اداری...", isProtective: false, importance: "essential" },
        { id: "cl-c-002", title: "ماده ۲ - مبلغ پیمان", content: "۲۵,۰۰۰,۰۰۰,۰۰۰ ریال...", isProtective: true, importance: "essential" },
        { id: "cl-c-003", title: "ماده ۳ - مدت اجرا", content: "۱۸ ماه شمسی...", isProtective: false, importance: "essential" },
      ],
      state: "archived",
      createdAt: "2026-06-01T10:00:00Z",
    },
  ],
  analysis: null,
  attachments: fixtureV1ContractAttachmentsContracting,
  createdAt: "2026-06-01T10:00:00Z",
  updatedAt: "2026-07-01T10:00:00Z",
  disclaimer: "این متن به صورت خودکار توسط هوش مصنوعی LEGALIR تولید شده و صرفاً یک پیش‌نویس است.",
};

// Contract Draft Fixture

export const fixtureV1ContractDraft: V1ContractDraft = {
  id: "draft-emp-001",
  contractId: "cnt-emp-001",
  typeId: "employment",
  currentStep: 2,
  answers: {
    employer_name: "شرکت فناوری نوین ایرانیان",
    employer_id: "۱۰۲۰۳۰۴۰۵۰",
    employee_name: "سارا رضایی",
    employee_id: "۱۲۳۴۵۶۷۸۹۰",
    position: "مدیر فنی",
    salary: "۲۵۰۰۰۰۰۰۰",
  },
  savedAt: "2026-07-31T08:30:00Z",
  createdAt: "2026-07-31T08:00:00Z",
  updatedAt: "2026-07-31T08:30:00Z",
};

// Generate Response Fixture

export const fixtureV1GenerateResponse: V1ContractGenerateResponse = {
  id: "cnt-lease-001",
  state: "generated",
  currentVersionId: "ver-lease-002",
  versionNumber: 2,
  content: fixtureV1ContractVersion2.content,
  clauses: fixtureV1ContractVersion2.clauses,
};

// Question list fixtures

export const fixtureV1QuestionLists: Record<V1ContractType, V1ContractQuestion[]> = {
  lease: fixtureV1LeaseQuestions,
  nda: fixtureV1NdaQuestions,
  employment: fixtureV1EmploymentQuestions,
  sale_purchase: [],
  loan: [],
  partnership: [],
  saas: [],
  contracting: [],
  investment: [],
};

// --- Phase 14: Preloaded Demo Conversation — Contract Review ---

export const fixtureConversationContractReview: Conversation & { messages: Message[] } = {
  id: "conv-contract-review-001",
  userId: "u-pro-001",
  title: "بررسی قرارداد پیمانکاری ساختمان",
  category: "contract",
  status: "active",
  riskLevel: "medium",
  messageCount: 4,
  createdAt: "2026-08-05T09:00:00Z",
  updatedAt: "2026-08-05T09:45:00Z",
  messages: [
    {
      id: "msg-cr-001",
      conversationId: "conv-contract-review-001",
      role: "user",
      content:
        "سلام، من یک قرارداد پیمانکاری ساختمان دارم. پیمانکار حدود ۴۵ روز تأخیر داشته و من می‌خواهم بدانم آیا می‌توانم بابت این تأخیر خسارت مطالبه کنم؟ در قرارداد شرط شده که به ازای هر روز تأخیر، پیمانکار باید ۰٫۱٪ از مبلغ کل قرارداد را به عنوان جریمه پرداخت کند. آیا می‌توانم علاوه بر این مبلغ، خسارت تأخیر تأدیه هم بر اساس نرخ تورم از پیمانکار بخواهم؟",
      status: "sent",
      createdAt: "2026-08-05T09:00:00Z",
    },
    {
      id: "msg-cr-002",
      conversationId: "conv-contract-review-001",
      role: "assistant",
      content:
        "بررسی قرارداد پیمانکاری ساختمان — تحلیل شروط جریمه تأخیر و امکان مطالبه همزمان خسارت قراردادی و قانونی",
      status: "completed",
      createdAt: "2026-08-05T09:00:30Z",
    },
  ],
};

export const fixtureContractReviewSections: StructuredResponseSection[] = [
  {
    id: "cr-sec-summary",
    title: "خلاصه",
    content:
      "با توجه به ماده ۲۳۰ قانون مدنی، شرط جریمه تأخیر در قرارداد پیمانکاری معتبر است و شما می‌توانید بابت ۴۵ روز تأخیر، معادل ۴٫۵٪ از مبلغ کل قرارداد را به عنوان وجه التزام قراردادی مطالبه کنید. اما بر اساس رأی وحدت رویه شماره ۸۰۵ هیأت عمومی دیوان عالی کشور، امکان مطالبه همزمان وجه التزام قراردادی (ماده ۲۳۰ ق.م) و خسارت تأخیر تأدیه قانونی (ماده ۵۲۲ ق.آ.د.م) وجود ندارد — مگر آنکه ثابت شود شرط قراردادی صرفاً جنبه تأمینی داشته و برای جبران کامل خسارت کافی نیست.",
    order: 1,
  },
  {
    id: "cr-sec-facts",
    title: "اطلاعات و فرض‌ها",
    content:
      "اطلاعات ارائه‌شده:\n- قرارداد پیمانکاری ساختمان منعقد شده است\n- پیمانکار ۴۵ روز تأخیر در انجام تعهدات داشته است\n- شرط جریمه روزانه ۰٫۱٪ از مبلغ کل در قرارداد درج شده است\n- مبلغ قرارداد و تاریخ شروع/پایان مشخص است\n\nفرض‌ها:\n- قرارداد از نظر شکلی و ماهوی معتبر و لازم‌الاجراست\n- تأخیر ناشی از قوه قاهره (فورس ماژور) نبوده است\n- شرط جریمه به صورت صریح و بدون ابهام در قرارداد ذکر شده است\n- پیمانکار از تأخیر مطلع شده و اخطار کتبی دریافت کرده است",
    order: 2,
  },
  {
    id: "cr-sec-analysis",
    title: "تحلیل اولیه",
    content:
      "۱. اعتبار شرط جریمه (وجه التزام) — ماده ۲۳۰ قانون مدنی:\n" +
      "مطابق ماده ۲۳۰ قانون مدنی، شرط پرداخت مبلغ معین در صورت تخلف از تعهد (وجه التزام) معتبر است و دادگاه نمی‌تواند میزان آن را تغییر دهد. شرط ۰٫۱٪ روزانه در قرارداد شما مصداق همین ماده است و قابل مطالبه می‌باشد.\n\n" +
      "۲. امکان مطالبه خسارت تأخیر تأدیه — ماده ۵۲۲ قانون آیین دادرسی مدنی:\n" +
      'ماده ۵۲۲ ق.آ.د.م مقرر می‌دارد که در دعاوی راجع به "دِین" از نوع وجه رایج، خسارت تأخیر تأدیه بر اساس شاخص تورم قابل مطالبه است. نکته کلیدی این است که وجه التزام قراردادی (موضوع ماده ۲۳۰ ق.م) از جنس "دِین" نیست، بلکه یک شرط ضمن عقد است.\n\n' +
      "۳. رأی وحدت رویه شماره ۸۰۵ هیأت عمومی دیوان عالی کشور (مورخ ۱۴۰۰/۰۴/۰۱):\n" +
      "این رأی وحدت رویه تصریح می‌کند که در مواردی که طرفین در قرارداد شرط وجه التزام (جریمه تخلف) پیش‌بینی کرده‌اند، این شرط جایگزین خسارت تأخیر تأدیه موضوع ماده ۵۲۲ می‌شود و امکان مطالبه همزمان هر دو وجود ندارد — مگر اینکه شرط قراردادی کفایت نکند و این عدم کفایت در دادگاه اثبات شود.",
    order: 3,
  },
  {
    id: "cr-sec-risks",
    title: "ریسک‌ها",
    content:
      "۱. **ریسک بالا — عدم امکان تجمیع خسارات**: اگر صرفاً به استناد قرارداد اقدام کنید، دادگاه حق مطالبه خسارت تأخیر تأدیه (تورم) را به دلیل وجود شرط وجه التزام از شما سلب خواهد کرد.\n\n" +
      "۲. **ریسک متوسط — کافی نبودن مبلغ جریمه قراردادی**: ۴٫۵٪ مبلغ قرارداد ممکن است با توجه به نرخ تورم واقعی (که معمولاً بالای ۳۰٪ سالانه است) ناکافی باشد. باید آمادگی اثبات این عدم کفایت را در دادگاه داشته باشید.\n\n" +
      "۳. **ریسک متوسط — مرور زمان**: دعاوی مرتبط با قراردادهای پیمانکاری مشمول مرور زمان ۱۰ ساله هستند. هر چه زودتر اقدام کنید.\n\n" +
      "۴. **ریسک پایین — دفاع فورس ماژور توسط پیمانکار**: پیمانکار ممکن است به تحریم‌ها، کمبود مصالح، یا شرایط جوی استناد کند.",
    order: 4,
  },
  {
    id: "cr-sec-actions",
    title: "اقدامات پیشنهادی",
    content:
      "۱. **ارسال اظهارنامه رسمی**: بلافاصله اظهارنامه‌ای به پیمانکار ارسال و مراتب تأخیر، مبلغ جریمه قراردادی (۴٫۵٪) و مهلت پرداخت را اعلام کنید.\n\n" +
      "۲. **مستندسازی تأخیر**: گزارش‌های روزانه کارگاه، صورت‌جلسات، مکاتبات انجام‌شده و اخطارهای قبلی را جمع‌آوری و بایگانی کنید.\n\n" +
      "۳. **محاسبه خسارت واقعی**: با کمک کارشناس رسمی دادگستری، خسارت واقعی ناشی از تأخیر (شامل تورم، هزینه‌های تحمیل‌شده، و عدم بهره‌برداری) را محاسبه و مستند کنید.\n\n" +
      "۴. **طرح دعوا در دادگاه**: ابتدا دعوای مطالبه وجه التزام قراردادی (ماده ۲۳۰) را مطرح کنید. اگر مبلغ جریمه کفایت نمی‌کند، همزمان دادخواست مطالبه خسارت اضافی بر اساس رأی وحدت رویه ۸۰۵ را با ارائه مستندات کارشناسی تقدیم دهید.\n\n" +
      "۵. **مشاوره با وکیل متخصص**: با توجه به پیچیدگی موضوع و رأی وحدت رویه ۸۰۵، حتماً با وکیل متخصص دعاوی پیمانکاری مشورت کنید.",
    order: 5,
  },
  {
    id: "cr-sec-sources",
    title: "منابع",
    content: "تحلیل فوق بر اساس منابع حقوقی معتبر زیر انجام شده است. این منابع شامل قوانین موضوعه، آرای وحدت رویه دیوان عالی کشور، و دکترین حقوقی می‌باشد.",
    order: 6,
  },
  {
    id: "cr-sec-disclaimer",
    title: "هشدار حقوقی",
    content:
      "این تحلیل توسط سامانه هوشمند LEGALIR و بر اساس منابع معتبر حقوقی ایران انجام شده است. با این حال، هر پرونده ویژگی‌های منحصر به فرد خود را دارد و نتیجه نهایی به شرایط خاص قرارداد، ادله طرفین، و تشخیص قاضی رسیدگی‌کننده بستگی دارد. توصیه می‌شود پیش از هر اقدام حقوقی با یک وکیل متخصص مشورت کنید.",
    order: 7,
  },
];

export const fixtureContractReviewReferences: V1Reference[] = [
  {
    id: "ref-cr-001",
    conversationId: "conv-contract-review-001",
    messageId: "msg-cr-002",
    sourceId: "src-law-civil-230",
    locator: "ماده ۲۳۰",
    quote: "اگر در ضمن معامله شرط شده باشد که در صورت تخلف، متخلف مبلغی به عنوان خسارت بدهد، حاکم نمی‌تواند او را به بیشتر یا کمتر از آنچه که ملزم شده است محکوم نماید",
    section: "cr-sec-analysis",
    sourceType: "law",
    sourceTypeFa: "قانون",
  },
  {
    id: "ref-cr-002",
    conversationId: "conv-contract-review-001",
    messageId: "msg-cr-002",
    sourceId: "src-law-procedure-522",
    locator: "ماده ۵۲۲",
    quote: "در دعاویی که موضوع آن دِین و از نوع وجه رایج بوده و با مطالبه داین و تمکن مدیون، مدیون امتناع از پرداخت نموده، دادگاه می‌تواند علاوه بر محکومیت به پرداخت اصل دین، به پرداخت خسارت تأخیر تأدیه بر اساس شاخص رسمی تورم نیز حکم دهد",
    section: "cr-sec-analysis",
    sourceType: "law",
    sourceTypeFa: "قانون",
  },
  {
    id: "ref-cr-003",
    conversationId: "conv-contract-review-001",
    messageId: "msg-cr-002",
    sourceId: "src-unity-decision-805",
    locator: "رأی وحدت رویه ۸۰۵",
    quote: "در مواردی که طرفین در قرارداد شرط وجه التزام پیش‌بینی کرده‌اند، این شرط جایگزین خسارت تأخیر تأدیه موضوع ماده ۵۲۲ می‌شود و امکان مطالبه همزمان هر دو وجود ندارد، مگر آنکه ثابت شود شرط قراردادی صرفاً جنبه تأمینی داشته و برای جبران کامل خسارت کافی نیست",
    section: "cr-sec-analysis",
    sourceType: "precedent",
    sourceTypeFa: "رأی یا رویه قضایی",
  },
  {
    id: "ref-cr-004",
    conversationId: "conv-contract-review-001",
    messageId: "msg-cr-002",
    sourceId: "src-unity-decision-805",
    locator: "رأی وحدت رویه ۸۰۵ — تبصره",
    quote: "تشخیص کفایت یا عدم کفایت وجه التزام قراردادی برای جبران خسارت، امری ماهوی و در صلاحیت دادگاه رسیدگی‌کننده است که با جلب نظر کارشناس رسمی صورت می‌گیرد",
    section: "cr-sec-actions",
    sourceType: "precedent",
    sourceTypeFa: "رأی یا رویه قضایی",
  },
];

export const fixtureContractReviewStructuredMessage: V1StructuredMessage = {
  id: "msg-cr-002",
  conversationId: "conv-contract-review-001",
  role: "assistant",
  content:
    "بررسی قرارداد پیمانکاری ساختمان — تحلیل شروط جریمه تأخیر و امکان مطالبه همزمان خسارت قراردادی و قانونی",
  status: "completed",
  createdAt: "2026-08-05T09:00:30Z",
  sections: fixtureContractReviewSections,
  riskLevel: "medium",
  references: fixtureContractReviewReferences,
};

export const fixtureV1ConversationDetailContractReview: V1ConversationDetail = {
  ...fixtureConversationContractReview,
  messages: [
    ...fixtureConversationContractReview.messages,
    fixtureContractReviewStructuredMessage,
  ],
  aiRuns: [
    createAiRunFixture("conv-contract-review-001", "msg-cr-002", "succeeded"),
  ],
  references: fixtureContractReviewReferences,
};

export const fixtureV1SourceCivil230: V1SourceDetail = {
  id: "src-law-civil-230",
  sourceType: "law",
  sourceTypeFa: "قانون",
  title: "قانون مدنی جمهوری اسلامی ایران",
  articleSection: "ماده ۲۳۰",
  publicationAuthority: "مجلس شورای اسلامی",
  jurisdiction: "ایران",
  effectiveDate: "۱۳۰۷-۰۲-۱۸",
  versionDate: "۱۳۹۵-۰۷-۱۴",
  excerpt:
    "ماده ۲۳۰: اگر در ضمن معامله شرط شده باشد که در صورت تخلف، متخلف مبلغی به عنوان خسارت بدهد، حاکم نمی‌تواند او را به بیشتر یا کمتر از آنچه که ملزم شده است محکوم نماید. این شرط که «وجه التزام» یا «شرط کیفری» نامیده می‌شود، جنبه جبران خسارت دارد و با تحقق تخلف، قابل مطالبه است.",
  url: "https://rc.majlis.ir/fa/law/show/92538",
  documentIdentifier: "ق.م. مصوب ۱۳۰۷",
  status: "valid",
  availability: "available",
};

export const fixtureV1SourceProcedure522: V1SourceDetail = {
  id: "src-law-procedure-522",
  sourceType: "law",
  sourceTypeFa: "قانون",
  title: "قانون آیین دادرسی دادگاه‌های عمومی و انقلاب در امور مدنی مصوب ۱۳۷۹",
  articleSection: "ماده ۵۲۲",
  publicationAuthority: "مجلس شورای اسلامی",
  jurisdiction: "ایران",
  effectiveDate: "۱۳۷۹-۰۷-۰۱",
  versionDate: null,
  excerpt:
    "ماده ۵۲۲: در دعاویی که موضوع آن دِین و از نوع وجه رایج بوده و با مطالبه داین و تمکن مدیون، مدیون امتناع از پرداخت نموده، دادگاه می‌تواند علاوه بر محکومیت به پرداخت اصل دین، به پرداخت خسارت تأخیر تأدیه بر اساس شاخص رسمی تورم که توسط بانک مرکزی جمهوری اسلامی ایران اعلام می‌شود، از تاریخ سررسید تا زمان پرداخت حکم دهد. مبلغ خسارت بر اساس متوسط شاخص تورم در دوره تأخیر محاسبه می‌گردد.",
  url: "https://rc.majlis.ir/fa/law/show/93235",
  documentIdentifier: "ق.آ.د.م مصوب ۱۳۷۹",
  status: "valid",
  availability: "available",
};

export const fixtureV1SourceUnity805: V1SourceDetail = {
  id: "src-unity-decision-805",
  sourceType: "precedent",
  sourceTypeFa: "رأی یا رویه قضایی",
  title: "رأی وحدت رویه شماره ۸۰۵ — هیأت عمومی دیوان عالی کشور",
  articleSection: "رأی شماره ۸۰۵ مورخ ۱۴۰۰/۰۴/۰۱",
  publicationAuthority: "هیأت عمومی دیوان عالی کشور",
  jurisdiction: "ایران",
  effectiveDate: "۱۴۰۰-۰۴-۰۱",
  versionDate: null,
  excerpt:
    "رأی وحدت رویه شماره ۸۰۵ مورخ ۱۴۰۰/۰۴/۰۱: با عنایت به اینکه شرط وجه التزام (موضوع ماده ۲۳۰ قانون مدنی) به منظور جبران خسارت ناشی از عدم انجام یا تأخیر در انجام تعهد پیش‌بینی می‌شود، در مواردی که طرفین در قرارداد چنین شرطی را درج کرده‌اند، این شرط جایگزین مقررات ماده ۵۲۲ قانون آیین دادرسی دادگاه‌های عمومی و انقلاب در امور مدنی می‌گردد و ذی‌نفع نمی‌تواند علاوه بر وجه التزام، خسارت تأخیر تأدیه نیز مطالبه نماید. با این وصف، چنانچه ثابت شود که مبلغ وجه التزام قراردادی صرفاً جنبه تأمینی داشته و برای جبران کامل خسارت وارده کافی نیست، دادگاه می‌تواند با احراز این امر و با جلب نظر کارشناس رسمی، نسبت به جبران مابقی خسارت وارده نیز رأی مقتضی صادر نماید.",
  url: "https://divanealee.eadl.ir/UnityDecisions/805",
  documentIdentifier: "ر.و.ر ۸۰۵ — ۱۴۰۰/۰۴/۰۱",
  status: "valid",
  availability: "available",
};

// --- Scenario Map ---

export const fixtures = {
  "user-new": { user: fixtureUserNew, profile: fixtureProfileIncomplete, subscription: null },
  "user-silver": { user: fixtureUserBasic, subscription: fixtureSubscriptionSilver, planCode: "silver" as const },
  "user-gold": { user: fixtureUserPro, profile: fixtureProfileComplete, subscription: fixtureSubscriptionGold, planCode: "gold" as const },
  "user-diamond": { user: fixtureUserPremium, planCode: "diamond" as const },
  "conversation-rent": fixtureConversationRent,
  "conversation-detail": fixtureV1ConversationDetail,
  "document-lease": { document: fixtureDocumentLease, report: fixtureRiskReport },
  "document-detail": { detail: fixtureDocumentDetail, items: fixtureDocumentListItems },
  "document-list": fixtureDocumentListResponse,
  "contract-nda": fixtureContractNda,
  "sources-civil-490": fixtureV1SourceCivil490,
  "sources-mojer": fixtureV1SourceMojer,
  "structured-message": fixtureV1StructuredMessage,
  "conversations-all": fixtureAllConversations,
  // Phase 10 contract fixtures
  "contract-types": fixtureV1ContractTypes,
  "contract-list": fixtureV1ContractListResponse,
  "contract-detail": fixtureV1ContractDetail,
  "contract-draft": fixtureV1ContractDraft,
  "contract-risk-analysis": fixtureV1ContractRiskAnalysis,
  "contract-generate": fixtureV1GenerateResponse,
  "contract-lease-questions": fixtureV1LeaseQuestions,
  "contract-nda-questions": fixtureV1NdaQuestions,
  "contract-employment-questions": fixtureV1EmploymentQuestions,
  // Phase 11
  "history-items": fixtureV1HistoryItems,
  "memory-items-v1": fixtureV1MemoryItems,
  "subscription-history": fixtureV1SubscriptionHistory,
  "profile-usage": fixtureProfileUsage,
  // Phase 14: Preloaded demo conversation
  "conversation-contract-review": fixtureConversationContractReview,
  "conversation-contract-review-detail": fixtureV1ConversationDetailContractReview,
  "contract-review-sections": fixtureContractReviewSections,
  "contract-review-references": fixtureContractReviewReferences,
  "contract-review-structured-message": fixtureContractReviewStructuredMessage,
  "source-civil-230": fixtureV1SourceCivil230,
  "source-procedure-522": fixtureV1SourceProcedure522,
  "source-unity-805": fixtureV1SourceUnity805,
} as const;

export type FixtureName = keyof typeof fixtures;

export function loadFixture<T extends FixtureName>(name: T): (typeof fixtures)[T] {
  return fixtures[name];
}

// ============================================================
// Legal Library Fixtures
// ============================================================
export {
  fixtureLegalTopics,
  fixtureLegalSources,
  fixtureLegalSourceRelations,
  fixtureBlogPosts,
  fixtureBlogCategories,
  fixtureLegalLibraryListItems,
  fixtureLegalLibraryTopics,
  fixtureLegalSourceDetails,
  fixtureBlogListItems,
  fixtureBlogPostDetails,
} from "./legal-library-fixtures";
