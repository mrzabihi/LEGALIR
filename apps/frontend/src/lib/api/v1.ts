// ============================================================
// LEGALIR — API v1 Client Functions
// ============================================================
// All functions route through the centralized apiClient (client.ts)
// which provides correlation IDs, idempotency keys, error mapping,
// and environment-based base URL.
// ============================================================

import { apiClient } from "./client";
import type {
  MeResponse,
  DashboardSummary,
  UsageSummary,
  RecentActivitiesResponse,
  Profile,
  Plan,
  V1Subscription,
  V1EntitlementsResponse,
  V1UsageResponse,
  CheckoutIntent,
  PlanCode,
  Conversation,
  ConversationStatus,
  V1ConversationDetail,
  V1StructuredMessage,
  AiRun,
  V1Reference,
  V1SourceDetail,
  V1SourceVersion,
  V1DocumentCitations,
  V1DocumentListResponse,
  V1DocumentListParams,
  V1DocumentDetail,
  V1DocumentPreview,
  V1DocumentUploadRequest,
  V1DocumentUploadResponse,
  V1DocumentStatusResponse,
  V1DocumentAnalysisResponse,
  V1DocumentRetryResponse,
  V1DocumentDeleteResponse,
  V1DocumentListItem,
  V1ContractTypeListResponse,
  V1ContractQuestionListResponse,
  V1ContractType,
  V1ContractListParams,
  V1ContractListResponse,
  V1ContractDetail,
  V1ContractCreateRequest,
  V1ContractCreateResponse,
  V1ContractUpdateRequest,
  V1ContractGenerateResponse,
  V1ContractRiskAnalysis,
  V1ContractVersionDetail,
  V1ContractArchiveResponse,
  V1ContractDraft,
  V1HistoryListResponse,
  V1MemoryItem,
  V1MemoryListResponse,
  V1MemoryUpdateRequest,
  V1UserPreferences,
  V1PreferencesUpdateRequest,
  V1SubscriptionHistoryResponse,
  V1ProfileUsage,
  V1DailyQuota,
  V1BlogListResponse,
  V1BlogPostDetail,
  RewardsSummary,
  RewardsHistoryResponse,
  DailyVisitClaimResponse,
  PointsAccount,
  PointsTransactionsResponse,
  ConvertToLegalResponse,
  NotificationSettings,
  NotificationsResponse,
  PrivacySettings,
  SessionsResponse,
} from "@legalir/types";

// ============================================================
// Helper: build query string with URLSearchParams
// ============================================================

function qs(params: URLSearchParams): string {
  const s = params.toString();
  return s ? `?${s}` : "";
}

// ============================================================
// Auth & User
// ============================================================

export function fetchMe(): Promise<MeResponse> {
  return apiClient.get<MeResponse>("/api/v1/me");
}

export function updateProfile(data: Partial<Profile>): Promise<Profile> {
  return apiClient.patch<Profile>("/api/v1/me/profile", data);
}

// ============================================================
// Dashboard
// ============================================================

export function fetchDashboardSummary(): Promise<DashboardSummary> {
  return apiClient.get<DashboardSummary>("/api/v1/dashboard/summary");
}

// ============================================================
// Usage
// ============================================================

export function fetchUsageSummary(): Promise<UsageSummary> {
  return apiClient.get<UsageSummary>("/api/v1/usage/summary");
}

// ============================================================
// Activities
// ============================================================

export function fetchRecentActivities(
  page = 1,
  pageSize = 10
): Promise<RecentActivitiesResponse> {
  const p = new URLSearchParams();
  p.set("page", String(page));
  p.set("pageSize", String(pageSize));
  return apiClient.get<RecentActivitiesResponse>(
    `/api/v1/activities/recent${qs(p)}`
  );
}

// ============================================================
// Plans & Subscriptions (Phase 6 V1)
// ============================================================

export function fetchPlans(): Promise<Plan[]> {
  return apiClient.get<Plan[]>("/api/v1/plans");
}

export function fetchCurrentSubscription(): Promise<V1Subscription | null> {
  return apiClient.get<V1Subscription | null>("/api/v1/subscriptions/current");
}

