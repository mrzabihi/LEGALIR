# LEGALIER — Chat Document Attachments

Attach documents a user already owns to a chat message, so the AI can ground
its answer in the document's content. The document is **never copied or
re-uploaded** — the chat only holds a reference to it.

```
Document  ←  MessageAttachment  →  Message
   (owned, independent entity)      (the join row)      (the chat turn)
```

---

## 1. Why a join table (and not a file copy)

A document is an independent entity owned by the user. Attaching it to a
message must not duplicate the file, its storage key, or its analysis. The
only thing a chat turn stores is a **`MessageAttachment`** row that points at
the document:

```ts
interface MessageAttachment {
  id: string;
  messageId: string;
  conversationId: string;
  documentId: string;
  userId: string;
  createdAt: string;
}
```

Consequences:

- Deleting the conversation removes the links, not the documents.
- Deleting a document makes its attachment refs disappear from the UI
  (hydration drops rows whose document no longer exists).
- The same document can be attached to many messages without extra storage.

## 2. Ownership is enforced server-side

`linkAttachmentsToMessage()` (`lib/ai/attachments.ts`) validates **every**
document id against the *requesting user's* own documents via
`getDemoDocument(userId, id)`. Ids the user does not own are returned in
`rejected` and are **never** written. A crafted request that injects another
user's document id therefore cannot attach it — the guarantee lives in the
backend, not the UI.

The function is also:

- **Idempotent** — re-linking the same document to the same message is a no-op.
- **Capped** — at most `MAX_CHAT_ATTACHMENTS` (5) per message; ids beyond the
  cap are reported as rejected rather than silently dropped.

## 3. API surface

| Endpoint | Change | Purpose |
|----------|--------|---------|
| `GET /api/v1/documents/recent?limit=` | new | The user's most recent documents (metadata only) for the attach picker. 401 when unauthenticated; `limit` clamped 1..50, default 12. |
| `POST /api/v1/ai/stream` | extended | Body gained `attachmentDocumentIds?: string[]`. After the user message is persisted, the ids are linked and their extracted text is injected into the prompt. |
| `GET /api/v1/conversations/[id]` | extended | Each message is decorated with `attachments: ChatAttachmentRef[]` so the bubble can render persisted attachment cards. |
| `DELETE /api/v1/conversations/[id]` | extended | Also drops the conversation's attachment links. |

The SSE `done` event now carries `userMessageId` and `userAttachments` so the
client can reconcile the optimistic message with the persisted refs.

## 4. AI context injection

The full file is **never** sent to the model. `resolveAttachmentContext()`
returns, for each owned document, its already-extracted text (from the
existing analysis pipeline). The gateway injects that text under a
`## اسناد پیوست‌شده توسط کاربر` block in the system prompt, and reports
`attachmentsUsed` on the `ANALYZE` stage. Documents with no extracted text
yet are still linked (they appear in the UI) but contribute no prompt text.

## 5. Frontend

### Composer

- `MessageInput` renders a **tray** of `ChatDocumentAttachment variant="COMPOSER"`
  chips (name + size + remove ×) above the textarea.
- The paperclip button opens `AttachDocumentModal` — a desktop dialog /
  mobile bottom sheet listing recent documents with search, multi-select
  (capped at 5), and loading / empty / error states.
- `"+ بارگذاری سند جدید"` navigates to the **existing** documents upload page
  (`/documents/upload?source=chat&returnTo=<chat url>`) — no parallel upload
  system.

### Message bubble

- `MessageBubble` renders persisted attachments above the message text via
  `ChatDocumentAttachment variant="MESSAGE"`.
- Clicking a card opens the document in the **existing** `DocumentViewer`
  (modal overlay on the chat page) — the same viewer used everywhere else.

### returnTo flow

1. From the chat composer, "بارگذاری سند جدید" → `/documents/upload?source=chat&returnTo=/chat/<id>`.
2. After a successful upload, the done step offers "بازگشت به گفتگو با این سند",
   which returns to the chat with `attachedDocumentId/Name/Mime/Size` params.
3. The chat page reads those params on mount, pre-selects the document into
   the composer tray, and strips the params from the URL. The document is
   **not** auto-sent — the user still writes and sends the message.

## 6. Types

```ts
// @legalir/types
export const MAX_CHAT_ATTACHMENTS = 5;

interface ChatAttachmentRef {
  attachmentId: string;
  documentId: string;
  name: string;
  mime: string;
  sizeBytes: number;
  status: DocumentStatus;
  riskLevel: RiskLevel | null;
  findingCount: number;
  createdAt: string;
}

interface Message {
  // …
  attachments?: ChatAttachmentRef[];
}
```

`ChatAttachmentRef` is metadata only — it never carries `storageKey`,
`extractedText`, or file bytes.

## 7. Tests

`src/lib/__tests__/chat-attachments.test.ts` pins the two guarantees:

- **Reference, not copy** — attaching leaves the document row byte-identical.
- **Ownership** — a foreign document id is rejected and never linked; mixed
  owned/foreign requests link only the owned ids.

It also covers idempotency, the `MAX_CHAT_ATTACHMENTS` cap, metadata-only
refs, grouping by message, deletion cleanup, recent-document scoping, and
context resolution.
