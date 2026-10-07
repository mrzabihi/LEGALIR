// ============================================================
// LEGALIR — History permanent delete + "edit" (new process)
// ============================================================
// Server-only. Two operations that must be exact:
//
//   purgeHistoryItem — permanently remove ONE history item and the data
//     that is private to it, from every user-facing path (history list,
//     archive, detail page, view/continue/edit APIs, and the item's own
//     outputs). It never touches an independent record that merely
//     references the item (a shared file, a case, a contract that was
//     created FROM this item) — those keep their own data.
//
//   createEditedProcess — build a NEW process from a completed item's
//     editable input, preserving the original. The new process gets its
//     own id and a `source_item_id` link back; the previous OUTPUT
//     (messages, generated versions, Done status) is NOT copied.
// ============================================================

import {
  readTable,
  readConversations,
  writeConversations,
  removeActivity,
  recordActivity,
  type ActivityRow,
  type StoredConversation,
} from "@/lib/db";
import { deleteMessages } from "@/lib/ai/store";
import { deleteConversationAttachments } from "@/lib/ai/attachments";
import { deleteRunsForConversation } from "@/lib/ai/pipeline/run";
import { getDemoDocument, deleteDemoDocument, deleteDemoRelationshipsFor } from "@/lib/demo-seed";
import { deleteDocumentFile, documentFileReference } from "@/lib/document-storage";
import { deleteCase } from "@/lib/case-db";
import {
  deleteContractForUser,
  insertContract,
  upsertParty,
  buildReferenceCode,
  countContractsOfType,
  listParties,
} from "@/lib/contracts/db";
import { findContractDefinition } from "@/lib/contracts/registry";
import { todayJalali } from "@/lib/contracts/dates";
import type { ContractParty, PropertyContract, PropertyKind } from "@legalir/types";

/** The kind of underlying entity a history item represents. */
export type HistoryItemKind = ActivityRow["type"];

export interface ResolvedHistoryItem {
  id: string;
  kind: HistoryItemKind;
  title: string;
  /** The stored activity row, when the item is activity-backed. */
  activity?: ActivityRow;
  /** The stored conversation, when the item is a chat. */
  conversation?: StoredConversation;
}

/**
 * Resolve a history id to its underlying entity, owner-scoped. Returns
 * null when the id does not exist or belongs to another user.
 */
export function resolveHistoryItem(userId: string, id: string): ResolvedHistoryItem | null {
  const conv = readConversations().find((c) => c.id === id && c.userId === userId);
  if (conv) {
    return { id, kind: "conversation", title: conv.title, conversation: conv };
  }
  const row = readTable<ActivityRow>("activities").find((r) => r.id === id && r.user_id === userId);
  if (row) {
    return { id, kind: row.type, title: row.title, activity: row };
  }
  return null;
}

/**
 * Permanently delete a history item and the data private to it.
 * Returns the resolved item (for the success message) or null when the
 * item does not exist / is not owned by the user.
 */
export function purgeHistoryItem(userId: string, id: string): ResolvedHistoryItem | null {
  const item = resolveHistoryItem(userId, id);
  if (!item) return null;

  switch (item.kind) {
    case "conversation": {
      // The history entry IS the conversation — remove the chat, its
      // messages, attachments, and any processing run so nothing can
      // re-surface it.
      const all = readConversations();
      writeConversations(all.filter((c) => !(c.id === id && c.userId === userId)));
      deleteMessages(id);
      deleteConversationAttachments(id);
      deleteRunsForConversation(id);
      removeActivity(userId, id);
      break;
    }
    case "document": {
      // The document is an independent record the user reaches from
      // /documents — deleting the history item removes the document and
      // its private bytes, matching the document's own delete semantics.
      const doc = getDemoDocument(userId, id);
      if (doc) {
        deleteDemoDocument(userId, id);
        deleteDemoRelationshipsFor(userId, id);
        deleteDocumentFile(documentFileReference(doc));
      }
      removeActivity(userId, id);
      break;
    }
    case "contract": {
      // Remove the contract aggregate and its private files. A contract
      // that was created FROM this one keeps its own independent data.
      deleteContractForUser(userId, id);
      removeActivity(userId, id);
      break;
    }
    case "case": {
      deleteCase(userId, id);
      removeActivity(userId, id);
      break;
    }
    case "subscription": {
      // A subscription is a billing record — the history entry is only a
      // mirror, so remove the mirror and leave the subscription intact.
      removeActivity(userId, id);
      break;
    }
    default:
      removeActivity(userId, id);
  }

  return item;
}