export function fetchEntitlements(): Promise<V1EntitlementsResponse> {
  return apiClient.get<V1EntitlementsResponse>("/api/v1/entitlements");
}

export function fetchUsage(): Promise<V1UsageResponse> {
  return apiClient.get<V1UsageResponse>("/api/v1/usage");
}

export function createCheckoutIntent(planCode: PlanCode): Promise<CheckoutIntent> {
  return apiClient.post<CheckoutIntent>("/api/v1/checkout/intents", { planCode });
}

export function getCheckoutIntent(id: string): Promise<CheckoutIntent> {
  return apiClient.get<CheckoutIntent>(`/api/v1/checkout/intents/${id}`);
}

// ============================================================
// Conversations (Phase 7)
// ============================================================

export function fetchConversations(
  page = 1,
  pageSize = 20
): Promise<Conversation[]> {
  const p = new URLSearchParams();
  p.set("page", String(page));
  p.set("pageSize", String(pageSize));
  return apiClient.get<Conversation[]>(
    `/api/v1/conversations${qs(p)}`
  );
}

export function createConversation(data: {
  title: string;
  category?: string;
}): Promise<Conversation> {
  return apiClient.post<Conversation>("/api/v1/conversations", data);
}

export function fetchConversation(id: string): Promise<V1ConversationDetail> {
  return apiClient.get<V1ConversationDetail>(`/api/v1/conversations/${id}`);
}

export function updateConversation(
  id: string,
  data: { title?: string; status?: ConversationStatus }
): Promise<Conversation> {
  return apiClient.patch<Conversation>(`/api/v1/conversations/${id}`, data);
}

export function deleteConversation(
  id: string
): Promise<V1DocumentDeleteResponse> {
  return apiClient.delete<V1DocumentDeleteResponse>(`/api/v1/conversations/${id}`);
}

export function sendMessage(
  conversationId: string,
  content: string
): Promise<V1StructuredMessage> {
  return apiClient.post<V1StructuredMessage>(
    `/api/v1/conversations/${conversationId}/messages`,
    { conversationId, content }
  );
}

// ============================================================
// AI Runs (Phase 7)
// ============================================================

export function createAiRun(data: {
  conversationId: string;
  messageId: string;
}): Promise<AiRun> {
  return apiClient.post<AiRun>("/api/v1/ai-runs", data);
}

export function fetchAiRun(id: string): Promise<AiRun> {
  return apiClient.get<AiRun>(`/api/v1/ai-runs/${id}`);
}

export function cancelAiRun(id: string): Promise<AiRun> {
  return apiClient.post<AiRun>(`/api/v1/ai-runs/${id}/cancel`, {});
}

// ============================================================
// References & Sources (Phase 8)
// ============================================================

export function fetchConversationReferences(
  conversationId: string
): Promise<V1Reference[]> {
  return apiClient.get<V1Reference[]>(
    `/api/v1/conversations/${conversationId}/references`
  );
}

export function fetchSource(id: string): Promise<V1SourceDetail> {
  return apiClient.get<V1SourceDetail>(`/api/v1/sources/${id}`);
}

export function fetchSourceVersions(id: string): Promise<V1SourceVersion[]> {
  return apiClient.get<V1SourceVersion[]>(`/api/v1/sources/${id}/versions`);
}

export function fetchDocumentCitations(
  documentId: string
): Promise<V1DocumentCitations> {
  return apiClient.get<V1DocumentCitations>(
    `/api/v1/documents/${documentId}/citations`
  );
}

// ============================================================
// Documents (Phase 9)
// ============================================================

export function fetchDocuments(
  params: V1DocumentListParams = {}
): Promise<V1DocumentListResponse> {
  const p = new URLSearchParams();
  if (params.page) p.set("page", String(params.page));
  if (params.pageSize) p.set("pageSize", String(params.pageSize));
  if (params.search) p.set("search", params.search);
  if (params.status && params.status !== "all") p.set("status", params.status);
  if (params.sort) p.set("sort", params.sort);
  return apiClient.get<V1DocumentListResponse>(`/api/v1/documents${qs(p)}`);
}

export function fetchDocumentDetail(id: string): Promise<V1DocumentDetail> {
  return apiClient.get<V1DocumentDetail>(`/api/v1/documents/${id}`);
}

