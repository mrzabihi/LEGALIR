// ============================================================
// LEGALIR — Contextual chat tools for one service (user-facing)
// ============================================================
// GET /api/v1/chat/tools?service=<serviceType>&conversationId=<id>
//
// Returns every tool projected for the service, including the HONEST
// `available` verdict and, when unavailable, the Persian reason. The
// persisted selection comes from the conversation row, so a refresh (or a
// second tab) restores exactly what the user had chosen (§7).
// ============================================================

import { NextResponse } from "next/server";
import { findSessionById, readConversations } from "@/lib/db";
import { resolveChatTools } from "@/lib/ai/chat-tools";
import { resolveServiceType } from "@/lib/ai/service-context";

function getUser(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader.match(/legalir-session=([^;]+)/);
  if (!match || !match[1]) return null;
  return findSessionById(match[1]!)?.userId ?? null;
}

export async function GET(request: Request) {
  const userId = getUser(request);
  if (!userId) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "لطفا وارد شوید" },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const conversationId = url.searchParams.get("conversationId");

  // The conversation's own service context wins over the URL, because it is
  // what the backend actually recorded when the last turn ran. A foreign or
  // unknown conversation resolves to the URL's service and no selection.
  const conversation = conversationId
    ? readConversations().find((c) => c.id === conversationId && c.userId === userId)
    : undefined;

  const service = resolveServiceType(
    conversation?.serviceType ?? url.searchParams.get("service")
  );
  const persistedSelection = conversation?.toolIds ?? [];
  const { tools, selected } = resolveChatTools(service.serviceType, persistedSelection);

  return NextResponse.json({
    data: {
      serviceType: service.serviceType,
      tools,
      selected,
      // A tool can only change metered cost through an enabled energy profile;
      // this stays false until that real pricing exists for the tools.
      meteredByEnergyProfile: false,
    },
    meta: { requestId: crypto.randomUUID() },
  });
}
