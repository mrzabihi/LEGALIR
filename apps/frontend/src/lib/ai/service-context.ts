// ============================================================
// LEGALIR — Service Context (isomorphic, client + server)
// ============================================================
// Maps LEGALIR service entry points to a structured
// `conversation_context.service_type` understood by the AI gateway.
// Shared by the client (to render the context card) and the server
// (to build the system prompt) so labels stay consistent (§20–§21).
// ============================================================

export type ServiceType =
  | "legal_consultation"
  | "contract_review"
  | "contract_drafting"
  | "legal_notice"
  | "document_analysis"
  | "legal_calculation"
  | "law_search"
  | "case_analysis";

export interface ServiceContext {
  serviceType: ServiceType;
  label: string;
  description: string;
}

export const SERVICE_CONTEXTS: Record<ServiceType, ServiceContext> = {
  legal_consultation: {
    serviceType: "legal_consultation",
    label: "مشاوره حقوقی",
    description: "پرسش و پاسخ حقوقی با استناد به منابع معتبر",
  },
  contract_review: {
    serviceType: "contract_review",
    label: "بررسی قرارداد",
    description: "تحلیل قرارداد، شناسایی ریسک‌ها و شروط نامتعارف",
  },
  contract_drafting: {
    serviceType: "contract_drafting",
    label: "تنظیم قرارداد",
    description: "تنظیم پیش‌نویس قرارداد بر اساس نیاز شما",
  },
  legal_notice: {
    serviceType: "legal_notice",
    label: "تنظیم اظهارنامه",
    description: "تنظیم اظهارنامه رسمی با ذکر مستندات قانونی",
  },
  document_analysis: {
    serviceType: "document_analysis",
    label: "تحلیل سند",
    description: "بررسی هوشمند اسناد حقوقی همراه با ارجاعات",
  },
  legal_calculation: {
    serviceType: "legal_calculation",
    label: "محاسبات حقوقی",
    description: "محاسبه خسارت، هزینه دادرسی و دیه",
  },
  law_search: {
    serviceType: "law_search",
    label: "جستجوی قوانین",
    description: "جستجو در قوانین و آرای وحدت رویه",
  },
  case_analysis: {
    serviceType: "case_analysis",
    label: "تحلیل پرونده",
    description: "تحلیل وضعیت پرونده و مسیر پیشنهادی",
  },
};

export function getServiceContext(type: string | undefined | null): ServiceContext {
  if (type && type in SERVICE_CONTEXTS) {
    return SERVICE_CONTEXTS[type as ServiceType];
  }
  return SERVICE_CONTEXTS.legal_consultation;
}

/**
 * Maps legacy `?category=` query values used by the Services page to a
 * ServiceType. Unknown/empty values fall back to legal_consultation.
 */
export function categoryToServiceType(category: string | null | undefined): ServiceType {
  switch (category) {
    case "formal_letter":
    case "notice":
      return "legal_notice";
    case "calculator":
    case "calculation":
      return "legal_calculation";
    case "contract_review":
      return "contract_review";
    case "contract":
      return "contract_drafting";
    case "document":
      return "document_analysis";
    case "law":
    case "law_search":
      return "law_search";
    case "case":
      return "case_analysis";
    default:
      return "legal_consultation";
  }
}

/**
 * Pure, isomorphic helper: derives a ServiceType from a raw query string.
 * Reads `?service=` first, then `?category=`. Safe to use on both the
 * client (window.location.search) and server (request.url).
 */
export function serviceTypeFromQuery(search: string | null | undefined): ServiceType {
  if (!search) return "legal_consultation";
  const params = new URLSearchParams(search);
  const service = params.get("service") ?? params.get("category");
  return categoryToServiceType(service);
}