export function fetchDocumentPreview(id: string): Promise<V1DocumentPreview> {
  return apiClient.get<V1DocumentPreview>(`/api/v1/documents/${id}/preview`);
}

export function initiateUpload(data: V1DocumentUploadRequest): Promise<V1DocumentUploadResponse> {
  return apiClient.post<V1DocumentUploadResponse>("/api/v1/documents/uploads", data);
}

/**
 * Complete an upload by sending the file's bytes. The server stores them
 * so the preview/file/download routes can serve the document afterwards —
 * sending only metadata would leave the row without any bytes to preview.
 */
export function completeUpload(id: string, file: File): Promise<V1DocumentListItem> {
  const form = new FormData();
  form.append("file", file, file.name);
  return apiClient.postForm<V1DocumentListItem>(`/api/v1/documents/uploads/${id}/complete`, form);
}

export function fetchDocumentStatus(id: string): Promise<V1DocumentStatusResponse> {
  return apiClient.get<V1DocumentStatusResponse>(`/api/v1/documents/${id}/status`);
}

export function fetchDocumentAnalysis(id: string): Promise<V1DocumentAnalysisResponse> {
  return apiClient.get<V1DocumentAnalysisResponse>(`/api/v1/documents/${id}/analysis`);
}

export function retryDocument(id: string): Promise<V1DocumentRetryResponse> {
  return apiClient.post<V1DocumentRetryResponse>(`/api/v1/documents/${id}/retry`, {});
}

export function deleteDocument(id: string): Promise<V1DocumentDeleteResponse> {
  return apiClient.delete<V1DocumentDeleteResponse>(`/api/v1/documents/${id}`);
}

// ============================================================
// Contracts (Phase 10)
// ============================================================

export function fetchContractTypes(): Promise<V1ContractTypeListResponse> {
  return apiClient.get<V1ContractTypeListResponse>("/api/v1/contract-types");
}

export function fetchContractQuestions(typeId: V1ContractType): Promise<V1ContractQuestionListResponse> {
  return apiClient.get<V1ContractQuestionListResponse>(`/api/v1/contract-types/${typeId}/questions`);
}

export function fetchContracts(
  params: V1ContractListParams = {}
): Promise<V1ContractListResponse> {
  const p = new URLSearchParams();
  if (params.page) p.set("page", String(params.page));
  if (params.pageSize) p.set("pageSize", String(params.pageSize));
  if (params.search) p.set("search", params.search);
  if (params.state) p.set("state", params.state);
  if (params.category) p.set("category", params.category);
  if (params.sort) p.set("sort", params.sort);
  return apiClient.get<V1ContractListResponse>(`/api/v1/contracts${qs(p)}`);
}

export function createContract(data: V1ContractCreateRequest): Promise<V1ContractCreateResponse> {
  return apiClient.post<V1ContractCreateResponse>("/api/v1/contracts", data);
}

export function fetchContract(id: string): Promise<V1ContractDetail> {
  return apiClient.get<V1ContractDetail>(`/api/v1/contracts/${id}`);
}

export function updateContract(
  id: string,
  data: V1ContractUpdateRequest
): Promise<V1ContractDetail> {
  return apiClient.patch<V1ContractDetail>(`/api/v1/contracts/${id}`, data);
}

export function generateContract(id: string): Promise<V1ContractGenerateResponse> {
  return apiClient.post<V1ContractGenerateResponse>(`/api/v1/contracts/${id}/generate`, {});
}

export function fetchContractVersions(id: string): Promise<V1ContractVersionDetail[]> {
  return apiClient.get<V1ContractVersionDetail[]>(`/api/v1/contracts/${id}/versions`);
}

export function fetchContractAnalysis(id: string): Promise<V1ContractRiskAnalysis> {
  return apiClient.get<V1ContractRiskAnalysis>(`/api/v1/contracts/${id}/analysis`);
}

export function archiveContract(id: string): Promise<V1ContractArchiveResponse> {
  return apiClient.post<V1ContractArchiveResponse>(`/api/v1/contracts/${id}/archive`, {});
}

// ============================================================
// Contract Drafts (Phase 10)
// ============================================================

