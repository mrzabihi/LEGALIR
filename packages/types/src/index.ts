// ============================================================
// LEGALIR — Shared Domain Types
// ============================================================

// --- API Envelope ---

export interface ApiSuccess<T> {
  data: T;
  meta?: {
    requestId: string;
    pagination?: Pagination;
  };
}

export interface ApiError {
  code: string;
  message: string;
  fieldErrors?: FieldError[];
  correlationId: string;
  retryable: boolean;
  nextAction?: string;
}

export interface FieldError {
  path: string;
  reason: string;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// --- Auth ---

export interface OtpChallenge {
  challengeId: string;
  expiresAt: string;
  remainingAttempts: number;
  resendCooldownSeconds: number;
}

export interface OtpResult {
  sessionId: string;
  user: UserSummary;
  isNewUser: boolean;
}

export interface UserSummary {
  id: string;
  mobileE164: string;
  mobileDisplay: string;
  status: AccountStatus;
}

export type AccountStatus = "pending" | "active" | "restricted" | "suspended" | "closed";

// --- Profile ---

export interface Profile {
  userId: string;
  displayName: string | null;
  email: string | null;
  gender: "male" | "female" | "other" | null;
  birthDate: string | null;
  city: string | null;
  occupation: string | null;
  completionPercent: number;
  avatarUrl: string | null;
  // Extended profile ("پروفایل حقوقی من")
  userType: string | null;
  province: string | null;
  legalInterests: string[] | null;
  primaryUseCase: string | null;
}

export interface UserPreference {
  theme: "light" | "dark";
  locale: "fa-IR" | "en";
  notifications: NotificationFlags;
}

export interface NotificationFlags {
  appointments: boolean;
  contractExpiry: boolean;
  lawyerResponse: boolean;
  paymentStatus: boolean;
  caseUpdate: boolean;
  marketing: boolean;
}

// --- Subscription ---

export interface Plan {
  id: string;
  code: PlanCode;
  nameFa: string;
  descriptionFa: string;
  durationDays: number;
  listPrice: number;
  salePrice: number;
  currency: string;
  features: string[];
  dailyRequestLimit: number;
  totalTokenLimit: number;
  usageLimits: PlanUsageLimit[];
}

export interface PlanUsageLimit {
  featureKey: string;
  nameFa: string;
  period: "day" | "month" | "year" | "forever";
  limit: number;
}

export type PlanCode = "silver" | "gold" | "diamond";

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  planCode: PlanCode;
  startAt: string;
  endAt: string;
  status: SubscriptionStatus;
}

export type SubscriptionStatus = "pending" | "active" | "expired" | "cancelled";

export interface Entitlement {
  featureKey: string;
  nameFa: string;
  limit: number | null;
  period: "day" | "week" | "month" | "year" | "forever";
  used: number;
  isBoolean: boolean;
  isEnabled: boolean;
}

export interface UsageCounter {
  featureKey: string;
  periodStart: string;
  periodEnd: string;
  used: number;
  limit: number | null;
}

// --- Dashboard ---

export interface DashboardSummary {
  user: UserSummary;
  profile: Profile;
  subscription: Subscription | null;
  entitlements: Entitlement[];
  recentActivity: RecentActivityItem[];
  savedSourcesCount: number;
  activeProcessingCount: number;
  dailyTrialsUsed: number;
  dailyTrialsTotal: number;
  activeRequests: ActiveRequestItem[];
  recommendations: DashboardRecommendation[];
  recentDocuments: RecentDocumentItem[];
}

export interface RecentActivityItem {
  id: string;
  type: "conversation" | "document" | "contract";
  title: string;
  status: string;
  updatedAt: string;
}

// --- Conversation ---

