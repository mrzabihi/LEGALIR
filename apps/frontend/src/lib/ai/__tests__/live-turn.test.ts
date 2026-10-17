// ============================================================
// LEGALIR — live-turn model unit tests
// ============================================================
// The live turn is what makes the chat feel like a messenger while staying
// honest: the user message appears immediately, the assistant reply grows
// from REAL chunks only, the turn reconciles to server ids on `done`, and a
// failure keeps the user message for a non-duplicating retry.

import { describe, it, expect } from "vitest";
import type { Message, V1DocumentListItem } from "@legalir/types";
import {
  createLiveTurn,
  applyChunk,
  applyRunId,
  completeTurn,
  failTurn,
  cancelTurn,
  liveTurnMessages,
  mergeTurn,
  isTurnFullyPersisted,
} from "../live-turn";

const DOC: V1DocumentListItem = {
  id: "doc-1",
  name: "قرارداد.pdf",
  mime: "application/pdf",
  sizeBytes: 1234,
  status: "ready",
  createdAt: "2026-10-14T10:00:00.000Z",
  updatedAt: "2026-10-14T10:00:00.000Z",
  riskLevel: "medium",
  findingCount: 2,
};

describe("createLiveTurn", () => {
  it("shows the user message immediately with status=sending", () => {
    const turn = createLiveTurn({
      conversationId: "conv-1",
      content: "این قرارداد را بررسی کن",
      attachments: [DOC],
    });

    const [user] = liveTurnMessages(turn);
    expect(user!.role).toBe("user");
    expect(user!.content).toBe("این قرارداد را بررسی کن");
    expect(user!.status).toBe("sending");
    expect(user!.attachments).toHaveLength(1);
    expect(user!.attachments?.[0]?.documentId).toBe("doc-1");
    // No assistant message until a real chunk arrives.
    expect(turn.assistant).toBeNull();
    expect(liveTurnMessages(turn)).toHaveLength(1);
  });
});

describe("applyChunk", () => {
  it("creates the assistant message on the first chunk and accumulates text", () => {
    let turn = createLiveTurn({ conversationId: "c", content: "q" });
    turn = applyChunk(turn, { text: "سلام ", index: 0 });
    turn = applyChunk(turn, { text: "دنیا", index: 1 });

    expect(turn.assistant?.content).toBe("سلام دنیا");
    expect(turn.assistant?.status).toBe("streaming");
    // The user message is considered sent once streaming has begun.
    expect(turn.userStatus).toBe("sent");
  });

  it("ignores an empty chunk", () => {
    let turn = createLiveTurn({ conversationId: "c", content: "q" });
    turn = applyChunk(turn, { text: "", index: 0 });
    expect(turn.assistant).toBeNull();
  });
});

describe("completeTurn", () => {
  it("reconciles server ids, attachments, sections and references", () => {
    let turn = createLiveTurn({
      conversationId: "c",
      content: "q",
      attachments: [DOC],
    });
    turn = applyChunk(turn, { text: "پاسخ", index: 0 });
    turn = completeTurn(turn, {
      messageId: "assistant-1",
      requestId: "run-1",
      userMessageId: "user-1",
      userAttachments: [
        {
          attachmentId: "att-1",
          documentId: "doc-1",
          name: "قرارداد.pdf",
          mime: "application/pdf",
          sizeBytes: 1234,
          status: "ready",
          riskLevel: null,
          findingCount: 0,
          createdAt: "2026-10-14T10:00:00.000Z",
        },
      ],
      sections: [{ id: "s1", title: "خلاصه", content: "…", order: 1 }],
      references: [
        {
          id: "r1",
          conversationId: "c",
          messageId: "assistant-1",
          sourceId: "src-1",
          locator: "ماده ۱",
          quote: "متن",
          section: "منابع مرتبط",
        },
      ],
    });

    expect(turn.serverUserId).toBe("user-1");
    expect(turn.serverAssistantId).toBe("assistant-1");
    expect(turn.runId).toBe("run-1");
    expect(turn.userStatus).toBe("sent");
    expect(turn.assistant?.status).toBe("completed");
    expect(turn.assistant?.sections).toHaveLength(1);
    expect(turn.assistant?.references).toHaveLength(1);
    expect(turn.attachments[0]?.attachmentId).toBe("att-1");
  });
});

