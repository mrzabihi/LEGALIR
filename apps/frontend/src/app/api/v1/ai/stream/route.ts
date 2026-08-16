// ============================================================
// LEGALIR — AI Gateway SSE Streaming Endpoint (server-only)
// ============================================================
// The single point through which the frontend reaches an AI provider.
// Provider credentials are read from server-only env vars and are never
// exposed to the browser (§16–§19).
//
//   Frontend → POST /api/v1/ai/stream  →  LEGALIR AI Gateway → Provider
//
// The response is Server-Sent Events framed as `data: {json}\n\n`.
// Events (status phases mirror AiRunStatus, §25):
//   { type: "status", status: "queued" | "retrieving" | "generating"
//                          | "validating" | "succeeded" | "failed" }
//   { type: "chunk", text: string, index: number }
//   { type: "done", messageId, sections, references }
//   { type: "error", code, message, retryable }
// ============================================================

import { findSessionById } from "@/lib/db";
import { createAiProvider, readAiProviderConfig } from "@/lib/ai/provider";
import { retrieveGroundedSources } from "@/lib/ai/grounding";
import { appendMessage, getMessages, incrementDailyRequest } from "@/lib/ai/store";
import { getServiceContext, categoryToServiceType } from "@/lib/ai/service-context";
import type { StructuredResponseSection, V1Reference } from "@legalir/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ============================================================
// Request shape
// ============================================================

interface StreamRequestBody {
  conversationId: string;
  /** The new user message text. */
  content: string;
  /** Optional conversation_context from the entry service (§20). */
  context?: {
    serviceType?: string;
    category?: string;
    documentId?: string;
  };
}

type Emit = (data: unknown) => void;

// ============================================================
// Helpers
// ============================================================

function getUser(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/legalir-session=([^;]+)/);
  if (!match || !match[1]) return null;
  const session = findSessionById(match[1]!);
  return session?.userId ?? null;
}

function sse(data: unknown): Uint8Array {
  const encoder = new TextEncoder();
  return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
}

function buildSystemPrompt(serviceType: string, contextBlock: string): string {
  const ctx = getServiceContext(serviceType);

  const parts = [
    "تو «دستیار تخصصی حقوقی لیگالیر» هستی؛ یک دستیار حقوقی فارسی‌زبان برای نظام حقوقی ایران.",
    `خدمت جاری: «${ctx.label}» — ${ctx.description}.`,
    "پاسخ را به زبان فارسی، رسمی، ساختاریافته و قابل استناد ارائه بده و در صورت امکان از عناوین «خلاصه»، «تحلیل اولیه»، «ریسک‌ها» و «اقدامات پیشنهادی» استفاده کن.",
    "فقط به قوانین، آرای وحدت رویه و منابع معتبری که در ادامه در اختیارت قرار می‌گیرد استناد کن. اگر منبع معتبری برای یک ادعا نداری، به‌صراحت بگو که برای آن مورد، استناد قطعی در دسترس نیست و از ذکر شماره ماده یا رأی ساختگی خودداری کن.",
    "این یک مشاوره رسمی یا نظر قطعی قضایی نیست؛ در پایان، کاربر را در موارد مهم به مشاوره با وکیل متخصص ارجاع بده.",
  ];

  if (contextBlock) {
    parts.push(contextBlock);
  }

  return parts.join("\n\n");
}

