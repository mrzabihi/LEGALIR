// ============================================================
// LEGALIR — Shared Zod Validation Schemas
// ============================================================

import { z } from "zod";

// --- Persian Helpers ---

const persianMobileRegex = /^(\+98|0)?9\d{9}$/;
const mobileE164Regex = /^\+989\d{9}$/;

export const mobileInputSchema = z
  .string()
  .min(1, "شماره موبایل الزامی است")
  .regex(/^09\d{9}$/, "شماره موبایل باید با ۰۹ شروع شود و ۱۱ رقم باشد");

export const mobileE164Schema = z
  .string()
  .regex(mobileE164Regex, "شماره موبایل در قالب E.164 معتبر نیست");

export const otpCodeSchema = z
  .string()
  .length(6, "کد تأیید ۶ رقمی است")
  .regex(/^\d{6}$/, "کد تأیید فقط عدد است");

// --- Auth ---

export const requestOtpInputSchema = z.object({
  mobile: mobileInputSchema,
});

export const verifyOtpInputSchema = z.object({
  challengeId: z.string().uuid(),
  code: otpCodeSchema,
});

// --- Profile ---

export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .min(2, "نام حداقل ۲ حرف است")
    .max(100, "نام حداکثر ۱۰۰ حرف است")
    .optional(),
  city: z.string().max(50).optional(),
  occupation: z.string().max(100).optional(),
});

export const updatePreferencesSchema = z.object({
  theme: z.enum(["light", "dark"]).optional(),
  locale: z.enum(["fa-IR", "en"]).optional(),
  notifications: z
    .object({
      appointments: z.boolean().optional(),
      contractExpiry: z.boolean().optional(),
      lawyerResponse: z.boolean().optional(),
      paymentStatus: z.boolean().optional(),
      caseUpdate: z.boolean().optional(),
      marketing: z.boolean().optional(),
    })
    .optional(),
});

// --- Subscription ---

export const purchaseSubscriptionSchema = z.object({
  planCode: z.enum(["ultra", "pro", "pro_max"]),
});

// --- Conversation ---

export const createConversationSchema = z.object({
  title: z.string().min(1, "عنوان گفتگو الزامی است").max(200),
  category: z
    .enum([
      "family",
      "contract",
      "real_estate",
      "labor",
      "commerce",
      "criminal",
      "tax",
      "companies",
      "checks",
      "immigration",
      "cyber",
      "other",
    ])
    .optional(),
});

export const updateConversationSchema = z.object({
  title: z.string().min(1, "عنوان گفتگو الزامی است").max(200).optional(),
  status: z.enum(["draft", "active", "completed", "archived", "failed"]).optional(),
});

export const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1, "پیام نمی‌تواند خالی باشد").max(10000),
});

export const createAiRunSchema = z.object({
  conversationId: z.string().uuid(),
  messageId: z.string().uuid(),
});

// --- Document ---

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB
const ALLOWED_MIMES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
];

export const initiateUploadSchema = z.object({
  name: z.string().min(1).max(255),
  mime: z.enum(ALLOWED_MIMES as [string, ...string[]]),
  sizeBytes: z.number().int().positive().max(MAX_FILE_SIZE, "حجم فایل بیش از حد مجاز است"),
});

// --- Contract ---

export const createContractSchema = z.object({
  type: z.enum(["lease", "nda", "employment", "contracting", "partnership"]),
});

// --- Pagination ---

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// --- Checkout ---

export const createCheckoutIntentSchema = z.object({
  planCode: z.enum(["ultra", "pro", "pro_max"]),
});

// --- API Response Validation ---

export function apiSuccessSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    meta: z
      .object({
        requestId: z.string(),
        pagination: z
          .object({
            page: z.number(),
            pageSize: z.number(),
            total: z.number(),
            totalPages: z.number(),
          })
          .optional(),
      })
      .optional(),
  });
}

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  fieldErrors: z
    .array(
      z.object({
        path: z.string(),
        reason: z.string(),
      })
    )
    .optional(),
  correlationId: z.string(),
  retryable: z.boolean(),
  nextAction: z.string().optional(),
});