export function createContractDraft(typeId: V1ContractType): Promise<V1ContractDraft> {
  return apiClient.post<V1ContractDraft>("/api/v1/contracts/drafts", { typeId });
}

export function fetchContractDraft(typeId: V1ContractType): Promise<V1ContractDraft | null> {
  return apiClient.get<V1ContractDraft | null>(`/api/v1/contracts/drafts/${typeId}`);
}

export function saveContractDraft(
  typeId: V1ContractType,
  currentStep: number,
  answers: Record<string, string>
): Promise<V1ContractDraft> {
  return apiClient.patch<V1ContractDraft>(`/api/v1/contracts/drafts/${typeId}`, {
    currentStep,
    answers,
  });
}

export function deleteContractDraft(typeId: V1ContractType): Promise<{ deleted: true }> {
  return apiClient.delete<{ deleted: true }>(`/api/v1/contracts/drafts/${typeId}`);
}

// ============================================================
// History (Phase 11)
// ============================================================

export function fetchHistory(
  params: {
    page?: number;
    pageSize?: number;
    category?: string;
    search?: string;
    sort?: string;
    type?: string;
  } = {}
): Promise<V1HistoryListResponse> {
  const p = new URLSearchParams();
  if (params.page) p.set("page", String(params.page));
  if (params.pageSize) p.set("pageSize", String(params.pageSize));
  if (params.category && params.category !== "all") p.set("category", params.category);
  if (params.search) p.set("search", params.search);
  if (params.sort) p.set("sort", params.sort);
  if (params.type && params.type !== "all") p.set("type", params.type);
  return apiClient.get<V1HistoryListResponse>(`/api/v1/history${qs(p)}`);
}

/** Toggle the archived flag on a history item (persisted server-side). */
export function archiveHistoryItem(
  id: string,
  archived: boolean
): Promise<{ id: string; archived: boolean }> {
  return apiClient.patch<{ id: string; archived: boolean }>("/api/v1/history", {
    id,
    archived,
  });
}

// ============================================================
// Memories (Phase 11)
// ============================================================

export function fetchMemories(): Promise<V1MemoryListResponse> {
  return apiClient.get<V1MemoryListResponse>("/api/v1/memories");
}

export function createMemory(data: {
  key: string;
  value: string;
  category?: "profile" | "preference" | "legal_context";
}): Promise<V1MemoryItem> {
  return apiClient.post<V1MemoryItem>("/api/v1/memories", data);
}

export function updateMemory(
  id: string,
  data: V1MemoryUpdateRequest
): Promise<V1MemoryItem> {
  return apiClient.patch<V1MemoryItem>(`/api/v1/memories/${id}`, data);
}

export function deleteMemory(id: string): Promise<V1DocumentDeleteResponse> {
  return apiClient.delete<V1DocumentDeleteResponse>(`/api/v1/memories/${id}`);
}

// ============================================================
// Preferences (Phase 11)
// ============================================================

export function fetchPreferences(): Promise<V1UserPreferences> {
  return apiClient.get<V1UserPreferences>("/api/v1/me/preferences");
}

export function updatePreferences(
  data: V1PreferencesUpdateRequest
): Promise<V1UserPreferences> {
  return apiClient.patch<V1UserPreferences>("/api/v1/me/preferences", data);
}

// ============================================================
// Subscription History (Phase 11)
// ============================================================

export function fetchSubscriptionHistory(
  page = 1,
  pageSize = 20
): Promise<V1SubscriptionHistoryResponse> {
  const p = new URLSearchParams();
  p.set("page", String(page));
  p.set("pageSize", String(pageSize));
  return apiClient.get<V1SubscriptionHistoryResponse>(
    `/api/v1/subscription-history${qs(p)}`
  );
}

// ============================================================
// Profile Usage (Phase 11)
// ============================================================

export function fetchProfileUsage(): Promise<V1ProfileUsage> {
  return apiClient.get<V1ProfileUsage>("/api/v1/profile/usage");
}

export function fetchDailyQuota(): Promise<V1DailyQuota> {
  return apiClient.get<V1DailyQuota>("/api/v1/quota");
}

// ============================================================
// Blog (Legal Education)
// ============================================================