export interface Conversation {
  id: string;
  userId: string;
  title: string;
  category: LegalCategory | null;
  status: ConversationStatus;
  riskLevel: RiskLevel | null;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export type ConversationStatus = "draft" | "active" | "completed" | "archived" | "failed";
export type LegalCategory =
  | "family"
  | "contract"
  | "real_estate"
  | "labor"
  | "commerce"
  | "criminal"
  | "tax"
  | "companies"
  | "checks"
  | "immigration"
  | "cyber"
  | "other";

export interface Message {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  status: MessageStatus;
  createdAt: string;
}

export type MessageStatus = "draft" | "sending" | "sent" | "streaming" | "validating" | "completed" | "blocked" | "failed";

export interface AiRun {
  id: string;
  conversationId: string;
  messageId: string;
  modelRef: string;
  promptVersion: string;
  status: AiRunStatus;
  startedAt: string;
  completedAt: string | null;
}

export type AiRunStatus = "queued" | "retrieving" | "generating" | "validating" | "succeeded" | "blocked" | "failed";

// --- AI Response ---

export interface AiStructuredResponse {
  summary: string;
  relevantFacts: string[];
  legalAnalysis: string;
  riskLevel: RiskLevel;
  possibleActions: string[];
  citations: Citation[];
  disclaimer: string;
  nextStep: string | null;
}

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface Citation {
  id: string;
  sourceId: string;
  locator: string;
  quote: string;
  source: LegalSource;
}

export interface LegalSource {
  id: string;
  type: SourceType;
  title: string;
  authority: string;
  validFrom: string;
  validTo: string | null;
  status: SourceStatus;
  jurisdiction: string;
  retrievedAt: string;
}

export type SourceType = "law" | "regulation" | "precedent" | "directive" | "opinion" | "user_document";
export type SourceStatus = "valid" | "amended" | "expired" | "needs_review";

// --- Document ---

export interface Document {
  id: string;
  userId: string;
  name: string;
  mime: string;
  sizeBytes: number;
  status: DocumentStatus;
  storageKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DocumentStatus =
  | "uploaded"
  | "processing"
  | "extracting"
  | "analyzing"
  | "ready"
  | "failed"
  | "blocked"
  | "cancelled";

export interface DocumentJob {
  id: string;
  documentId: string;
  stage: DocumentStatus;
  status: JobStatus;
  progress: number;
  errorCode: string | null;
}

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface DocumentFinding {
  id: string;
  documentId: string;
  title: string;
  severity: RiskLevel;
  locator: string;
  reason: string;
  recommendation: string;
  citation: Citation | null;
  confidence: number;
}

export interface RiskReport {
  documentId: string;
  summary: string;
  findings: DocumentFinding[];
  generatedAt: string;
  confidence: number;
}

// --- Phase 9: Document Upload & Analysis Contracts ---

export interface V1DocumentUploadRequest {
  name: string;
  mime: string;
  sizeBytes: number;
}

export interface V1DocumentUploadResponse {
  id: string;
  uploadUrl: string;
  expiresAt: string;
}

export interface V1DocumentListItem {
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
  status: DocumentStatus;
  createdAt: string;
  updatedAt: string;
  riskLevel: RiskLevel | null;
  findingCount: number;
}

export interface V1DocumentDetail {
  id: string;
  userId: string;
  name: string;
  mime: string;
  sizeBytes: number;
  status: DocumentStatus;
  storageKey: string | null;
  createdAt: string;
  updatedAt: string;
  jobs: DocumentJob[];
  report: RiskReport | null;
  extractedText: string | null;
  previewUrl: string | null;
}

export interface V1DocumentStatusResponse {
  id: string;
  status: DocumentStatus;
  progress: number;
  currentStage: string | null;
  errorCode: string | null;
}

export interface V1DocumentAnalysisResponse {
  report: RiskReport;
  extractedText: string | null;
}

export interface V1DocumentRetryResponse {
  id: string;
  status: DocumentStatus;
}

export interface V1DocumentDeleteResponse {
  deleted: true;
}

export type V1DocumentFilter = "all" | "ready" | "processing" | "failed";

export interface V1DocumentListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: V1DocumentFilter;
  sort?: "newest" | "oldest" | "name";
}

export interface V1DocumentListResponse {
  items: V1DocumentListItem[];
  pagination: Pagination;
}

export const SUPPORTED_DOCUMENT_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

export type SupportedDocumentMime = (typeof SUPPORTED_DOCUMENT_MIMES)[number];

export const MAX_DOCUMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

// --- Contract (Phase 10) ---

// Legacy types (kept for backward compatibility with existing fixtureContractNda)
export interface Contract {
  id: string;
  userId: string;
  type: ContractType;
  status: ContractStatus;
  currentVersionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ContractType = "lease" | "nda" | "employment" | "contracting" | "partnership";
export type ContractStatus =
  | "draft"
  | "collecting"
  | "generating"
  | "generated"
  | "reviewing"
  | "exported"
  | "archived";

export interface ContractVersion {
  id: string;
  contractId: string;
  versionNumber: number;
  answers: Record<string, string>;
  content: string | null;
  createdAt: string;
}

// --- Phase 10: Contract Workspace Types ---

export type V1ContractCategory = "personal" | "business";

export type V1PersonalContractType = "lease" | "sale_purchase" | "loan" | "partnership";
export type V1BusinessContractType = "nda" | "employment" | "saas" | "contracting" | "investment";
export type V1ContractType = V1PersonalContractType | V1BusinessContractType;

export interface V1ContractTypeInfo {
  id: V1ContractType;
  nameFa: string;
  descriptionFa: string;
  category: V1ContractCategory;
  icon: string;
  questionCount: number;
}

export interface V1ContractQuestion {
  id: string;
  typeId: V1ContractType;
  step: number;
  fieldKey: string;
  labelFa: string;
  hintFa?: string;
  inputType: "text" | "textarea" | "select" | "date" | "number" | "radio";
  required: boolean;
  options?: { value: string; labelFa: string }[];
  placeholderFa?: string;
}

export type V1ContractState =
  | "draft"
  | "collecting"
  | "generated"
  | "under_review"
  | "approved"
  | "exported"
  | "archived";

export const V1_CONTRACT_STATE_LABELS: Record<V1ContractState, string> = {
  draft: "پیش‌نویس",
  collecting: "در حال تکمیل",
  generated: "تولید شده",
  under_review: "در حال بررسی",
  approved: "تأیید شده",
  exported: "خروجی گرفته شده",
  archived: "بایگانی",
};

export const V1_CONTRACT_STATE_TRANSITIONS: Record<V1ContractState, V1ContractState[]> = {
  draft: ["collecting", "archived"],
  collecting: ["generated", "draft", "archived"],
  generated: ["under_review", "collecting", "archived"],
  under_review: ["approved", "generated", "archived"],
  approved: ["exported", "archived"],
  exported: ["archived"],
  archived: [],
};

export interface V1ContractListItem {
  id: string;
  title: string;
  type: V1ContractType;
  typeFa: string;
  category: V1ContractCategory;
  state: V1ContractState;
  currentVersionNumber: number;
  createdAt: string;
  updatedAt: string;
  hasDraft: boolean;
}

export interface V1ContractDraft {
  id: string;
  contractId: string | null;
  typeId: V1ContractType;
  currentStep: number;
  answers: Record<string, string>;
  savedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface V1ContractClause {
  id: string;
  title: string;
  content: string;
  isProtective: boolean;
  importance: "essential" | "recommended" | "optional";
}

export interface V1RiskFinding {
  id: string;
  title: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  clauseRef: string | null;
  suggestion: string;
}

export interface V1ContractRiskAnalysis {
  contractId: string;
  overallRisk: "low" | "medium" | "high" | "critical";
  findings: V1RiskFinding[];
  protectiveSuggestions: V1ContractClause[];
  generatedAt: string;
}

export interface V1ContractVersionDetail {
  id: string;
  contractId: string;
  versionNumber: number;
  answers: Record<string, string>;
  content: string;
  clauses: V1ContractClause[];
  state: V1ContractState;
  createdAt: string;
}

export interface V1ContractDetail {
  id: string;
  userId: string;
  title: string;
  type: V1ContractType;
  typeFa: string;
  category: V1ContractCategory;
  state: V1ContractState;
  currentVersionId: string | null;
  currentVersionNumber: number;
  versions: V1ContractVersionDetail[];
  analysis: V1ContractRiskAnalysis | null;
  createdAt: string;
  updatedAt: string;
  disclaimer: string;
}

// API Request/Response types

export interface V1ContractListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  state?: V1ContractState;
  category?: V1ContractCategory;
  sort?: "newest" | "oldest" | "title";
}

export interface V1ContractListResponse {
  items: V1ContractListItem[];
  pagination: Pagination;
}

export interface V1ContractCreateRequest {
  typeId: V1ContractType;
  title: string;
}

export interface V1ContractCreateResponse {
  id: string;
  typeId: V1ContractType;
  title: string;
  state: V1ContractState;
  createdAt: string;
}

export interface V1ContractUpdateRequest {
  title?: string;
  answers?: Record<string, string>;
  state?: V1ContractState;
  currentStep?: number;
}

export interface V1ContractGenerateResponse {
  id: string;
  state: V1ContractState;
  currentVersionId: string;
  versionNumber: number;
  content: string;
  clauses: V1ContractClause[];
}

export interface V1ContractArchiveResponse {
  id: string;
  state: "archived";
}

export interface V1ContractTypeListResponse {
  personal: V1ContractTypeInfo[];
  business: V1ContractTypeInfo[];
}

export interface V1ContractQuestionListResponse {
  typeId: V1ContractType;
  questions: V1ContractQuestion[];
}

// --- History ---

export type HistoryCategory = "cases" | "contracts" | "real_estate" | "family" | "commerce" | "other";

export interface HistoryItem {
  id: string;
  type: "conversation" | "document" | "contract";
  title: string;
  category: HistoryCategory | null;
  status: string;
  updatedAt: string;
}

// --- Memory ---

export interface MemoryItem {
  id: string;
  userId: string;
  key: string;
  value: string;
  sensitivity: "normal" | "sensitive" | "highly_sensitive";
  status: "active" | "disabled" | "deleted";
  createdAt: string;
  updatedAt: string;
}

// --- Phase 11: History ---

export interface V1HistoryListParams {
  page?: number;
  pageSize?: number;
  category?: HistoryCategory | "all";
  search?: string;
  sort?: "newest" | "oldest" | "title";
  type?: "all" | "conversation" | "document" | "contract";
}

export interface V1HistoryItem {
  id: string;
  userId: string;
  type: "conversation" | "document" | "contract";
  title: string;
  category: HistoryCategory | null;
  categoryFa: string | null;
  status: string;
  statusFa: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

export interface V1HistoryListResponse {
  items: V1HistoryItem[];
  pagination: Pagination;
}

// --- Phase 11: Memory ---

export interface V1MemoryItem {
  id: string;
  userId: string;
  key: string;
  value: string;
  category: "profile" | "preference" | "legal_context";
  categoryFa: string;
  sensitivity: "normal" | "sensitive" | "highly_sensitive";
  sensitivityFa: string;
  status: "active" | "disabled" | "deleted";
  createdAt: string;
  updatedAt: string;
  consentGiven: boolean;
  consentDate: string | null;
}

export interface V1MemoryListResponse {
  items: V1MemoryItem[];
  memoryEnabled: boolean;
}

export interface V1MemoryUpdateRequest {
  key?: string;
  value?: string;
  status?: "active" | "disabled" | "deleted";
}

// --- Phase 11: Preferences ---

export interface V1UserPreferences {
  theme: "light" | "dark";
  locale: "fa-IR" | "en";
  notifications: NotificationFlags;
  privacy: V1PrivacySettings;
}

export interface V1PrivacySettings {
  shareUsageData: boolean;
  allowAiTraining: boolean;
  storeConversationHistory: boolean;
  autoMemoryConsent: boolean;
}

export interface V1PreferencesUpdateRequest {
  theme?: "light" | "dark";
  locale?: "fa-IR" | "en";
  notifications?: Partial<NotificationFlags>;
  privacy?: Partial<V1PrivacySettings>;
}

// --- Phase 11: Subscription History ---

export interface V1SubscriptionHistoryItem {
  id: string;
  planNameFa: string;
  planCode: PlanCode;
  amount: number;
  currency: string;
  startAt: string;
  endAt: string;
  status: "active" | "expired" | "cancelled" | "unknown";
  statusFa: string;
  purchasedAt: string;
}

export interface V1SubscriptionHistoryResponse {
  items: V1SubscriptionHistoryItem[];
  pagination: Pagination;
}

// --- Phase 11: Profile Usage ---

export interface V1ProfileUsage {
  dailyRequestsUsed: number;
  dailyRequestsTotal: number;
  tokensUsed: number;
  tokensTotal: number;
  documentAnalysesUsed: number;
  documentAnalysesTotal: number;
  contractsGenerated: number;
  contractsTotal: number;
}

// --- Feature Flags ---

export interface FeatureFlags {
  useMockApi: boolean;
  documentAnalysis: boolean;
  contractWorkspace: boolean;
  memory: boolean;
  adminHistoryReview: boolean;
  englishLocale: boolean;
  legalirBlogEnabled: boolean;
  legalLibraryEnabled: boolean;
}

// ============================================================
// Legal Knowledge / Library Domain Types
// ============================================================

export type LegalContentType =
  | "LAW_ARTICLE"
  | "REGULATION"
  | "UNIFICATION_RULING"
  | "JUDICIAL_DECISION"
  | "LEGAL_GUIDE"
  | "HOW_TO"
  | "CHECKLIST"
  | "FAQ"
  | "LEGAL_TOOL"
  | "TEMPLATE_GUIDE"
  | "BLOG_ARTICLE"
  | "SOURCE";

export type VerificationStatus =
  | "VERIFIED_OFFICIAL"
  | "VERIFIED_SECONDARY"
  | "DEMO_VERIFIED"
  | "UNVERIFIED"
  | "OUTDATED"
  | "SUPERSEDED";

export type LegalReviewStatus =
  | "NOT_REVIEWED"
  | "REVIEW_REQUIRED"
  | "REVIEWED"
  | "VERIFIED_SOURCE_ONLY";

export interface LegalTopic {
  id: string;
  slug: string;
  titleFa: string;
  shortDescription: string;
  description: string;
  icon: string;
  coverAsset: string | null;
  category: LegalCategory;
  keywords: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedReadTime: number;
  featured: boolean;
  popular: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LegalSourceExtended {
  id: string;
  sourceType: LegalContentType;
  title: string;
  shortTitle: string | null;
  lawName: string | null;
  articleNumber: string | null;
  judgmentNumber: string | null;
  decisionNumber: string | null;
  authority: string;
  jurisdiction: string;
  publicationDate: string | null;
  effectiveDate: string | null;
  lastAmendmentDate: string | null;
  status: string;
  summary: string;
  body: string | null;
  simpleExplanation: string | null;
  practicalApplication: string | null;
  keyPoints: string[] | null;
  examples: string[] | null;
  sourceUrl: string | null;
  officialSourceUrl: string | null;
  sourceProvider: string | null;
  sourceDomain: string | null;
  verificationStatus: VerificationStatus;
  lastVerifiedAt: string | null;
  externalIdentifier: string | null;
  version: number;
  topicSlug: string | null;
  relatedSourceIds: string[];
  legalReviewStatus: LegalReviewStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LegalSourceRelation {
  id: string;
  sourceId: string;
  relatedSourceId: string;
  relationType: SourceRelationType;
  description: string | null;
  createdAt: string;
}

export type SourceRelationType =
  | "RELATED_TO"
  | "INTERPRETS"
  | "REFERENCES"
  | "SUPPLEMENTS"
  | "SUPERSEDES"
  | "APPLIES_TO";

export interface LegalBookmark {
  id: string;
  userId: string;
  sourceId: string;
  createdAt: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  titleFa: string;
  excerpt: string;
  body: string;
  coverImage: string | null;
  author: string;
  category: string;
  tags: string[];
  readingTime: number;
  publishedAt: string | null;
  updatedAt: string;
  status: BlogPostStatus;
  featured: boolean;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  relatedTopicSlugs: string[];
  relatedSourceIds: string[];
  relatedServiceSlugs: string[];
  legalReviewStatus: LegalReviewStatus;
  createdAt: string;
}

export type BlogPostStatus = "DRAFT" | "LEGAL_REVIEW" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";

export interface BlogCategory {
  id: string;
  slug: string;
  titleFa: string;
  description: string | null;
}

export interface V1LegalLibraryListParams {
  page?: number;
  pageSize?: number;
  search?: string;
  topic?: string;
  sourceType?: LegalContentType;
  sort?: "newest" | "oldest" | "title" | "popular";
}

export interface V1LegalLibraryListResponse {
  items: V1LegalLibraryListItem[];
  pagination: Pagination;
}

export interface V1LegalLibraryListItem {
  id: string;
  title: string;
  sourceType: LegalContentType;
  sourceTypeFa: string;
  topic: string | null;
  topicSlug: string | null;
  summary: string;
  authority: string;
  verificationStatus: VerificationStatus;
  publishedDate: string | null;
  updatedAt: string;
  readingTime: number;
  popular: boolean;
  featured: boolean;
}

export interface V1LegalSourceDetail {
  id: string;
  sourceType: LegalContentType;
  sourceTypeFa: string;
  title: string;
  shortTitle: string | null;
  lawName: string | null;
  articleNumber: string | null;
  judgmentNumber: string | null;
  authority: string;
  jurisdiction: string;
  publicationDate: string | null;
  effectiveDate: string | null;
  lastAmendmentDate: string | null;
  status: string;
  summary: string;
  body: string | null;
  simpleExplanation: string | null;
  practicalApplication: string | null;
  keyPoints: string[] | null;
  examples: string[] | null;
  sourceUrl: string | null;
  officialSourceUrl: string | null;
  sourceProvider: string | null;
  sourceDomain: string | null;
  verificationStatus: VerificationStatus;
  lastVerifiedAt: string | null;
  version: number;
  relatedSources: V1RelatedSource[];
  relatedGuides: V1LegalLibraryListItem[];
  relatedServices: V1RelatedService[];
  legalReviewStatus: LegalReviewStatus;
  isBookmarked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface V1RelatedSource {
  id: string;
  title: string;
  sourceType: LegalContentType;
  sourceTypeFa: string;
  relationType: SourceRelationType;
  relationTypeFa: string;
  summary: string;
}

export interface V1RelatedService {
  id: string;
  title: string;
  description: string;
  href: string;
  cta: string;
}

export interface V1LegalLibraryTopic {
  slug: string;
  titleFa: string;
  shortDescription: string;
  icon: string;
  category: LegalCategory;
  keywords: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  estimatedReadTime: number;
  contentCount: number;
  popular: boolean;
}

export interface V1LegalSearchParams {
  q: string;
  topic?: string;
  sourceType?: LegalContentType;
  page?: number;
  pageSize?: number;
}

export interface V1LegalSearchResponse {
  items: V1LegalLibraryListItem[];
  pagination: Pagination;
  query: string;
  normalizedQuery: string;
}

export interface V1LegalBookmarksResponse {
  items: V1LegalLibraryListItem[];
  pagination: Pagination;
}

export interface V1BlogListParams {
  page?: number;
  pageSize?: number;
  category?: string;
  tag?: string;
  sort?: "newest" | "oldest" | "popular";
}

export interface V1BlogListResponse {
  items: V1BlogListItem[];
  pagination: Pagination;
}

export interface V1BlogListItem {
  id: string;
  slug: string;
  titleFa: string;
  excerpt: string;
  coverImage: string | null;
  author: string;
  category: string;
  tags: string[];
  readingTime: number;
  publishedAt: string;
  featured: boolean;
}

export interface V1BlogPostDetail {
  id: string;
  slug: string;
  titleFa: string;
  excerpt: string;
  body: string;
  coverImage: string | null;
  author: string;
  category: string;
  tags: string[];
  readingTime: number;
  publishedAt: string;
  updatedAt: string;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  relatedSources: V1RelatedSource[];
  relatedGuides: V1LegalLibraryListItem[];
  relatedServices: V1RelatedService[];
  previousPost: { slug: string; titleFa: string } | null;
  nextPost: { slug: string; titleFa: string } | null;
}

// --- Route Map ---

export interface RouteDefinition {
  path: string;
  titleFa: string;
  access: "guest" | "challenge" | "authenticated" | "entitled" | "owner" | "admin" | "user";
  icon?: string;
  children?: RouteDefinition[];
}

// --- Full User (me endpoint) ---

export interface MeResponse {
  user: UserSummary;
  profile: Profile;
  preferences: UserPreference;
  role: UserRole;
}

export type UserRole = "user" | "admin";


// --- Dashboard Widgets ---

export interface ActiveRequestItem {
  id: string;
  title: string;
  type: "conversation" | "document" | "contract";
  typeFa: string;
  date: string;
  progress: number;
  status: "draft" | "processing" | "needs_info" | "completed";
  statusFa: string;
  link: string;
}

export interface DashboardRecommendation {
  id: string;
  text: string;
  icon: string;
  link: string;
  linkLabel: string;
  urgency: "info" | "warning" | "action";
}

export interface RecentDocumentItem {
  id: string;
  name: string;
  mime: string;
  uploadedAt: string;
  status: string;
  statusFa: string;
}

export interface DashboardWidgetsData {
  activeRequests: ActiveRequestItem[];
  recommendations: DashboardRecommendation[];
  recentDocuments: RecentDocumentItem[];
}
// --- Usage ---

export interface UsageSummary {
  entitlements: Entitlement[];
  /** When the current usage period resets */
  periodEnd: string;
  /** Days remaining in current period */
  daysRemaining: number;
}

// --- Activities ---

export interface RecentActivitiesResponse {
  items: RecentActivityItem[];
  pagination: Pagination;
}

// --- Rewards & Loyalty ---

export type RewardEventType =
  | "PROFILE_COMPLETED"
  | "DAILY_VISIT"
  | "REFERRAL_COMPLETED"
  | "SUBSCRIPTION_SILVER_PURCHASED"
  | "SUBSCRIPTION_GOLD_PURCHASED"
  | "SUBSCRIPTION_DIAMOND_PURCHASED";

export interface RewardRuleInfo {
  eventType: RewardEventType;
  points: number;
  frequency: "once_per_account" | "once_per_day" | "once_per_purchase";
  enabled: boolean;
  labelFa: string;
  descriptionFa: string;
}

export interface RewardLedgerItem {
  id: string;
  eventType: RewardEventType;
  pointsDelta: number;
  sourceType: string;
  sourceId: string;
  description: string;
  createdAt: string;
}

export interface RewardsSummary {
  balance: number;
  today: {
    visitRewardClaimed: boolean;
    pointsAwarded: number;
  };
  rules: RewardRuleInfo[];
}

export interface RewardsHistoryResponse {
  items: RewardLedgerItem[];
  pagination: Pagination;
}

export interface DailyVisitClaimResponse {
  awarded: boolean;
  points: number;
  balance: number;
}

// --- Phase 7: Chat Workspace Types ---

export interface V1ConversationDetail extends Conversation {
  messages: Message[];
  aiRuns: AiRun[];
  references: V1Reference[];
}

export interface StructuredResponseSection {
  id: string;
  title: string;
  content: string;
  order: number;
}

export interface V1StructuredMessage extends Message {
  sections: StructuredResponseSection[];
  riskLevel: RiskLevel | null;
  references: V1Reference[];
}

// --- Phase 8: Reference & Citation Types ---

export interface V1Reference {
  id: string;
  conversationId: string;
  messageId: string;
  sourceId: string;
  locator: string;
  quote: string;
  section: string;
  sourceType?: SourceType;
  sourceTypeFa?: string;
}

export interface V1SourceDetail {
  id: string;
  sourceType: SourceType;
  sourceTypeFa: string;
  title: string;
  articleSection: string | null;
  publicationAuthority: string;
  jurisdiction: string;
  effectiveDate: string;
  versionDate: string | null;
  excerpt: string;
  url: string | null;
  documentIdentifier: string | null;
  status: SourceStatus;
  availability: "available" | "unavailable" | "outdated" | "unverified";
}

export interface V1SourceVersion {
  id: string;
  sourceId: string;
  versionDate: string;
  changes: string;
  effectiveDate: string;
}

export interface V1DocumentCitations {
  documentId: string;
  citations: V1Reference[];
}

// --- Checkout / Payment ---

export type PaymentStatus = "idle" | "creating" | "pending" | "paid" | "failed" | "cancelled";

export interface CheckoutIntent {
  id: string;
  planCode: PlanCode;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentUrl: string | null;
  createdAt: string;
  expiresAt: string;
  metadata: {
    planNameFa: string;
    durationDays: number;
    dailyRequests: number;
    totalTokens: number;
  };
}

export interface V1Subscription {
  id: string;
  userId: string;
  planId: string;
  planCode: PlanCode;
  planNameFa: string;
  startAt: string;
  endAt: string;
  status: SubscriptionStatus;
  autoRenew: boolean;
  cancelledAt: string | null;
}

export interface V1EntitlementsResponse {
  entitlements: Entitlement[];
  planCode: PlanCode;
  planNameFa: string;
}

export interface V1UsageResponse {
  usageCounters: UsageCounter[];
  periodStart: string;
  periodEnd: string;
  daysRemaining: number;
}

// --- API Endpoints ---

export type ApiEndpoints = {
  auth: {
    requestOtp: { input: { mobile: string }; output: OtpChallenge };
    verifyOtp: { input: { challengeId: string; code: string }; output: OtpResult };
    logout: { input: void; output: void };
  };
  user: {
    getMe: { input: void; output: MeResponse };
    updateProfile: { input: Partial<Profile>; output: Profile };
    getPreferences: { input: void; output: UserPreference };
    updatePreferences: { input: Partial<UserPreference>; output: UserPreference };
  };
  dashboard: {
    getSummary: { input: void; output: DashboardSummary };
  };
  activities: {
    getRecent: { input: { page?: number; pageSize?: number }; output: RecentActivitiesResponse };
  };
  plans: {
    list: { input: void; output: Plan[] };
    listV1: { input: void; output: Plan[] };
  };
  subscriptions: {
    purchase: { input: { planCode: PlanCode }; output: Subscription };
    getEntitlements: { input: void; output: Entitlement[] };
    currentV1: { input: void; output: V1Subscription | null };
  };
  entitlements: {
    getV1: { input: void; output: V1EntitlementsResponse };
  };
  usage: {
    getSummary: { input: void; output: UsageSummary };
    getV1: { input: void; output: V1UsageResponse };
  };
  checkout: {
    createIntent: { input: { planCode: PlanCode }; output: CheckoutIntent };
    getIntent: { input: { id: string }; output: CheckoutIntent };
  };
  conversations: {
    list: { input: { page?: number; pageSize?: number }; output: Conversation[] };
    create: { input: { title: string; category?: LegalCategory }; output: Conversation };
    getById: { input: { id: string }; output: V1ConversationDetail };
    update: { input: { id: string; title?: string; status?: ConversationStatus }; output: Conversation };
    sendMessage: { input: { conversationId: string; content: string }; output: V1StructuredMessage };
    listReferences: { input: { id: string }; output: V1Reference[] };
  };
  aiRuns: {
    create: { input: { conversationId: string; messageId: string }; output: AiRun };
    getById: { input: { id: string }; output: AiRun };
    cancel: { input: { id: string }; output: AiRun };
  };
  sources: {
    getById: { input: { id: string }; output: V1SourceDetail };
    getVersions: { input: { id: string }; output: V1SourceVersion[] };
  };
  documents: {
    list: { input: void; output: Document[] };
    getById: { input: { id: string }; output: Document & { jobs: DocumentJob[]; report?: RiskReport } };
    initiateUpload: { input: { name: string; mime: string; sizeBytes: number }; output: Document };
    completeUpload: { input: { id: string }; output: Document };
    retry: { input: { id: string }; output: Document };
    getCitations: { input: { id: string }; output: V1DocumentCitations };
    // Phase 9 V1 endpoints
    listV1: { input: V1DocumentListParams; output: V1DocumentListResponse };
    getByIdV1: { input: { id: string }; output: V1DocumentDetail };
    uploadInitV1: { input: V1DocumentUploadRequest; output: V1DocumentUploadResponse };
    uploadCompleteV1: { input: { id: string }; output: V1DocumentListItem };
    getStatusV1: { input: { id: string }; output: V1DocumentStatusResponse };
    getAnalysisV1: { input: { id: string }; output: V1DocumentAnalysisResponse };
    retryV1: { input: { id: string }; output: V1DocumentRetryResponse };
    deleteV1: { input: { id: string }; output: V1DocumentDeleteResponse };
  };
  contracts: {
    list: { input: void; output: Contract[] };
    create: { input: { type: ContractType }; output: Contract };
    getById: { input: { id: string }; output: Contract & { versions: ContractVersion[] } };
    // Phase 10 V1 endpoints
    getTypesV1: { input: void; output: V1ContractTypeListResponse };
    getQuestionsV1: { input: { typeId: V1ContractType }; output: V1ContractQuestionListResponse };
    listV1: { input: V1ContractListParams; output: V1ContractListResponse };
    createV1: { input: V1ContractCreateRequest; output: V1ContractCreateResponse };
    getByIdV1: { input: { id: string }; output: V1ContractDetail };
    updateV1: { input: { id: string } & V1ContractUpdateRequest; output: V1ContractDetail };
    generateV1: { input: { id: string }; output: V1ContractGenerateResponse };
    getVersionsV1: { input: { id: string }; output: V1ContractVersionDetail[] };
    getAnalysisV1: { input: { id: string }; output: V1ContractRiskAnalysis };
    archiveV1: { input: { id: string }; output: V1ContractArchiveResponse };
    // Draft endpoints
    createDraftV1: { input: { typeId: V1ContractType }; output: V1ContractDraft };
    getDraftV1: { input: { typeId: V1ContractType }; output: V1ContractDraft | null };
    saveDraftV1: { input: { typeId: V1ContractType; currentStep: number; answers: Record<string, string> }; output: V1ContractDraft };
    deleteDraftV1: { input: { typeId: V1ContractType }; output: { deleted: true } };
  };
  // Phase 11 endpoints
  history: {
    list: { input: V1HistoryListParams; output: V1HistoryListResponse };
  };
  memories: {
    list: { input: void; output: V1MemoryListResponse };
    update: { input: { id: string } & V1MemoryUpdateRequest; output: V1MemoryItem };
    delete: { input: { id: string }; output: { deleted: true } };
  };
  preferences: {
    get: { input: void; output: V1UserPreferences };
    update: { input: V1PreferencesUpdateRequest; output: V1UserPreferences };
  };
  subscriptionHistory: {
    list: { input: { page?: number; pageSize?: number }; output: V1SubscriptionHistoryResponse };
  };
  profileUsage: {
    get: { input: void; output: V1ProfileUsage };
  };
};