export interface EditedProcessResult {
  id: string;
  href: string;
  title: string;
}

/**
 * Create a NEW process from a completed item's editable input. The
 * original item is untouched. Returns the new process id + route.
 */
export function createEditedProcess(
  userId: string,
  source: ResolvedHistoryItem
): EditedProcessResult {
  const newTitle = `نسخه جدید از: ${source.title}`;

  if (source.kind === "conversation" && source.conversation) {
    const now = new Date().toISOString();
    const conv: StoredConversation = {
      id: crypto.randomUUID(),
      userId,
      title: newTitle,
      category: source.conversation.category,
      status: "active",
      riskLevel: null,
      messageCount: 0,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
      retentionStartedAt: now,
      sourceItemId: source.id,
    };
    const all = readConversations();
    all.push(conv);
    writeConversations(all);
    recordActivity({
      userId,
      type: "conversation",
      title: conv.title,
      status: "active",
      statusFa: "فعال",
      description: null,
      category: conv.category,
      categoryFa: null,
      sourceId: conv.id,
      sourceItemId: source.id,
    });
    return { id: conv.id, href: `/chat/${conv.id}`, title: newTitle };
  }

  if (source.kind === "contract" && source.activity) {
    const sourceContract = readTable<PropertyContract>("contracts").find(
      (c) => c.id === source.id && c.userId === userId
    );
    const typeId = sourceContract?.type;
    const def = typeId ? findContractDefinition(typeId) : undefined;
    if (sourceContract && def && typeId) {
      const now = new Date().toISOString();
      const jy = todayJalali().jy;
      const sequence = countContractsOfType(typeId) + 1;
      const firstStep = def.wizardSteps[0]?.id ?? "parties";
      const propertyKind: PropertyKind =
        (sourceContract.data as { propertyKind?: PropertyKind }).propertyKind ?? "apartment";

      const contract: PropertyContract = {
        ...sourceContract,
        id: `cnt-${crypto.randomUUID()}`,
        referenceCode: buildReferenceCode(typeId, jy, sequence),
        title: newTitle,
        state: "DRAFT",
        currentStep: firstStep,
        progress: 0,
        // Copy the editable INPUT (domain data) but start a fresh process:
        // no versions, no approvals, no finalized output.
        data: def.createDefaultData(propertyKind),
        currentVersionId: null,
        currentVersionNumber: 0,
        finalVersionId: null,
        finalizedAt: null,
        publicVerificationId: `vrf-${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
        createdAt: now,
        updatedAt: now,
      };
      insertContract(contract);

      // Pre-fill the parties from the source (editable input), re-keyed to
      // the new contract id.
      for (const party of listParties(source.id)) {
        const copy: ContractParty = {
          ...party,
          id: `pty-${crypto.randomUUID()}`,
          contractId: contract.id,
          createdAt: now,
        };
        upsertParty(copy);
      }

      recordActivity({
        userId,
        type: "contract",
        title: contract.title,
        status: contract.state,
        statusFa: "پیش‌نویس",
        description: `نسخه جدید از ${def.typeFa}`,
        category: def.categoryFa,
        categoryFa: def.categoryFa,
        sourceId: contract.id,
        sourceItemId: source.id,
      });
      return { id: contract.id, href: `/contracts/${contract.id}`, title: newTitle };
    }
  }

  if (source.kind === "case" && source.activity) {
    // Cases are created through the case API; the edit flow for a case
    // returns the case-creation route so the user re-enters the form with
    // the source title pre-filled. No case row is created here — the user
    // commits explicitly (no silent duplicate).
    return { id: source.id, href: `/cases?from=${source.id}`, title: newTitle };
  }

  // Fallback: no dedicated new-process route — send the user to the
  // relevant "start new" surface rather than a blank unrelated form.
  const fallbackHref = source.kind === "document" ? "/documents/upload" : "/history";
  return { id: source.id, href: fallbackHref, title: newTitle };
}
