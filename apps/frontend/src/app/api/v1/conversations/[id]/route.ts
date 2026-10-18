import { NextResponse } from 'next/server';
import {
  findSessionById,
  readConversations,
  writeConversations,
  removeActivity,
} from '@/lib/db';
import { getMessages, deleteMessages } from '@/lib/ai/store';
import { getAttachmentRefsByMessage, deleteConversationAttachments } from '@/lib/ai/attachments';
import { getLatestRunForConversation, toRunView } from '@/lib/ai/pipeline/run';
import { resolveServiceType } from '@/lib/ai/service-context';
import { validateToolSelection } from '@/lib/ai/chat-tools';

function getUser(req: Request): string | null {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const match = cookieHeader.match(/legalir-session=([^;]+)/);
  if (!match || !match[1]) return null;
  const session = findSessionById(match[1]!);
  return session?.userId ?? null;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUser(request);
  if (!userId) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'لطفا وارد شوید' }, { status: 401 });
  }

  const { id } = await params;
  const all = readConversations();
  const conv = all.find(c => c.id === id && c.userId === userId);
  if (!conv) {
    return NextResponse.json({ code: 'NOT_FOUND', message: 'گفتگو یافت نشد' }, { status: 404 });
  }

  // Hydrate persisted messages from the AI gateway store, decorating each
  // with the documents the user attached to it (references only).
  const attachmentsByMessage = getAttachmentRefsByMessage(id);
  const messages = getMessages(id).map((m) => ({
    ...m,
    attachments: attachmentsByMessage[m.id] ?? [],
  }));

  // The most recent processing run, projected to its user-safe view, so the
  // progress timeline survives a refresh (§37) and a WAITING_FOR_USER state
  // can be restored (§43).
  const latestRun = getLatestRunForConversation(id);
  const processingRun = latestRun ? toRunView(latestRun) : null;

  // The persisted service + tool selection, and the workflow projection, so a
  // refresh restores the exact context and the open follow-ups (§2, §7, §8).
  // Legacy rows carry none of these fields; the response then falls back to
  // the latest run (which already recorded what actually executed).
  const rawWorkflow = conv.workflow as
    | {
        phase?: string;
        domain?: string | null;
        pendingFollowUps?: unknown[];
        suggestCaseCreation?: boolean;
      }
    | null
    | undefined;

  const workflow = rawWorkflow
    ? {
        phase: rawWorkflow.phase ?? "DISCOVERY",
        domain: rawWorkflow.domain ?? null,
        pendingFollowUps: Array.isArray(rawWorkflow.pendingFollowUps)
          ? rawWorkflow.pendingFollowUps
          : [],
        suggestCaseCreation: Boolean(rawWorkflow.suggestCaseCreation),
      }
    : processingRun && (processingRun.pendingFollowUps?.length ?? 0) > 0
      ? {
          phase: "DATA_COLLECTION",
          domain: null,
          pendingFollowUps: processingRun.pendingFollowUps ?? [],
          suggestCaseCreation: false,
        }
      : null;

  return NextResponse.json({
    data: {
      ...conv,
      messages,
      aiRuns: [],
      references: [],
      processingRun,
      serviceType: conv.serviceType ?? null,
      toolIds: conv.toolIds ?? [],
      workflow,
    },
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUser(request);
  if (!userId) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'لطفا وارد شوید' }, { status: 401 });
  }

  const { id } = await params;
  const all = readConversations();
  const idx = all.findIndex(c => c.id === id && c.userId === userId);
  if (idx === -1) {
    return NextResponse.json({ code: 'NOT_FOUND', message: 'گفتگو یافت نشد' }, { status: 404 });
  }

  const body = await request.json();
  const { title, status: newStatus, toolIds } = body as {
    title?: string;
    status?: string;
    toolIds?: unknown;
  };

  const conv = all[idx]!;

  // A tool selection is validated against the same service allowlist the
  // stream gateway enforces, so a hand-edited request can never persist a
  // tool the backend would refuse on the next turn (§3, §7).
  if (toolIds !== undefined) {
    if (!Array.isArray(toolIds)) {
      return NextResponse.json(
        { code: 'INVALID_TOOL_SELECTION', message: 'فهرست ابزارها نامعتبر است.' },
        { status: 400 }
      );
    }
    const service = resolveServiceType(conv.serviceType);
    const validation = validateToolSelection(service.serviceType, toolIds);
    if (validation.rejected.length > 0) {
      return NextResponse.json(
        {
          code: 'INVALID_TOOL_SELECTION',
          message: validation.rejected.map((r) => r.reasonFa).join(' '),
        },
        { status: 400 }
      );
    }
    conv.toolIds = validation.valid;
  }

  if (title !== undefined) conv.title = title;
  if (newStatus !== undefined) conv.status = newStatus;
  conv.updatedAt = new Date().toISOString();

  writeConversations(all);

  return NextResponse.json({ data: all[idx] });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = getUser(request);
  if (!userId) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: 'لطفا وارد شوید' }, { status: 401 });
  }

  const { id } = await params;
  const all = readConversations();
  const idx = all.findIndex(c => c.id === id && c.userId === userId);
  if (idx === -1) {
    return NextResponse.json({ code: 'NOT_FOUND', message: 'گفتگو یافت نشد' }, { status: 404 });
  }

  // Remove the conversation, its persisted messages, and its history row.
  all.splice(idx, 1);
  writeConversations(all);
  deleteMessages(id);
  deleteConversationAttachments(id);
  removeActivity(userId, id);

  return NextResponse.json({ data: { deleted: true as const } });
}