export function fetchBlogPosts(
  page = 1,
  pageSize = 4
): Promise<V1BlogListResponse> {
  const p = new URLSearchParams();
  p.set("page", String(page));
  p.set("pageSize", String(pageSize));
  return apiClient.get<V1BlogListResponse>(`/api/v1/blog${qs(p)}`);
}

export function fetchBlogPost(slug: string): Promise<V1BlogPostDetail> {
  return apiClient.get<V1BlogPostDetail>(`/api/v1/blog/${slug}`);
}

// ============================================================
// Rewards & Loyalty
// ============================================================

export function fetchRewardsSummary(): Promise<RewardsSummary> {
  return apiClient.get<RewardsSummary>("/api/v1/rewards/summary");
}

export function fetchRewardsHistory(
  page = 1,
  pageSize = 20
): Promise<RewardsHistoryResponse> {
  const p = new URLSearchParams();
  p.set("page", String(page));
  p.set("pageSize", String(pageSize));
  return apiClient.get<RewardsHistoryResponse>(`/api/v1/rewards/history${qs(p)}`);
}

export function claimDailyVisitReward(): Promise<DailyVisitClaimResponse> {
  return apiClient.post<DailyVisitClaimResponse>("/api/v1/rewards/daily-visit/claim", {});
}

// ============================================================
// Points Account (ledger aggregates)
// ============================================================

export function fetchPointsAccount(): Promise<PointsAccount> {
  return apiClient.get<PointsAccount>("/api/v1/points");
}

export function fetchPointsTransactions(
  page = 1,
  pageSize = 20
): Promise<PointsTransactionsResponse> {
  const p = new URLSearchParams();
  p.set("page", String(page));
  p.set("pageSize", String(pageSize));
  return apiClient.get<PointsTransactionsResponse>(`/api/v1/points/transactions${qs(p)}`);
}

// ============================================================
// Notification Center
// ============================================================

export function fetchNotifications(): Promise<NotificationsResponse> {
  return apiClient.get<NotificationsResponse>("/api/v1/notifications");
}

export function markNotificationRead(id: string): Promise<NotificationsResponse> {
  return apiClient.post<NotificationsResponse>(
    `/api/v1/notifications/${encodeURIComponent(id)}/read`,
    {}
  );
}

export function markAllNotificationsRead(): Promise<NotificationsResponse> {
  return apiClient.post<NotificationsResponse>("/api/v1/notifications/read-all", {});
}

// ============================================================
// Account type
// ============================================================

export function convertToLegal(): Promise<ConvertToLegalResponse> {
  return apiClient.post<ConvertToLegalResponse>("/api/v1/profile/convert-to-legal", {});
}

// ============================================================
// Settings — notifications, privacy, sessions
// ============================================================

export function fetchNotificationSettings(): Promise<NotificationSettings> {
  return apiClient.get<NotificationSettings>("/api/v1/settings/notifications");
}

export function updateNotificationSettings(
  updates: Partial<NotificationSettings>
): Promise<NotificationSettings> {
  return apiClient.patch<NotificationSettings>("/api/v1/settings/notifications", updates);
}

export function fetchPrivacySettings(): Promise<PrivacySettings> {
  return apiClient.get<PrivacySettings>("/api/v1/settings/privacy");
}

export function updatePrivacySettings(
  updates: Partial<PrivacySettings>
): Promise<PrivacySettings> {
  return apiClient.patch<PrivacySettings>("/api/v1/settings/privacy", updates);
}

export function fetchSessions(): Promise<SessionsResponse> {
  return apiClient.get<SessionsResponse>("/api/v1/settings/sessions");
}

export function revokeSession(id: string): Promise<{ revoked: boolean }> {
  return apiClient.delete<{ revoked: boolean }>(`/api/v1/settings/sessions/${id}`);
}

export function revokeOtherSessions(): Promise<{ revoked: number }> {
  return apiClient.delete<{ revoked: number }>("/api/v1/settings/sessions");
}

// ============================================================
// Account deletion
// ============================================================

export function deleteAccount(): Promise<{ deleted: boolean }> {
  return apiClient.delete<{ deleted: boolean }>("/api/v1/account");
}