describe("failTurn / cancelTurn", () => {
  it("keeps the user message for a retry on failure", () => {
    let turn = createLiveTurn({ conversationId: "c", content: "سوال" });
    turn = failTurn(turn, "خطای شبکه", true);

    expect(turn.userStatus).toBe("failed");
    expect(turn.error).toBe("خطای شبکه");
    expect(turn.retryable).toBe(true);
    // The user's text is intact — a retry re-sends the same content.
    expect(turn.content).toBe("سوال");
    expect(liveTurnMessages(turn)[0]?.content).toBe("سوال");
  });

  it("keeps the partial reply received so far on cancel", () => {
    let turn = createLiveTurn({ conversationId: "c", content: "q" });
    turn = applyChunk(turn, { text: "پاسخ نیمه", index: 0 });
    turn = cancelTurn(turn);

    expect(turn.assistant?.content).toBe("پاسخ نیمه");
    expect(turn.assistant?.status).toBe("completed");
  });
});

describe("mergeTurn", () => {
  it("does not duplicate a message the server has already persisted", () => {
    let turn = createLiveTurn({ conversationId: "c", content: "q" });
    turn = applyChunk(turn, { text: "پاسخ", index: 0 });
    turn = completeTurn(turn, {
      messageId: "assistant-1",
      userMessageId: "user-1",
      sections: [],
      references: [],
    });

    const persisted: Message[] = [
      {
        id: "user-1",
        conversationId: "c",
        role: "user",
        content: "q",
        status: "sent",
        createdAt: "2026-10-14T10:00:00.000Z",
      },
      {
        id: "assistant-1",
        conversationId: "c",
        role: "assistant",
        content: "پاسخ",
        status: "completed",
        createdAt: "2026-10-14T10:00:01.000Z",
      },
    ];

    const merged = mergeTurn(persisted, turn);
    expect(merged).toHaveLength(2);
    expect(isTurnFullyPersisted(turn, persisted)).toBe(true);
  });

  it("appends the still-unpersisted live remainder while streaming", () => {
    let turn = createLiveTurn({ conversationId: "c", content: "q" });
    turn = applyChunk(turn, { text: "پاسخ", index: 0 });

    const persisted: Message[] = [
      {
        id: "older",
        conversationId: "c",
        role: "assistant",
        content: "قدیمی",
        status: "completed",
        createdAt: "2026-10-14T09:00:00.000Z",
      },
    ];

    const merged = mergeTurn(persisted, turn);
    expect(merged).toHaveLength(3); // older + optimistic user + streaming assistant
    expect(merged[1]?.role).toBe("user");
    expect(merged[2]?.role).toBe("assistant");
    expect(merged[2]?.content).toBe("پاسخ");
    expect(isTurnFullyPersisted(turn, persisted)).toBe(false);
  });

  it("returns the persisted list untouched when there is no live turn", () => {
    const persisted: Message[] = [
      {
        id: "m1",
        conversationId: "c",
        role: "user",
        content: "x",
        status: "sent",
        createdAt: "2026-10-14T09:00:00.000Z",
      },
    ];
    expect(mergeTurn(persisted, null)).toEqual(persisted);
  });
});

describe("applyRunId", () => {
  it("captures the backend run id once and is idempotent", () => {
    let turn = createLiveTurn({ conversationId: "c", content: "q" });
    turn = applyRunId(turn, "run-1");
    const again = applyRunId(turn, "run-1");
    expect(turn.runId).toBe("run-1");
    expect(again).toBe(turn); // unchanged reference
  });
});