function markdownToSections(md: string): StructuredResponseSection[] {
  const sections: StructuredResponseSection[] = [];
  const lines = md.split(/\r?\n/);
  let current: { title: string; lines: string[] } | null = null;

  const flush = () => {
    if (current) {
      sections.push({
        id: `sec-${sections.length}`,
        title: current.title,
        content: current.lines.join("\n").trim(),
        order: sections.length + 1,
      });
      current = null;
    }
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const heading = line.match(/^#{1,3}\s+(.*)$/);
    if (heading) {
      flush();
      current = { title: heading[1]!.trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    } else if (line.trim()) {
      current = { title: "پاسخ", lines: [line] };
    }
  }
  flush();

  return sections;
}

// ============================================================
// Streaming (abortable, status-emitting)
// ============================================================

async function streamAssistant(
  emit: Emit,
  signal: AbortSignal,
  userId: string,
  body: StreamRequestBody
): Promise<void> {
  const serviceType = categoryToServiceType(
    body.context?.serviceType ?? body.context?.category
  );

  // Persist the user message first (§22 — no message loss).
  const userMessageId = crypto.randomUUID();
  appendMessage(body.conversationId, {
    id: userMessageId,
    conversationId: body.conversationId,
    role: "user",
    content: body.content,
    status: "sent",
    createdAt: new Date().toISOString(),
  });

  // Count the request against usage (§26).
  incrementDailyRequest(userId);

  const provider = createAiProvider();

  // Grounding (§24) — retrieve relevant verified legal sources.
  const grounding = retrieveGroundedSources(body.content, 3);

  const system = buildSystemPrompt(serviceType, grounding.contextBlock);

  // Build conversation history (the just-added user msg is passed
  // explicitly as the final turn, so exclude it from history).
  const history = getMessages(body.conversationId)
    .filter((m) => m.role !== "system" && m.id !== userMessageId)
    .slice(-8)
    .map((m) => ({
      role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
      content: m.content,
    }));

  let text = "";
  let index = 0;

  for await (const delta of provider.stream({
    system,
    messages: [...history, { role: "user" as const, content: body.content }],
    signal,
  })) {
    text += delta;
    emit({ type: "status", status: "generating" });
    emit({ type: "chunk", text: delta, index: index++ });
  }

  const sections = markdownToSections(text);

  const messageId = crypto.randomUUID();
  const references: V1Reference[] = grounding.references.map((r) => ({
    ...r,
    conversationId: body.conversationId,
    messageId,
  }));

  appendMessage(body.conversationId, {
    id: messageId,
    conversationId: body.conversationId,
    role: "assistant",
    content: text,
    status: "completed",
    sections,
    riskLevel: null,
    references,
    createdAt: new Date().toISOString(),
  });

  emit({ type: "done", messageId, sections, references });
}

// ============================================================
// Route handlers
// ============================================================

export async function POST(request: Request) {
  const userId = getUser(request);
  if (!userId) {
    return new Response(
      JSON.stringify({ code: "UNAUTHORIZED", message: "لطفا وارد شوید" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: StreamRequestBody;
  try {
    body = (await request.json()) as StreamRequestBody;
  } catch {
    return new Response(
      JSON.stringify({ code: "VALIDATION_ERROR", message: "بدنه درخواست نامعتبر است" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!body.conversationId || !body.content || !body.content.trim()) {
    return new Response(
      JSON.stringify({ code: "VALIDATION_ERROR", message: "متن پیام الزامی است" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const abortController = new AbortController();
      let closed = false;

      const emit: Emit = (data) => {
        if (closed) return;
        try {
          controller.enqueue(sse(data));
        } catch {
          closed = true;
        }
      };

      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      request.signal.addEventListener(
        "abort",
        () => {
          abortController.abort();
          close();
        },
        { once: true }
      );

      try {
        emit({ type: "status", status: "queued" });
        emit({ type: "status", status: "retrieving" });

        await streamAssistant(emit, abortController.signal, userId, body);

        emit({ type: "status", status: "validating" });
        emit({ type: "status", status: "succeeded" });
      } catch (err) {
        const isAbort = err instanceof Error && err.name === "AbortError";
        if (!abortController.signal.aborted) {
          emit({
            type: "error",
            code: isAbort ? "ABORTED" : "PROVIDER_UNAVAILABLE",
            message: isAbort
              ? "پردازش متوقف شد"
              : "در حال حاضر اتصال به سرویس هوشمند امکان‌پذیر نیست.",
            retryable: !isAbort,
          });
          emit({ type: "status", status: "failed" });
        }
      } finally {
        close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

// Health endpoint — reveals provider status without leaking secrets.
export async function GET() {
  const provider = createAiProvider();
  const health = await provider.health();
  const config = readAiProviderConfig();

  return new Response(
    JSON.stringify({
      provider: provider.name,
      model: provider.model,
      configured: provider.configured,
      healthy: health.ok,
      providerRequested: config.provider,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    }
  );
}
